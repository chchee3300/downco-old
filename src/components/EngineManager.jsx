import { useEffect, useState, useSyncExternalStore } from 'react'
import { openUrl } from '@tauri-apps/plugin-opener'
import { engineCancel, engineRemove, engineSetPath, engineStatus, installState, onInstallChange, startInstall } from 'sorai-toolkit-converter'
import { useTranslation } from '../hooks/useTranslation.js'

// SettingsModal's "Conversion engines" section (#settings-engines). The
// engines and their commands live in the converter plugin (engines.rs, its
// only consumer); this is just their settings UI. Reloads when the modal opens.
// Install downloads the pinned package (Windows) with progress and Cancel;
// the progress is the converter's shared install state, so an install
// started here or from the Converter's first-run prompt shows after reopening.
export default function EngineManager({ open }) {
  const { t } = useTranslation()
  const [list, setList] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
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

  return (
    <fieldset className="preset-fieldset" disabled={busy}>
      {list.map((e) => (
        <div key={e.id} className="engine-row" data-id={e.id} data-state={e.state}>
          <div className="engine-head">
            <span className="engine-name">{e.name}</span>
            <span className="engine-state">{t(`settings.engines.state.${e.state}`)}</span>
          </div>
          <p className="settings-hint">
            {t(`settings.engines.desc.${e.id}`)}{' '}
            <button type="button" className="engine-link" onClick={() => openUrl(e.homepage)}>{t('settings.engines.license', { license: e.license })}</button>
          </p>
          {e.path && <p className="settings-hint engine-path">{e.path}</p>}
          {e.userPath && e.state !== 'user' && <p className="settings-hint preset-error">{t('settings.engines.userPathMissing', { path: e.userPath })}</p>}
          {e.installCommand && <p className="settings-hint">{t('settings.engines.installWith')} <code>{e.installCommand}</code></p>}
          {percentOf(e) !== null && (
            <div className="engine-progress">
              <progress max="100" value={percentOf(e)} />
              <span className="settings-hint">{t('settings.engines.downloading', { percent: Math.round(percentOf(e)) })}</span>
            </div>
          )}
          <div className="engine-actions">
            {/* Downloads are Windows-only (`installable`); elsewhere installCommand. */}
            {e.installable && !e.installed && percentOf(e) === null && <button type="button" className="btn btn-primary btn-sm engine-install" onClick={() => startDownload(e)}>{t('settings.engines.install')}</button>}
            {percentOf(e) !== null && <button type="button" className="btn btn-outline btn-sm engine-cancel" onClick={() => engineCancel()}>{t('settings.engines.cancel')}</button>}
            {e.installed && percentOf(e) === null && <button type="button" className="btn btn-outline btn-sm engine-remove" onClick={() => run(engineRemove(e.id))}>{t('settings.engines.remove')}</button>}
            <button type="button" className="btn btn-outline btn-sm engine-pick" onClick={() => pick(e)}>{t('settings.engines.useMine')}</button>
            {e.userPath && <button type="button" className="btn btn-ghost btn-sm engine-clear" onClick={() => run(engineSetPath(e.id, null))}>{t('settings.engines.clear')}</button>}
            <button type="button" className="btn btn-ghost btn-sm engine-recheck" onClick={() => run(engineStatus())}>{t('settings.engines.recheck')}</button>
          </div>
        </div>
      ))}
      {shownError && <p className="settings-hint preset-error" role="alert">{shownError}</p>}
    </fieldset>
  )
}
