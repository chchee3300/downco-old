import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Header from './components/Header.jsx'
import HubMenu from './components/HubMenu.jsx'
import UpdateBanner from './components/UpdateBanner.jsx'
import CloseConfirmModal from './components/CloseConfirmModal.jsx'
import { ConverterApp } from 'sorai-toolkit-converter'
import { DownloaderApp } from 'sorai-toolkit-downloader'
import { useTheme } from './hooks/useTheme.js'
import { useTranslation } from './hooks/useTranslation.js'
import { useUpdateChecker } from './hooks/useUpdateChecker.js'
import { useCloseBehavior } from './hooks/useCloseBehavior.js'
import { useSingleInstance } from './hooks/useSingleInstance.js'
import { ensureFinderServicesInstalled } from './lib/macFinderServices.js'
import { ensureNautilusScriptsInstalled } from './lib/linuxNautilusScripts.js'

// Hub shell: owns which tool is currently shown. Plain conditional
// rendering, not a router -- there's no history/deep-linking need for a
// desktop app with 2-3 top-level screens. Adding a tool later means one
// more branch here plus one more HubMenu.TOOLS entry, not a rework.
function App() {
  const { theme, toggleTheme } = useTheme()
  const { t } = useTranslation()
  const [currentTool, setCurrentTool] = useState('hub')
  // Hub-level concern: one checker for the whole app (checks on mount,
  // re-checkable from the hamburger menu), one toast regardless of which
  // tool is showing.
  const updater = useUpdateChecker()
  // Hub-level concern, same reasoning as updater above -- one instance for
  // the whole app regardless of which tool is showing, since the close (X)
  // button applies to the whole window, not a per-tool concept.
  const closeBehavior = useCloseBehavior()
  // Explorer/Finder/Files right-click launches (cold start or forwarded
  // from a second instance) both land here as the same pendingLaunch
  // shape -- see useSingleInstance.js. !ready/!isPrimary render nothing
  // below (a secondary instance never shows a window at all).
  const { ready, isPrimary, pendingLaunch } = useSingleInstance()

  useEffect(() => {
    if (pendingLaunch) setCurrentTool('converter')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingLaunch?.seq])

  // macOS Finder Quick Actions / GNOME Nautilus Scripts have no install-
  // time hook the way Windows' registry (installer.iss) or KDE Dolphin's
  // ServiceMenu (packaging/linux/build.sh) do -- see macFinderServices.js
  // / linuxNautilusScripts.js for why the app self-installs these itself,
  // idempotently, on every primary-instance startup. Each is a no-op on
  // the "wrong" platform (checked via EstellaLib.platform.getOS() /
  // XDG_CURRENT_DESKTOP respectively) and swallows its own errors, so a
  // failure here never blocks startup or the normal file-open flow.
  useEffect(() => {
    if (!isPrimary || !ready) return
    const os = window.EstellaLib?.platform.getOS()
    if (os === 'Darwin') ensureFinderServicesInstalled().catch(() => {})
    if (os === 'Linux') ensureNautilusScriptsInstalled().catch(() => {})
  }, [isPrimary, ready])

  // Reuses HubMenu.jsx's own `hub.tool.<id>.label` dict keys instead of a
  // separate TOOL_LABELS map, so the breadcrumb and the hub card never
  // drift out of sync the way two hand-duplicated literal strings could.
  const toolLabel = currentTool === 'hub' ? undefined : t(`hub.tool.${currentTool}.label`)

  // Window stays invisible (see neutralino.config.json's modes.window.hidden)
  // until we know whether this process is the primary instance -- a
  // secondary instance hands its launch off to the primary and exits
  // without ever rendering anything real.
  if (!ready || !isPrimary) return null

  return (
    <div className="app-shell">
      <Header
        toolLabel={toolLabel}
        showBackToHub={currentTool !== 'hub'}
        onBackToHub={() => setCurrentTool('hub')}
        theme={theme}
        onToggleTheme={toggleTheme}
        updater={updater}
        closeBehavior={closeBehavior}
      />
      {currentTool === 'hub' && <HubMenu onSelectTool={setCurrentTool} />}
      {currentTool === 'converter' && <ConverterApp pendingLaunch={pendingLaunch} />}
      {currentTool === 'downloader' && <DownloaderApp />}
      {/* Self-built copies (see useUpdateChecker.js's IS_OFFICIAL_BUILD)
          never had a real silent-install to offer anyway -- the toast's
          "Update now" button would just re-open a browser tab, which reads
          as a popup nagging you to do something you can just as easily
          notice later. Those builds surface the same status quietly
          instead, via HamburgerMenu's badge dot -> AboutModal's own update
          section. */}
      {updater.isOfficialBuild && (
        <UpdateBanner
          status={updater.status}
          latestRelease={updater.latestRelease}
          updateError={updater.updateError}
          manualCheck={updater.manualCheck}
          currentVersion={updater.currentVersion}
          onInstall={updater.installUpdate}
          onDismiss={updater.dismiss}
        />
      )}
      {/* Portaled to document.body -- see HamburgerMenu.jsx's identical
          reasoning for AboutModal: a full-viewport .modal-overlay needs an
          unconstrained positioning ancestor, not whatever App.jsx's own
          render tree happens to nest it under. */}
      {createPortal(
        <CloseConfirmModal
          open={closeBehavior.confirmOpen}
          onChoose={closeBehavior.resolveConfirm}
          onCancel={closeBehavior.cancelConfirm}
        />,
        document.body,
      )}
    </div>
  )
}

export default App
