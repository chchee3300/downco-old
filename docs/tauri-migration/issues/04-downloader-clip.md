# 04: Downloader：片段下載（ClipModal）

**What to build:** 使用者在 ClipModal 選取時間範圍後，只下載該片段，輸出長度落在既有承諾的容差內。片段下載期間如果拿不到進度百分比，UI 會停在「Starting…」，不會顯示 NaN。

**Blocked by:** 03（Downloader：下載佇列（合併、只下載音訊、分開存檔、進度、取消））

**Status:** done（ClipModal 拖拉待使用者真機驗證）

- [x] --download-sections 和 --force-keyframes-at-cuts 參數由 Rust 端建構，用 `cargo test` 覆蓋
- [x] 進度為 N/A 的情況由解析器過濾掉，用 `cargo test` 覆蓋
- [x] E2E：從短片下載一段 2 到 5 秒的片段，用 ffmpeg 量測輸出長度在容差內
