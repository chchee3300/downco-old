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

/// video | image | audio | pdf by extension (case-insensitive), as the Converter decides.
pub fn file_type_of(path: &str) -> Option<&'static str> {
  let ext = std::path::Path::new(path).extension()?.to_str()?.to_ascii_lowercase();
  crate::context_menu::INPUT_EXTS.iter().find(|(_, exts)| exts.contains(&ext.as_str())).map(|(t, _)| *t)
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
pub fn save(path: &Path, presets: &[Preset]) -> Result<(), String> {
  let err = |e: std::io::Error| format!("{}: {e}", path.display());
  if let Some(dir) = path.parent() {
    std::fs::create_dir_all(dir).map_err(err)?;
  }
  let tmp = path.with_extension("json.tmp");
  std::fs::write(&tmp, serde_json::to_string_pretty(presets).unwrap()).map_err(err)?;
  std::fs::rename(&tmp, path).map_err(err)
}

/// What the Converter (or the hub's manager) sends to save: no `id` = a new
/// preset; an existing `id` = overwrite it in place (its `labelKey` and list
/// position stay). A blank `name` clears it (a built-in falls back to its label).
#[derive(Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct PresetInput {
  #[serde(default)]
  pub id: Option<String>,
  #[serde(default)]
  pub name: Option<String>,
  pub file_type: String,
  pub format: String,
  pub settings: Value,
}

const FILE_TYPES: [&str; 4] = ["video", "image", "audio", "pdf"];

/// Adds or overwrites; returns the saved preset. New ids are `user-<n>`, which
/// stays inside the `[A-Za-z0-9._-]` set the registry command line needs.
pub fn upsert(list: &mut Vec<Preset>, input: PresetInput) -> Result<Preset, String> {
  if !FILE_TYPES.contains(&input.file_type.as_str()) {
    return Err(format!("unknown file type {:?}", input.file_type));
  }
  if !input.format.starts_with('.') || !input.settings.is_object() {
    return Err("format must be \".ext\" and settings an object".into());
  }
  let name = input.name.map(|n| n.trim().to_string()).filter(|n| !n.is_empty());
  let at = match &input.id {
    Some(id) => Some(list.iter().position(|p| &p.id == id).ok_or_else(|| format!("no preset {id:?}"))?),
    None => None,
  };
  let label_key = at.and_then(|i| list[i].label_key.clone());
  if name.is_none() && label_key.is_none() {
    return Err("a preset needs a name".into());
  }
  let id = match at {
    Some(i) => list[i].id.clone(),
    None => (1..).map(|n| format!("user-{n}")).find(|id| list.iter().all(|p| &p.id != id)).unwrap(),
  };
  let p = Preset { id, name, label_key, file_type: input.file_type, format: input.format, settings: input.settings };
  match at {
    Some(i) => list[i] = p.clone(),
    None => list.push(p.clone()),
  }
  Ok(p)
}

/// The listed ids first, in that order; anything not listed keeps its
/// relative order after them (a stale list never drops a preset).
pub fn reorder(list: Vec<Preset>, ids: &[String]) -> Vec<Preset> {
  let (mut listed, rest): (Vec<_>, Vec<_>) = list.into_iter().partition(|p| ids.contains(&p.id));
  listed.sort_by_key(|p| ids.iter().position(|i| i == &p.id));
  listed.extend(rest);
  listed
}

