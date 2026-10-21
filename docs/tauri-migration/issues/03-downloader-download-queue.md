# 03: Downloader：下載佇列（合併、只下載音訊、分開存檔、進度、取消）

**What to build:** 使用者按開始後，佇列會依序下載。三種模式都能運作：選 video-only 格式時自動合併 bestaudio、只下載音訊、影片和音訊分開存成兩個檔案。每個項目即時顯示百分比、速度、ETA。按取消或移除正在下載的項目時，會確實停止 yt-dlp 程序（Windows 上殺掉整棵程序樹），不會卡在 Cancelling。一個項目失敗不影響其他項目。

**Blocked by:** 02（Downloader：貼網址抓 metadata）

**Status:** done

- [x] Downloader plugin 提供子程序執行器：開始 job 時回傳 job id，推送 progress、log、finished 事件，可以依 job id 取消，並且有逾時保險
- [x] 指令建構和進度解析都在 Rust 端，用 `cargo test` 覆蓋；指令建構包括格式選擇器、--ffmpeg-location 指向 ffmpeg sidecar、合併成 mp4、分開存檔時的輸出檔名、progress-template
- [x] 選擇下載資料夾時走集中的對話框模組
- [x] E2E（改寫現有的 test_download）：選 video-only 格式下載，用 ffmpeg 確認輸出同時有 Video 和 Audio 串流；只下載音訊時有產生輸出檔；取消後項目狀態是 cancelled，而且沒有殘留的 yt-dlp 程序
