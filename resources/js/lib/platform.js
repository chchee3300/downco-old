// Cross-platform seam for OS detection, path joining, and binary/command
// resolution. Every other lib file's `\binaries\...exe` string literal
// routes through here instead of hardcoding a separator/extension — see
// ffmpeg-commands.js / qpdf-commands.js / img2pdf-commands.js. Framework-
// agnostic strangler-fig seam, same window.EstellaLib attach pattern as the
// rest of resources/js/lib/.
(function (global) {
  // NL_OS is injected into the page by the native Neutralino binary at
  // runtime (not defined in the bundled neutralino.js client lib itself) --
  // 'Windows' | 'Linux' | 'Darwin'. Treat a missing value as Windows since
  // that's the only platform this app supported before this seam existed.
  function getOS() {
    return global.NL_OS;
  }

  function isWindows() {
    return getOS() === 'Windows' || getOS() === undefined;
  }

  function sep() {
    return isWindows() ? '\\' : '/';
  }

  // Joins already-clean path segments with the current OS's native
  // separator. No '..'/'.' normalization or de-duplication -- no caller
  // needs it.
  function joinPath(...parts) {
    return parts.filter((p) => p !== '' && p != null).join(sep());
  }

  // Shared shape behind ffmpegPath/ytdlpPath below -- both bundle one
  // binary per platform under binaries/<platform>/<name>[.exe], mac arch
  // split (not a universal binary) to match the pattern bin/ already uses
  // for the Neutralino shell itself. name is the bare executable name with
  // no extension -- the Windows branch appends .exe, macOS/Linux don't need
  // one.
  function binaryPath(binPath, name) {
    if (isWindows()) return joinPath(binPath, 'binaries', 'win_x64', `${name}.exe`);
    if (getOS() === 'Darwin') {
      const arch = global.NL_ARCH === 'arm64' ? 'mac_arm64' : 'mac_x64';
      return joinPath(binPath, 'binaries', arch, name);
    }
    return joinPath(binPath, 'binaries', 'linux_x64', name);
  }

  // ffmpeg is bundled on every platform.
  function ffmpegPath(binPath) {
    return binaryPath(binPath, 'ffmpeg');
  }

  // qpdf/img2pdf: bundled .exe on Windows. On macOS/Linux these are
  // system-installed (brew/apt/pip) -- return the bare command name and let
  // the shell resolve it from PATH.
  function qpdfCommand(binPath) {
    return isWindows() ? joinPath(binPath, 'binaries', 'win_x64', 'qpdf.exe') : 'qpdf';
  }

  function img2pdfCommand(binPath) {
    return isWindows() ? joinPath(binPath, 'binaries', 'win_x64', 'img2pdf.exe') : 'img2pdf';
  }

  // yt-dlp: bundled on every platform (single binary, no zip, see
  // setup.mjs's setupYtDlp). macOS ships one universal build for both Intel
  // and Apple Silicon -- same one-build-covers-both-arches pattern as
  // ffmpeg's evermeet.cx build above.
  function ytdlpPath(binPath) {
    return binaryPath(binPath, 'yt-dlp');
  }

  // Direct replacement for the old `window.NL_PATH.replace(/\//g, '\\')`
  // literal -- normalizes NL_PATH (which Neutralino may report with forward
  // slashes even on Windows) to the *current* OS's native separator instead
  // of assuming Windows.
  function resolveBinPath() {
    const raw = global.NL_PATH;
    return isWindows() ? raw.replace(/\//g, '\\') : raw.replace(/\\/g, '/');
  }

  // Presence probe for the two macOS/Linux system dependencies (qpdf,
  // img2pdf) -- resolves true/false rather than throwing, so callers can
  // gate a friendly error message instead of a cryptic spawn failure.
  async function checkToolAvailable(command) {
    try {
      const res = await global.Neutralino.os.execCommand(`${command} --version`);
      return res.exitCode === 0;
    } catch (e) {
      return false;
    }
  }

  // Neutralino.os.updateSpawnedProcess(pid, 'exit') only terminates the
  // single PID it tracks -- fine for ffmpeg (one real process, verified: it
  // spawns no children), but not for the bundled Windows yt-dlp.exe: it's a
  // PyInstaller onefile build whose top-level process is just a bootloader
  // that re-execs itself as a CHILD process to do the real work (confirmed
  // live: Get-CimInstance Win32_Process showed a second yt-dlp.exe with
  // ParentProcessId = the spawned PID). Killing only the parent orphans
  // that child, which keeps downloading in the background even though the
  // UI already shows "Cancelled" -- this is why cancel felt unreliable in
  // Downloader specifically (Converter's ffmpeg has no such child). Callers
  // should run this ALONGSIDE (not instead of) updateSpawnedProcess(pid,
  // 'exit') -- this best-effort-kills the OS-level tree, the other keeps
  // Neutralino's own internal bookkeeping/exit-event consistent.
  async function killProcessTree(pid) {
    try {
      if (isWindows()) {
        await global.Neutralino.os.execCommand(`taskkill /PID ${pid} /T /F`);
        return;
      }
      // macOS/Linux: yt-dlp's own binaries there aren't PyInstaller onefile
      // builds the same way, so this is a precautionary best-effort only --
      // kills any direct children of pid, not verified to be needed like
      // the Windows case above.
      await global.Neutralino.os.execCommand(`pkill -TERM -P ${pid}`);
    } catch (e) {
      /* already gone, or nothing to kill -- fine either way */
    }
  }

  global.EstellaLib = global.EstellaLib || {};
  global.EstellaLib.platform = {
    getOS,
    isWindows,
    sep,
    joinPath,
    ffmpegPath,
    qpdfCommand,
    img2pdfCommand,
    ytdlpPath,
    resolveBinPath,
    checkToolAvailable,
    killProcessTree,
  };
})(window);
