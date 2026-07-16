import { useState } from 'react'
import Header from './components/Header.jsx'
import HubMenu from './components/HubMenu.jsx'
import { ConverterApp } from 'sorai-toolkit-converter'
import { DownloaderApp } from 'sorai-toolkit-downloader'
import { useTheme } from './hooks/useTheme.js'
import { useTranslation } from './hooks/useTranslation.js'

// Hub shell: owns which tool is currently shown. Plain conditional
// rendering, not a router -- there's no history/deep-linking need for a
// desktop app with 2-3 top-level screens. Adding a tool later means one
// more branch here plus one more HubMenu.TOOLS entry, not a rework.
function App() {
  const { theme, toggleTheme } = useTheme()
  const { t } = useTranslation()
  const [currentTool, setCurrentTool] = useState('hub')

  // Reuses HubMenu.jsx's own `hub.tool.<id>.label` dict keys instead of a
  // separate TOOL_LABELS map, so the breadcrumb and the hub card never
  // drift out of sync the way two hand-duplicated literal strings could.
  const toolLabel = currentTool === 'hub' ? undefined : t(`hub.tool.${currentTool}.label`)

  return (
    <div className="app-shell">
      <Header
        toolLabel={toolLabel}
        showBackToHub={currentTool !== 'hub'}
        onBackToHub={() => setCurrentTool('hub')}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
      {currentTool === 'hub' && <HubMenu onSelectTool={setCurrentTool} />}
      {currentTool === 'converter' && <ConverterApp />}
      {currentTool === 'downloader' && <DownloaderApp />}
    </div>
  )
}

export default App
