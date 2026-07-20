// Self-install of macOS Finder "Quick Actions" (Automator Services) --
// the macOS half of the cross-platform right-click integration (see
// packaging/windows/generate-context-menu-registry.mjs for Windows,
// packaging/linux/generate-context-menu-registry.mjs + linuxNautilusScripts.js
// for Linux). macOS's .dmg packaging (packaging/macos/build.sh) has no
// install-time script hook of any kind (no pkgbuild/productbuild) -- so,
// like GNOME Nautilus's Scripts folder, this has to be self-installed by
// the running app into ~/Library/Services/ at every primary-instance
// startup, idempotently, with no separate uninstall step (removed app =
// orphaned Service entries, an accepted tradeoff for a drag-install app,
// same reasoning as linuxNautilusScripts.js).
//
// *** HIGHEST-RISK PIECE OF THE WHOLE macOS/Linux CONTEXT-MENU PLAN ***
// The Info.plist / document.wflow XML below is hand-authored from general
// knowledge of the Automator .workflow-as-Service bundle format -- NOT
// diffed against a real bundle produced by Automator.app, because no Mac
// was available while writing this. Before relying on this in production:
// on a real Mac, use Automator.app to hand-build one trivial Quick Action
// Service (e.g. "reveal the selected file in Finder" via a no-op shell
// command), save it, then read its Contents/Info.plist and
// Contents/document.wflow back to get real ground truth to diff this
// file's generated XML against. See the plan doc's macOS section.
//
// Quick Actions are a macOS-wide FLAT list (no real nested submenus,
// unlike Windows/Dolphin/Nautilus) -- the user explicitly chose to
// collapse macOS to 7 category-level entries instead of a full
// extension x format matrix (which would be 90+ flat items). The 3
// "轉檔（...）" entries deliberately carry NO target format -- they open
// the app with the file(s) loaded, and the user picks the output format
// from Converter's existing format dropdown (no new UI needed there).
const CATEGORIES = [
  { key: 'video', label: '影片', uti: 'public.movie' },
  { key: 'image', label: '圖片', uti: 'public.image' },
  { key: 'audio', label: '音訊', uti: 'public.audio' },
]
const TARGET_SIZE_PRESETS_MB = [5, 25, 50]
const PDF_UTI = 'com.adobe.pdf'

// parseLaunchArgs (src/lib/launchArgs.js) requires seeing at least one
// recognized --sorai-* flag before it treats the argv as a real launch --
// a bare `open -n -a "SORAI Toolkit" --args "$@"` with no flag would have
// its files silently dropped (sawFlag stays false). So the category
// "convert" Services below deliberately emit `--sorai-convert-to=` with
// an EMPTY value rather than omitting the flag: parseLaunchArgs sets
// format = '' (sawFlag becomes true), and '' is falsy at every
// `if (pendingLaunch.format)` consumption site downstream (confirmed by
// reading sorai-toolkit-converter's App.jsx handleFirstFileType), so it
// falls through to the existing "use the source file's own extension as
// the default format" behavior -- identical to a launch with no format at
// all, just without tripping the sawFlag guard. No changes needed to
// launchArgs.js/instanceLock.js/Converter for this to work correctly --
// but verify this empty-string fallthrough explicitly in code review, see
// the plan doc.
function serviceDefs() {
  const defs = []
  for (const cat of CATEGORIES) {
    defs.push({
      slug: `convert-${cat.key}`,
      name: `SORAI Toolkit - 轉檔（${cat.label}）`,
      uti: cat.uti,
      execArgs: '--sorai-convert-to=',
    })
  }
  defs.push({
    slug: 'compress-pdf',
    name: 'SORAI Toolkit - 壓縮 PDF',
    uti: PDF_UTI,
    execArgs: '--sorai-quick-action=compress-pdf',
  })
  for (const mb of TARGET_SIZE_PRESETS_MB) {
    defs.push({
      slug: `quick-compress-${mb}mb`,
      name: `SORAI Toolkit - 快速壓縮到 ${mb}MB 以下`,
      uti: 'public.movie',
      execArgs: `--sorai-quick-action=compress-under:${mb}`,
    })
  }
  return defs
}

function escapeXml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function infoPlist(def) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>CFBundleIdentifier</key>
	<string>com.soraitoolkit.hub.quickaction.${def.slug}</string>
	<key>CFBundleName</key>
	<string>${escapeXml(def.name)}</string>
	<key>NSServices</key>
	<array>
		<dict>
			<key>NSMenuItem</key>
			<dict>
				<key>default</key>
				<string>${escapeXml(def.name)}</string>
			</dict>
			<key>NSMessage</key>
			<string>runWorkflowAsService</string>
			<key>NSSendFileTypes</key>
			<array>
				<string>${def.uti}</string>
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
`
}

function randomUuid() {
  if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID().toUpperCase()
  // Fallback for older webviews without crypto.randomUUID -- these UUIDs
  // only need to be unique within one bundle's document.wflow, not
  // cryptographically random.
  return 'XXXXXXXX-XXXX-4XXX-YXXX-XXXXXXXXXXXX'.replace(/[XY]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'X' ? r : (r & 0x3) | 0x8
    return v.toString(16).toUpperCase()
  })
}

// The shell command each Service runs. `open -n -a` forces a brand-new
// process (rather than macOS's default "activate the existing instance"
// behavior for `open -a`), which is what lets this app's own single-
// instance queue (src/lib/instanceLock.js) detect and handle the launch
// the same way a Windows registry verb or Linux %f invocation does.
function commandString(def) {
  return `open -n -a "SORAI Toolkit" --args ${def.execArgs} "$@"`
}

function documentWflow(def) {
  const inputUuid = randomUuid()
  const outputUuid = randomUuid()
  const actionUuid = randomUuid()
  return `<?xml version="1.0" encoding="UTF-8"?>
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
					<string>${escapeXml(commandString(def))}</string>
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
				<string>${inputUuid}</string>
				<key>OutputUUID</key>
				<string>${outputUuid}</string>
				<key>UUID</key>
				<string>${actionUuid}</string>
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
`
}

async function writeWorkflowBundle(servicesDir, def) {
  const join = window.EstellaLib.platform.joinPath
  const bundleDir = join(servicesDir, `${def.name}.workflow`)
  const contentsDir = join(bundleDir, 'Contents')
  await window.Neutralino.filesystem.createDirectory(contentsDir).catch(() => {})
  await window.Neutralino.filesystem.writeFile(join(contentsDir, 'Info.plist'), infoPlist(def))
  await window.Neutralino.filesystem.writeFile(join(contentsDir, 'document.wflow'), documentWflow(def))
}

// Idempotent -- overwrites all 7 bundles on every call, no separate
// uninstall step (see this file's top comment for why that's accepted).
// Errors from any individual write are swallowed by the caller (App.jsx's
// .catch) so a partial failure never blocks app startup or the normal
// file-open flow.
export async function ensureFinderServicesInstalled() {
  const home = await window.Neutralino.os.getEnv('HOME')
  const servicesDir = window.EstellaLib.platform.joinPath(home, 'Library', 'Services')
  await window.Neutralino.filesystem.createDirectory(servicesDir).catch(() => {})

  for (const def of serviceDefs()) {
    await writeWorkflowBundle(servicesDir, def)
  }
}
