mod presets;
mod self_install;

use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use serde::{Deserialize, Serialize};
use tauri::{Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

// argv of the cold start plus every launch a second instance forwarded;
// the frontend drains it (useSingleInstance.js) on mount and on each
// `sorai://launch` event, so launches before the listener exists aren't lost.
struct LaunchQueue(Mutex<Vec<Vec<String>>>);

#[tauri::command]
fn take_launch_args(queue: tauri::State<LaunchQueue>) -> Vec<Vec<String>> {
  std::mem::take(&mut *queue.0.lock().unwrap())
}

/// A right-click preset launch converts in the progress window only; the
/// main window stays as it is (hidden on a cold start).
fn is_background_launch(argv: &[String]) -> bool {
  argv.iter().any(|a| a.starts_with("--sorai-preset="))
}

/// Whether the cold start was background-only (useSingleInstance.js then
/// doesn't reveal the main window).
struct ColdBackground(bool);

#[tauri::command]
fn launch_is_background(cold: tauri::State<ColdBackground>) -> bool {
  cold.0
}

fn presets_path<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> Result<std::path::PathBuf, String> {
  Ok(app.path().app_config_dir().map_err(|e| e.to_string())?.join(presets::FILE_NAME))
}

#[tauri::command]
fn list_presets(app: tauri::AppHandle) -> Result<Vec<presets::Preset>, String> {
  presets::load(&presets_path(&app)?)
}

/// One debounced launch batch for the progress window (main -> Rust -> progress).
#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ProgressBatch {
  preset_id: String,
  files: Vec<String>,
}

/// Batches waiting for the progress window to drain (take_progress_jobs), so
/// none are lost while it's still loading -- same idea as LaunchQueue.
#[derive(Default)]
struct ProgressQueue(Mutex<Vec<ProgressBatch>>);

const PROGRESS: &str = "progress";

/// Queues a batch and opens the progress window if it isn't open. Async:
/// creating a window from a sync command deadlocks on Windows.
#[tauri::command]
async fn queue_background(app: tauri::AppHandle, preset_id: String, files: Vec<String>) -> Result<(), String> {
  app.state::<ProgressQueue>().0.lock().unwrap().push(ProgressBatch { preset_id, files });
  if app.get_webview_window(PROGRESS).is_some() {
    let _ = app.emit_to(PROGRESS, "sorai://progress-jobs", ());
    return Ok(());
  }
  // Same frontend; src/main.jsx renders ProgressApp for this label.
  WebviewWindowBuilder::new(&app, PROGRESS, WebviewUrl::App("index.html".into()))
    .title("SORAI Toolkit")
    .inner_size(420.0, 300.0)
    .resizable(false)
    .center()
    .build()
    .map_err(|e| e.to_string())?;
  Ok(())
}

/// One file for the progress window: its preset (None = unknown id, an
/// error row) and whether that preset applies (false = a "skipped" row).
#[derive(Serialize)]
struct ProgressJob {
  path: String,
  preset: Option<presets::Preset>,
  applies: bool,
}

/// Drains the queued batches, one entry per file, in launch order.
#[tauri::command]
fn take_progress_jobs(app: tauri::AppHandle, queue: tauri::State<ProgressQueue>) -> Result<Vec<ProgressJob>, String> {
  let batches = std::mem::take(&mut *queue.0.lock().unwrap());
  if batches.is_empty() {
    return Ok(vec![]);
  }
  let all = presets::load(&presets_path(&app)?)?;
  Ok(batches.into_iter().flat_map(|b| {
    let preset = all.iter().find(|p| p.id == b.preset_id).cloned();
    b.files.into_iter().map(move |path| {
      let applies = preset.as_ref().is_some_and(|p| presets::applies(p, &path));
      ProgressJob { path, preset: preset.clone(), applies }
    })
  }).collect())
}

/// Success toasts still on screen. Clicking one runs in this process, so a
/// background-only app stays alive while one shows (bounded by TOAST_WAIT).
#[derive(Default)]
struct Toasts(AtomicUsize);

// ponytail: Windows' default toast banner is ~5-7 s; a click after the app
// has exited (from the Action Center) does nothing. Upgrade: a COM toast
// activator registered by the installer.
#[cfg(windows)]
const TOAST_WAIT: std::time::Duration = std::time::Duration::from_secs(10);

/// Nothing showing: the main window was never revealed (or is hidden with no
/// tray to bring it back) and no toast is waiting for a click.
fn idle<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> bool {
  let main_visible = app.get_webview_window("main").is_some_and(|m| m.is_visible().unwrap_or(false));
  !main_visible && app.tray_by_id("sorai-tray").is_none() && app.state::<Toasts>().0.load(Ordering::SeqCst) == 0
}

