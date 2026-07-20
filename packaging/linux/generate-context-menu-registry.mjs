// Generates packaging/linux/context-menu.generated/*.desktop -- KDE
// ServiceMenu files that packaging/linux/build.sh stages into
// usr/share/kio/servicemenus/ before fpm packages the .deb/.rpm.
// Regenerated fresh by build.sh before every package build -- gitignored,
// same convention as packaging/windows/generate-context-menu-registry.mjs's
// context-menu.generated.iss.
//
// One .desktop file PER INPUT EXTENSION (not one shared file) -- a KDE
// ServiceMenu's MimeType= field filters at the whole-file level, and each
// extension needs a different target-format list (its own format excluded)
// plus a different MimeType, so one file per extension avoids needing any
// per-action MIME gating inside a single file (which ServiceMenus don't
// support). Each file's X-KDE-Submenu=SORAI Toolkit groups that file's own
// actions under one "SORAI Toolkit" cascading entry in Dolphin's context
// menu -- this is the single documented/reliable nesting KDE ServiceMenus
// provide. A DEEPER second-level submenu (e.g. "SORAI Toolkit -> 轉檔 ->
// 轉成 X", matching the Windows registry's 3-level shell tree) is NOT
// attempted here because there is no confirmed-working syntax for it
// without a real KDE/Dolphin environment to test against -- this is an
// explicit unverified spike item (see the plan doc). What ships here is
// the safe fallback: one flat "SORAI Toolkit" submenu per file containing
// that extension's full target-format matrix + (video only) quick-compress
// + (pdf only) compress-pdf, which is guaranteed to work by the single-
// level X-KDE-Submenu mechanism regardless of how the deeper-nesting
// question resolves.
//
// Format lists mirror sorai-toolkit-converter's useSettings.js
// (VIDEO_FORMATS/IMAGE_FORMATS/AUDIO_FORMATS/TARGET_SIZE_PRESETS_MB) and
// useFileManager.js (VIDEO_EXTS/IMAGE_EXTS/AUDIO_EXTS/PDF_EXTS) by hand --
// same as the Windows generator, no automated cross-repo sync check
// exists. If Converter's format lists change, this file needs a matching
// manual update or the generated context menu silently drifts out of sync
// with what the app actually supports.
//
// MIME type strings below are the commonly-accepted freedesktop.org.xml
// values for each extension, but have NOT been cross-checked against a
// real machine's /usr/share/mime/packages/freedesktop.org.xml -- a wrong
// MIME type means that extension's entry silently never appears in
// Dolphin with no error anywhere. Verify on a real KDE spike before
// relying on this for release.
//
// Whether Dolphin's %f bundles a multi-selection into one invocation or
// fires once per selected file (like Windows Explorer turned out to,
// see the Windows generator's own comment) is also unverified -- but
// doesn't matter functionally either way, since the app's own
// single-instance queue+debounce (src/lib/instanceLock.js,
// src/hooks/useSingleInstance.js) reassembles either shape into one
// batched pendingLaunch.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.join(__dirname, 'context-menu.generated')

const VIDEO_FORMATS = ['.mp4', '.mkv', '.webm', '.avi', '.gif']
const IMAGE_FORMATS = ['.jpg', '.png', '.webp', '.avif', '.ico', '.pdf']
const AUDIO_FORMATS = ['.mp3', '.wav', '.aac', '.flac', '.ogg']
const TARGET_SIZE_PRESETS_MB = [5, 25, 50]

// Same category shape as the Windows generator's INPUT_EXTENSIONS -- see
// that file's comment for why this is broader than the output format
// lists above (.mov/.jpeg valid inputs only, .gif is an IMAGE input
// despite being a VIDEO output format).
const INPUT_EXTENSIONS = {
  video: ['mp4', 'mkv', 'avi', 'mov', 'webm'],
  image: ['jpg', 'jpeg', 'png', 'webp', 'avif', 'gif', 'ico'],
  audio: ['mp3', 'wav', 'aac', 'flac', 'ogg'],
  pdf: ['pdf'],
}

