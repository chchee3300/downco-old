// Neutralino has no built-in single-instance primitive (confirmed --
// searched neutralino.config.json's schema, no such key exists). This
// module implements one from scratch using only what a webview shell
// actually has: a PID lock file in app-data, a "pending launch" queue
// directory for handing off launches' parsed args to the already-running
// primary, and a platform-specific shell command (via os.execCommand) to
// bring the primary's window to the front since there's no cross-
// platform API for reaching into another process's window from here.
//
// The queue is a DIRECTORY of one file per invocation, not a single
// shared pending-launch.json -- empirically confirmed (see the Windows
// spike this was built from) that a static registry context-menu verb
// invokes the registered command ONCE PER SELECTED FILE, not once with
// every selected path bundled in (MultiSelectModel=Player, which the
// original design assumed would do that, actually silently no-ops
// instead -- it's for media-player-style "reuse a running instance",
// not for delivering a multi-selection's paths in one command line; a
// real COM IContextMenu extension is the only way to get that, which is
// why Tichau/FileConverter -- the C#/SharpShell reference app looked at
// during planning -- needed one and this app deliberately doesn't). A
// directory of uniquely-named entries avoids near-simultaneous
// invocations clobbering each other's write, and lets
// useSingleInstance.js debounce-aggregate everything that arrives within
// a short quiet window into one batched pendingLaunch instead of firing
// once per file.
const APP_DATA_SUBDIR = 'sorai-toolkit'
const LOCK_FILE = 'instance.lock'
const QUEUE_SUBDIR = 'pending-launch'

async function getStateDir() {
  const dataDir = await window.Neutralino.os.getPath('data')
  const dir = window.EstellaLib.platform.joinPath(dataDir, APP_DATA_SUBDIR)
  await window.Neutralino.filesystem.createDirectory(dir).catch(() => {})
  return dir
}

async function getQueueDir() {
  const stateDir = await getStateDir()
  const dir = window.EstellaLib.platform.joinPath(stateDir, QUEUE_SUBDIR)
  await window.Neutralino.filesystem.createDirectory(dir).catch(() => {})
  return dir
}

function lockPath(dir) {
  return window.EstellaLib.platform.joinPath(dir, LOCK_FILE)
}

async function readJsonFile(path) {
  try {
    const text = await window.Neutralino.filesystem.readFile(path)
    return JSON.parse(text)
  } catch (e) {
    return null
  }
}

async function writeJsonFile(path, data) {
  await window.Neutralino.filesystem.writeFile(path, JSON.stringify(data))
}

// Windows: tasklist. macOS/Linux: kill -0 (signal 0 -- checks existence/
// permission without actually sending a signal). A failed/erroring
// execCommand is treated as "not alive" (stale lock), not re-thrown --
// the caller's job is to decide primary/secondary, not to distinguish
// "definitely dead" from "couldn't tell", and treating the latter as
// dead just means worst case a second window opens, not a deadlock.
async function isPidAlive(pid) {
  const os = window.EstellaLib.platform.getOS()
  try {
    if (os === 'Windows') {
      const res = await window.Neutralino.os.execCommand(`tasklist /FI "PID eq ${pid}"`)
      return res.stdOut.includes(String(pid))
    }
    const res = await window.Neutralino.os.execCommand(`kill -0 ${pid}`)
    return res.exitCode === 0
  } catch (e) {
    return false
  }
}

function randomJitterMs(maxMs) {
  return Math.floor(Math.random() * maxMs)
}

// Claims primary-instance status, self-healing a stale lock (previous
// process crashed/was killed without cleaning up) rather than
// deadlocking every future launch behind a dead PID forever.
//
// The jitter + read-after-write check are defense in depth, not a real
// guarantee -- there's no OS-level mutex available from a webview shell,
// so two truly simultaneous cold starts (Explorer firing N per-file
// invocations back-to-back for a multi-select, see this file's own
// top comment) can still both read "no lock" before either writes one.
// Worst case that produces is two visible windows, not data loss (each
// still enqueues its own file correctly either way).
export async function checkAndAcquireLock() {
  const dir = await getStateDir()
  const path = lockPath(dir)
  const ownPid = Number(window.NL_PID)

  await new Promise((resolve) => setTimeout(resolve, randomJitterMs(150)))

  const existing = await readJsonFile(path)
  // A page reload (e.g. neu's own --neu-dev-auto-reload on file changes)
  // re-mounts this hook without restarting the native process -- the
  // lock file it finds is its own, written by an earlier mount of
  // itself, not a competing instance. Without this check that would be
  // misread as "another instance is already running" and cause a
  // perfectly normal reload to self-exit.
  if (existing && existing.pid === ownPid) {
    return { isPrimary: true }
  }
  if (existing && typeof existing.pid === 'number' && (await isPidAlive(existing.pid))) {
    return { isPrimary: false, existingPid: existing.pid }
  }

  await writeJsonFile(path, { pid: ownPid, startedAt: Date.now() })

  const verify = await readJsonFile(path)
  if (verify && verify.pid !== ownPid) {
    return { isPrimary: false, existingPid: verify.pid }
  }

  return { isPrimary: true }
}

