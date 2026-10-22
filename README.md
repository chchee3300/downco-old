# SORAI Toolkit

A desktop suite of local, no-upload file tools, built with [Neutralino.js](https://neutralino.js.org/) and React. This is the **hub repo**: the installable app itself — window shell, main-menu hub, theme, and in-app updates — composing individual tools that each live in their own repo.

## Tools

- **Converter** ([`sorai-toolkit-converter`](https://github.com/chchee3300/sorai-toolkit-converter)) — convert video, image, audio, and PDF files locally.
- **Downloader** ([`sorai-toolkit-downloader`](https://github.com/chchee3300/sorai-toolkit-downloader)) — download a video from a URL, pick a format, and save it locally (via `yt-dlp`).

Each tool repo is consumed here as an npm git dependency (`package.json`'s `dependencies`) and built automatically via its own `prepare` lifecycle script on `npm install` — no manual build step needed for either.

## Installation

Pick one:

- **Download a pre-built package** — grab the file for your OS from the [latest release](https://github.com/chchee3300/sorai-toolkit/releases/latest):
  - **Windows** — `sorai-toolkit_*_x64-setup.exe`. Per-user install into `%LOCALAPPDATA%\SORAI Toolkit\`, no admin prompt; adds the Explorer right-click menu.
  - **macOS** — `sorai-toolkit_*_mac_x64.dmg` (Intel) or `*_mac_arm64.dmg` (Apple Silicon). Open it and drag the app into Applications. These builds aren't code-signed, so the first launch needs right-click → Open (or System Settings → Privacy & Security → "Open Anyway") to get past Gatekeeper.
  - **Linux** — `sorai-toolkit_*_amd64.deb` (`sudo apt install ./sorai-toolkit_*_amd64.deb`) or `sorai-toolkit-*.x86_64.rpm` (`sudo dnf install ./sorai-toolkit-*.x86_64.rpm`). Both pull in `qpdf`, `img2pdf`, webkit2gtk and gtk3, and install the KDE Dolphin right-click menu. They ship their own `ffmpeg` and `yt-dlp` in `/usr/lib/SORAI Toolkit/` (not on `PATH`), so a distro `ffmpeg`/`yt-dlp` package is left alone.
- **Build it yourself from source** — see [Setup](#setup) below.

### Upgrading from 1.x (the Neutralino builds)

The first Tauri release can't be installed by a 1.x app's built-in updater; install it by hand once. After that, updates install themselves.

- **Windows: uninstall the old version first** (Settings → Apps → SORAI Toolkit → Uninstall), *then* run the new installer. The old version lives in `%LOCALAPPDATA%\Programs\SORAI Toolkit\`, the new one in `%LOCALAPPDATA%\SORAI Toolkit\`, but both write the same right-click menu registry keys — uninstalling the old one *after* installing the new one deletes the new version's right-click menu (reinstall the new version to get it back).
- **macOS**: drag the new app into Applications and replace the old one.
- **Linux**: install the new `.deb`/`.rpm` over the old one — same package name (`sorai-toolkit`), so it upgrades in place.

## How it works

The UI (React + Vite, in `src/`) runs inside a [Neutralino.js](https://neutralino.js.org/) shell, which gives it native filesystem access and the ability to spawn local command-line tools. Each tool's own conversion/download logic lives in its own repo; this repo provides the shared runtime globals both tools call into (`resources/js/lib/platform.js` and friends — `window.EstellaLib.*`) plus the actual bundled third-party binaries:

- [`ffmpeg`](https://ffmpeg.org/) — video/image/audio conversion (Converter) and stream merging (Downloader, via `--ffmpeg-location`). Bundled on every platform.
- [`yt-dlp`](https://github.com/yt-dlp/yt-dlp) — video metadata/download (Downloader). Bundled on every platform, fetched live from yt-dlp's own GitHub releases (not a pinned version, since it cuts releases often).
- [`qpdf`](https://qpdf.readthedocs.io/) — PDF optimization (Converter). Bundled on Windows; on macOS/Linux it's a system-installed dependency (`brew`/`apt`/etc.).
- [`img2pdf`](https://gitlab.mister-muffin.de/josch/img2pdf) — image-to-PDF conversion (Converter). Bundled on Windows; on macOS/Linux it's a system-installed dependency (`pip`).

These live in per-platform folders under `binaries/` (`win_x64/`, `mac_x64/`, `mac_arm64/`, `linux_x64/`), fetched by `setup.mjs`.

Inter and Noto Sans TC (思源黑體) are bundled locally as `@font-face` woff2 files under `resources/fonts/` (so Traditional Chinese UI text renders consistently even fully offline); JetBrains Mono still loads from Google Fonts.

## Requirements

Building from source needs:

- [Node.js](https://nodejs.org/) (for the Vite build and `setup.mjs`)
- The [Neutralino CLI](https://neutralino.js.org/docs/cli/neu-cli) — installed automatically by `npm run setup`
- Windows, macOS, or Linux
- **macOS/Linux only**: `qpdf` and `img2pdf` must be installed system-wide for Converter's PDF features (`brew install qpdf` / `sudo apt install qpdf`, and `pip install img2pdf`) — ffmpeg and yt-dlp are bundled on every platform. This applies whether you built from source or installed a pre-built `.deb`/`.rpm`/`.dmg`.

## Setup

```bash
npm install
npm run setup
```

`npm install` also triggers each tool repo's own `prepare` script (via its git dependency), building `sorai-toolkit-converter`/`sorai-toolkit-downloader`'s `dist/index.js` automatically.

`npm run setup` chains everything a fresh clone needs:

```bash
npm install -g @neutralinojs/neu@11.7.1   # pinned -- see note below
neu update                                 # fetches the Neutralino client lib + runtime binaries (bin/, gitignored)
node scripts/copy-neutralino-client.mjs    # neu update writes the client lib to web-dist/js/ (per
                                            # neutralino.config.json's clientLibrary); vite.config.mjs
                                            # re-copies it from resources/js/ (its source of truth, also
                                            # gitignored) on every build, so this needs doing once
node setup.mjs                             # downloads ffmpeg + yt-dlp (all platforms) into binaries/, plus
                                            # qpdf/img2pdf on Windows; on macOS/Linux it checks for system
                                            # qpdf/img2pdf and prints install hints if missing
```

The `@neutralinojs/neu` version is pinned rather than left at `latest`: as of this writing, the latest published version (`11.7.2`) declares a `uuid` dependency range that resolves to an ESM-only release, which crashes its own (CommonJS) code with `ERR_REQUIRE_ESM` on install. `11.7.1` is the last version that doesn't have this problem — worth re-checking occasionally in case upstream fixes it.

## Development

```bash
npm run dev         # start the Vite dev server (UI only, in a browser)
neu run             # launch the Neutralino desktop shell -- serves whatever's already in web-dist/,
                     # it does NOT build anything itself; run `npm run build` first (or use dev:watch below)
npm run dev:watch   # rebuilds automatically on save, then launches neu run -- see below
```

`neu run` serves the app from `web-dist/`, which is built from `src/` via Vite — `npm run build` regenerates it.

Changing a tool's own logic (Converter/Downloader) happens in that tool's own repo. Since those are consumed here as npm git dependencies, editing their source doesn't touch this repo's `node_modules` copy on its own — either `npm install` again (or `npm update sorai-toolkit-converter`/`sorai-toolkit-downloader`) once those changes are pushed, or, for local iteration before pushing:

```bash
npm run dev:watch
```

`scripts/dev-watch.mjs` rebuilds whichever of this hub or a sibling `sorai-toolkit-converter`/`sorai-toolkit-downloader` checkout just changed, copies the tool's `dist/` into this repo's `node_modules`, rebuilds `web-dist/`, and launches `neu run` — which then live-reloads on every subsequent save. Assumes the two tool repos are cloned as sibling folders next to this one; override with `CONVERTER_REPO`/`DOWNLOADER_REPO` env vars otherwise. Windows/macOS only (uses `fs.watch({ recursive: true })`, unsupported on Linux).

## Project structure

```
src/                 Hub shell (main menu, hamburger menu, theme, in-app update banner)
resources/           Static assets served by Neutralino (icons, styles, neutralino.js client,
                      platform/command-builder libs shared by both tools)
binaries/            Bundled conversion binaries, per platform (fetched by setup.mjs):
                       win_x64/    ffmpeg.exe, yt-dlp.exe, qpdf.exe, img2pdf.exe + runtime DLLs
                       mac_x64/    ffmpeg, yt-dlp
                       mac_arm64/  ffmpeg, yt-dlp
                       linux_x64/  ffmpeg, yt-dlp
bin/                 Neutralino runtime binaries (per-platform)
tests/               Regression/E2E test scripts and their fixture files (tests/fixtures/)
packaging/           Per-platform installer/package build scripts (linux/, windows/, macos/)
scripts/             Setup and CI helper scripts (neutralino.js client copy, version computation/stamping)
neutralino.config.json   Neutralino app configuration (window size, allowed native APIs, etc.)
setup.mjs            Downloads the third-party conversion binaries (cross-platform)
```

## Testing

```bash
node tests/test_conversion.js        # Converter golden-master regression suite
node tests/test_drop.js              # Converter file drag-and-drop behavior
node tests/test_crop_ui.js           # Converter image crop UI
node tests/test_image_crop_commands.js
node tests/test_download.js          # Downloader: real metadata fetch + real download, through the hub
```

All drive the real composed app end-to-end via Playwright and a `neu run` instance, so they must be run from the project root. Fixtures live in `tests/fixtures/`.

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
