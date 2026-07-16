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
const ConverterIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 12a8 8 0 0 1 14-5.3" />
    <path d="M20 12a8 8 0 0 1-14 5.3" />
    <path d="M18 3v4h-4" />
    <path d="M6 21v-4h4" />
  </svg>
)

const DownloaderIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 4v12" />
    <path d="M7 12l5 5 5-5" />
    <path d="M4 20h16" />
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
