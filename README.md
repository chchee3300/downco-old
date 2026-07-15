# SORAI Toolkit

The main hub app for SORAI Toolkit — a desktop suite of local, no-upload file tools, built with [Neutralino.js](https://neutralino.js.org/) and React. This repo owns the shell (window, hub menu, theme, in-app updates) and composes individual tools.

**Status**: Phase A of a multi-repo restructure (see `CLAUDE.md` and `~/.claude/plans/mac-linux-reactive-metcalfe.md` for the full plan). The Converter tool is currently copied directly into this repo (`src/components/ConverterView.jsx`) rather than consumed as a separate package — that split happens in Phase B.

## Setup

```bash
npm install
npm run setup   # installs the pinned Neutralino CLI, fetches the client lib + runtime, downloads ffmpeg/qpdf/img2pdf
```

## Development

```bash
npm run dev     # Vite dev server (UI only, in a browser)
neu run         # build the web UI and launch the Neutralino desktop shell
```

## Testing

```bash
node tests/test_conversion.js
node tests/test_drop.js
node tests/test_crop_ui.js
node tests/test_image_crop_commands.js
```

## License

MIT
