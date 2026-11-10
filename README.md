# downco

downco is a desktop app for downloading videos and converting media files. Everything runs on your computer, and no file is uploaded anywhere. It runs on Windows, macOS and Linux, and is built with [Tauri v2](https://tauri.app/) and React.

Until version 2.2.0 it was called SORAI Toolkit.

## What it does

**Converter** ([`downco-co`](https://github.com/chchee3300/downco-co))

- Video to MP4, MKV, WebM, AVI, MOV, M4V, TS, WMV, MPG, GIF or APNG. You can also save one frame as a PNG, or keep only the sound as M4A or MP3.
- Audio to MP3, WAV, AAC, M4A (AAC or lossless ALAC), FLAC, OGG, Opus, AIFF, WMA or AC3.
- Images to JPG, PNG, WebP, AVIF, ICO or PDF.
- PDF: compress, linearize, extract pages, split into one file per page, rotate, add a password, and preview before converting.
- Word documents (`.docx`, `.doc`, `.odt`, `.rtf`) to PDF, DOCX, ODT, RTF, HTML, Markdown or plain text, once the optional WordCraft converter is installed.
- Trim and crop video, change speed, pick the codec and quality, or set a target file size such as "under 25 MB".
- Merge several videos, audio files or PDFs into one file.

**Downloader** ([`downco-down`](https://github.com/chchee3300/downco-down))

- Paste a link, then choose the video and audio quality. YouTube, Twitch and X are recognized, and any other site [yt-dlp](https://github.com/yt-dlp/yt-dlp) supports also works.
- Download several videos in a queue, or clip a video to a start and end time before downloading.

**Right-click menu**

Save conversion settings as a preset, then run it from the file manager without opening the main window. A small progress window shows the conversion.

- On Windows the presets appear under **downco** in the Explorer menu.
- On macOS they appear as Finder Quick Actions.
- On Linux they appear in Dolphin (KDE) and in Nautilus's Scripts menu (GNOME).

Windows hides right-click items when more than 15 files are selected. Drag larger batches into the app instead.

## Install

Download the file for your system from the [latest release](https://github.com/chchee3300/downco/releases/latest).

| System | File | Notes |
|---|---|---|
| Windows | `downco_*_x64-setup.exe` | Installs for the current user into `%LOCALAPPDATA%\downco\`, without an administrator prompt. |
| macOS (Apple Silicon) | `downco_*_mac_arm64.dmg` | Drag the app into Applications. The app isn't code-signed, so the first launch needs right-click → Open, or System Settings → Privacy & Security → Open Anyway. |
| macOS (Intel) | `downco_*_mac_x64.dmg` | Same as above. |
| Debian / Ubuntu | `downco_*_amd64.deb` | `sudo apt install ./downco_*_amd64.deb` |
| Fedora | `downco-*.x86_64.rpm` | `sudo dnf install ./downco-*.x86_64.rpm` |

The app checks for updates when it starts. Official builds install an update after you confirm it. On Linux this asks for your password.

On macOS and Linux, the PDF features need `qpdf` and `img2pdf` from your system (`brew install qpdf` or `sudo apt install qpdf`, and `pip install img2pdf`). The `.deb` and `.rpm` packages install them for you. ffmpeg and yt-dlp come with the app on every system. On Linux they live in `/usr/lib/downco/`, so the app doesn't replace your distribution's copies.

### Third-party software

Settings → Third-party software lists the tools downco uses. It shows each tool's version and license, and can check for newer versions of the bundled ones.

| Tool | Used for | How you get it |
|---|---|---|
| ffmpeg | Converting video, audio and images, and merging downloaded streams | Included |
| yt-dlp | Downloading | Included |
| qpdf, img2pdf | PDF operations, images to PDF | Included on Windows, system packages elsewhere |
| Ghostscript | Smaller PDFs when compressing (downco keeps whichever result is smaller) | Optional download on Windows |
| WordCraft | Converting Word documents (alpha) | Optional download on Windows |
| Deno | Lets yt-dlp see every YouTube format | Optional download on Windows |
| oxipng | Shrinks PNG output without losing quality | Optional download on Windows |

On macOS and Linux the app doesn't download the optional tools. Settings shows how to install each one yourself: a `brew` or `apt` command, or for WordCraft a link to its releases.

### Upgrading from SORAI Toolkit

Update as usual, either inside the app or by running the new installer.

- **Windows:** the installer moves your presets, settings and downloaded tools to downco's folders. It then uninstalls SORAI Toolkit, including its Start menu entry, right-click menu and install folder.
- **Linux:** the `downco` package replaces the `sorai-toolkit` package.
- **macOS:** drag downco into Applications and delete SORAI Toolkit. downco picks up the old settings the first time it starts.

### Upgrading from 1.x

Versions 1.x can't install a newer version through their built-in updater, so install it by hand once.

- **Windows:** uninstall the old version first (Settings → Apps → SORAI Toolkit), then run the installer. Uninstalling the old version afterwards would delete the new version's right-click menu. Reinstalling downco brings it back.
- **macOS:** replace the old app in Applications.
- **Linux:** install the new package over the old one.

## Development

This is the hub repository: the app window, home screen, settings, tray, right-click menu, updater, installers and release pipeline. The Converter and Downloader each live in their own repository as a Tauri plugin (a Rust crate plus a React UI). The hub installs them as npm git dependencies. Their npm package names are still `sorai-toolkit-converter` and `sorai-toolkit-downloader`.

You need [Node.js](https://nodejs.org/), a [Rust toolchain](https://rustup.rs/) and Tauri's [system prerequisites](https://tauri.app/start/prerequisites/). On macOS and Linux you also need the system `qpdf` and `img2pdf` mentioned above.

```bash
npm ci              # also builds the Converter and Downloader packages
npm run setup       # downloads ffmpeg, yt-dlp (and on Windows qpdf, img2pdf) into binaries/
npm run tauri:dev   # Vite dev server and the app in one command
```

If the tool repositories are checked out next to this one (`../sorai-toolkit-converter`, `../sorai-toolkit-downloader`, or the paths in `CONVERTER_REPO` and `DOWNLOADER_REPO`), dev mode uses those checkouts. Changes to their `src/` reload in place, and changes to their Rust crate rebuild and restart the app. Without them, dev mode uses the copies in `node_modules`.

To run several checkouts at once, give each its own `VITE_PORT` (default 5173) and `CDP_PORT` (default 9229, the WebView2 debugging port the tests connect to).

```
src/            Hub UI: home screen, settings, About, update banner, progress window
src-tauri/      Tauri app: Rust code (menu, migration, self-install), configs, icons
resources/      Shared stylesheet, fonts, icons, brand assets (resources/brand/)
packaging/      Windows installer hooks, KDE menu generator
scripts/        Dev and build helpers (dev server, sidecars, version stamping, updater manifest)
tests/e2e/      End-to-end tests against the real app window
binaries/       Third-party programs per platform (downloaded by setup.mjs, not committed)
```

### Tests

```bash
npm run test:e2e                # every tests/e2e/*.test.mjs
npm run test:e2e -- converter   # only files whose name contains "converter"
(cd src-tauri && cargo test)    # hub Rust tests
```

The end-to-end tests start the app with a fresh WebView2 profile, connect Playwright to the real window, and run real conversions and downloads. The download tests need a network connection. Each tool repository has its own Rust tests (`cd plugin && cargo test`). Drag and drop, the tray and the right-click menus need a real mouse, so they are checked by hand.

### Releases

Every push to `master` runs `.github/workflows/release.yml`. [semantic-release](https://semantic-release.gitbook.io/) reads the [Conventional Commits](https://www.conventionalcommits.org/) since the last release:

- `fix:` makes a patch release and `feat:` a minor release.
- `feat!:` or a `BREAKING CHANGE:` footer makes a major release.
- Other types (`docs:`, `chore:`, `refactor:`, `test:`) don't release.

When a release is due, the workflow builds the Windows installer, `.deb` and `.rpm`, and the macOS `.dmg` files for Intel and Apple Silicon. It signs the update packages, writes `latest.json`, publishes the GitHub release and updates `CHANGELOG.md`. Version numbers come from git tags, so nothing is bumped by hand.

To try the build without publishing, open Actions → Release → Run workflow and tick `dry_run`. It builds unsigned packages and keeps them as workflow artifacts for a week. For a local build, run `npx tauri build`. The output goes to `src-tauri/target/release/bundle/` and isn't signed.

The updater signing key lives in the repository secrets `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`, and the matching public key is in `src-tauri/tauri.conf.json`. Back the key up: without it, installed copies can't verify another update.

## License

downco's own code, including the Converter and Downloader, is [MIT](LICENSE). The bundled programs and fonts keep their own licenses. This includes a GPL build of ffmpeg on Windows and macOS, which downco runs as a separate program and doesn't link. [`THIRD-PARTY-LICENSES.md`](THIRD-PARTY-LICENSES.md) has the details.
