# 01: 轉檔邏輯地基（純函式＋探測音訊編碼）

**What to build:** Converter plugin 的純邏輯能產生這次所有新功能的指令，還沒有 UI。具體範圍：
- 容器規則：`container_codecs`、`holds_video`／`holds_audio`、`audio_encoder`、`video_encoder`。
- 特殊影片輸出：GIF／APNG／PNG／M4A／MP3。
- 新的音訊編碼器：Opus 上限 256k、ALAC、AIFF、WMA、AC3。
- PDF 操作：擷取頁面、分割、旋轉、加密（log 遮蔽密碼）。
- `merge_args`。
- 輸出檔名 suffix（`_converted`／`_merged`／`_pages`）與 `taken_dir`。
- 大小預估。
- `probe_source` 多回傳 `audioCodec`，`Source` 帶 `videoCodec`／`audioCodec`。

這是 prefactor：既有行為不變，現有測試全部通過（只改簽名）。起點是 `more-formats` 分支上未提交的 `convert.rs`。

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] `cargo test` 全綠（既有測試只因為 `unique_out_path` 多了 suffix 參數而調整）
- [ ] 每個新分支都有字串比對的測試：
  - 編碼器下拉選「保留原編碼」：容器裝得下、裝不下但會退回、只有聲音要重新編碼
  - APNG／PNG（有沒有 Trim）／M4A（複製或 AAC、變速）／MP3
  - Opus 320k→256k、ALAC、AIFF、WMA、AC3
  - 擷取、旋轉（有沒有範圍、不合法的角度）、加密（沒有密碼就錯誤）、分割
- [ ] `merge_args`：PDF、音訊（含變速）、影片複製路線（清單含 `inpoint`／`outpoint` 與 `'` 跳脫）、影片濾鏡路線（不同解析度、沒有聲音的段落補 anullsrc、target size）、少於 2 個檔案就錯誤、特殊輸出就錯誤
- [ ] `page_range`、`display_command` 的密碼遮蔽、`taken_dir`、`parse_media_info` 解析出 `audioCodec`
- [ ] 舊的 settings JSON（沒有 `alac`／`pages`／`angle`／`password`）可以反序列化
- [ ] 執行器（runner）支援輸出是資料夾：成功時回報總大小，失敗、取消或 app 結束時刪掉整個資料夾；`start_convert` 為分割預留資料夾
