# 15: 移除 Neutralino 並切換

**What to build:** 三個 repo 都只剩 Tauri 版：Neutralino 的設定、client、binary、相關的 workaround，以及 EstellaLib 的路徑和程序工具全部移除。所有測試都通過，code review 沒有未處理的問題，CLAUDE.md 反映最終狀態，三個 repo 的 tauri 分支準備好 merge 回 master。

**Blocked by:** 01（Plugin 骨架、跨 repo 開發模式、E2E 測試框架）, 02（Downloader：貼網址抓 metadata）, 03（Downloader：下載佇列（合併、只下載音訊、分開存檔、進度、取消））, 04（Downloader：片段下載（ClipModal））, 05（Converter：拖曳和瀏覽加檔、來源資訊卡、縮圖）, 06（Converter：影片、音訊、圖片轉檔 job）, 07（Converter：Trim 和 Crop 的預覽與指令）, 08（Converter：PDF 壓縮和圖片轉 PDF）, 09（Hub：視窗生命週期、關閉行為、系統匣、通知、主題圖示）, 10（Hub：單一實例、啟動參數、pendingLaunch）, 11（Hub：自動更新）, 12（Hub：macOS Finder Services 和 GNOME Nautilus scripts 自我安裝）, 13（Windows NSIS 安裝檔和右鍵選單）, 14（Linux、macOS 打包和 CI release workflow）, 16（Linux：sidecar 不佔用 /usr/bin、不取代系統套件）

**Status:** ready-for-agent

- [ ] 在程式碼中搜尋不到 Neutralino 的執行期呼叫和設定
- [ ] 兩個切點的全部測試都通過
- [ ] code review 找到的問題全部修完
- [ ] 三個 repo 的 CLAUDE.md 定稿
- [ ] merge 回 master 之前先取得使用者同意
