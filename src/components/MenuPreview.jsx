import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useTranslation } from '../hooks/useTranslation.js'
import logoDark from '../../resources/icons/appIcon-dark.png'
import logoLight from '../../resources/icons/appIcon-light.png'

export const IS_WINDOWS = navigator.userAgent.includes('Windows')
const MENU = 'SORAIToolkit'

// Beside PresetManager's list (#settings-presets): what right-clicking a file
// of the picked extension and hovering "SORAI Toolkit" shows in Explorer.
// Drawn from context_menu_entries -- the exact values register_context_menu
// writes -- so it can't drift from the real menu. Refetched whenever the
// preset list (`list`) or the language changes. Windows only (macOS / GNOME
// menus are fixed, not built from presets). The picked type / extension
// (`pick`, owned by PresetManager) also filters the preset list.
export default function MenuPreview({ list, pick, onPick }) {
  const { t, lang } = useTranslation()
  const [data, setData] = useState(null)
  const { type, ext } = pick

  useEffect(() => {
    if (IS_WINDOWS) invoke('context_menu_entries', { lang }).then(setData, () => setData(null))
  }, [list, lang])

  if (!IS_WINDOWS) return null
  // The column right away (empty until the entries load), so the settings
  // window doesn't widen a moment after opening.
  const title = <h4 className="field-label settings-section-title">{t('settings.presets.preview')}</h4>
  if (!data) return <aside className="menu-preview-col" id="menu-preview" aria-busy="true">{title}<div className="menu-preview"></div></aside>
  // <ext key>\shell\001 … : MUIVerb (`&&` = a literal &), CommandFlags = separator above.
  const base = `SystemFileAssociations\\.${ext}\\shell\\${MENU}\\shell\\`
  const byKey = new Map()
  for (const v of data.values) {
    if (!v.key.startsWith(base) || v.key.endsWith('\\command')) continue
    const item = byKey.get(v.key) ?? {}
    if (v.name === 'MUIVerb') item.text = v.data.replaceAll('&&', '&')
    if (v.name === 'CommandFlags') item.sep = true
    byKey.set(v.key, item)
  }
  const items = [...byKey.keys()].sort().map((k) => byKey.get(k))

  return (
    // Title outside the box, level with the list's (PresetManager's left column).
    <aside className="menu-preview-col" id="menu-preview" aria-label={t('settings.presets.preview')}>
      {title}
      <div className="menu-preview">
        <div className="menu-preview-types" role="radiogroup" aria-label={t('settings.presets.previewType')}>
          {data.inputs.map(([ty, exts]) => (
            <button
              key={ty}
              type="button"
              role="radio"
              aria-checked={ty === type}
              className={ty === type ? 'chip chip--active' : 'chip'}
              data-type={ty}
              onClick={() => ty !== type && onPick({ type: ty, ext: exts[0] })}
            >
              {t(`settings.presets.type.${ty}`)}
            </button>
          ))}
        </div>
        <div className="menu-preview-exts" role="radiogroup" aria-label={t('settings.presets.previewType')}>
          {(data.inputs.find(([ty]) => ty === type)?.[1] ?? []).map((e) => (
            <button key={e} type="button" role="radio" aria-checked={e === ext} className={e === ext ? 'menu-preview-ext is-active' : 'menu-preview-ext'} data-ext={e} onClick={() => onPick({ type, ext: e })}>
              .{e}
            </button>
          ))}
        </div>
        <div className="menu-preview-stage">
          <div className="menu-preview-file">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true">
              <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"></path>
              <path d="M14 3v5h5"></path>
            </svg>
            <span id="menu-preview-file">{t('settings.presets.previewFile')}.{ext}</span>
          </div>
          <div className="menu-preview-menus">
            {/* Explorer's own items as blank bars; ours highlighted as if hovered. */}
            <ul className="menu-preview-menu" aria-hidden="true">
              <li className="menu-preview-skel"><span></span></li>
              <li className="menu-preview-skel"><span></span></li>
              <li className="menu-preview-root">
                <img className="menu-preview-icon on-dark" src={logoDark} alt="" />
                <img className="menu-preview-icon on-light" src={logoLight} alt="" />
                SORAI Toolkit
                <span className="menu-preview-arrow">›</span>
              </li>
              <li className="menu-preview-skel"><span></span></li>
              <li className="menu-preview-skel"><span></span></li>
            </ul>
            <ul className="menu-preview-menu menu-preview-sub" id="menu-preview-items">
              {items.flatMap((it, i) => [
                it.sep && <li key={`sep${i}`} className="menu-preview-sep" role="separator"></li>,
                <li key={i} title={it.text}>{it.text}</li>,
              ])}
            </ul>
          </div>
        </div>
        <p className="settings-hint">{t('settings.presets.previewHint')}</p>
      </div>
    </aside>
  )
}
