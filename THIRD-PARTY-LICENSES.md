# Third-party licenses

SORAI Toolkit's own code is MIT-licensed (see `LICENSE`). It bundles and
invokes the following third-party tools and fonts as **separate subprocesses
and asset files**, not linked into its own code — each keeps its own license
below. Bundling a GPL-licensed binary this way ("mere aggregation": the app
shells out to a standalone executable and never links against its libraries)
does not require SORAI Toolkit's own code to be GPL-licensed, but the bundled
binary itself remains fully subject to its own license terms.

## Bundled binaries (`binaries/<platform>/`)

- **ffmpeg** — Windows and macOS builds are compiled with `--enable-gpl`
  (they include the `libx264`/`libx265` encoders this app's video encoder
  picker exposes), so those two platforms' ffmpeg binaries are
  **GPL-licensed**:
  - Windows: [BtbN/FFmpeg-Builds](https://github.com/BtbN/FFmpeg-Builds), the `-gpl` release variant (see `setup.mjs`).
  - macOS: [evermeet.cx](https://evermeet.cx/ffmpeg/)'s static build.
  - Linux: [ffbinaries.com](https://ffbinaries.com/)'s prebuilt static binary — resolved dynamically at setup time; confirm its exact license/codec configuration against ffbinaries' own build notes before assuming it matches the Windows/macOS GPL builds.
  - ffmpeg's own license text: <https://github.com/FFmpeg/FFmpeg/blob/master/COPYING.GPLv3>. The Windows binary's exact corresponding source and build configuration are published by the builder itself at [BtbN/FFmpeg-Builds](https://github.com/BtbN/FFmpeg-Builds) (its CI configs pin the exact FFmpeg commit + `--enable-gpl` flags used for each release) — open an issue on this repo if you need a copy of the source archived alongside a specific bundled release.
- **yt-dlp** — [Unlicense](https://github.com/yt-dlp/yt-dlp/blob/master/LICENSE) (public domain dedication, no restrictions). Note: this is a licensing statement only — using yt-dlp to download from a given site may still be subject to that site's own Terms of Service, which is a separate concern from open-source licensing.
- **qpdf** (Windows only; macOS/Linux use a system install) — [Apache License 2.0](https://github.com/qpdf/qpdf/blob/main/LICENSE.txt).
- **img2pdf** (Windows only; macOS/Linux use a system install) — [LGPL-3.0](https://gitlab.mister-muffin.de/josch/img2pdf/-/blob/master/LICENSE).

## Bundled fonts (`resources/fonts/`)

- **Inter** — [SIL Open Font License 1.1](https://github.com/rsms/inter/blob/master/LICENSE.txt).
- **Noto Sans TC** (思源黑體) — [SIL Open Font License 1.1](https://github.com/notofonts/noto-cjk/blob/main/Sans/OFL.txt).
- **JetBrains Mono** (loaded via Google Fonts CDN, not bundled as a file) — [Apache License 2.0](https://github.com/JetBrains/JetBrainsMono/blob/master/OFL.txt).

## Key runtime/UI dependencies

- **Neutralino.js** — MIT.
- **React / React DOM** — MIT.
- **liquid-glass-react** — MIT.

Build-only tooling (Vite, Tailwind CSS, semantic-release, Playwright, etc.) isn't distributed in the packaged app, so its licenses don't affect end-user distribution — see each repo's own `package.json`/`node_modules` for those if needed.
