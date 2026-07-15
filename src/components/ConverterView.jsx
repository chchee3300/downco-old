import { useEffect, useState } from 'react'
import StatusBar from './StatusBar.jsx'
import DropZone from './DropZone.jsx'
import FileList from './FileList.jsx'
import SettingsPanel from './SettingsPanel.jsx'
import ToolIntro from './ToolIntro.jsx'
import ProgressLog from './ProgressLog.jsx'
import MixedTypeModal from './MixedTypeModal.jsx'
import TrimModal from './TrimModal.jsx'
import CropModal from './CropModal.jsx'
import UpdateBanner from './UpdateBanner.jsx'
import { useFileManager } from '../hooks/useFileManager.js'
import { useSettings } from '../hooks/useSettings.js'
import { useExecute } from '../hooks/useExecute.js'
import { useUpdateChecker } from '../hooks/useUpdateChecker.js'

// Extracted from the pre-hub App.jsx (Phase A of the multi-repo restructure
// — see ~/.claude/plans/mac-linux-reactive-metcalfe.md). This is the
// Converter tool's own content, no longer wrapped in its own <Header> or
// useTheme() call — the hub's App.jsx/Header.jsx own the persistent shell
// chrome now, this component just renders in the hub's content area when
// currentTool === 'converter'. In Phase B this becomes the library entry
// point exported by the (separately git-hosted) sorai-toolkit-converter
// package instead of a copy living directly in the hub repo.
function LoadingOverlay({ visible }) {
  return (
    <div id="file-loading-overlay" className={visible ? 'loading-overlay' : 'loading-overlay hidden'} role="status" aria-live="polite">
      <div className="spinner" aria-hidden="true"></div>
      <p>Reading files…</p>
    </div>
  )
}

export default function ConverterView() {
  const settings = useSettings()
  const updateChecker = useUpdateChecker()

  const {
    files,
    setFiles,
    fileType,
    outputPath,
    setOutputPath,
    loading,
    status,
    setStatus,
    handleFiles,
    removeFile,
    clearFiles,
    browseForFiles,
    browseForOutputFolder,
    pendingMismatch,
    confirmClearAndLoad,
    cancelPendingMismatch,
  } = useFileManager({ onFirstFileType: settings.setFormatForType })

  const {
    execute,
    executing,
    cancel,
    cancelling,
    progressVisible,
    progressPercent,
    progressText,
    terminalLog,
  } = useExecute({ files, setFiles, fileType, settings, outputPath, setOutputPath, setStatus })

  const hasFiles = files.length > 0

  useEffect(() => {
    setFiles((prev) => (prev.some((f) => f.converted) ? prev.map((f) => (f.converted ? { ...f, converted: false, convertedSizeMB: undefined } : f)) : prev))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.video, settings.image, settings.audio, settings.pdf])

  const [trimIndex, setTrimIndex] = useState(-1)
  const trimFile = trimIndex >= 0 ? files[trimIndex] : null

  const handleSaveTrim = (start, end) => {
    if (trimIndex < 0) return
    setFiles((prev) => prev.map((f, i) => (i === trimIndex ? { ...f, trimStart: start, trimEnd: end } : f)))
  }

  const [cropIndex, setCropIndex] = useState(-1)
  const cropFile = cropIndex >= 0 ? files[cropIndex] : null

  const handleSaveCrop = (crop) => {
    if (cropIndex < 0) return
    setFiles((prev) => prev.map((f, i) => (i === cropIndex ? { ...f, crop } : f)))
  }

  return (
    <>
      <main className="main" id="main-content">
        <LoadingOverlay visible={loading} />

        <div className="main-columns">
          <section className="panel panel--ghost" id="input-panel">
            {!hasFiles && <DropZone onClick={browseForFiles} />}
            <div id="file-list-container" className={hasFiles ? '' : 'hidden'}>
              <div className="filelist-header">
                <span className="mono-label tabular-nums" id="file-count-label">
                  {files.length} file{files.length !== 1 ? 's' : ''} · {fileType ? fileType.toUpperCase() : ''}
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-ghost-success btn-xs" id="btn-add-files" onClick={browseForFiles}>
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                      <line x1="8" y1="3" x2="8" y2="13" />
                      <line x1="3" y1="8" x2="13" y2="8" />
                    </svg>
                    Add files
                  </button>
                  <button className="btn btn-ghost btn-xs" id="btn-clear-files" onClick={clearFiles}>
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                      <line x1="3" y1="3" x2="13" y2="13" />
                      <line x1="13" y1="3" x2="3" y2="13" />
                    </svg>
                    Clear all
                  </button>
                </div>
              </div>
              <FileList files={files} fileType={fileType} settings={settings} onRemove={removeFile} onOpenTrim={setTrimIndex} onOpenCrop={setCropIndex} />
            </div>
            <ProgressLog visible={progressVisible} percent={progressPercent} text={progressText} log={terminalLog} />
          </section>

          {hasFiles ? (
            <SettingsPanel
              files={files}
              fileType={fileType}
              settings={settings}
              outputPath={outputPath}
              onBrowseOutput={browseForOutputFolder}
              executing={executing}
              cancelling={cancelling}
              onExecute={execute}
              onCancel={cancel}
            />
          ) : (
            <ToolIntro />
          )}
        </div>
      </main>
      <StatusBar text={status.text} state={status.state} />
      <TrimModal
        open={trimIndex >= 0}
        file={trimFile}
        fileType={fileType}
        onClose={() => setTrimIndex(-1)}
        onSave={handleSaveTrim}
      />
      <CropModal
        open={cropIndex >= 0}
        file={cropFile}
        onClose={() => setCropIndex(-1)}
        onSave={handleSaveCrop}
      />
      <MixedTypeModal
        open={!!pendingMismatch}
        existingType={pendingMismatch?.existingType}
        incomingType={pendingMismatch?.incomingType}
        existingCount={pendingMismatch?.existingCount ?? 0}
        incomingCount={pendingMismatch?.paths.length ?? 0}
        onConfirm={confirmClearAndLoad}
        onCancel={cancelPendingMismatch}
      />
      <UpdateBanner
        status={updateChecker.status}
        latestRelease={updateChecker.latestRelease}
        updateError={updateChecker.updateError}
        onInstall={updateChecker.installUpdate}
        onDismiss={updateChecker.dismiss}
      />
    </>
  )
}