const FORMAT_LABELS = {
  '.mp4': 'MP4', '.mkv': 'MKV', '.webm': 'WEBM', '.avi': 'AVI', '.gif': 'GIF',
  '.jpg': 'JPG', '.png': 'PNG', '.webp': 'WEBP', '.avif': 'AVIF', '.ico': 'ICO', '.pdf': 'PDF',
  '.mp3': 'MP3', '.wav': 'WAV', '.aac': 'AAC', '.flac': 'FLAC', '.ogg': 'OGG',
}

// Unverified against a real machine's MIME database -- see top-of-file
// comment.
const MIME_TYPES = {
  mp4: 'video/mp4', mkv: 'video/x-matroska', avi: 'video/x-msvideo', mov: 'video/quicktime', webm: 'video/webm',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', avif: 'image/avif', gif: 'image/gif', ico: 'image/vnd.microsoft.icon',
  mp3: 'audio/mpeg', wav: 'audio/x-wav', aac: 'audio/aac', flac: 'audio/flac', ogg: 'audio/ogg',
  pdf: 'application/pdf',
}

// Same filtering logic as the Windows generator's targetFormatsFor.
function targetFormatsFor(ext, category) {
  const allFormats = { video: VIDEO_FORMATS, image: IMAGE_FORMATS, audio: AUDIO_FORMATS }[category]
  if (!allFormats) return []
  const ownFormat = ext === 'jpeg' ? '.jpg' : `.${ext}`
  return allFormats.filter((f) => f !== ownFormat)
}

function buildDesktopFile(ext, category) {
  const mime = MIME_TYPES[ext]
  const actionIds = []
  const actionBlocks = []

  function addAction(id, name, exec) {
    actionIds.push(id)
    actionBlocks.push(`[Desktop Action ${id}]\nName=${name}\nIcon=sorai-toolkit\nExec=${exec}\n`)
  }

  if (category === 'pdf') {
    addAction('CompressPdf', '壓縮 PDF', '/usr/bin/sorai-toolkit --sorai-quick-action=compress-pdf %f')
  } else {
    for (const targetFormat of targetFormatsFor(ext, category)) {
      const label = FORMAT_LABELS[targetFormat] || targetFormat.slice(1).toUpperCase()
      addAction(`ConvertTo_${targetFormat.slice(1)}`, `轉成 ${label}`, `/usr/bin/sorai-toolkit --sorai-convert-to=${targetFormat} %f`)
    }
    if (category === 'video') {
      for (const mb of TARGET_SIZE_PRESETS_MB) {
        addAction(`QuickCompress_${mb}MB`, `快速壓縮到 ${mb}MB 以下`, `/usr/bin/sorai-toolkit --sorai-quick-action=compress-under:${mb} %f`)
      }
    }
  }

  const header = [
    '[Desktop Entry]',
    'Type=Service',
    'X-KDE-ServiceTypes=KonqPopupMenu/Plugin',
    `MimeType=${mime};`,
    'X-KDE-Submenu=SORAI Toolkit',
    'Icon=sorai-toolkit',
    `Actions=${actionIds.join(';')};`,
    '',
  ].join('\n')

  return header + actionBlocks.join('\n')
}

fs.rmSync(OUT_DIR, { recursive: true, force: true })
fs.mkdirSync(OUT_DIR, { recursive: true })

let fileCount = 0
for (const [category, exts] of Object.entries(INPUT_EXTENSIONS)) {
  for (const ext of exts) {
    const content = buildDesktopFile(ext, category)
    const outPath = path.join(OUT_DIR, `sorai-toolkit-${ext}.desktop`)
    fs.writeFileSync(outPath, content, 'utf8')
    fileCount++
  }
}

console.log(`Wrote ${fileCount} ServiceMenu files to ${OUT_DIR}`)
