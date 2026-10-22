; Tauri NSIS installer hooks (bundle.windows.nsis.installerHooks).
; Install: the app writes its own Explorer menu (src-tauri/src/context_menu.rs:
; built-in or saved presets, Chinese labels) and exits without opening a
; window; every app start then rewrites it in the app's language.
; Uninstall: delete each extension's SORAIToolkit subtree, then .<ext>\shell
; if that left it empty. The extension list mirrors context_menu.rs
; INPUT_EXTS (a cargo test checks it).
!macro NSIS_HOOK_POSTINSTALL
  ExecWait '"$INSTDIR\${MAINBINARYNAME}.exe" --sorai-register-menu'
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  DeleteRegKey HKCU "Software\Classes\.mp4\shell\SORAIToolkit"
  DeleteRegKey /ifempty HKCU "Software\Classes\.mp4\shell"
  DeleteRegKey HKCU "Software\Classes\.mkv\shell\SORAIToolkit"
  DeleteRegKey /ifempty HKCU "Software\Classes\.mkv\shell"
  DeleteRegKey HKCU "Software\Classes\.avi\shell\SORAIToolkit"
  DeleteRegKey /ifempty HKCU "Software\Classes\.avi\shell"
  DeleteRegKey HKCU "Software\Classes\.mov\shell\SORAIToolkit"
  DeleteRegKey /ifempty HKCU "Software\Classes\.mov\shell"
  DeleteRegKey HKCU "Software\Classes\.webm\shell\SORAIToolkit"
  DeleteRegKey /ifempty HKCU "Software\Classes\.webm\shell"
  DeleteRegKey HKCU "Software\Classes\.jpg\shell\SORAIToolkit"
  DeleteRegKey /ifempty HKCU "Software\Classes\.jpg\shell"
  DeleteRegKey HKCU "Software\Classes\.jpeg\shell\SORAIToolkit"
  DeleteRegKey /ifempty HKCU "Software\Classes\.jpeg\shell"
  DeleteRegKey HKCU "Software\Classes\.png\shell\SORAIToolkit"
  DeleteRegKey /ifempty HKCU "Software\Classes\.png\shell"
  DeleteRegKey HKCU "Software\Classes\.webp\shell\SORAIToolkit"
  DeleteRegKey /ifempty HKCU "Software\Classes\.webp\shell"
  DeleteRegKey HKCU "Software\Classes\.avif\shell\SORAIToolkit"
  DeleteRegKey /ifempty HKCU "Software\Classes\.avif\shell"
  DeleteRegKey HKCU "Software\Classes\.gif\shell\SORAIToolkit"
  DeleteRegKey /ifempty HKCU "Software\Classes\.gif\shell"
  DeleteRegKey HKCU "Software\Classes\.ico\shell\SORAIToolkit"
  DeleteRegKey /ifempty HKCU "Software\Classes\.ico\shell"
  DeleteRegKey HKCU "Software\Classes\.mp3\shell\SORAIToolkit"
  DeleteRegKey /ifempty HKCU "Software\Classes\.mp3\shell"
  DeleteRegKey HKCU "Software\Classes\.wav\shell\SORAIToolkit"
  DeleteRegKey /ifempty HKCU "Software\Classes\.wav\shell"
  DeleteRegKey HKCU "Software\Classes\.aac\shell\SORAIToolkit"
  DeleteRegKey /ifempty HKCU "Software\Classes\.aac\shell"
  DeleteRegKey HKCU "Software\Classes\.flac\shell\SORAIToolkit"
  DeleteRegKey /ifempty HKCU "Software\Classes\.flac\shell"
  DeleteRegKey HKCU "Software\Classes\.ogg\shell\SORAIToolkit"
  DeleteRegKey /ifempty HKCU "Software\Classes\.ogg\shell"
  DeleteRegKey HKCU "Software\Classes\.pdf\shell\SORAIToolkit"
  DeleteRegKey /ifempty HKCU "Software\Classes\.pdf\shell"
!macroend
