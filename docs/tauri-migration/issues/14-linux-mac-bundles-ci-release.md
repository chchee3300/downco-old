# 14: Linux、macOS 打包和 CI release workflow

**What to build:** push 到 master 時，CI 自動決定版本號，用 Tauri 打包三個平台（Windows NSIS、Linux deb/rpm 含 KDE ServiceMenu、macOS dmg），簽章後發佈 GitHub Release。release 裡附上 updater 需要的 latest.json 和簽章。

**Blocked by:** 11（Hub：自動更新）, 12（Hub：macOS Finder Services 和 GNOME Nautilus scripts 自我安裝）, 13（Windows NSIS 安裝檔和右鍵選單）

**Status:** done（實際在 GitHub 上跑 CI 需使用者同意 push，且要等第 15 張切換後才會成功；簽章金鑰由維護者準備）

- [x] 保留 semantic-release 和版本號寫入流程，三個 build job 改用 Tauri 建置；保留 setup.mjs 下載 sidecar 的步驟，移除 Neutralino 相關步驟；官方 build 設 VITE_OFFICIAL_BUILD=true
- [x] deb 和 rpm 透過額外檔案設定安裝 KDE servicemenus；系統依賴由 Tauri bundler 宣告
- [x] updater 簽章使用 GitHub Secrets 裡的金鑰；金鑰由維護者產生，agent 不產生也不接觸私鑰；公鑰寫進設定
- [x] 決定並記錄舊 Neutralino 安裝版升級到 Tauri 版的做法（預設是在 release notes 說明需要手動重裝一次）
- [ ] workflow 至少要在一個非 master 分支上，用 dry-run 或手動觸發，成功跑完三個平台的 build
