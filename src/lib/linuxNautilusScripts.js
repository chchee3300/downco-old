// Self-install of GNOME Nautilus "Scripts" entries -- the macOS/Linux-
// Nautilus half of the same idea as macFinderServices.js. Modern Nautilus
// (3.38+) dropped its old declarative custom-actions extension mechanism
// entirely; the only integration point left is the per-user
// ~/.local/share/nautilus/scripts/ folder (supports subfolder nesting,
// rendered as Scripts > <subfolder> > <script name>), which -- like
// macOS's ~/Library/Services -- has no package-install-time hook reachable
// from a .deb/.rpm's user-space install, so the running app writes these
// itself, idempotently, on every primary-instance startup.
//
// Gated to GNOME specifically (not just "any Linux desktop") to avoid
// dropping orphan files under ~/.local/share on KDE/XFCE/etc. systems that
// already get their own integration via Dolphin's ServiceMenu (installed
// at package-install time instead, see packaging/linux/
// generate-context-menu-registry.mjs) or that have no equivalent at all
// (v1 scope, see the plan doc).
//
// Format lists mirror sorai-toolkit-converter's useSettings.js /
// useFileManager.js by hand, same convention (and same drift risk) as the
// Windows/Dolphin generator scripts -- this is the THIRD hand-copy of the
// same source of truth. No automated cross-repo sync check exists.
//
// Unlike Windows' registry / Dolphin's per-extension MimeType-filtered
// ServiceMenu files, a Nautilus script's visibility in the Scripts menu
// does NOT vary by the type of the selected file -- there is no per-file-
// type gating mechanism here at all. So instead of one leaf set per
// SOURCE EXTENSION (which would require excluding that extension's own
// format, the way the Windows/Dolphin generators do), this generates one
// leaf set per CATEGORY (video/image/audio), offering that category's
// full target-format list unfiltered. Converting a file to its own
// existing format this way is a harmless no-op edge case, not something
// worth working around given Nautilus's real constraints here.
const CATEGORY_LABELS = { video: '影片', image: '圖片', audio: '音訊', pdf: 'PDF' }
const VIDEO_FORMATS = ['.mp4', '.mkv', '.webm', '.avi', '.gif']
const IMAGE_FORMATS = ['.jpg', '.png', '.webp', '.avif', '.ico', '.pdf']
const AUDIO_FORMATS = ['.mp3', '.wav', '.aac', '.flac', '.ogg']
const TARGET_SIZE_PRESETS_MB = [5, 25, 50]

const FORMAT_LABELS = {
  '.mp4': 'MP4', '.mkv': 'MKV', '.webm': 'WEBM', '.avi': 'AVI', '.gif': 'GIF',
  '.jpg': 'JPG', '.png': 'PNG', '.webp': 'WEBP', '.avif': 'AVIF', '.ico': 'ICO', '.pdf': 'PDF',
  '.mp3': 'MP3', '.wav': 'WAV', '.aac': 'AAC', '.flac': 'FLAC', '.ogg': 'OGG',
}

const ROOT_NAME = 'SORAI Toolkit'

// XDG_CURRENT_DESKTOP can be a colon-separated list (e.g. "ubuntu:GNOME")
// or absent entirely under some session managers/sandboxes -- substring
// match is a pragmatic heuristic, not a guarantee. Needs real-machine
// confirmation on at least Ubuntu-GNOME and Fedora-GNOME before trusting
// it universally; see the plan doc.
async function isGnomeDesktop() {
  try {
    const de = await window.Neutralino.os.getEnv('XDG_CURRENT_DESKTOP')
    return /GNOME/i.test(de || '')
  } catch (e) {
    return false
  }
}

async function homeDir() {
  return window.Neutralino.os.getEnv('HOME')
}

// A single-quoted shell string spanning two source lines, containing one
// literal embedded newline character between the quotes -- the standard
// POSIX idiom for "set IFS to a newline" (IFS='\n' inside single quotes
// would instead set IFS to the two literal characters backslash+n, not a
// newline). set -f suppresses glob expansion so a filename containing
// */?/[ isn't glob-expanded. The trailing $NAUTILUS_SCRIPT_SELECTED_FILE_PATHS
// is deliberately UNQUOTED so word-splitting on that newline-only IFS
// actually happens -- quoting it would pass the whole multi-line variable
// as one single argument instead of one argument per line. Needs real-
// machine verification with filenames containing spaces (exactly the case
// this idiom exists to handle, and the easiest thing to get subtly wrong).
function scriptBody(execArgs) {
  return `#!/bin/sh
IFS='
'
set -f
exec /usr/bin/sorai-toolkit ${execArgs} $NAUTILUS_SCRIPT_SELECTED_FILE_PATHS
`
}

function buildLeaves() {
  const leaves = []
  for (const [category, formats] of [['video', VIDEO_FORMATS], ['image', IMAGE_FORMATS], ['audio', AUDIO_FORMATS]]) {
    for (const format of formats) {
      const label = FORMAT_LABELS[format] || format.slice(1).toUpperCase()
      leaves.push({ category, name: `轉成 ${label}`, execArgs: `--sorai-convert-to=${format}` })
    }
  }
  for (const mb of TARGET_SIZE_PRESETS_MB) {
    leaves.push({ category: 'video', name: `快速壓縮到 ${mb}MB 以下`, execArgs: `--sorai-quick-action=compress-under:${mb}` })
  }
  leaves.push({ category: 'pdf', name: '壓縮 PDF', execArgs: '--sorai-quick-action=compress-pdf' })
  return leaves
}

async function writeExecutableScript(path, body) {
  await window.Neutralino.filesystem.writeFile(path, body)
  await window.Neutralino.os.execCommand(`chmod +x "${path}"`)
}

// Idempotent -- overwrites every leaf script on every call, no separate
// uninstall step (a removed/renamed leaf from a future format-list change
// becomes an orphan file until the next run picks it up as a rename, same
// accepted tradeoff as macFinderServices.js). Errors from any individual
// write are swallowed by the caller (see App.jsx's .catch) so a partial
// failure here never blocks app startup or the normal file-open flow.
export async function ensureNautilusScriptsInstalled() {
  if (!(await isGnomeDesktop())) return

  const home = await homeDir()
  const join = window.EstellaLib.platform.joinPath
  const rootDir = join(home, '.local', 'share', 'nautilus', 'scripts', ROOT_NAME)

  for (const leaf of buildLeaves()) {
    const categoryDir = join(rootDir, CATEGORY_LABELS[leaf.category])
    await window.Neutralino.filesystem.createDirectory(categoryDir).catch(() => {})
    const scriptPath = join(categoryDir, leaf.name)
    await writeExecutableScript(scriptPath, scriptBody(leaf.execArgs))
  }
}
