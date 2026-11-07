import { useEffect, useState, useSyncExternalStore } from 'react'
import { openUrl } from '@tauri-apps/plugin-opener'
import { engineCancel, engineLatest, engineRemove, engineSetPath, engineStatus, installState, onInstallChange, startInstall } from 'sorai-toolkit-converter'
import { useTranslation } from '../hooks/useTranslation.js'

// "Version a is later than b": number groups compared in order, like the
// converter's tools::newer (2026.10.26, 12.4.2, ffmpeg's 2026-11-06).
const key = (v) => (v ?? '').match(/\d+/g)?.map(Number) ?? []
function newer(a, b) {
  const [x, y] = [key(a), key(b)]
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if ((x[i] ?? -1) !== (y[i] ?? -1)) return (x[i] ?? -1) > (y[i] ?? -1)
  }
  return false
}
const mb = (bytes) => Math.max(1, Math.round(bytes / 1e6))

// SettingsModal's "Third-party software" section (#settings-engines). The
// programs and their commands live in the converter plugin (engines.rs:
// Ghostscript, optional; tools.rs: the bundled ffmpeg / yt-dlp / qpdf /
// img2pdf); this is their settings UI. Reloads when the modal opens.
// "Check for updates" asks each tool's project for its newest release; an
// update (Windows) downloads it with progress and Cancel, and "Back to the
// bundled version" deletes it. Ghostscript installs its pinned package. The
// progress is the converter's shared install state, so an install started
// here or from the Converter's first-run prompt shows after reopening.
export default function EngineManager({ open }) {
  const { t } = useTranslation()
  const [list, setList] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  // engineLatest() by id; null = not checked; 'checking' while it runs.
  const [latest, setLatest] = useState(null)
  // Download progress (0-100) while installing, else null. Not `busy`:
  // the fieldset stays enabled so Cancel works.
  const install = useSyncExternalStore(onInstallChange, installState)
  const installing = install.percent !== null

  const run = (promise) => {
    setBusy(true)
    return promise
      .then((l) => { setList(l); setError('') }, (e) => setError(String(e)))
      .finally(() => setBusy(false))
  }

  // On open, and again when an install ends (wherever it was started).
  useEffect(() => {
    if (open) run(engineStatus())
  }, [open, installing])

  const checkUpdates = () => {
    setLatest('checking')
    engineLatest().then((l) => setLatest(Object.fromEntries(l.map((x) => [x.id, x]))), (e) => { setLatest(null); setError(String(e)) })
  }

  const pick = async (e) => {
    const files = await window.SoraiDialogs.openFiles({ title: t('settings.engines.pickTitle', { name: e.name }) })
    if (files?.[0]) run(engineSetPath(e.id, files[0]))
  }

  const startDownload = (e) => {
    setError('')
    startInstall(e.id)
  }
  const percentOf = (e) => (install.engine === e.id ? install.percent : null)
  const shownError = error || install.error
  const tools = list.some((e) => e.kind === 'tool')

  // A tool's line under its version after "Check for updates".
  const updateInfo = (e) => {
    const l = latest?.[e.id]
    if (!l || percentOf(e) !== null) return null
    if (l.error) return <p className="settings-hint preset-error engine-latest" data-latest="error" title={l.error}>{t('settings.engines.checkFailed')}</p>
    if (e.state !== 'missing' && !newer(l.version, e.version)) return <p className="settings-hint engine-latest" data-latest="current">{t('settings.engines.upToDate')}</p>
    return <p className="settings-hint engine-latest" data-latest="newer">{t('settings.engines.newVersion', { version: l.version, mb: mb(l.size) })}</p>
  }
  const updatable = (e) => {
    const l = latest?.[e.id]
    return e.installable && l && !l.error && (e.state === 'missing' || newer(l.version, e.version))
  }

  return (
    <fieldset className="preset-fieldset" disabled={busy}>
      {tools && (
        <div className="engines-toolbar">
          <button type="button" className="btn btn-outline btn-sm" id="engines-check-updates" disabled={latest === 'checking'} onClick={checkUpdates}>
            {t(latest === 'checking' ? 'settings.engines.checking' : 'settings.engines.checkUpdates')}
          </button>
        </div>
      )}
      {list.map((e) => (
        <div key={e.id} className="engine-row" data-id={e.id} data-kind={e.kind} data-state={e.state}>
          <div className="engine-head">
            <span className="engine-name">{e.name}</span>
            {e.version && <span className="engine-version">{e.version}</span>}
            <span className="engine-state">{t(`settings.engines.state.${e.kind === 'tool' ? `tool.${e.state}` : e.state}`)}</span>
          </div>
          <p className="settings-hint">
            {t(`settings.engines.desc.${e.id}`)}{' '}
            <button type="button" className="engine-link" onClick={() => openUrl(e.homepage)}>{t('settings.engines.license', { license: e.license })}</button>
          </p>
          {e.path && <p className="settings-hint engine-path">{e.path}</p>}
          {e.userPath && e.state !== 'user' && <p className="settings-hint preset-error">{t('settings.engines.userPathMissing', { path: e.userPath })}</p>}
          {e.installCommand && <p className="settings-hint">{t('settings.engines.installWith')} <code>{e.installCommand}</code></p>}
          {e.kind === 'tool' && updateInfo(e)}
          {percentOf(e) !== null && (
            <div className="engine-progress">
              <progress max="100" value={percentOf(e)} />
              <span className="settings-hint">{t('settings.engines.downloading', { percent: Math.round(percentOf(e)) })}</span>
            </div>
          )}
          <div className="engine-actions">
            {percentOf(e) !== null && <button type="button" className="btn btn-outline btn-sm engine-cancel" onClick={() => engineCancel()}>{t('settings.engines.cancel')}</button>}
            {e.kind === 'engine' ? (
              <>
                {/* Downloads are Windows-only (`installable`); elsewhere installCommand. */}
                {e.installable && !e.installed && percentOf(e) === null && <button type="button" className="btn btn-primary btn-sm engine-install" onClick={() => startDownload(e)}>{t('settings.engines.install')}</button>}
                {e.installed && percentOf(e) === null && <button type="button" className="btn btn-outline btn-sm engine-remove" onClick={() => run(engineRemove(e.id))}>{t('settings.engines.remove')}</button>}
                <button type="button" className="btn btn-outline btn-sm engine-pick" onClick={() => pick(e)}>{t('settings.engines.useMine')}</button>
                {e.userPath && <button type="button" className="btn btn-ghost btn-sm engine-clear" onClick={() => run(engineSetPath(e.id, null))}>{t('settings.engines.clear')}</button>}
                <button type="button" className="btn btn-ghost btn-sm engine-recheck" onClick={() => run(engineStatus())}>{t('settings.engines.recheck')}</button>
              </>
            ) : (
              percentOf(e) === null && (
                <>
                  {updatable(e) && <button type="button" className="btn btn-primary btn-sm engine-update" disabled={installing} onClick={() => startDownload(e)}>{t(e.state === 'missing' ? 'settings.engines.install' : 'settings.engines.update')}</button>}
                  {e.installed && <button type="button" className="btn btn-outline btn-sm engine-remove" onClick={() => run(engineRemove(e.id))}>{t('settings.engines.revert')}</button>}
                </>
              )
            )}
          </div>
        </div>
      ))}
      {shownError && <p className="settings-hint preset-error" role="alert">{shownError}</p>}
    </fieldset>
  )
}