/// "All converted" toast; a click reveals `reveal` (an output file) in its folder.
#[tauri::command]
fn notify_done(app: tauri::AppHandle, title: String, body: String, reveal: String) -> Result<(), String> {
  #[cfg(windows)]
  {
    use tauri_plugin_opener::OpenerExt;
    let mut n = notify_rust::Notification::new();
    n.summary(&title).body(&body);
    // Same as tauri-plugin-notification: the app's AUMID only exists once
    // installed; dev builds post under PowerShell's.
    let exe = tauri::utils::platform::current_exe().map_err(|e| e.to_string())?;
    let dir = exe.parent().map(|d| d.to_string_lossy().into_owned()).unwrap_or_default();
    let sep = std::path::MAIN_SEPARATOR;
    if !dir.ends_with(&format!("{sep}target{sep}debug")) && !dir.ends_with(&format!("{sep}target{sep}release")) {
      n.app_id(&app.config().identifier);
    }
    let handle = n.show().map_err(|e| e.to_string())?;
    app.state::<Toasts>().0.fetch_add(1, Ordering::SeqCst);
    // Whichever comes first (click/dismiss or TOAST_WAIT) releases the toast.
    let released = Arc::new(AtomicBool::new(false));
    let release = {
      let app = app.clone();
      move || {
        if !released.swap(true, Ordering::SeqCst) {
          app.state::<Toasts>().0.fetch_sub(1, Ordering::SeqCst);
          if app.get_webview_window(PROGRESS).is_none() && idle(&app) {
            app.exit(0);
          }
        }
      }
    };
    let (r1, r2) = (release.clone(), release);
    let app2 = app.clone();
    std::thread::spawn(move || {
      let _ = handle.wait_for_response(|r: &notify_rust::NotificationResponse| {
        if matches!(r, notify_rust::NotificationResponse::Default | notify_rust::NotificationResponse::Action(_)) {
          let _ = app2.opener().reveal_item_in_dir(&reveal);
        }
      });
      r1();
    });
    std::thread::spawn(move || {
      std::thread::sleep(TOAST_WAIT);
      r2();
    });
    Ok(())
  }
  #[cfg(not(windows))]
  {
    // No click callback through the plugin here; right-click presets are Windows-only.
    use tauri_plugin_notification::NotificationExt;
    let _ = reveal;
    app.notification().builder().title(title).body(body).show().map_err(|e| e.to_string())
  }
}

// Whether the taskbar (where the tray icon sits) is light. On Windows that's
// its own setting, separate from the app theme (Windows 10's default is light
// apps + dark taskbar). None elsewhere: the frontend falls back to the
// window theme (macOS tints its template tray icon itself).
#[tauri::command]
fn taskbar_is_light() -> Option<bool> {
  #[cfg(windows)]
  {
    let key = winreg::RegKey::predef(winreg::enums::HKEY_CURRENT_USER)
      .open_subkey(r"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize")
      .ok()?;
    key.get_value::<u32, _>("SystemUsesLightTheme").ok().map(|v| v != 0)
  }
  #[cfg(not(windows))]
  None
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let cold_argv: Vec<String> = std::env::args_os().map(|a| a.to_string_lossy().into_owned()).collect();
  tauri::Builder::default()
    // args_os: env::args() panics on a non-UTF-8 argument (Linux file names).
    .manage(ColdBackground(is_background_launch(&cold_argv)))
    .manage(LaunchQueue(Mutex::new(vec![cold_argv])))
    .manage(ProgressQueue::default())
    .manage(Toasts::default())
    // Must be the first plugin. Keyed on the app identifier: scripts/tauri-dev.mjs
    // gives dev/E2E builds a per-CDP-port identifier so worktrees don't collide.
    .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
      let background = is_background_launch(&argv);
      app.state::<LaunchQueue>().0.lock().unwrap().push(argv);
      let _ = app.emit("sorai://launch", ());
      if background {
        return;
      }
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
    .invoke_handler(tauri::generate_handler![take_launch_args, taskbar_is_light, launch_is_background, list_presets, queue_background, take_progress_jobs, notify_done])
    // Closing the progress window ends the app when nothing else is showing
    // (see idle; a pending toast ends it on release instead).
    .on_window_event(|w, e| {
      if w.label() == PROGRESS && matches!(e, tauri::WindowEvent::Destroyed) && idle(w.app_handle()) {
        w.app_handle().exit(0);
      }
    })
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

#[cfg(test)]
mod tests {
  #[test]
  fn only_preset_launches_are_background() {
    let argv = |a: &[&str]| a.iter().map(|s| s.to_string()).collect::<Vec<_>>();
    assert!(super::is_background_launch(&argv(&["app.exe", "--sorai-preset=video-to-mp4", r"C: b.mov"])));
    assert!(!super::is_background_launch(&argv(&["app.exe", "--sorai-convert-to=.ogg", "a.mp3"])));
    assert!(!super::is_background_launch(&argv(&["app.exe"])));
  }
}
