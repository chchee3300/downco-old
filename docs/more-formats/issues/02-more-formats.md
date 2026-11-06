# 02: 新的影片／音訊輸入與輸出格式

**What to build:**
- 新的輸入副檔名可以拖曳或瀏覽加入 Converter：
  - 影片：m4v、flv、ts、m2ts、mts、3gp、wmv、mpg、mpeg、ogv
  - 音訊：opus、aiff、aif、wma、ac3、ape、dsf、dff、dts
- 影片格式下拉多 MOV、M4V、TS、WMV、MPG、APNG，編碼器下拉依容器限制選項（JS 端的 `effectiveCodec` 加 `CONTAINER_CODECS`）。
- 音訊格式下拉多 Opus、AIFF、WMA、AC3；M4A 多「無損（ALAC）」勾選（勾了停用位元率，AIFF 也停用）。
- hub 的右鍵選單（`INPUT_EXTS`、NSIS、Linux 產生器與 MIME）加新的輸入副檔名，**`.ts` 不加**。
- 文案中英文都要有，兩個 repo 的 CLAUDE.md 都要更新。

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] E2E：MP4 → MOV、MP4 → WMV 成功（用 ffprobe 檢查容器）；單聲道 mp3 → Opus 320k 成功；mp3 → M4A＋ALAC 的音訊編碼是 alac
- [ ] E2E：WebM 編碼器的限制仍然通過；MOV 只列 H.264／H.265
- [ ] hub cargo test：`INPUT_EXTS` 數量正確、沒有 `ts`、nsh 一致；`suggest_name` 對 ALAC 有名稱
- [ ] `presets.test.mjs`／`context-menu` E2E 仍然通過
