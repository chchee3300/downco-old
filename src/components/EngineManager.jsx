import { useEffect, useState } from 'react'
import { openUrl } from '@tauri-apps/plugin-opener'
import { engineSetPath, engineStatus } from 'sorai-toolkit-converter'
import { useTranslation } from '../hooks/useTranslation.js'

// SettingsModal's "Conversion engines" section (#settings-engines). The
// engines and their commands live in the converter plugin (engines.rs, its
// only consumer); this is just their settings UI. Reloads when the modal opens.
export default function EngineManager({ open }) {
  const { t } = useTranslation()
  const [list, setList] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

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
          <div className="engine-actions">
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
