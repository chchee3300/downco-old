// Self-install of macOS Finder Quick Actions and GNOME Nautilus Scripts.
//
// Neither has an install-time hook (.dmg has no scripts; Nautilus scripts are
// per-user under ~/.local/share), unlike Windows' NSIS hook or KDE's
// ServiceMenu files shipped in the deb/rpm. So the running app writes them at
// every startup, idempotently, with no uninstall step (a removed app leaves
// orphan entries -- accepted tradeoff). Ported 1:1 from the Neutralino-era
// src/lib/macFinderServices.js + linuxNautilusScripts.js; content and rules
// unchanged except the Automator UUIDs, which are now derived from the slug so
// every rewrite is byte-identical.
//
// UNVERIFIED ON REAL MACHINES (dev box is Windows only): the Automator
// Info.plist/document.wflow XML is hand-authored, never diffed against a bundle
// Automator.app produced; the GNOME detection and the IFS/word-splitting idiom
// for filenames with spaces have never run on a real Nautilus.

use std::path::{Path, PathBuf};

pub struct Entry {
  /// Relative to $HOME.
  pub path: PathBuf,
  pub contents: String,
  /// chmod 755 on unix (Nautilus silently ignores non-executable scripts).
  pub executable: bool,
}

const TARGET_SIZE_PRESETS_MB: [u32; 3] = [5, 25, 50];

// ---------------------------------------------------------------- macOS ----

struct Service {
  slug: String,
  name: String,
  uti: &'static str,
  exec_args: String,
}

// Quick Actions are a flat, system-wide list, so macOS gets 7 category-level
// entries instead of the full extension x format matrix. The "convert" ones
// pass `--sorai-convert-to=` with an EMPTY value on purpose: launchArgs.js only
// accepts argv that contains a recognized --sorai-* flag, and '' is falsy
// downstream, so Converter falls back to the source file's own format.
fn services() -> Vec<Service> {
  let mut v: Vec<Service> = [("video", "影片", "public.movie"), ("image", "圖片", "public.image"), ("audio", "音訊", "public.audio")]
    .into_iter()
    .map(|(key, label, uti)| Service {
      slug: format!("convert-{key}"),
      name: format!("SORAI Toolkit - 轉檔（{label}）"),
      uti,
      exec_args: "--sorai-convert-to=".into(),
    })
    .collect();
  v.push(Service {
    slug: "compress-pdf".into(),
    name: "SORAI Toolkit - 壓縮 PDF".into(),
    uti: "com.adobe.pdf",
    exec_args: "--sorai-quick-action=compress-pdf".into(),
  });
  for mb in TARGET_SIZE_PRESETS_MB {
    v.push(Service {
      slug: format!("quick-compress-{mb}mb"),
      name: format!("SORAI Toolkit - 快速壓縮到 {mb}MB 以下"),
      uti: "public.movie",
      exec_args: format!("--sorai-quick-action=compress-under:{mb}"),
    });
  }
  v
}

fn escape_xml(s: &str) -> String {
  s.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;")
}

// Stable pseudo-UUID (FNV-1a) -- only needs to be unique within one bundle.
fn uuid(seed: &str) -> String {
  let fnv = |salt: u8| {
    [salt].into_iter().chain(seed.bytes()).fold(0xcbf29ce484222325u64, |h, b| (h ^ b as u64).wrapping_mul(0x100000001b3))
  };
  let h = format!("{:016X}{:016X}", fnv(1), fnv(2));
  format!("{}-{}-{}-{}-{}", &h[0..8], &h[8..12], &h[12..16], &h[16..20], &h[20..32])
}

