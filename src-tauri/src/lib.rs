mod self_install;

use std::sync::Mutex;
use tauri::{Emitter, Manager};
use tauri_plugin_shell::ShellExt;

// argv of the cold start plus every launch a second instance forwarded;
// the frontend drains it (useSingleInstance.js) on mount and on each
// `sorai://launch` event, so launches before the listener exists aren't lost.
struct LaunchQueue(Mutex<Vec<Vec<String>>>);

#[tauri::command]
fn take_launch_args(queue: tauri::State<LaunchQueue>) -> Vec<Vec<String>> {
  std::mem::take(&mut *queue.0.lock().unwrap())
}

// Phase 0 probe: proves both sidecars resolve and execute from the bundle.
#[tauri::command]
async fn sidecar_versions(app: tauri::AppHandle) -> Result<Vec<String>, String> {
  let mut out = Vec::new();
  for (name, arg) in [("ffmpeg", "-version"), ("yt-dlp", "--version")] {
    let res = app
      .shell()
      .sidecar(name)
      .map_err(|e| e.to_string())?
      .arg(arg)
      .output()
      .await
      .map_err(|e| e.to_string())?;
    let first = String::from_utf8_lossy(&res.stdout).lines().next().unwrap_or("").to_string();
    out.push(format!("{name}: {first}"));
  }
  Ok(out)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .manage(LaunchQueue(Mutex::new(vec![std::env::args().collect()])))
    // Must be the first plugin. Keyed on the app identifier: scripts/tauri-dev.mjs
    // gives dev/E2E builds a per-CDP-port identifier so worktrees don't collide.
    .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
      app.state::<LaunchQueue>().0.lock().unwrap().push(argv);
      let _ = app.emit("sorai://launch", ());
      if let Some(w) = app.get_webview_window("main") {
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
      }
    }))
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_process::init())
    .plugin(tauri_plugin_updater::Builder::new().build())
    .plugin(tauri_plugin_notification::init())
    .plugin(tauri_plugin_sorai_converter::init())
    .plugin(tauri_plugin_sorai_downloader::init())
    .invoke_handler(tauri::generate_handler![sidecar_versions, take_launch_args])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      // macOS Finder Quick Actions / GNOME Nautilus Scripts (no-op elsewhere).
      std::thread::spawn(self_install::install);
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while building tauri application");
}
