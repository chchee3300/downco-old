//! One-time move of the pre-rename (SORAI Toolkit) app data to downco's
//! folders: presets, menu language, engines.json (config dir) and the
//! WebView storage + downloaded engines (local data dir). Runs at the top of
//! `run()`, so the installer's `--sorai-register-menu` migrates before it
//! writes anything, and the old uninstaller (run right after by the
//! installer hook) finds nothing left to delete.

use std::path::{Path, PathBuf};

pub const OLD_ID: &str = "com.soraitoolkit.hub";

/// The (config, local data) roots Tauri resolves `<identifier>` under.
fn roots() -> Vec<PathBuf> {
  let env = |k: &str| std::env::var_os(k).map(PathBuf::from);
  let home = env("HOME").unwrap_or_default();
  if cfg!(windows) {
    [env("APPDATA"), env("LOCALAPPDATA")].into_iter().flatten().collect()
  } else if cfg!(target_os = "macos") {
    vec![home.join("Library/Application Support")]
  } else {
    vec![env("XDG_CONFIG_HOME").unwrap_or(home.join(".config")), env("XDG_DATA_HOME").unwrap_or(home.join(".local/share"))]
  }
}

/// Only the production build migrates; dev/E2E identifiers never touch real data.
pub fn run(identifier: &str) {
  if identifier != crate::context_menu::PRODUCTION_ID {
    return;
  }
  for root in roots() {
    move_dir(&root.join(OLD_ID), &root.join(identifier));
  }
}

/// Moves `old` to `new` unless `new` already exists; a rename, else
/// (old app still holding a file, other volume) a best-effort copy.
pub fn move_dir(old: &Path, new: &Path) {
  if new.exists() || !old.is_dir() {
    return;
  }
  if std::fs::rename(old, new).is_err() {
    let _ = copy_dir(old, new);
  }
}

fn copy_dir(from: &Path, to: &Path) -> std::io::Result<()> {
  std::fs::create_dir_all(to)?;
  for e in std::fs::read_dir(from)?.flatten() {
    let (src, dst) = (e.path(), to.join(e.file_name()));
    let _ = if e.file_type()?.is_dir() { copy_dir(&src, &dst) } else { std::fs::copy(&src, &dst).map(|_| ()) };
  }
  Ok(())
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn moves_old_data_once_and_never_over_new_data() {
    let d = std::env::temp_dir().join(format!("downco-migrate-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&d);
    let (old, new) = (d.join("old"), d.join("new"));
    std::fs::create_dir_all(old.join("engines/deno")).unwrap();
    std::fs::write(old.join("presets.json"), "[1]").unwrap();
    std::fs::write(old.join("engines/deno/deno.exe"), "x").unwrap();
    move_dir(&old, &new);
    assert_eq!(std::fs::read_to_string(new.join("presets.json")).unwrap(), "[1]");
    assert!(new.join("engines/deno/deno.exe").is_file());
    assert!(!old.exists());
    // A second old copy never overwrites what downco already has.
    std::fs::create_dir_all(&old).unwrap();
    std::fs::write(old.join("presets.json"), "[2]").unwrap();
    move_dir(&old, &new);
    assert_eq!(std::fs::read_to_string(new.join("presets.json")).unwrap(), "[1]");
    let _ = std::fs::remove_dir_all(&d);
  }
}