// `open -n` forces a new process, which the single-instance plugin then
// forwards to the running one -- same path as a Windows/Linux launch.
fn mac_command(s: &Service) -> String {
  format!(r#"open -n -a "SORAI Toolkit" --args {} "$@""#, s.exec_args)
}

fn info_plist(s: &Service) -> String {
  let name = escape_xml(&s.name);
  format!(
    r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>CFBundleIdentifier</key>
	<string>com.soraitoolkit.hub.quickaction.{slug}</string>
	<key>CFBundleName</key>
	<string>{name}</string>
	<key>NSServices</key>
	<array>
		<dict>
			<key>NSMenuItem</key>
			<dict>
				<key>default</key>
				<string>{name}</string>
			</dict>
			<key>NSMessage</key>
			<string>runWorkflowAsService</string>
			<key>NSSendFileTypes</key>
			<array>
				<string>{uti}</string>
			</array>
			<key>NSRequiredContext</key>
			<dict>
				<key>NSApplicationIdentifier</key>
				<string>com.apple.finder</string>
			</dict>
		</dict>
	</array>
</dict>
</plist>
"#,
    slug = s.slug,
    uti = s.uti,
  )
}

fn document_wflow(s: &Service) -> String {
  format!(
    r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>AMApplicationBuild</key>
	<string>512</string>
	<key>AMApplicationVersion</key>
	<string>2.10</string>
	<key>AMDocumentVersion</key>
	<string>2</string>
	<key>actions</key>
	<array>
		<dict>
			<key>action</key>
			<dict>
				<key>AMAccepts</key>
				<dict>
					<key>Container</key>
					<string>List</string>
					<key>Optional</key>
					<true/>
					<key>Types</key>
					<array>
						<string>com.apple.cocoa.path</string>
					</array>
				</dict>
				<key>AMActionVersion</key>
				<string>2.0.3</string>
				<key>AMProvides</key>
				<dict>
					<key>Container</key>
					<string>List</string>
					<key>Types</key>
					<array>
						<string>com.apple.cocoa.string</string>
					</array>
				</dict>
				<key>ActionBundlePath</key>
				<string>/System/Library/Automator/Run Shell Script.action</string>
				<key>ActionName</key>
				<string>Run Shell Script</string>
				<key>ActionParameters</key>
				<dict>
					<key>COMMAND_STRING</key>
					<string>{command}</string>
					<key>CheckedForUserDefaultShell</key>
					<true/>
					<key>inputMethod</key>
					<integer>1</integer>
					<key>shell</key>
					<string>/bin/sh</string>
					<key>source</key>
					<string></string>
				</dict>
				<key>BundleIdentifier</key>
				<string>com.apple.RunShellScript</string>
				<key>CFBundleVersion</key>
				<string>2.0.3</string>
				<key>CanShowSelectedItemsWhenRun</key>
				<false/>
				<key>CanShowWhenRun</key>
				<true/>
				<key>Class Name</key>
				<string>RunShellScriptAction</string>
				<key>InputUUID</key>
				<string>{input}</string>
				<key>OutputUUID</key>
				<string>{output}</string>
				<key>UUID</key>
				<string>{action}</string>
				<key>isViewVisible</key>
				<true/>
			</dict>
			<key>isViewVisible</key>
			<true/>
		</dict>
	</array>
	<key>connectors</key>
	<dict/>
	<key>workflowMetaData</key>
	<dict>
		<key>serviceInputTypeIdentifier</key>
		<string>com.apple.Automator.fileSystemObject.string</string>
		<key>serviceOutputTypeIdentifier</key>
		<string>com.apple.Automator.nothing</string>
		<key>serviceProcessesInput</key>
		<integer>0</integer>
		<key>workflowTypeIdentifier</key>
		<string>com.apple.Automator.servicesMenu</string>
	</dict>
</dict>
</plist>
"#,
    command = escape_xml(&mac_command(s)),
    input = uuid(&format!("{}/input", s.slug)),
    output = uuid(&format!("{}/output", s.slug)),
    action = uuid(&format!("{}/action", s.slug)),
  )
}

pub fn finder_services() -> Vec<Entry> {
  services()
    .iter()
    .flat_map(|s| {
      let dir = Path::new("Library/Services").join(format!("{}.workflow", s.name)).join("Contents");
      [
        Entry { path: dir.join("Info.plist"), contents: info_plist(s), executable: false },
        Entry { path: dir.join("document.wflow"), contents: document_wflow(s), executable: false },
      ]
    })
    .collect()
}

// ---------------------------------------------------------------- GNOME ----

// Format lists are a hand copy of sorai-toolkit-converter's (same convention
// and drift risk as the packaging generators). Nautilus can't filter scripts by
// file type, so leaves are per CATEGORY, unfiltered (converting to the file's
// own format is a harmless no-op).
const NAUTILUS_CATEGORIES: [(&str, &[&str]); 3] = [
  ("影片", &["MP4", "MKV", "WEBM", "AVI", "GIF"]),
  ("圖片", &["JPG", "PNG", "WEBP", "AVIF", "ICO", "PDF"]),
  ("音訊", &["MP3", "WAV", "AAC", "FLAC", "OGG"]),
];

// IFS = one literal newline (two-line single-quoted string), set -f stops glob
// expansion, and the variable is deliberately UNQUOTED so it splits into one
// argument per selected path (filenames with spaces stay whole).
fn script_body(exec_args: &str) -> String {
  format!("#!/bin/sh\nIFS='\n'\nset -f\nexec /usr/bin/sorai-toolkit {exec_args} $NAUTILUS_SCRIPT_SELECTED_FILE_PATHS\n")
}

pub fn nautilus_scripts() -> Vec<Entry> {
  let mut leaves: Vec<(&str, String, String)> = Vec::new();
  for (category, formats) in NAUTILUS_CATEGORIES {
    for f in formats {
      leaves.push((category, format!("轉成 {f}"), format!("--sorai-convert-to=.{}", f.to_lowercase())));
    }
  }
  for mb in TARGET_SIZE_PRESETS_MB {
    leaves.push(("影片", format!("快速壓縮到 {mb}MB 以下"), format!("--sorai-quick-action=compress-under:{mb}")));
  }
  leaves.push(("PDF", "壓縮 PDF".into(), "--sorai-quick-action=compress-pdf".into()));

  let root = Path::new(".local/share/nautilus/scripts/SORAI Toolkit");
  leaves
    .into_iter()
    .map(|(category, name, args)| Entry { path: root.join(category).join(name), contents: script_body(&args), executable: true })
    .collect()
}

// XDG_CURRENT_DESKTOP may be a list ("ubuntu:GNOME") or missing. Non-GNOME
// desktops get nothing written (KDE has its packaged ServiceMenu instead).
pub fn is_gnome(xdg_current_desktop: Option<&str>) -> bool {
  xdg_current_desktop.is_some_and(|d| d.to_ascii_uppercase().contains("GNOME"))
}

// ----------------------------------------------------------------- write ----

pub fn write_all(home: &Path, entries: &[Entry]) -> std::io::Result<()> {
  for e in entries {
    let path = home.join(&e.path);
    std::fs::create_dir_all(path.parent().unwrap())?;
    std::fs::write(&path, &e.contents)?;
    #[cfg(unix)]
    if e.executable {
      use std::os::unix::fs::PermissionsExt;
      std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o755))?;
    }
  }
  Ok(())
}