// One file per invocation -- see this file's top comment for why a
// single shared pending-launch.json isn't safe here.
export async function enqueuePendingLaunch(payload) {
  const dir = await getQueueDir()
  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`
  await writeJsonFile(window.EstellaLib.platform.joinPath(dir, name), payload)
}

// Lightweight listing for useSingleInstance's poll loop to diff against
// -- names only, no file reads, cheap enough to call every ~300ms.
export async function listQueueEntryNames() {
  const dir = await getQueueDir()
  try {
    const entries = await window.Neutralino.filesystem.readDirectory(dir)
    return entries.filter((e) => e.type === 'FILE').map((e) => e.entry).sort()
  } catch (e) {
    return []
  }
}

// Reads + deletes every named queue entry, merging them into one batch:
// all files concatenated in enqueue order, format/quickAction taken from
// the first entry that has one (every entry in a batch came from the
// same context-menu click across a multi-selection, so they agree).
export async function consumeQueueEntries(names) {
  const dir = await getQueueDir()
  const files = []
  let format = null
  let quickAction = null
  for (const name of names) {
    const path = window.EstellaLib.platform.joinPath(dir, name)
    const data = await readJsonFile(path)
    if (data) {
      if (Array.isArray(data.files)) files.push(...data.files)
      if (format == null && data.format) format = data.format
      if (quickAction == null && data.quickAction) quickAction = data.quickAction
    }
    await window.Neutralino.filesystem.remove(path).catch(() => {})
  }
  if (files.length === 0) return null
  return { files, format, quickAction }
}

// PowerShell needs -EncodedCommand's UTF-16LE base64, not the browser's
// default UTF-8 btoa -- manual byte-pack since there's no Buffer in this
// renderer context (this is a webview page, not Node).
function toPowerShellEncodedCommand(script) {
  const bytes = []
  for (let i = 0; i < script.length; i++) {
    const code = script.charCodeAt(i)
    bytes.push(code & 0xff, (code >> 8) & 0xff)
  }
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}

// Finds the target PID's own top-level window via EnumWindows (not
// Get-Process.MainWindowHandle, which is unreliable for a window
// currently hidden by Feature A's minimize-to-tray) and brings it
// forward. Verified live against a stuck real window (see
// forceOwnWindowForeground's comment) -- ShowWindow(9)/SW_RESTORE +
// SetForegroundWindow measurably flips a real window from IsIconic=true
// back to false.
function windowsForegroundScript(pid) {
  return [
    '$sig = @\'',
    '[DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);',
    '[DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);',
    '[DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);',
    '[DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);',
    '[DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);',
    'public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);',
    '\'@',
    'Add-Type -MemberDefinition $sig -Namespace SoraiWin32 -Name Api',
    `$targetPid = ${pid}`,
    '$found = [IntPtr]::Zero',
    '$callback = {',
    '  param($hWnd, $lParam)',
    '  $wPid = 0',
    '  [SoraiWin32.Api]::GetWindowThreadProcessId($hWnd, [ref]$wPid) | Out-Null',
    '  if ($wPid -eq $targetPid -and [SoraiWin32.Api]::IsWindowVisible($hWnd)) {',
    '    $script:found = $hWnd',
    '    return $false',
    '  }',
    '  return $true',
    '}',
    '[SoraiWin32.Api]::EnumWindows($callback, [IntPtr]::Zero) | Out-Null',
    'if ($found -ne [IntPtr]::Zero) {',
    '  [SoraiWin32.Api]::ShowWindow($found, 9) | Out-Null',
    '  [SoraiWin32.Api]::SetForegroundWindow($found) | Out-Null',
    '}',
  ].join('\n')
}

async function runWindowsForegroundScript(pid) {
  const encoded = toPowerShellEncodedCommand(windowsForegroundScript(pid))
  await window.Neutralino.os.execCommand(`powershell -NoProfile -NonInteractive -EncodedCommand ${encoded}`)
}

// Best-effort -- a failure here (wrong window found, wmctrl missing,
// Wayland refusing focus-steal) is swallowed by the caller. Files still
// reach the primary instance via the pending-launch file regardless of
// whether this succeeds; it only affects whether the window visibly
// jumps to the front.
export async function bringExistingInstanceToForeground(pid) {
  const os = window.EstellaLib.platform.getOS()
  try {
    if (os === 'Windows') {
      await runWindowsForegroundScript(pid)
      return
    }
    if (os === 'Darwin') {
      await window.Neutralino.os.execCommand(`osascript -e 'tell application "SORAI Toolkit" to activate'`)
      return
    }
    // Linux: no reliable cross-DE primitive. wmctrl may not be
    // installed, and Wayland compositors commonly block arbitrary
    // focus-stealing outright regardless -- see useCloseBehavior.js's
    // sibling comment on the same platform limitation for tray.
    await window.Neutralino.os.execCommand(`wmctrl -a "SORAI Toolkit"`)
  } catch (e) {
    /* best-effort, see comment above */
  }
}
