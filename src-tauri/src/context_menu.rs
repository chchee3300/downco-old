//! Windows Explorer right-click menu, written by the app from the current
//! presets and language: `entries()` is the pure part (what to write),
//! `write()` the thin registry layer. Classic cascading verbs under
//! `HKCU\<root>\.<ext>\shell\SORAIToolkit`: the presets that apply to the
//! extension's type (list order), then (separator) "Open in SORAI Toolkit…"
//! and "Manage presets…".

use std::collections::HashMap;

use serde::Serialize;

use crate::presets::Preset;

/// Input extension -> type. Mirrors the Converter's useFileManager.js
/// (VIDEO_EXTS/IMAGE_EXTS/AUDIO_EXTS/PDF_EXTS) by hand.
pub const INPUT_EXTS: [(&str, &[&str]); 4] = [
  ("video", &["mp4", "mkv", "avi", "mov", "webm"]),
  ("image", &["jpg", "jpeg", "png", "webp", "avif", "gif", "ico"]),
  ("audio", &["mp3", "wav", "aac", "flac", "ogg"]),
  ("pdf", &["pdf"]),
];

pub const MENU_KEY: &str = "SORAIToolkit";
pub const PRODUCTION_ID: &str = "com.soraitoolkit.hub";
/// Language of the menu `--sorai-register-menu` (the installer) writes.
pub const INSTALL_LANG: &str = "zh-TW";
/// ECF_SEPARATORBEFORE: a separator above "Open in SORAI Toolkit…".
const SEPARATOR_BEFORE: u32 = 0x20;

// Single source of truth for these labels: the hub's dict.js imports the same file.
const STRINGS: &str = include_str!("../../src/i18n/menu-strings.json");

#[derive(Serialize, Debug, PartialEq, Clone)]
#[serde(untagged)]
pub enum RegData {
  Str(String),
  Dword(u32),
}

/// One registry value; `key` is relative to the classes root.
#[derive(Serialize, Debug, PartialEq, Clone)]
pub struct RegValue {
  pub key: String,
  pub name: String,
  pub data: RegData,
}

/// The real menu lives under `Software\Classes` only for the production
/// identifier; dev/E2E builds (`com.soraitoolkit.hub.dev<port>`) write a
/// scoped tree Explorer never reads, so tests can't touch the installed app's menu.
pub fn classes_root(identifier: &str) -> String {
  if identifier == PRODUCTION_ID {
    r"Software\Classes".into()
  } else {
    format!(r"Software\SORAI Toolkit Dev\{identifier}\Classes")
  }
}

fn strings(lang: &str) -> HashMap<String, String> {
  let mut all: HashMap<String, HashMap<String, String>> = serde_json::from_str(STRINGS).expect("menu-strings.json");
  all.remove(lang).or_else(|| all.remove("en")).unwrap_or_default()
}

fn label(p: &Preset, s: &HashMap<String, String>) -> String {
  if let Some(name) = &p.name {
    return name.clone();
  }
  match p.label_key.as_ref().and_then(|k| s.get(k)) {
    Some(t) => t
      .replace("{format}", &p.format.trim_start_matches('.').to_uppercase())
      .replace("{mb}", &p.settings["targetSizeMB"].to_string()),
    None => p.id.clone(),
  }
}

/// `&` is a menu accelerator prefix; `&&` shows a literal one.
fn menu_text(s: &str) -> String {
  s.replace('&', "&&")
}

/// Ids go unquoted into the command line, and `%` would be taken for a
/// shell placeholder, so only these characters are allowed.
fn valid_id(id: &str) -> bool {
  !id.is_empty() && id.chars().all(|c| c.is_ascii_alphanumeric() || "-_.".contains(c))
}

/// A built-in "convert to X" isn't offered on an X file (.jpeg counts as .jpg).
/// User presets always are: re-encoding at other settings is legitimate.
fn applies(p: &Preset, file_type: &str, ext: &str) -> bool {
  let own = if ext == "jpeg" { ".jpg".to_string() } else { format!(".{ext}") };
  p.file_type == file_type && valid_id(&p.id) && !(p.label_key.as_deref() == Some("preset.convertTo") && p.format == own)
}

