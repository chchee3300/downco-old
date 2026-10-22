# 07: Converter：Trim 和 Crop 的預覽與指令

**What to build:** 使用者打開 Trim 視窗時，可以播放本機檔案的預覽並選取時間範圍。打開 Crop 視窗時，可以看到預覽畫面並拖拉裁切框。輸出符合選取的範圍和裁切區域。

**Blocked by:** 06（Converter：影片、音訊、圖片轉檔 job）

**Status:** done（Crop/Trim 真實滑鼠拖拉待使用者驗證）

- [x] 預覽改用 asset protocol，使用者選的檔案在加入佇列時動態加進 asset scope；server.mount 全部移除
- [x] 裁切和剪輯相關的指令建構都在 Rust 端，`cargo test` 承接現有 test_image_crop_commands 的案例
- [x] E2E（改寫現有的 test_crop_ui）：預覽能載入，裁切輸出的尺寸正確，剪輯輸出的長度正確
