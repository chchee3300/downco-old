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

const Chevron = ({ back }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={back ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6'} />
  </svg>
)

// SettingsModal's "Third-party software" section (#settings-engines), laid
// out like a store: a list of packages (.engine-item), click one for its
// page (.engine-detail) with what it is, its license, where it is, and
// the actions. The programs and commands live in the converter plugin
// (engines.rs: Ghostscript, optional; tools.rs: the bundled ffmpeg /
// yt-dlp / qpdf / img2pdf). Tools: "Check for updates" asks that tool's
// project (only on click), "Update to X" downloads it, "Back to the bundled
// version" deletes it. Ghostscript: Install / Uninstall its pinned package;
// "Use a program on this computer" under Advanced. Progress is the
// converter's shared install state, so an install started here or from the
// Converter's first-run prompt shows after reopening. `focusItem` opens
// that package's page (window.SoraiSettings.open('engines', id)).
export default function EngineManager({ open, focusItem }) {
  const { t } = useTranslation()
  const [list, setList] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [selected, setSelected] = useState(null)
  // engineLatest() by id: 'checking' while it runs, then { version, size, error }.
  const [latest, setLatest] = useState({})
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
  useEffect(() => {
    if (open) setSelected(focusItem ?? null)
  }, [open, focusItem])

  const check = (id) => {
    setLatest((l) => ({ ...l, [id]: 'checking' }))
    engineLatest(id).then(
      (r) => setLatest((l) => ({ ...l, [id]: r })),
      (e) => setLatest((l) => ({ ...l, [id]: { error: String(e) } })),
    )
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
  const stateText = (e) => t(`settings.engines.state.${e.kind === 'tool' ? `tool.${e.state}` : e.state}`)
  const shownError = error || install.error
  const alert = shownError && <p className="settings-hint preset-error" role="alert">{shownError}</p>

  const e = selected && list.find((x) => x.id === selected)
  if (!e) {
    return (
      <fieldset className="preset-fieldset" disabled={busy}>
        <div className="engine-list">
          {list.map((x) => (
            <button key={x.id} type="button" className="engine-item" data-id={x.id} data-state={x.state} onClick={() => setSelected(x.id)}>
              <span className="engine-item-main">
                <span className="engine-head">
                  <span className="engine-name">{x.name}</span>
                  {x.version && <span className="engine-version">{x.version}</span>}
                </span>
                <span className="engine-item-desc">{t(`settings.engines.desc.${x.id}`)}</span>
              </span>
              <span className="engine-state">{percentOf(x) !== null ? t('settings.engines.downloading', { percent: Math.round(percentOf(x)) }) : stateText(x)}</span>
              <Chevron />
            </button>
          ))}
        </div>
        {alert}
      </fieldset>
    )
  }

  const percent = percentOf(e)
  const l = latest[e.id]
  const checked = l && l !== 'checking' && !l.error
  const offer = checked && e.installable && (e.state === 'missing' || newer(l.version, e.version))
  return (
    <fieldset className="preset-fieldset" disabled={busy}>
      <div className="engine-detail" data-id={e.id} data-kind={e.kind} data-state={e.state}>
        <button type="button" className="btn btn-ghost btn-xs engine-back" onClick={() => setSelected(null)}>
          <Chevron back /> {t('settings.engines.heading')}
        </button>
        <div className="engine-detail-head">
          <div className="engine-detail-title">
            <span className="engine-detail-name">{e.name}</span>
            <span className="engine-head">
              {e.version && <span className="engine-version">{e.version}</span>}
              <span className="engine-state">{stateText(e)}</span>
            </span>
            {e.kind === 'tool' && percent === null && l && l !== 'checking' && (
              l.error ? <p className="settings-hint preset-error engine-latest" data-latest="error" title={l.error}>{t('settings.engines.checkFailed')}</p>
              : offer ? <p className="settings-hint engine-latest" data-latest="newer">{t('settings.engines.newVersion', { version: l.version, mb: mb(l.size) })}</p>
              : <p className="settings-hint engine-latest" data-latest="current">{t('settings.engines.upToDate')}</p>
            )}
          </div>
          <div className="engine-actions">
            {percent !== null ? (
              <button type="button" className="btn btn-outline btn-sm engine-cancel" onClick={() => engineCancel()}>{t('settings.engines.cancel')}</button>
            ) : e.kind === 'engine' ? (
              <>
                {/* Downloads are Windows-only (`installable`); elsewhere installCommand. */}
                {e.installed && <button type="button" className="btn btn-outline btn-sm engine-remove" onClick={() => run(engineRemove(e.id))}>{t('settings.engines.remove')}</button>}
                {e.installable && !e.installed && <button type="button" className="btn btn-primary btn-sm engine-install" disabled={installing} onClick={() => startDownload(e)}>{t('settings.engines.install')}</button>}
              </>
            ) : (
              <>
                {e.installed && <button type="button" className="btn btn-outline btn-sm engine-remove" onClick={() => run(engineRemove(e.id))}>{t('settings.engines.revert')}</button>}
                {offer ? (
                  <button type="button" className="btn btn-primary btn-sm engine-update" disabled={installing} onClick={() => startDownload(e)}>
                    {e.state === 'missing' ? t('settings.engines.install') : t('settings.engines.update', { version: l.version })}
                  </button>
                ) : (
                  <button type="button" className="btn btn-primary btn-sm engine-check" disabled={l === 'checking'} onClick={() => check(e.id)}>
                    {t(l === 'checking' ? 'settings.engines.checking' : 'settings.engines.checkUpdates')}
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {percent !== null && (
          <div className="engine-progress">
            <progress max="100" value={percent} />
            <span className="settings-hint">{t('settings.engines.downloading', { percent: Math.round(percent) })}</span>
          </div>
        )}

        <p className="engine-detail-desc">{t(`settings.engines.desc.${e.id}`)}</p>
        <dl className="engine-facts">
          <dt>{t('settings.engines.licenseLabel')}</dt>
          <dd><button type="button" className="engine-link" onClick={() => openUrl(e.homepage)}>{t('settings.engines.license', { license: e.license })}</button></dd>
          {e.path && (<><dt>{t('settings.engines.location')}</dt><dd className="engine-path">{e.path}</dd></>)}
          {e.installCommand && (<><dt>{t('settings.engines.installWith')}</dt><dd><code>{e.installCommand}</code></dd></>)}
        </dl>
        {e.userPath && e.state !== 'user' && <p className="settings-hint preset-error">{t('settings.engines.userPathMissing', { path: e.userPath })}</p>}

        {e.kind === 'engine' && (
          <details className="engine-advanced" open={!!e.userPath}>
            <summary>{t('settings.engines.advanced')}</summary>
            <p className="settings-hint">{t('settings.engines.useMineHint', { name: e.name })}</p>
            <div className="engine-actions">
              <button type="button" className="btn btn-outline btn-sm engine-pick" onClick={() => pick(e)}>{t('settings.engines.useMine')}</button>
              {e.userPath && <button type="button" className="btn btn-ghost btn-sm engine-clear" onClick={() => run(engineSetPath(e.id, null))}>{t('settings.engines.clear')}</button>}
            </div>
          </details>
        )}
      </div>
      {alert}
    </fieldset>
  )
}
