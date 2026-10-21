# 06: Converter：影片、音訊、圖片轉檔 job

**What to build:** 使用者設定好格式和參數後開始轉檔。每個檔案即時顯示進度，可以取消，一個檔案失敗不影響其他檔案，輸出也不會覆蓋既有的檔案。輸出大小預估照常顯示。選「快速壓縮到 5/25/50MB 以下」時，輸出確實低於目標大小。

**Blocked by:** 05（Converter：拖曳和瀏覽加檔、來源資訊卡、縮圖）

**Status:** done（PDF/img2pdf 由 08 處理）

- [x] ffmpeg 指令建構、目標大小的位元率計算、進度解析、大小預估、檔名衝突避開，都搬到 Converter plugin 的 Rust 端，用 `cargo test` 覆蓋（承接現有純邏輯測試的案例）
- [x] Converter plugin 有自己的子程序執行器，跟 Downloader 那份重複，加上 ponytail 註記
- [x] Converter 不再使用 window.EstellaLib 裡對應的指令類模組
- [x] E2E（改寫現有的 test_conversion）：影片、音訊、圖片各轉一次，用 ffmpeg 驗證輸出；目標大小模式的輸出低於門檻；取消有效
