import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
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

// Hub shell: owns which tool is currently shown. Plain conditional
// rendering, not a router -- there's no history/deep-linking need for a
// desktop app with 2-3 top-level screens. Adding a tool later means one
// more branch here plus one more HubMenu.TOOLS entry, not a rework.
function App() {
  const { theme, toggleTheme } = useTheme()
  const { t, lang } = useTranslation()
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
  // shape -- see useSingleInstance.js. A secondary instance exits in Rust
  // (single-instance plugin) before this ever renders.
  const { pendingLaunch, presetsRequest } = useSingleInstance()
  // Settings -> a preset's "Edit": the Converter's edit-preset mode, opened
  // over whichever tool was showing (the Converter keeps its queue and
  // settings: it stays mounted). Closing it returns to that tool with the
  // presets section of Settings reopened (same counter as --sorai-presets).
  const [editing, setEditing] = useState(null) // { preset, from } | null
  const [editsClosed, setEditsClosed] = useState(0)
  const editPreset = (preset) => {
    setEditing({ preset, from: currentTool })
    setCurrentTool('converter')
  }
  const endEdit = () => {
    setCurrentTool(editing.from)
    setEditing(null)
    setEditsClosed((n) => n + 1)
  }

  // The Explorer menu follows the presets and language: rewrite it on every
  // start (repairs a deleted menu, replaces 2.0.0's) and language switch.
  useEffect(() => {
    invoke('register_context_menu', { lang }).catch(console.error)
  }, [lang])

  useEffect(() => {
    if (pendingLaunch) setCurrentTool('converter')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingLaunch?.seq])

  // Reuses HubMenu.jsx's own `hub.tool.<id>.label` dict keys instead of a
  // separate TOOL_LABELS map, so the breadcrumb and the hub card never
  // drift out of sync the way two hand-duplicated literal strings could.
  const toolLabel = currentTool === 'hub' ? undefined : t(`hub.tool.${currentTool}.label`)

  return (
    <div className="app-shell">
      <Header
        toolLabel={toolLabel}
        showBackToHub={currentTool !== 'hub'}
        onBackToHub={() => { setEditing(null); setCurrentTool('hub') }}
        theme={theme}
        onToggleTheme={toggleTheme}
        updater={updater}
        closeBehavior={closeBehavior}
        presetsRequest={presetsRequest + editsClosed}
        onEditPreset={editPreset}
      />
      {currentTool === 'hub' && <HubMenu onSelectTool={setCurrentTool} />}
      {currentTool === 'converter' && <ConverterApp pendingLaunch={pendingLaunch} editPreset={editing?.preset ?? null} onEditDone={endEdit} />}
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
