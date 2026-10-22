import { useEffect, useState } from 'react'
import { useTranslation } from '../hooks/useTranslation.js'

// SettingsModal's "Right-click presets" section (#settings-presets): every
// preset in menu order, renamed in place (commit on blur/Enter), moved,
// deleted, or all restored to the built-ins. Goes through window.SoraiPresets
// (src/lib/presets.js), which rewrites the Explorer menu after each edit.
// Reloads whenever the modal opens, so a preset saved from the Converter shows up.
export default function PresetManager({ open }) {
  const { t } = useTranslation()
  const [list, setList] = useState([])
  const [error, setError] = useState('')
  const [confirmRestore, setConfirmRestore] = useState(false)
  // One edit at a time: a click while one is in flight would act on the old list.
  const [busy, setBusy] = useState(false)

  const run = (promise) => {
    setBusy(true)
    return promise
      .then((l) => { setList(l); setError('') }, (e) => setError(String(e)))
      .finally(() => { setBusy(false); setConfirmRestore(false) })
  }

  useEffect(() => {
    if (open) run(window.SoraiPresets.list())
    else setConfirmRestore(false)
  }, [open])

  const label = (p) =>
    p.name ?? (p.labelKey ? t(p.labelKey, { format: p.format.slice(1).toUpperCase(), mb: p.settings?.targetSizeMB }) : p.id)

  const rename = (p, value) => {
    if (value.trim() === label(p)) return
    // A failed save (blank user preset name) reloads, putting the old name back.
    run(window.SoraiPresets.save({ ...p, name: value }).then(() => window.SoraiPresets.list()))
  }

  const move = (i, delta) => {
    const ids = list.map((p) => p.id)
    ;[ids[i], ids[i + delta]] = [ids[i + delta], ids[i]]
    run(window.SoraiPresets.reorder(ids))
  }

  return (
    <fieldset className="preset-fieldset" disabled={busy}>
      <ul className="preset-list">
        {list.map((p, i) => (
          <li key={p.id} className="preset-row" data-id={p.id}>
            <span className="preset-type">{t(`settings.presets.type.${p.fileType}`)}</span>
            <input
              key={label(p)}
              type="text"
              className="input preset-name"
              defaultValue={label(p)}
              aria-label={t('settings.presets.rename')}
              onBlur={(e) => rename(p, e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
            />
            <button type="button" className="btn btn-ghost btn-xs preset-up" disabled={i === 0} aria-label={t('settings.presets.moveUp')} onClick={() => move(i, -1)}>↑</button>
            <button type="button" className="btn btn-ghost btn-xs preset-down" disabled={i === list.length - 1} aria-label={t('settings.presets.moveDown')} onClick={() => move(i, 1)}>↓</button>
            <button type="button" className="btn btn-ghost btn-xs preset-delete" aria-label={t('settings.presets.delete')} onClick={() => run(window.SoraiPresets.remove(p.id))}>✕</button>
          </li>
        ))}
      </ul>
      {list.length === 0 && <p className="settings-hint">{t('settings.presets.empty')}</p>}
      {error && <p className="settings-hint preset-error" role="alert">{error}</p>}
      <button
        type="button"
        className={confirmRestore ? 'btn btn-outline-danger btn-sm preset-restore' : 'btn btn-outline btn-sm preset-restore'}
        onClick={() => (confirmRestore ? run(window.SoraiPresets.restore()) : setConfirmRestore(true))}
      >
        {t(confirmRestore ? 'settings.presets.restoreConfirm' : 'settings.presets.restore')}
      </button>
    </fieldset>
  )
}
