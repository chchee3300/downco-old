// window.SoraiPresets: the hub-owned right-click presets (src-tauri/src/
// presets.rs), offered to the tool packages as a runtime global like
// window.SoraiDialogs -- look it up at call time, never store it. Every edit
// rewrites the Explorer menu in the current language before resolving.
// Preset: { id, name?, labelKey?, fileType, format, settings }.
import { invoke } from '@tauri-apps/api/core'

const lang = () => window.EstellaLib.i18n.getLang()

async function edit(cmd, args) {
  const out = await invoke(cmd, args)
  await invoke('register_context_menu', { lang: lang() }).catch(console.error)
  return out
}

const presets = {
  // -> Preset[] in menu order
  list: () => invoke('list_presets'),
  // { fileType, format, settings } -> auto-generated name in the app language
  suggestName: ({ fileType, format, settings }) => invoke('preset_name', { fileType, format, settings, lang: lang() }),
  // { id?, name, fileType, format, settings } -> saved Preset. No id = new;
  // an existing id = overwrite in place (keeps its position and menu command).
  save: (preset) => edit('save_preset', { preset }),
  // -> Preset[]
  remove: (id) => edit('delete_preset', { id }),
  // ids in the new order -> Preset[]
  reorder: (ids) => edit('reorder_presets', { ids }),
  // back to the built-ins -> Preset[]
  restore: () => edit('restore_presets'),
}

window.SoraiPresets = presets
export default presets
