# 02: Downloader：貼網址抓 metadata

**What to build:** 使用者在 Tauri 版的 Downloader 貼上網址後，Downloader plugin 的 Rust 端會呼叫 yt-dlp sidecar 抓 metadata。佇列項目顯示標題、縮圖、長度、頻道，以及可選的影片、音訊、combined 格式，並預設選中最佳格式。抓取失敗時，在該項目上顯示 yt-dlp 的錯誤訊息。

**Blocked by:** 01（Plugin 骨架、跨 repo 開發模式、E2E 測試框架）

**Status:** ready-for-agent

- [ ] metadata 抓取和 JSON 解析都在 Rust 端完成，行為跟現行 JS 版一致：排除 storyboard、mhtml、webm、portrait 變體；vcodec 或 acodec 只有明確寫 'none' 才算沒有該串流；預覽 URL 和最佳格式預設值的挑選規則不變
- [ ] `cargo test` 用 fixture 覆蓋 YouTube、Twitch（格式沒有 vcodec/acodec 欄位）、Twitter（有混合格式）
- [ ] UI 元件和佇列狀態機沿用現有的，只把 Neutralino 呼叫換成 plugin 的 invoke
- [ ] E2E：貼上 "Me at the zoo" 後顯示正確的標題和格式；貼上無效網址時顯示錯誤
