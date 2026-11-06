# 04: 只取音訊、擷取一張畫面、右鍵「影片 → 轉成 MP3」

**What to build:**
- 影片格式下拉多「M4A（只取音訊）」「MP3（只取音訊）」「PNG（擷取一張畫面）」；開了 target-size 時隱藏這三個和 GIF／APNG。
- 只取音訊的設定區只留速度；PNG 隱藏所有參數，提示會用 Trim 起點（沒設就取中間）。
- hub 內建預設多 `video-to-mp3`，從 21 個變成 22 個，連帶 Nautilus scripts、計數測試、`presets.test.mjs` 的索引、CLAUDE.md 都要改。

**Blocked by:** 02

**Status:** done

- [x] E2E：影片 → M4A：有 aac 音訊、沒有影像，來源是 aac 時 log 有 `-c:a copy`
- [x] E2E：影片 → MP3 成功
- [x] E2E：影片 → PNG 是一張圖，寬高跟來源一樣；設了 Trim 時用 `-ss <起點>`
- [x] hub cargo test：22 個內建且有 `video-to-mp3`、self_install 的數量正確
- [x] E2E `presets.test.mjs` 通過（數量與索引）；`--sorai-preset=video-to-mp3` 轉出 mp3
