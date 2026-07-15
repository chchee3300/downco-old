// Main menu / tool picker. TOOLS is the single source of truth for what
// shows up here — adding a tool later (e.g. the Downloader, see the
// multi-repo restructure plan) means one more array entry plus one more
// branch in App.jsx's view switch, not a registry/plugin system (not
// justified yet for 2-3 tools). Card styling follows
// design-system/UI_STYLE_REFERENCE.md: existing --glass-radius/--accent
// tokens, border+surface layering, no new shadows.
const TOOLS = [
  {
    id: 'converter',
    label: 'Converter',
    description: 'Convert video, image, audio, and PDF files locally.',
  },
]

export default function HubMenu({ onSelectTool }) {
  return (
    <main className="main" id="hub-main">
      <div className="hub-grid">
        {TOOLS.map((tool) => (
          <button
            key={tool.id}
            className="hub-card"
            onClick={() => onSelectTool(tool.id)}
          >
            <span className="hub-card-title">{tool.label}</span>
            <span className="hub-card-desc">{tool.description}</span>
          </button>
        ))}
      </div>
    </main>
  )
}
