# SORAI Toolkit

A desktop suite of local, no-upload file tools, built with [Tauri v2](https://tauri.app/) and React. This is the **hub repo**: the installable app itself — window shell, main-menu hub, tray, single instance, theme, in-app updates, packaging — composing individual tools that each live in their own repo.

## Tools

- **Converter** ([`sorai-toolkit-converter`](https://github.com/chchee3300/sorai-toolkit-converter)) — convert video, image, audio, and PDF files locally.
- **Downloader** ([`sorai-toolkit-downloader`](https://github.com/chchee3300/sorai-toolkit-downloader)) — download a video from a URL, pick a format, and save it locally (via `yt-dlp`).

Each tool repo is a Tauri plugin: a Rust crate (`plugin/`, the command building, output parsing and process running) plus a React UI package. Both halves come from one npm git dependency (`package.json`'s `dependencies`, built by the tool's own `prepare` script on `npm install`); `src-tauri/Cargo.toml` points at the crate inside it through a link that `scripts/siblings.mjs` generates.

## Installation

Pick one:

- **Download a pre-built package** — grab the file for your OS from the [latest release](https://github.com/chchee3300/sorai-toolkit/releases/latest):
  - **Windows** — `sorai-toolkit_*_x64-setup.exe`. Per-user install into `%LOCALAPPDATA%\SORAI Toolkit\`, no admin prompt; adds the Explorer right-click menu: **SORAI Toolkit** → your presets for that file type, *Open in SORAI Toolkit…*, *Manage presets…*. The menu follows the app's language and is rewritten on every start. Windows hides static right-click items when more than 15 files are selected; for bigger batches, drag the files into the app instead.
  - **macOS** — `sorai-toolkit_*_mac_x64.dmg` (Intel) or `*_mac_arm64.dmg` (Apple Silicon). Open it and drag the app into Applications. These builds aren't code-signed, so the first launch needs right-click → Open (or System Settings → Privacy & Security → "Open Anyway") to get past Gatekeeper.
  - **Linux** — `sorai-toolkit_*_amd64.deb` (`sudo apt install ./sorai-toolkit_*_amd64.deb`) or `sorai-toolkit-*.x86_64.rpm` (`sudo dnf install ./sorai-toolkit-*.x86_64.rpm`). Both pull in `qpdf`, `img2pdf`, webkit2gtk and gtk3, and install the KDE Dolphin right-click menu. They ship their own `ffmpeg` and `yt-dlp` in `/usr/lib/SORAI Toolkit/` (not on `PATH`), so a distro `ffmpeg`/`yt-dlp` package is left alone.
- **Build it yourself from source** — see [Setup](#setup) below.

### Upgrading from 1.x (the Neutralino builds)

The first Tauri release can't be installed by a 1.x app's built-in updater; install it by hand once. After that, updates install themselves.

- **Windows: uninstall the old version first** (Settings → Apps → SORAI Toolkit → Uninstall), *then* run the new installer. The old version lives in `%LOCALAPPDATA%\Programs\SORAI Toolkit\`, the new one in `%LOCALAPPDATA%\SORAI Toolkit\`, but both write the same right-click menu registry keys — uninstalling the old one *after* installing the new one deletes the new version's right-click menu (reinstall the new version to get it back).
- **macOS**: drag the new app into Applications and replace the old one.
- **Linux**: install the new `.deb`/`.rpm` over the old one — same package name (`sorai-toolkit`), so it upgrades in place.

## How it works

The UI (React + Vite, in `src/`) runs in the system webview of a [Tauri](https://tauri.app/) app (`src-tauri/`). The hub's Rust side registers the two tool plugins and the shell features (single instance, updater, dialogs, notifications, tray); each tool's Rust plugin runs the bundled command-line tools as Tauri sidecars:

- [`ffmpeg`](https://ffmpeg.org/) — video/image/audio conversion (Converter) and stream merging (Downloader, via `--ffmpeg-location`). Bundled on every platform.
- [`yt-dlp`](https://github.com/yt-dlp/yt-dlp) — video metadata/download (Downloader). Bundled on every platform, fetched live from yt-dlp's own GitHub releases (not a pinned version, since it cuts releases often).
- [`qpdf`](https://qpdf.readthedocs.io/) — PDF optimization (Converter). Bundled on Windows; on macOS/Linux it's a system-installed dependency (`brew`/`apt`/etc.).
- [`img2pdf`](https://gitlab.mister-muffin.de/josch/img2pdf) — image-to-PDF conversion (Converter). Bundled on Windows; on macOS/Linux it's a system-installed dependency (`pip`).

`setup.mjs` downloads these into per-platform folders under `binaries/` (`win_x64/`, `mac_x64/`, `mac_arm64/`, `linux_x64/`); `scripts/copy-sidecars.mjs` copies them into `src-tauri/binaries/` under the names Tauri's `externalBin` expects, before every `tauri dev`/`tauri build`.

Inter and Noto Sans TC (思源黑體) are bundled locally as `@font-face` woff2 files under `resources/fonts/` (so Traditional Chinese UI text renders consistently even fully offline); JetBrains Mono still loads from Google Fonts.

## Requirements

Building from source needs:

- [Node.js](https://nodejs.org/) and a [Rust toolchain](https://rustup.rs/) (see Tauri's [prerequisites](https://tauri.app/start/prerequisites/) for the per-OS system packages, e.g. webkit2gtk on Linux)
- Windows, macOS, or Linux
- **macOS/Linux only**: `qpdf` and `img2pdf` must be installed system-wide for Converter's PDF features (`brew install qpdf` / `sudo apt install qpdf`, and `pip install img2pdf`) — ffmpeg and yt-dlp are bundled on every platform. This applies whether you built from source or installed a pre-built `.deb`/`.rpm`/`.dmg`.

## Setup

```bash
npm ci
npm run setup     # node setup.mjs: downloads ffmpeg + yt-dlp (all platforms) into binaries/, plus
                  # qpdf/img2pdf on Windows; on macOS/Linux it checks for system qpdf/img2pdf
```

`npm ci` also triggers each tool repo's own `prepare` script (via its git dependency), building `sorai-toolkit-converter`/`sorai-toolkit-downloader`'s `dist/index.js`.

## Development

```bash
npm run tauri:dev   # Vite dev server + tauri dev, one command
```

If `sorai-toolkit-converter`/`sorai-toolkit-downloader` are checked out as sibling folders next to this one (override the paths with `CONVERTER_REPO`/`DOWNLOADER_REPO`), dev mode uses them instead of `node_modules`: their `src/` hot-reloads through Vite and edits to their `plugin/` crate rebuild and restart the app. Without siblings it uses the npm git dependency's copy.

Other env vars: `VITE_PORT` (default 5173) and `CDP_PORT` (default 9229, the WebView2 remote-debugging port the E2E tests connect to) — set both to run several checkouts side by side.

## Project structure

```
src/                 Hub UI (main menu, hamburger menu, settings, about, update banner)
src-tauri/           Tauri app: Rust entry (lib.rs, self_install.rs), tauri*.conf.json, capabilities, icons
resources/           Stylesheet, fonts, icons, and the UI-only runtime globals both tools use
                      (liquid-glass.js, lib/i18n.js, lib/range-fill.js)
binaries/            Bundled third-party binaries, per platform (fetched by setup.mjs, gitignored):
                       win_x64/    ffmpeg.exe, yt-dlp.exe, qpdf.exe, img2pdf.exe + runtime DLLs
                       mac_x64/    ffmpeg, yt-dlp
                       mac_arm64/  ffmpeg, yt-dlp
                       linux_x64/  ffmpeg, yt-dlp
tests/e2e/           End-to-end tests against the real Tauri window (fixtures in tests/fixtures/)
packaging/           Windows NSIS installer hooks, KDE ServiceMenu generator
scripts/             Dev/build helpers (tauri-dev, siblings, copy-sidecars, version stamping, updater manifest)
setup.mjs            Downloads the third-party binaries (cross-platform)
```

## Testing

```bash
npm run test:e2e                  # every tests/e2e/*.test.mjs
npm run test:e2e -- converter     # only files whose name contains "converter"
(cd src-tauri && cargo test)      # hub Rust (self-install file generation)
```

`test:e2e` starts `tauri dev` with a fresh WebView2 profile, connects Playwright over CDP to the real window, and runs real conversions/downloads (the Downloader tests need network). Each tool's pure logic is tested in its own repo with `cd plugin && cargo test`. Drag-and-drop, the tray, and right-click menus need a real mouse and aren't automated.

## Releases

Versioning and GitHub Releases are automated with [semantic-release](https://semantic-release.gitbook.io/), driven by [Conventional Commits](https://www.conventionalcommits.org/) on `master`:

- `fix: ...` → patch release
- `feat: ...` → minor release
- `feat: ...` + a `BREAKING CHANGE:` footer (or `!` after the type, e.g. `feat!: ...`) → major release
- Other prefixes (`chore:`, `docs:`, `refactor:`, `test:`, etc.) don't trigger a release

Every push to `master` runs `.github/workflows/release.yml`, which:
1. Computes whether a release is warranted and, if so, the next version (`scripts/get-next-version.mjs`, semantic-release in dry-run).
2. Runs `tauri build` for Windows (NSIS), Linux (`.deb` + `.rpm`), and macOS (`.dmg` + updater `.app.tar.gz`, Intel and Apple Silicon) in parallel, signing every updater payload with the updater key.
3. Writes `latest.json` (`scripts/updater-manifest.mjs`) and publishes the GitHub Release with the packages and `latest.json` attached, and updates `CHANGELOG.md`.

No manual version bumping or tagging — the version number lives entirely in git tags/GitHub Releases, driven by commit messages. `scripts/write-version.mjs` stamps the computed version into `src/version.json` (the update checker's baseline) and `src-tauri/tauri.conf.json` before each build, and the release commit writes both back.

**Dry run** (no signing key needed, publishes nothing): Actions → Release → Run workflow on any branch with `dry_run` checked. It builds all four packages unsigned as version `0.0.<run number>` and keeps them as workflow artifacts for a week.

#### Updater signing key (maintainer, one-time)

1. `npx tauri signer generate -w ~/.tauri/sorai-toolkit.key` — pick a password. Keep the private key out of the repo.
2. Repo Settings → Secrets and variables → Actions: `TAURI_SIGNING_PRIVATE_KEY` = contents of `sorai-toolkit.key`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` = the password.
3. Paste the contents of `sorai-toolkit.key.pub` into `src-tauri/tauri.conf.json` → `plugins.updater.pubkey` (replacing the `PLACEHOLDER-…` string) and commit. The workflow refuses to release while the placeholder is still there.

Losing the private key means installed apps can never verify another update — back it up.

To build packages locally: `npx tauri build` (after `npm ci` and `node setup.mjs`). Local builds are unsigned — `createUpdaterArtifacts` is only switched on in CI via `src-tauri/tauri.release.conf.json`. Output lands in `src-tauri/target/release/bundle/`.

### In-app updates

On launch, the app checks `GET /repos/chchee3300/sorai-toolkit/releases/latest` and compares it against `src/version.json`. If a newer version is available (`src/hooks/useUpdateChecker.js`, `src/components/UpdateBanner.jsx`):

- **Official builds** (built by the workflow, `VITE_OFFICIAL_BUILD=true`): a toast offers "Update now", which hands off to the Tauri updater plugin — it fetches `latest.json`, verifies the signature, installs, and relaunches. Windows runs the NSIS installer in passive mode; Linux runs `dpkg -i` or `rpm -U` behind a pkexec/sudo password prompt (whichever format is installed); macOS replaces the `.app`.
- **Self-built copies**: only a badge in the menu and About; clicking it opens the release page.

## License

[MIT](LICENSE) for this repo's own code (and Converter's/Downloader's — see their own repos). The bundled third-party binaries and fonts keep their own licenses, including a GPL-licensed ffmpeg build on Windows/macOS — see [`THIRD-PARTY-LICENSES.md`](THIRD-PARTY-LICENSES.md) for the full breakdown and why bundling it this way (invoked as a subprocess, never linked) doesn't require this app's own code to be GPL.
