import HamburgerMenu from './HamburgerMenu.jsx'
import versionInfo from '../version.json'

// Hub-owned, persistent across every screen (hub menu and inside any tool)
// — this is why theme toggling, tool navigation, and the app version
// display all live here instead of in each tool's own view. The version
// used to live in Converter's StatusBar, but that's the hub's own release
// version, not a per-tool concern -- moved here during the multi-repo
// restructure (kept current by the release pipeline the same way it was
// before: see CLAUDE.md's src/version.json note). currentTool drives the
// breadcrumb; toolLabel is looked up by the caller (App.jsx) since
// HubMenu's TOOLS array is the single source of truth for tool display
// names.
export default function Header({ toolLabel, showBackToHub, onBackToHub, theme, onToggleTheme }) {
  return (
    <header className="header">
      <div className="header-left">
        <div className="logo">
          <span className="logo-text">SORAI Toolkit</span>
          <span className={toolLabel ? 'logo-sep' : 'logo-sep hidden'}>&nbsp;/&nbsp;</span>
          <span className="logo-type">{toolLabel || ''}</span>
        </div>
      </div>
      <div className="header-right">
        <span className="header-version">v{versionInfo.version}</span>
        <HamburgerMenu
          showBackToHub={showBackToHub}
          onBackToHub={onBackToHub}
          theme={theme}
          onToggleTheme={onToggleTheme}
        />
      </div>
    </header>
  )
}