/// Called once at startup (primary instance only -- a secondary exits inside
/// the single-instance plugin before setup runs). No-op on Windows and on
/// non-GNOME Linux. Errors are logged, never fatal.
pub fn install() {
  let entries = if cfg!(target_os = "macos") {
    finder_services()
  } else if cfg!(target_os = "linux") && is_gnome(std::env::var("XDG_CURRENT_DESKTOP").ok().as_deref()) {
    nautilus_scripts()
  } else {
    return;
  };
  let Some(home) = std::env::var_os("HOME") else { return };
  if let Err(e) = write_all(Path::new(&home), &entries) {
    log::warn!("self-install of context-menu entries failed: {e}");
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  fn paths(entries: &[Entry]) -> Vec<String> {
    entries.iter().map(|e| e.path.to_string_lossy().replace('\\', "/")).collect()
  }

  #[test]
  fn finder_services_are_seven_bundles_with_plist_and_wflow() {
    let e = finder_services();
    let p = paths(&e);
    assert_eq!(p.len(), 14);
    assert_eq!(p[0], "Library/Services/SORAI Toolkit - 轉檔（影片）.workflow/Contents/Info.plist");
    assert_eq!(p[1], "Library/Services/SORAI Toolkit - 轉檔（影片）.workflow/Contents/document.wflow");
    for name in ["轉檔（圖片）", "轉檔（音訊）", "壓縮 PDF", "快速壓縮到 5MB 以下", "快速壓縮到 25MB 以下", "快速壓縮到 50MB 以下"] {
      assert!(p.contains(&format!("Library/Services/SORAI Toolkit - {name}.workflow/Contents/Info.plist")), "{name}");
    }
    assert!(e.iter().all(|e| !e.executable));
  }

  #[test]
  fn finder_service_contents() {
    let e = finder_services();
    let wflow = |i: usize| &e[i * 2 + 1].contents;
    let plist = |i: usize| &e[i * 2].contents;
    // empty --sorai-convert-to= on purpose (see services())
    assert!(wflow(0).contains(r#"<string>open -n -a "SORAI Toolkit" --args --sorai-convert-to= "$@"</string>"#));
    assert!(plist(0).contains("<string>public.movie</string>"));
    assert!(plist(1).contains("<string>public.image</string>"));
    assert!(plist(3).contains("<string>com.adobe.pdf</string>"));
    assert!(wflow(3).contains("--args --sorai-quick-action=compress-pdf \"$@\""));
    assert!(wflow(5).contains("--args --sorai-quick-action=compress-under:25 \"$@\""));
    assert!(plist(5).contains("com.soraitoolkit.hub.quickaction.quick-compress-25mb"));
    // deterministic -> idempotent rewrites; UUIDs distinct within a bundle
    assert_eq!(wflow(0), &finder_services()[1].contents);
    let u: Vec<&str> = wflow(0).match_indices("UUID</key>\n\t\t\t\t<string>").map(|(i, m)| &wflow(0)[i + m.len()..i + m.len() + 36]).collect();
    assert_eq!(u.len(), 3);
    assert!(u[0] != u[1] && u[1] != u[2] && u[0] != u[2]);
  }

  #[test]
  fn nautilus_scripts_layout_and_args() {
    let e = nautilus_scripts();
    let p = paths(&e);
    assert_eq!(p.len(), 5 + 6 + 5 + 3 + 1);
    assert!(e.iter().all(|e| e.executable));
    let root = ".local/share/nautilus/scripts/SORAI Toolkit";
    let body = |rel: &str| &e[p.iter().position(|x| x == &format!("{root}/{rel}")).unwrap_or_else(|| panic!("{rel}"))].contents;
    assert_eq!(
      body("影片/轉成 MP4"),
      "#!/bin/sh\nIFS='\n'\nset -f\nexec /usr/bin/sorai-toolkit --sorai-convert-to=.mp4 $NAUTILUS_SCRIPT_SELECTED_FILE_PATHS\n"
    );
    assert!(body("圖片/轉成 PDF").contains(" --sorai-convert-to=.pdf $NAUTILUS"));
    assert!(body("音訊/轉成 OGG").contains(" --sorai-convert-to=.ogg $NAUTILUS"));
    assert!(body("影片/快速壓縮到 50MB 以下").contains(" --sorai-quick-action=compress-under:50 $NAUTILUS"));
    assert!(body("PDF/壓縮 PDF").contains(" --sorai-quick-action=compress-pdf $NAUTILUS"));
  }

  #[test]
  fn gnome_detection() {
    assert!(is_gnome(Some("GNOME")));
    assert!(is_gnome(Some("ubuntu:GNOME")));
    assert!(is_gnome(Some("gnome-classic")));
    assert!(!is_gnome(Some("KDE")));
    assert!(!is_gnome(Some("XFCE")));
    assert!(!is_gnome(Some("")));
    assert!(!is_gnome(None));
  }

  #[test]
  fn write_all_is_idempotent_and_sets_exec_bit() {
    let home = std::env::temp_dir().join(format!("sorai-self-install-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&home);
    let entries = nautilus_scripts();
    write_all(&home, &entries).unwrap();
    write_all(&home, &entries).unwrap();
    let f = home.join(&entries[0].path);
    assert_eq!(std::fs::read_to_string(&f).unwrap(), entries[0].contents);
    #[cfg(unix)]
    {
      use std::os::unix::fs::PermissionsExt;
      assert_eq!(std::fs::metadata(&f).unwrap().permissions().mode() & 0o777, 0o755);
    }
    std::fs::remove_dir_all(&home).unwrap();
  }
}
