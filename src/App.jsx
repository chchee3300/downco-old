import { useState } from 'react'
import Header from './components/Header.jsx'
import HubMenu from './components/HubMenu.jsx'
import { ConverterApp } from 'sorai-toolkit-converter'
import { useTheme } from './hooks/useTheme.js'

// TOOLS labels shown in the header breadcrumb -- kept in sync with
// HubMenu.jsx's own TOOLS array by hand for this small a list (2-3 tools);
// not worth a shared registry yet.
const TOOL_LABELS = {
  converter: 'Converter',
}

// Hub shell: owns which tool is currently shown. Plain conditional
// rendering, not a router -- there's no history/deep-linking need for a
// desktop app with 2-3 top-level screens. Adding a tool later means one
// more branch here plus one more HubMenu.TOOLS entry, not a rework.
function App() {
  const { theme, toggleTheme } = useTheme()
  const [currentTool, setCurrentTool] = useState('hub')

  return (
    <div className="app-shell">
      <Header
        toolLabel={TOOL_LABELS[currentTool]}
        showBackToHub={currentTool !== 'hub'}
        onBackToHub={() => setCurrentTool('hub')}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
      {currentTool === 'hub' && <HubMenu onSelectTool={setCurrentTool} />}
      {currentTool === 'converter' && <ConverterApp />}
    </div>
  )
}

export default App
