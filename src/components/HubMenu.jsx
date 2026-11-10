import { useTranslation } from '../hooks/useTranslation.js'

// Main menu / tool picker. TOOLS is the single source of truth for what
// shows up here — adding a tool later (e.g. the Downloader, see the
// multi-repo restructure plan) means one more array entry plus one more
// branch in App.jsx's view switch, not a registry/plugin system (not
// justified yet for 2-3 tools). Card styling follows
// design-system/UI_STYLE_REFERENCE.md: existing --glass-radius/--accent
// tokens, border+surface layering, no new shadows.
// Icons follow the app's existing linework (stroke-based, round caps,
// viewBox 24x24) established by .drop-zone-icon/.intro-icon — no icon
// library, just inline SVG matched to that visual language.
// label/desc are dict keys, not literal text -- TOOLS itself stays a
// module-level constant (icon components are stable references and don't
// need to be reactive), resolved through t() at render time so switching
// languages actually re-renders this list. App.jsx's header breadcrumb
// reuses these same `hub.tool.<id>.label` keys instead of duplicating the
// strings a second time.
// The two tool icons are the downco logo split in two (geometry: resources/brand/source/tool-icons.py,
// paths copied from its output): the Converter is its loop, closed into
// two arrowed halves, the Downloader its drop (turn, stem, arrowhead) onto a line.
const ConverterIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4.76 10.06A7.5 7.5 0 0 1 18.8 8.83" />
    <path d="M15.79 7.74l3.01 1.09 1.09-3.01" />
    <path d="M19.24 13.94A7.5 7.5 0 0 1 5.2 15.17" />
    <path d="M8.21 16.26l-3.01-1.09-1.09 3.01" />
  </svg>
)

const DownloaderIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M18.5 4A6.5 6.5 0 0 0 12 10.5v7" />
    <path d="M9.03 14.53L12 17.5l2.97-2.97" />
    <path d="M5 20.5h14" />
  </svg>
)

const TOOLS = [
  { id: 'converter', icon: ConverterIcon },
  { id: 'downloader', icon: DownloaderIcon },
]

export default function HubMenu({ onSelectTool }) {
  const { t } = useTranslation()
  return (
    <main className="main" id="hub-main">
      <div className="hub-grid">
        {TOOLS.map((tool) => (
          <button
            key={tool.id}
            className="hub-card"
            onClick={() => onSelectTool(tool.id)}
          >
            <span className="hub-card-icon">
              <tool.icon />
            </span>
            <span className="hub-card-body">
              <span className="hub-card-title">{t(`hub.tool.${tool.id}.label`)}</span>
              <span className="hub-card-desc">{t(`hub.tool.${tool.id}.desc`)}</span>
            </span>
          </button>
        ))}
      </div>
    </main>
  )
}
