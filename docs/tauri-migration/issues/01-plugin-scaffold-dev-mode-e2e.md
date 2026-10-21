# 01: Plugin 骨架、跨 repo 開發模式、E2E 測試框架

**What to build:** 開發者可以在 hub 的 `tauri` 分支用一個指令啟動 Tauri 開發模式。Converter、Downloader 兩個 repo 的 `tauri` 分支各自已經是一個 Tauri v2 plugin（Rust crate 加 JS 套件），會被 hub 註冊，並能回應一個 ping 指令。改 hub 或兩個 sibling repo 的 Rust 或 JS 原始碼，都會自動重新建置或熱重載。原生對話框的呼叫集中在 hub 提供的一個可替換模組。E2E 測試框架能連進真實的 Tauri 視窗執行測試。

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Converter、Downloader 兩個 repo 的 `tauri` 分支各有一個 Tauri v2 plugin（Rust crate 加 JS 套件），各自提供一個 ping 指令
- [x] hub 用 cargo git dependency 加 npm git dependency 消費兩個 plugin，並在 Rust 端註冊；sibling repo 存在時，自動改用本機 patch 和 Vite alias 指向 sibling 原始碼
- [x] Vite dev port 和 WebView2 遠端除錯埠可以用環境變數覆寫，讓多個 worktree 能同時跑 E2E；預設維持 5173 和 9229
- [x] 原生對話框（選檔、選資料夾）集中在單一 JS 模組，E2E 測試可以在視窗內替換掉它
- [x] E2E 框架用一個指令完成：啟動 `tauri dev`、等視窗就緒、用 CDP 連進去、執行測試、結束後關閉程序；附一個冒煙測試（hub 顯示兩張工具卡片、兩個 plugin 的 ping 都有回應）並且通過
- [x] 每個 plugin crate 都能單獨跑 `cargo test`
- [x] 三個 repo 的 CLAUDE.md 都記錄新的開發和測試方式
