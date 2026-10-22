//! Right-click presets: the hub-owned store (`presets.json` in the app
//! config dir) and the built-in list used while that file doesn't exist.
//! `settings` is opaque here: it has the shape of the Converter's
//! `settings[fileType]` and goes straight into its plugin's `start_convert`.

use std::path::Path;

use serde::{Deserialize, Serialize};
use serde_json::{Value, json};

pub const FILE_NAME: &str = "presets.json";

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Preset {
  /// Stable; goes into the registry command line (`--sorai-preset=<id>`).
  pub id: String,
  /// User-given name. Built-ins have none and use `label_key` instead.
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub name: Option<String>,
  /// i18n key for built-ins: `preset.convertTo` (param: format),
  /// `preset.compressUnder` (param: settings.targetSizeMB), `preset.compressPdf`.
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub label_key: Option<String>,
  /// video | image | audio | pdf
  pub file_type: String,
  /// Output extension, dot included (".pdf" for pdf).
  pub format: String,
  pub settings: Value,
}

// Mirrors the Converter's useSettings.js (formats + DEFAULT_* blocks) by hand.
const VIDEO_FORMATS: [&str; 5] = [".mp4", ".mkv", ".webm", ".avi", ".gif"];
const IMAGE_FORMATS: [&str; 6] = [".jpg", ".png", ".webp", ".avif", ".ico", ".pdf"];
const AUDIO_FORMATS: [&str; 5] = [".mp3", ".wav", ".aac", ".flac", ".ogg"];
const TARGET_SIZE_MB: [u32; 3] = [5, 25, 50];

fn default_settings(file_type: &str, format: &str) -> Value {
  match file_type {
    "video" => json!({ "format": format, "codec": "libx264", "quality": 100, "upscale": false, "fps": null,
      "fpsUpscale": false, "speed": 1.0, "targetSizeMode": false, "targetSizeMB": null }),
    "image" => json!({ "format": format, "quality": 85, "scale": 100 }),
    "audio" => json!({ "format": format, "bitrate": "320k", "speed": 1.0 }),
    _ => json!({ "optimize": "linearize" }),
  }
}

fn builtin(id: String, label_key: &str, file_type: &str, format: &str, settings: Value) -> Preset {
  Preset { id, name: None, label_key: Some(label_key.into()), file_type: file_type.into(), format: format.into(), settings }
}

/// What the old fixed menu offered: "convert to X" per type, video
/// compress-under 5/25/50 MB (target-size mode), compress PDF.
pub fn builtins() -> Vec<Preset> {
  let mut out = vec![];
  for (file_type, formats) in [("video", &VIDEO_FORMATS[..]), ("image", &IMAGE_FORMATS[..]), ("audio", &AUDIO_FORMATS[..])] {
    for f in formats {
      out.push(builtin(format!("{file_type}-to-{}", &f[1..]), "preset.convertTo", file_type, f, default_settings(file_type, f)));
    }
    if file_type == "video" {
      for mb in TARGET_SIZE_MB {
        let mut s = default_settings("video", ".mp4");
        s["targetSizeMode"] = json!(true);
        s["targetSizeMB"] = json!(mb);
        out.push(builtin(format!("video-under-{mb}mb"), "preset.compressUnder", "video", ".mp4", s));
      }
    }
  }
  out.push(builtin("pdf-compress".into(), "preset.compressPdf", "pdf", ".pdf", json!({ "optimize": "compress" })));
  out
}

// The Converter's input lists (useFileManager.js), mirrored by hand.
const INPUT_EXTS: [(&str, &[&str]); 4] = [
  ("video", &["mp4", "mkv", "avi", "mov", "webm"]),
  ("image", &["jpg", "jpeg", "png", "webp", "avif", "gif", "ico"]),
  ("audio", &["mp3", "wav", "aac", "flac", "ogg"]),
  ("pdf", &["pdf"]),
];

/// video | image | audio | pdf by extension (case-insensitive), as the Converter decides.
pub fn file_type_of(path: &str) -> Option<&'static str> {
  let ext = std::path::Path::new(path).extension()?.to_str()?.to_ascii_lowercase();
  INPUT_EXTS.iter().find(|(_, exts)| exts.contains(&ext.as_str())).map(|(t, _)| *t)
}

/// Whether a background launch converts `path` with `preset` or marks it
/// skipped. Only the type matters: an input already in the target format
/// is still converted (re-encoded with the preset's settings, `_converted`).
pub fn applies(preset: &Preset, path: &str) -> bool {
  file_type_of(path) == Some(preset.file_type.as_str())
}

/// The store (a JSON array of presets); built-ins when the file doesn't exist.
pub fn load(path: &Path) -> Result<Vec<Preset>, String> {
  match std::fs::read_to_string(path) {
    Ok(s) => serde_json::from_str(&s).map_err(|e| format!("{}: {e}", path.display())),
    Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(builtins()),
    Err(e) => Err(format!("{}: {e}", path.display())),
  }
}

/// Writes the whole list (temp file + rename, so a crash never leaves half a file).
/// No command writes yet: the edit commands (ticket 04) will.
#[allow(dead_code)]
pub fn save(path: &Path, presets: &[Preset]) -> Result<(), String> {
  let err = |e: std::io::Error| format!("{}: {e}", path.display());
  if let Some(dir) = path.parent() {
    std::fs::create_dir_all(dir).map_err(err)?;
  }
  let tmp = path.with_extension("json.tmp");
  std::fs::write(&tmp, serde_json::to_string_pretty(presets).unwrap()).map_err(err)?;
  std::fs::rename(&tmp, path).map_err(err)
}

