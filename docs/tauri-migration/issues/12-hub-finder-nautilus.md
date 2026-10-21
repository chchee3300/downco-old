# 12: Hub：macOS Finder Services 和 GNOME Nautilus scripts 自我安裝

**What to build:** macOS 和 GNOME 的使用者啟動 app 後，Finder 的 Quick Actions 和 Nautilus 的 Scripts 選單會出現 SORAI Toolkit 的項目。點擊後用 --sorai-* 參數啟動或喚醒 app。內容和產生規則跟 Neutralino 版一致。

**Blocked by:** 10（Hub：單一實例、啟動參數、pendingLaunch）

**Status:** ready-for-agent

- [ ] 寫檔改走 Rust 端或 fs plugin，冪等覆寫；非 GNOME 的 Linux 不寫任何檔案
- [ ] 產生內容的純函式用 `cargo test` 或 JS 單元測試覆蓋（檔案清單、執行權限、參數字串）
- [ ] 沒有真機可以驗證，要在 CLAUDE.md 明確標註為未驗證