/// Auto-generated name, e.g. "MP4・畫質 70・30fps": the format, then only the
/// settings that differ from the Converter's defaults.
pub fn suggest_name(file_type: &str, format: &str, settings: &Value, lang: &str) -> String {
  let zh = lang == "zh-TW";
  let num = |k: &str| settings[k].as_f64();
  let mut parts = vec![if file_type == "pdf" { "PDF".to_string() } else { format.trim_start_matches('.').to_uppercase() }];
  let quality = |q: f64| if zh { format!("畫質 {q}") } else { format!("Quality {q}") };
  let speed = num("speed").filter(|s| *s != 1.0).map(|s| format!("{s}×"));
  match file_type {
    "video" => {
      if settings["targetSizeMode"] == true {
        let mb = num("targetSizeMB").unwrap_or(0.0);
        parts.push(if zh { format!("{mb}MB 以下") } else { format!("Under {mb} MB") });
      } else {
        let codec = match settings["codec"].as_str() {
          Some("libx265") => Some("H.265"),
          Some("libvpx-vp9") => Some("VP9"),
          Some("libsvtav1") => Some("AV1"),
          _ => None,
        };
        if let Some(c) = codec.filter(|_| format != ".gif") {
          parts.push(c.into());
        }
        if let Some(q) = num("quality").filter(|q| *q != 100.0) {
          parts.push(quality(q));
        }
      }
      if let Some(f) = num("fps") {
        parts.push(format!("{}fps", f.round()));
      }
      parts.extend(speed);
    }
    "image" if format != ".pdf" => {
      if let Some(q) = num("quality").filter(|q| *q != 85.0) {
        parts.push(quality(q));
      }
      if let Some(s) = num("scale").filter(|s| *s != 100.0) {
        parts.push(if zh { format!("縮放 {s}%") } else { format!("Scale {s}%") });
      }
    }
    "audio" => {
      if let Some(b) = settings["bitrate"].as_str().filter(|b| *b != "320k" && ![".flac", ".wav"].contains(&format)) {
        parts.push(b.into());
      }
      parts.extend(speed);
    }
    "pdf" => parts.push(
      match (settings["optimize"].as_str() == Some("compress"), zh) {
        (true, true) => "壓縮",
        (true, false) => "Compress",
        (false, true) => "線性化",
        (false, false) => "Linearize",
      }
      .into(),
    ),
    _ => {}
  }
  parts.join(if zh { "・" } else { " · " })
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

  fn input(id: Option<&str>, name: Option<&str>) -> PresetInput {
    PresetInput {
      id: id.map(Into::into),
      name: name.map(Into::into),
      file_type: "audio".into(),
      format: ".mp3".into(),
      settings: json!({ "format": ".mp3", "bitrate": "192k", "speed": 1.0 }),
    }
  }

  #[test]
  fn upsert_adds_new_presets_with_registry_safe_ids() {
    let mut list = builtins();
    let a = upsert(&mut list, input(None, Some("  MP3・192k "))).unwrap();
    let b = upsert(&mut list, input(None, Some("second"))).unwrap();
    assert_eq!((a.id.as_str(), a.name.as_deref(), a.label_key.as_deref()), ("user-1", Some("MP3・192k"), None));
    assert_eq!(b.id, "user-2");
    assert_eq!(list.len(), 22);
    assert_eq!(list.last().unwrap(), &b);
    // A freed id is reused; it's always [A-Za-z0-9._-].
    list.retain(|p| p.id != "user-1");
    assert_eq!(upsert(&mut list, input(None, Some("third"))).unwrap().id, "user-1");
  }

  #[test]
  fn upsert_overwrites_in_place_keeping_label_key() {
    let mut list = builtins();
    let p = upsert(&mut list, input(Some("audio-to-mp3"), Some("Mine"))).unwrap();
    assert_eq!((p.id.as_str(), p.label_key.as_deref(), p.name.as_deref()), ("audio-to-mp3", Some("preset.convertTo"), Some("Mine")));
    assert_eq!(list.len(), 20);
    assert_eq!(list.iter().position(|q| q.id == "audio-to-mp3"), Some(14));
    assert_eq!(list[14].settings["bitrate"], "192k");
    // Blank name on a built-in goes back to its label.
    let p = upsert(&mut list, input(Some("audio-to-mp3"), Some(" "))).unwrap();
    assert_eq!(p.name, None);
  }

  #[test]
  fn upsert_rejects_bad_input() {
    let mut list = builtins();
    assert!(upsert(&mut list, input(None, None)).is_err(), "user preset without a name");
    assert!(upsert(&mut list, input(None, Some(""))).is_err());
    assert!(upsert(&mut list, input(Some("nope"), Some("x"))).is_err(), "unknown id");
    let mut bad = input(None, Some("x"));
    bad.file_type = "text".into();
    assert!(upsert(&mut list, bad).is_err());
    let mut bad = input(None, Some("x"));
    bad.settings = json!(null);
    assert!(upsert(&mut list, bad).is_err());
    assert_eq!(list, builtins());
  }

  #[test]
  fn reorder_follows_ids_and_never_drops_presets() {
    let ids = |l: &[Preset]| l.iter().map(|p| p.id.clone()).collect::<Vec<_>>();
    let list: Vec<Preset> = builtins().into_iter().take(3).collect(); // mp4, mkv, webm
    let out = reorder(list, &["video-to-webm".into(), "video-to-mp4".into(), "ghost".into()]);
    assert_eq!(ids(&out), ["video-to-webm", "video-to-mp4", "video-to-mkv"]);
  }

  #[test]
  fn suggested_names_list_format_then_non_default_settings() {
    let n = |t: &str, f: &str, s: Value, l: &str| suggest_name(t, f, &s, l);
    assert_eq!(n("video", ".mp4", default_settings("video", ".mp4"), "zh-TW"), "MP4");
    let mut v = default_settings("video", ".mp4");
    v["quality"] = json!(70);
    v["fps"] = json!(29.97);
    assert_eq!(n("video", ".mp4", v.clone(), "zh-TW"), "MP4・畫質 70・30fps");
    v["codec"] = json!("libx265");
    v["speed"] = json!(1.5);
    assert_eq!(n("video", ".mkv", v.clone(), "en"), "MKV · H.265 · Quality 70 · 30fps · 1.5×");
    assert_eq!(n("video", ".gif", v.clone(), "en"), "GIF · Quality 70 · 30fps · 1.5×", "no codec on gif");
    v["targetSizeMode"] = json!(true);
    v["targetSizeMB"] = json!(25);
    v["fps"] = json!(null);
    v["speed"] = json!(1.0);
    assert_eq!(n("video", ".mp4", v, "zh-TW"), "MP4・25MB 以下", "target size ignores codec/quality");

    assert_eq!(n("image", ".webp", json!({ "quality": 70, "scale": 50 }), "zh-TW"), "WEBP・畫質 70・縮放 50%");
    assert_eq!(n("image", ".pdf", json!({ "quality": 70, "scale": 50 }), "en"), "PDF", "img2pdf ignores both");
    assert_eq!(n("audio", ".mp3", json!({ "bitrate": "192k", "speed": 1.0 }), "en"), "MP3 · 192k");
    assert_eq!(n("audio", ".flac", json!({ "bitrate": "192k", "speed": 0.5 }), "en"), "FLAC · 0.5×", "no bitrate on lossless");
    assert_eq!(n("pdf", ".pdf", json!({ "optimize": "compress" }), "zh-TW"), "PDF・壓縮");
    assert_eq!(n("pdf", ".pdf", json!({ "optimize": "linearize" }), "en"), "PDF · Linearize");
  }
}
