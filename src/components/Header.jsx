import HamburgerMenu from './HamburgerMenu.jsx'
import { useTranslation } from '../hooks/useTranslation.js'
import versionInfo from '../version.json'
import logoDark from '../../resources/icons/appIcon-dark.png'
import logoLight from '../../resources/icons/appIcon-light.png'

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
export default function Header({ toolLabel, showBackToHub, onBackToHub, theme, onToggleTheme, updater }) {
  const { t } = useTranslation()
  // Only the mark itself is the click target -- "Toolkit" / the breadcrumb
  // text next to it reads as a label, not a button, so it stays a plain
  // <span> even when showBackToHub is true. Used to be the whole .logo row
  // (text included); narrowed after feedback that the wider hit area read
  // wrong and the hover feedback (recoloring the text) was the wrong
  // affordance for an icon -- a scale-up on the mark itself reads more like
  // a real button.
  const mark = (
    <img
      src={theme === 'light' ? logoLight : logoDark}
      alt=""
      className="logo-mark"
    />
  )
  return (
    <header className="header">
      <div className="header-left">
        <div className="logo">
          {showBackToHub ? (
            <button
              type="button"
              className="logo-mark-button"
              onClick={onBackToHub}
              aria-label={t('header.backToHub')}
            >
              {mark}
            </button>
          ) : (
            mark
          )}
          <span className="logo-text">Toolkit</span>
          <span className={toolLabel ? 'logo-sep' : 'logo-sep hidden'}>&nbsp;/&nbsp;</span>
          <span className="logo-type">{toolLabel || ''}</span>
        </div>
      </div>
      <div className="header-right">
        <span className="header-version">v{versionInfo.version}</span>
        <HamburgerMenu
          theme={theme}
          onToggleTheme={onToggleTheme}
          updater={updater}
        />
      </div>
    </header>
  )
}
