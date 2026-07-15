import HamburgerMenu from './HamburgerMenu.jsx'

// Hub-owned, persistent across every screen (hub menu and inside any tool)
// — this is why theme toggling and tool navigation live here instead of in
// each tool's own view. currentTool drives the breadcrumb; toolLabel is
// looked up by the caller (App.jsx) since HubMenu's TOOLS array is the
// single source of truth for tool display names.
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