#[cfg(test)]
mod tests {
  use super::*;

  fn tmp_dir(name: &str) -> std::path::PathBuf {
    let d = std::env::temp_dir().join(format!("sorai-presets-test-{name}-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&d);
    d
  }

  #[test]
  fn builtins_match_the_old_fixed_menu() {
    let ids: Vec<String> = builtins().into_iter().map(|p| p.id).collect();
    assert_eq!(ids, [
      "video-to-mp4", "video-to-mkv", "video-to-webm", "video-to-avi", "video-to-gif",
      "video-under-5mb", "video-under-25mb", "video-under-50mb",
      "image-to-jpg", "image-to-png", "image-to-webp", "image-to-avif", "image-to-ico", "image-to-pdf",
      "audio-to-mp3", "audio-to-wav", "audio-to-aac", "audio-to-flac", "audio-to-ogg",
      "pdf-compress",
    ]);
  }

  #[test]
  fn builtin_settings_are_converter_defaults() {
    let all = builtins();
    let get = |id: &str| all.iter().find(|p| p.id == id).unwrap().clone();

    let ogg = get("audio-to-ogg");
    assert_eq!((ogg.file_type.as_str(), ogg.format.as_str(), ogg.label_key.as_deref()), ("audio", ".ogg", Some("preset.convertTo")));
    assert_eq!(ogg.settings, json!({ "format": ".ogg", "bitrate": "320k", "speed": 1.0 }));

    let webp = get("image-to-webp");
    assert_eq!(webp.settings, json!({ "format": ".webp", "quality": 85, "scale": 100 }));

    let mkv = get("video-to-mkv");
    assert_eq!(mkv.settings["format"], ".mkv");
    assert_eq!(mkv.settings["codec"], "libx264");
    assert_eq!(mkv.settings["quality"], 100);
    assert_eq!(mkv.settings["targetSizeMode"], false);

    let small = get("video-under-25mb");
    assert_eq!((small.format.as_str(), small.label_key.as_deref()), (".mp4", Some("preset.compressUnder")));
    assert_eq!((small.settings["targetSizeMode"].clone(), small.settings["targetSizeMB"].clone()), (json!(true), json!(25)));

    let pdf = get("pdf-compress");
    assert_eq!((pdf.file_type.as_str(), pdf.settings.clone()), ("pdf", json!({ "optimize": "compress" })));
    assert!(all.iter().all(|p| p.name.is_none()));
  }

  #[test]
  fn presets_apply_only_to_their_file_type() {
    let all = builtins();
    let get = |id: &str| all.iter().find(|p| p.id == id).unwrap();
    let mp4 = get("video-to-mp4");
    assert!(applies(mp4, r"C:\片 段.MOV"));
    assert!(applies(mp4, "a.mp4"), "same-format input is converted, not skipped");
    assert!(!applies(mp4, "a.mp3"));
    assert!(!applies(mp4, "a.gif"), "gif is an image input");
    assert!(!applies(mp4, "noext"));
    assert!(!applies(mp4, "a.txt"));
    assert!(applies(get("image-to-pdf"), "a.jpeg"));
    assert!(!applies(get("image-to-pdf"), "a.pdf"));
    assert!(applies(get("pdf-compress"), "a.PDF"));
    assert!(applies(get("audio-to-ogg"), "a.flac"));
    assert!(!applies(get("audio-to-ogg"), r"folder.mp3\inner"));
  }

  #[test]
  fn missing_store_loads_builtins() {
    let d = tmp_dir("missing");
    assert_eq!(load(&d.join(FILE_NAME)).unwrap(), builtins());
  }

  #[test]
  fn save_then_load_round_trips_and_creates_the_dir() {
    let d = tmp_dir("roundtrip");
    let path = d.join("nested").join(FILE_NAME);
    let mine = Preset {
      id: "user-1".into(),
      name: Some("MP4・畫質 70".into()),
      label_key: None,
      file_type: "video".into(),
      format: ".mp4".into(),
      settings: json!({ "format": ".mp4", "codec": "libx264", "quality": 70, "speed": 1.0, "fps": null }),
    };
    let list = vec![mine.clone(), builtins()[0].clone()];
    save(&path, &list).unwrap();
    assert_eq!(load(&path).unwrap(), list);
    // Optional fields stay out of the file rather than being written as null.
    let raw = std::fs::read_to_string(&path).unwrap();
    assert!(!raw.contains("labelKey\": null") && !raw.contains("\"name\": null"));
    save(&path, &[]).unwrap(); // an emptied list stays empty, not back to built-ins
    assert_eq!(load(&path).unwrap(), vec![]);
    let _ = std::fs::remove_dir_all(&d);
  }

  #[test]
  fn corrupt_store_is_an_error_not_silently_builtins() {
    let d = tmp_dir("corrupt");
    std::fs::create_dir_all(&d).unwrap();
    std::fs::write(d.join(FILE_NAME), "{not json").unwrap();
    assert!(load(&d.join(FILE_NAME)).is_err());
    let _ = std::fs::remove_dir_all(&d);
  }
}
