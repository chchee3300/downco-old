use tauri_plugin_shell::ShellExt;

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
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_process::init())
    .plugin(tauri_plugin_updater::Builder::new().build())
    .plugin(tauri_plugin_sorai_converter::init())
    .plugin(tauri_plugin_sorai_downloader::init())
    .invoke_handler(tauri::generate_handler![sidecar_versions])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while building tauri application");
}
