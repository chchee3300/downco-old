const FORMAT_PREFIX = '--sorai-convert-to='
const QUICK_ACTION_PREFIX = '--sorai-quick-action='

// Parses this app's own launch-time CLI args (window.NL_ARGS on a cold
// start, or an equivalent argv array forwarded from a second instance --
// see instanceLock.js) into the shape ConverterApp's pendingLaunch prop
// expects.
//
// Every launch path this app controls places one of the two --sorai-*
// flags first and the selected file paths after it:
//   Windows registry:  "<app>\sorai-toolkit.exe" --sorai-convert-to=.ogg %1
//   macOS Quick Action: open -n -a "SORAI Toolkit" --args --sorai-convert-to=.ogg "$@"
//   Linux Dolphin:      /usr/bin/sorai-toolkit --sorai-convert-to=.ogg %f
// So file paths are "every non-flag token following the recognized
// flag" -- not anything positional/heuristic about looking like a path.
// This also naturally drops the binary's own argv[0] path and any
// Neutralino-internal flags that precede it, since those never come
// after our own flag in any command line we build.
export function parseLaunchArgs(argv) {
  if (!Array.isArray(argv)) return null

  let format = null
  let quickAction = null
  const files = []
  let sawFlag = false

  for (const arg of argv) {
    if (typeof arg !== 'string') continue

    if (arg.startsWith(FORMAT_PREFIX)) {
      format = arg.slice(FORMAT_PREFIX.length)
      sawFlag = true
      continue
    }

    if (arg.startsWith(QUICK_ACTION_PREFIX)) {
      const value = arg.slice(QUICK_ACTION_PREFIX.length)
      if (value === 'compress-pdf') {
        quickAction = { type: 'compress-pdf' }
      } else {
        const match = /^compress-under:(\d+(?:\.\d+)?)$/.exec(value)
        if (match) quickAction = { type: 'compress-under', targetMB: parseFloat(match[1]) }
      }
      sawFlag = true
      continue
    }

    if (sawFlag && !arg.startsWith('--')) files.push(arg)
  }

  if (!sawFlag || files.length === 0) return null
  return { files, format, quickAction }
}