/// Everything to write, per input extension, in order.
pub fn entries(presets: &[Preset], lang: &str, exe: &str) -> Vec<RegValue> {
  let s = strings(lang);
  let mut out = vec![];
  let mut put = |key: &str, name: &str, data: RegData| out.push(RegValue { key: key.into(), name: name.into(), data });
  let str = |v: &str| RegData::Str(v.into());
  for (file_type, exts) in INPUT_EXTS {
    for ext in exts {
      let root = format!(r".{ext}\shell\{MENU_KEY}");
      put(&root, "MUIVerb", str("SORAI Toolkit"));
      put(&root, "Icon", RegData::Str(format!("\"{exe}\",0")));
      put(&root, "SubCommands", str(""));
      // Explorer orders static verbs by key name, hence the zero-padded index.
      // ponytail: 3 digits, order breaks past 998 presets.
      let mut items: Vec<(String, String, Option<u32>)> = presets
        .iter()
        .filter(|p| applies(p, file_type, ext))
        .map(|p| (label(p, &s), format!("\"{exe}\" --sorai-preset={} \"%1\"", p.id), None))
        .collect();
      items.push((s["menu.open"].clone(), format!("\"{exe}\" --sorai-open \"%1\""), Some(SEPARATOR_BEFORE)));
      items.push((s["menu.presets"].clone(), format!("\"{exe}\" --sorai-presets"), None));
      for (i, (text, command, flags)) in items.into_iter().enumerate() {
        let verb = format!(r"{root}\shell\{:03}", i + 1);
        put(&verb, "MUIVerb", RegData::Str(menu_text(&text)));
        if let Some(f) = flags {
          put(&verb, "CommandFlags", RegData::Dword(f));
        }
        put(&format!(r"{verb}\command"), "", RegData::Str(command));
      }
    }
  }
  out
}

/// Deletes every extension's whole `SORAIToolkit` subtree (2.0.0's fixed menu
/// included), then writes `values`. No diffing.
#[cfg(windows)]
pub fn write(root: &str, values: &[RegValue]) -> std::io::Result<()> {
  use winreg::{RegKey, enums::HKEY_CURRENT_USER};
  let hkcu = RegKey::predef(HKEY_CURRENT_USER);
  for (_, exts) in INPUT_EXTS {
    for ext in exts {
      match hkcu.delete_subkey_all(format!(r"{root}\.{ext}\shell\{MENU_KEY}")) {
        Err(e) if e.kind() != std::io::ErrorKind::NotFound => return Err(e),
        _ => {}
      }
    }
  }
  for v in values {
    let (key, _) = hkcu.create_subkey(format!(r"{root}\{}", v.key))?;
    match &v.data {
      RegData::Str(s) => key.set_value(&v.name, s)?,
      RegData::Dword(d) => key.set_value(&v.name, d)?,
    }
  }
  Ok(())
}

pub fn exe_path() -> Result<String, String> {
  Ok(std::env::current_exe().map_err(|e| e.to_string())?.display().to_string())
}

/// Loads the presets and rewrites the menu (no-op off Windows).
pub fn register(presets_path: &std::path::Path, identifier: &str, lang: &str) -> Result<(), String> {
  let values = entries(&crate::presets::load(presets_path)?, lang, &exe_path()?);
  #[cfg(windows)]
  write(&classes_root(identifier), &values).map_err(|e| e.to_string())?;
  let _ = (values, identifier);
  Ok(())
}

#[cfg(test)]
mod tests {
  use super::*;
  use crate::presets::builtins;
  use serde_json::json;

  const EXE: &str = r"C:\Users\A B\AppData\Local\SORAI Toolkit\sorai-toolkit.exe";

