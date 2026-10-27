import { useEffect, useState } from 'react'
import { openUrl } from '@tauri-apps/plugin-opener'
import { engineCancel, engineInstall, engineRemove, engineSetPath, engineStatus } from 'sorai-toolkit-converter'
import { useTranslation } from '../hooks/useTranslation.js'

// SettingsModal's "Conversion engines" section (#settings-engines). The
// engines and their commands live in the converter plugin (engines.rs, its
// only consumer); this is just their settings UI. Reloads when the modal opens.
// Install downloads the pinned package (Windows) with progress and Cancel.
export default function EngineManager({ open }) {
  const { t } = useTranslation()
  const [list, setList] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  // Download progress (0-100) while installing, else null. Not `busy`:
  // the fieldset stays enabled so Cancel works.
  const [percent, setPercent] = useState(null)

  const run = (promise) => {
    setBusy(true)
    return promise
      .then((l) => { setList(l); setError('') }, (e) => setError(String(e)))
      .finally(() => setBusy(false))
  }

  useEffect(() => {
    if (open) run(engineStatus())
  }, [open])

  const pick = async (e) => {
    const files = await window.SoraiDialogs.openFiles({ title: t('settings.engines.pickTitle', { name: e.name }) })
    if (files?.[0]) run(engineSetPath(e.id, files[0]))
  }

  const install = (e) => {
    setPercent(0)
    setError('')
    engineInstall(e.id, setPercent)
      .then(setList, (err) => {
        if (String(err) !== 'cancelled') setError(String(err))
        return engineStatus().then(setList)
      })
      .finally(() => setPercent(null))
  }

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
          {percent !== null && (
            <div className="engine-progress">
              <progress max="100" value={percent} />
              <span className="settings-hint">{t('settings.engines.downloading', { percent: Math.round(percent) })}</span>
            </div>
          )}
          <div className="engine-actions">
            {/* Downloads are Windows-only (`installable`); elsewhere installCommand. */}
            {e.installable && !e.installed && percent === null && <button type="button" className="btn btn-primary btn-sm engine-install" onClick={() => install(e)}>{t('settings.engines.install')}</button>}
            {percent !== null && <button type="button" className="btn btn-outline btn-sm engine-cancel" onClick={() => engineCancel()}>{t('settings.engines.cancel')}</button>}
            {e.installed && percent === null && <button type="button" className="btn btn-outline btn-sm engine-remove" onClick={() => run(engineRemove(e.id))}>{t('settings.engines.remove')}</button>}
            <button type="button" className="btn btn-outline btn-sm engine-pick" onClick={() => pick(e)}>{t('settings.engines.useMine')}</button>
            {e.userPath && <button type="button" className="btn btn-ghost btn-sm engine-clear" onClick={() => run(engineSetPath(e.id, null))}>{t('settings.engines.clear')}</button>}
            <button type="button" className="btn btn-ghost btn-sm engine-recheck" onClick={() => run(engineStatus())}>{t('settings.engines.recheck')}</button>
          </div>
        </div>
      ))}
      {error && <p className="settings-hint preset-error" role="alert">{error}</p>}
    </fieldset>
  )
}
