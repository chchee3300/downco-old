// Generates packaging/windows/context-menu.generated.nsh: the Tauri NSIS
// installer hooks (bundle.windows.nsis.installerHooks in
// src-tauri/tauri.windows.conf.json) that write the Explorer right-click
// menu on install (NSIS_HOOK_POSTINSTALL) and delete it on uninstall
// (NSIS_HOOK_PREUNINSTALL). Regenerated fresh by beforeBuildCommand before
// every `tauri build` -- gitignored, never goes stale in the repo.
//
// Mechanism confirmed empirically (real Windows Explorer, real registry
// writes, see the plan doc's Windows spike): a verb key with
// SubCommands="" and its children under a nested `shell` subkey DOES
// cascade correctly. MultiSelectModel="Player" does NOT bundle a multi-
// selection's paths into one invocation -- it silently no-ops instead.
// So every leaf verb here uses the *default* model: Explorer invokes the
// command once PER SELECTED FILE, and tauri-plugin-single-instance +
// useSingleInstance.js's 500ms debounce turn N invocations back into one
// pendingLaunch.
//
// Format lists mirror sorai-toolkit-converter's useSettings.js
// (VIDEO_FORMATS/IMAGE_FORMATS/AUDIO_FORMATS/TARGET_SIZE_PRESETS_MB) and
// useFileManager.js (VIDEO_EXTS/IMAGE_EXTS/AUDIO_EXTS/PDF_EXTS) by hand --
// no automated cross-repo sync check exists. If Converter's format lists
// change, this file needs a matching manual update or the generated
// context menu silently drifts out of sync with what the app actually
// supports.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_PATH = path.join(__dirname, 'context-menu.generated.nsh')

const VIDEO_FORMATS = ['.mp4', '.mkv', '.webm', '.avi', '.gif']
const IMAGE_FORMATS = ['.jpg', '.png', '.webp', '.avif', '.ico', '.pdf']
const AUDIO_FORMATS = ['.mp3', '.wav', '.aac', '.flac', '.ogg']
const TARGET_SIZE_PRESETS_MB = [5, 25, 50]

// Input-extension -> category, broader than the output format lists
// above (matches useFileManager.js's getFileType) -- e.g. .mov/.jpeg are
// valid inputs but not output format options, and .gif is an IMAGE input
// despite also being a VIDEO output format (classified by getFileType,
// not by useSettings.js's output lists -- a critical distinction, see
// below).
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

// Target-format list for a given input extension: the category's output
// format list minus the input's own equivalent (so a right-clicked .mp3
// never offers "Convert to MP3"). .jpeg is treated as .jpg's equivalent
// (neither offers a "convert to jpg" target from a .jpeg file, since
// they're the same format). Inputs with no real output equivalent (.mov,
// .gif-the-image-input) get the full unfiltered list.
function targetFormatsFor(ext, category) {
  const allFormats = { video: VIDEO_FORMATS, image: IMAGE_FORMATS, audio: AUDIO_FORMATS }[category]
  if (!allFormats) return []
  const ownFormat = ext === 'jpeg' ? '.jpg' : `.${ext}`
  return allFormats.filter((f) => f !== ownFormat)
}

// NSIS string literal: inside "...", `$` starts a variable and `"` ends the
// string. Only $INSTDIR / ${MAINBINARYNAME} are meant as NSIS variables.
function nsis(s) {
  return `"${s.replace(/\$(?!INSTDIR|\{MAINBINARYNAME\})/g, '$$$$').replace(/"/g, '$\\"')}"`
}

const EXE = '$INSTDIR\\${MAINBINARYNAME}.exe'
// "%1" quoted: unquoted, a path with spaces arrives as several argv tokens.
const command = (flag) => `"${EXE}" ${flag} "%1"`

const install = []
const uninstall = []
const reg = (subkey, valueName, value) =>
  install.push(`  WriteRegStr HKCU ${nsis(subkey)} ${nsis(valueName)} ${nsis(value)}`)

for (const [category, exts] of Object.entries(INPUT_EXTENSIONS)) {
  for (const ext of exts) {
    const extKey = `.${ext}`
    const root = `Software\\Classes\\${extKey}\\shell\\SORAIToolkit`

    install.push(`  ; --- ${extKey} (${category}) ---`)
    uninstall.push(`  DeleteRegKey HKCU ${nsis(root)}`)
    // WriteRegStr created .ext\shell if it wasn't there; don't leave it empty.
    uninstall.push(`  DeleteRegKey /ifempty HKCU ${nsis(`Software\\Classes\\${extKey}\\shell`)}`)
    reg(root, 'MUIVerb', 'SORAI Toolkit')
    reg(root, 'Icon', `"${EXE}",0`)
    reg(root, 'SubCommands', '')

    if (category === 'pdf') {
      const compressKey = `${root}\\shell\\CompressPdf`
      reg(compressKey, 'MUIVerb', '壓縮 PDF')
      reg(`${compressKey}\\command`, '', command('--sorai-quick-action=compress-pdf'))
      continue
    }

    // 轉檔 submenu -- one leaf per target format.
    const convertKey = `${root}\\shell\\Convert`
    reg(convertKey, 'MUIVerb', '轉檔')
    reg(convertKey, 'SubCommands', '')

    for (const targetFormat of targetFormatsFor(ext, category)) {
      const label = FORMAT_LABELS[targetFormat] || targetFormat.slice(1).toUpperCase()
      const leafKey = `${convertKey}\\shell\\ConvertTo_${targetFormat.slice(1)}`
      reg(leafKey, 'MUIVerb', `轉成 ${label}`)
      reg(`${leafKey}\\command`, '', command(`--sorai-convert-to=${targetFormat}`))
    }

    // Quick-compress siblings -- video only.
    if (category === 'video') {
      for (const mb of TARGET_SIZE_PRESETS_MB) {
        const quickKey = `${root}\\shell\\QuickCompress_${mb}MB`
        reg(quickKey, 'MUIVerb', `快速壓縮到 ${mb}MB 以下`)
        reg(`${quickKey}\\command`, '', command(`--sorai-quick-action=compress-under:${mb}`))
      }
    }
  }
}

const out = [
  '; Auto-generated by packaging/windows/generate-context-menu-registry.mjs -- do not edit by hand.',
  '; Per-user (HKCU), matching bundle.windows.nsis.installMode = currentUser.',
  '!macro NSIS_HOOK_POSTINSTALL',
  ...install,
  '!macroend',
  '',
  '!macro NSIS_HOOK_PREUNINSTALL',
  ...uninstall,
  '!macroend',
  '',
]
// BOM: makensis reads a BOM-less script in the ANSI codepage and mangles the Chinese labels.
fs.writeFileSync(OUT_PATH, '\uFEFF' + out.join('\r\n'), 'utf8')
console.log(`Wrote ${OUT_PATH} (${install.filter((l) => l.includes('WriteRegStr')).length} registry values)`)