  fn get<'a>(v: &'a [RegValue], key: &str, name: &str) -> Option<&'a RegData> {
    v.iter().find(|r| r.key == key && r.name == name).map(|r| &r.data)
  }
  fn s(v: &str) -> Option<RegData> {
    Some(RegData::Str(v.into()))
  }
  /// (MUIVerb, command) of each submenu item of `.ext`, in order.
  fn items(v: &[RegValue], ext: &str) -> Vec<(String, String)> {
    (1..)
      .map(|i| format!(r".{ext}\shell\SORAIToolkit\shell\{i:03}"))
      .map_while(|k| match (get(v, &k, "MUIVerb"), get(v, &format!(r"{k}\command"), "")) {
        (Some(RegData::Str(l)), Some(RegData::Str(c))) => Some((l.clone(), c.clone())),
        _ => None,
      })
      .collect()
  }
  fn user(id: &str, name: &str, file_type: &str, format: &str) -> Preset {
    Preset { id: id.into(), name: Some(name.into()), label_key: None, file_type: file_type.into(), format: format.into(), settings: json!({}) }
  }

  #[test]
  fn every_input_extension_gets_the_cascade_root() {
    let v = entries(&builtins(), "en", EXE);
    for ext in ["mp4", "mkv", "avi", "mov", "webm", "jpg", "jpeg", "png", "webp", "avif", "gif", "ico", "mp3", "wav", "aac", "flac", "ogg", "pdf"] {
      let root = format!(r".{ext}\shell\SORAIToolkit");
      assert_eq!(get(&v, &root, "MUIVerb"), s("SORAI Toolkit").as_ref(), "{ext}");
      assert_eq!(get(&v, &root, "SubCommands"), s("").as_ref());
      assert_eq!(get(&v, &root, "Icon"), s(&format!("\"{EXE}\",0")).as_ref());
    }
    assert!(!v.iter().any(|r| r.key.starts_with(".txt")));
  }

  #[test]
  fn mp4_menu_in_english() {
    let v = entries(&builtins(), "en", EXE);
    let cmd = |flag: &str| format!("\"{EXE}\" {flag} \"%1\"");
    assert_eq!(
      items(&v, "mp4"),
      vec![
        ("Convert to MKV".into(), cmd("--sorai-preset=video-to-mkv")),
        ("Convert to WEBM".into(), cmd("--sorai-preset=video-to-webm")),
        ("Convert to AVI".into(), cmd("--sorai-preset=video-to-avi")),
        ("Convert to GIF".into(), cmd("--sorai-preset=video-to-gif")),
        ("Compress under 5 MB".into(), cmd("--sorai-preset=video-under-5mb")),
        ("Compress under 25 MB".into(), cmd("--sorai-preset=video-under-25mb")),
        ("Compress under 50 MB".into(), cmd("--sorai-preset=video-under-50mb")),
        ("Open in SORAI Toolkit…".into(), cmd("--sorai-open")),
        ("Manage presets…".into(), format!("\"{EXE}\" --sorai-presets")),
      ]
    );
    // Separator above "Open…" only.
    assert_eq!(get(&v, r".mp4\shell\SORAIToolkit\shell\008", "CommandFlags"), Some(&RegData::Dword(0x20)));
    assert_eq!(v.iter().filter(|r| r.key.starts_with(".mp4\\") && r.name == "CommandFlags").count(), 1);
  }

  #[test]
  fn chinese_labels_and_types_follow_the_converter() {
    let v = entries(&builtins(), "zh-TW", EXE);
    let labels = |ext| items(&v, ext).into_iter().map(|(l, _)| l).collect::<Vec<_>>();
    assert_eq!(labels("pdf"), ["壓縮 PDF", "在 SORAI Toolkit 中開啟…", "設定預設…"]);
    // .gif is an image input (not video); .jpeg drops "to JPG" like .jpg does.
    assert_eq!(labels("gif"), ["轉成 JPG", "轉成 PNG", "轉成 WEBP", "轉成 AVIF", "轉成 ICO", "轉成 PDF", "在 SORAI Toolkit 中開啟…", "設定預設…"]);
    assert_eq!(labels("jpeg")[0], "轉成 PNG");
    assert_eq!(labels("mov")[0], "轉成 MP4");
    assert_eq!(labels("mov")[5], "快速壓縮到 5MB 以下");
    assert_eq!(labels("ogg"), ["轉成 MP3", "轉成 WAV", "轉成 AAC", "轉成 FLAC", "在 SORAI Toolkit 中開啟…", "設定預設…"]);
    // Unknown language falls back to English.
    assert_eq!(items(&entries(&builtins(), "fr", EXE), "pdf")[0].0, "Compress PDF");
  }

  #[test]
  fn user_presets_keep_their_name_order_and_escaping() {
    let presets = vec![
      user("user-2", "MP3・128k & \"小聲\"", "audio", ".mp3"),
      user("user-1", "影片", "video", ".mp4"),
      user("bad id%1", "Never shown", "audio", ".wav"),
    ];
    let got = items(&entries(&presets, "en", EXE), "mp3");
    // Same-format user preset still offered; '&' doubled; quotes kept as-is; invalid id skipped.
    assert_eq!(got[0], ("MP3・128k && \"小聲\"".into(), format!("\"{EXE}\" --sorai-preset=user-2 \"%1\"")));
    assert_eq!(got.len(), 3);
    assert_eq!(items(&entries(&presets, "en", EXE), "mp4")[0].0, "影片");
  }

  #[test]
  fn uninstaller_deletes_every_extension_menu() {
    let nsh = include_str!("../../packaging/windows/installer-hooks.nsh");
    for (_, exts) in INPUT_EXTS {
      for ext in exts {
        assert!(nsh.contains(&format!(r#"DeleteRegKey HKCU "Software\Classes\.{ext}\shell\SORAIToolkit""#)), "{ext}");
        assert!(nsh.contains(&format!(r#"DeleteRegKey /ifempty HKCU "Software\Classes\.{ext}\shell""#)), "{ext}");
      }
    }
    assert!(nsh.contains("--sorai-register-menu"));
  }

  #[test]
  fn only_the_production_build_writes_the_real_menu() {
    assert_eq!(classes_root("com.soraitoolkit.hub"), r"Software\Classes");
    assert_eq!(classes_root("com.soraitoolkit.hub.dev9249"), r"Software\SORAI Toolkit Dev\com.soraitoolkit.hub.dev9249\Classes");
  }
}
