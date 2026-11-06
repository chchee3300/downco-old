# Spec：更多格式、免重新編碼、擷取、合併與 PDF 頁面工具

狀態：`ready-for-agent`　·　範圍：`sorai-toolkit-converter`（主要）、`sorai-toolkit`（右鍵選單副檔名、內建預設、文件）　·　平台：全平台（右鍵選單規則照舊）　·　前置：`pdf-compression` 分支（未發版）

參考：KnifeLemon/Filee 的 `docs/ENGINES.md`「FFmpeg」「Media tools」「PDF」各節。使用者從比對清單裡選了 A1–A6、A8、B1–B4；C 組（新引擎）不做。

## Problem Statement

Converter 只認 5 種影片、6 種音訊格式，常見的 iPhone 錄影、錄影機的 TS/M2TS、舊的 WMV/MPG/FLV/3GP 直接被「不支援」擋掉。輸出也沒有 MOV、Opus、ALAC 這些使用者常要的格式。

除此之外，下面這些需求都做不到：

- **免重新編碼換容器**：每次轉檔都會重新編碼。只是 MOV 換成 MP4，也要花幾分鐘，還會損失畫質。
- **只取聲音或一張畫面**：沒辦法從影片只取出聲音，也沒辦法擷取一張畫面。
- **合併**：沒辦法把幾段影片、幾首音訊或幾份 PDF 接成一個檔案。
- **PDF 頁面處理**：PDF 只能壓縮和線性化，不能取出部分頁面、拆成單頁、旋轉或加密碼。

## Solution

1. **更多輸入格式**
   - 影片新增：m4v、flv、ts、m2ts、mts、3gp、wmv、mpg、mpeg、ogv。
   - 音訊新增：opus、aiff、aif、wma、ac3、ape、dsf、dff、dts。
2. **更多輸出格式**
   - 影片新增：MOV、M4V、TS、WMV、MPG、APNG。
   - 音訊新增：Opus、AIFF、WMA、AC3；M4A 多一個「無損（ALAC）」勾選。
3. **保留原編碼（最快、不失真）**：影片編碼器下拉多這一個選項。
   - 選了就直接複製串流（`-c copy`），畫質、fps、速度不再適用，UI 會隱藏這些欄位。
   - 目標容器裝不下原本的影像編碼時，自動改用該容器的預設編碼器重新編碼。
   - 聲音裝不下時只重新編碼聲音。
4. **只取音訊**：影片格式多「M4A（只取音訊）」和「MP3（只取音訊）」。
   - M4A：原本是 AAC 或 ALAC 時直接複製；有變速或是其他編碼時，編成 AAC 192k。
   - MP3：一律用 LAME `-q:a 2`。
5. **擷取一張畫面**：影片格式多「PNG（擷取一張畫面）」。有設 Trim 就取 Trim 起點那一格，沒設就取影片正中間那一格。
6. **合併成一個檔案**：佇列有 2 個以上的影片、音訊或 PDF 時，設定區出現「合併成一個檔案」勾選。
   - 佇列每一列多「上移／下移」按鈕，順序就是合併的順序。
   - 輸出檔名是 `<第一個檔名>_merged.<ext>`，一樣不會覆蓋既有檔案。
   - **影片**：每段的編碼、聲音編碼、解析度都一樣，又選了「保留原編碼」，而且容器裝得下時，用 concat demuxer 直接複製。其他情況把每段縮放、補邊成第一段的畫面大小與 fps 再重新編碼；沒有聲音的段落補上靜音。
   - **音訊**：一律解碼後接起來，段落之間不會有空隙。
   - **PDF**：`qpdf --empty --pages a b … --`。
   - 每段各自的 Trim 都會套用。速度、fps、畫質、目標大小套用在整個輸出上。
   - GIF、APNG、PNG、只取音訊這幾種輸出不能合併，勾選框不會出現。
7. **PDF 操作**：原本的「最佳化」下拉改成「操作」，有六個選項：
   - **壓縮**、**線性化**：照舊。
   - **擷取頁面**：輸入頁碼範圍，例如 `1-3,5`，`z` 代表最後一頁，輸出成一份 PDF。
   - **分割**：每一頁一份 PDF，放進新資料夾 `<檔名>_pages/`，檔名是 `<檔名>-<頁碼>.pdf`。
   - **旋轉**：90、180 或 270 度順時針。範圍留空就是全部頁面。
   - **加密碼**：AES-256，開啟密碼和擁有者密碼相同。
8. **右鍵選單**
   - 新的輸入副檔名都會出現 SORAI Toolkit 選單，**`.ts` 除外**，因為 TypeScript 檔也是 `.ts`。`.ts` 只能拖曳或瀏覽加入。
   - 新增一個內建預設「影片 → 轉成 MP3」，內建預設從 21 個變成 22 個。
   - 其他新格式不加內建預設，但都可以用「存成右鍵預設」自己存。
   - 合併的勾選狀態不會存進預設，因為右鍵預設是一個檔案跑一次。

## User Stories

1. 身為 iPhone 使用者，我想把 MOV 轉成 MP4 時不重新編碼，這樣幾秒就完成，畫質一點都不掉。
2. 身為 iPhone 使用者，我想在 MOV 檔上按右鍵就看到 SORAI 選單，這樣不用先打開 app。
3. 身為剪片的人，我想輸出 MOV 格式，這樣能直接丟進 Final Cut、iMovie。
4. 身為使用者，我想把錄影機的 M2TS／MTS 直接拖進 Converter，這樣不用另外找轉檔軟體。
5. 身為使用者，我想轉換舊的 WMV、FLV、3GP、MPG 影片，這樣老檔案也能在手機上播放。
6. 身為需要相容舊設備的人，我想輸出 WMV 或 MPG，這樣老電腦或 DVD 軟體讀得到。
7. 身為使用者，我想輸出 TS，這樣可以給串流或錄影系統用。
8. 身為做網頁的人，我想把短片轉成 APNG，這樣得到比 GIF 更好看、支援半透明的動圖。
9. 身為使用者，我想從影片只取出聲音存成 M4A，原本是 AAC 時直接複製，這樣又快又不失真。
10. 身為使用者，我想從影片取出聲音存成 MP3，這樣任何播放器都能放。
11. 身為使用者，我想在影片檔上右鍵選「轉成 MP3」，這樣一步就拿到音樂檔。
12. 身為使用者，我想從影片擷取一張 PNG 畫面，並用 Trim 起點決定是哪一格，這樣能拿來當封面或截圖。
13. 身為使用者，沒設 Trim 時我想拿到影片中間那一格，這樣不會老是拿到片頭的黑畫面。
14. 身為使用者，我選了「保留原編碼」時，想看到畫質、fps、速度欄位被隱藏，這樣不會誤以為那些設定有作用。
15. 身為使用者，原編碼放不進目標格式時（例如 H.264 放進 WebM），我想讓它自動重新編碼而不是失敗，這樣不用懂容器規則。
16. 身為使用者，我想在 log 裡看到實際跑的 ffmpeg 指令，這樣知道這次是複製還是重新編碼。
17. 身為使用者，我想把幾段影片合併成一個 MP4，這樣出遊的片段可以接成一支。
18. 身為使用者，合併時我想用上移／下移調整順序，這樣片段順序正確。
19. 身為使用者，合併的影片解析度不一樣時，我想讓它們自動縮放、補黑邊成同一個大小，這樣不會失敗。
20. 身為使用者，合併的某段影片沒有聲音時，我想讓那段補上靜音，這樣整支影片的聲音不會錯位。
21. 身為使用者，合併同規格的片段並選了「保留原編碼」時，我想直接複製串流，這樣很快就完成。
22. 身為使用者，我想讓合併套用每段各自的 Trim，這樣可以只接每段的精華。
23. 身為使用者，合併時我想用 5／25／50 MB 目標大小，這樣合併後的檔案能直接傳到聊天軟體。
24. 身為使用者，我想把幾首歌接成一個 MP3 或 M4A，中間不要有空白，這樣能做連續播放的混音。
25. 身為使用者，我想把幾份 PDF 依我排好的順序合併成一份，這樣報告附件只有一個檔案。
26. 身為使用者，我想看到合併後的檔名是第一個檔名加 `_merged`，而且不覆蓋既有檔案，這樣找得到也不會弄丟東西。
27. 身為使用者，佇列只有 1 個檔案時，我不想看到合併選項，這樣介面不會亂。
28. 身為使用者，輸出是 GIF、APNG、PNG 或只取音訊時，我不想看到合併選項，因為這些不能合併。
29. 身為使用者，我想從 PDF 取出指定頁面（例如 `1-3,5`），存成一份新的 PDF。
30. 身為使用者，頁碼範圍輸入錯誤時，我想看到清楚的錯誤訊息，而且這不會讓其他檔案停下來。
31. 身為使用者，我想把 PDF 拆成每頁一份，放進同一個新資料夾，這樣不會散落在原本的資料夾。
32. 身為使用者，我想把掃描歪掉的 PDF 全部轉 90 度，或只轉指定頁。
33. 身為使用者，我想幫 PDF 加上開啟密碼（AES-256），這樣寄出去比較安全。
34. 身為使用者，我不想讓密碼出現在畫面上的 log 裡，這樣截圖求助時不會外洩。
35. 身為使用者，沒填密碼就按加密時，我想看到該檔案失敗並寫明原因。
36. 身為使用者，我想把「旋轉 90 度」或「擷取第 1 頁」存成右鍵預設，這樣常做的事一鍵完成。
37. 身為使用者，我想把音訊轉成 Opus，這樣在小檔案裡保有好音質。
38. 身為 Apple 使用者，我想轉成無損的 ALAC（M4A），這樣在 iTunes／音樂 App 裡保有 CD 音質。
39. 身為使用者，我想轉成 AIFF，這樣能匯入 Mac 的錄音或剪輯軟體。
40. 身為使用者，我想轉成 WMA 或 AC3，這樣能給舊播放器或家庭劇院用。
41. 身為發燒友，我想把 APE、DSF/DFF、DTS 拖進來轉成 FLAC 或 MP3，這樣手機能播。
42. 身為使用者，單聲道來源選 Opus 320k 時我不希望失敗，系統應該自動降到上限 256k。
43. 身為使用者，我想讓檔案清單的大小預估涵蓋新格式（保留原編碼、擷取一張畫面、只取音訊、ALAC、AIFF、Opus）。
44. 身為使用者，我想讓舊的設定與舊的右鍵預設照常使用，不需要任何遷移。
45. 身為開發者，我不想在 TypeScript 檔上看到 SORAI 右鍵選單，所以 `.ts` 不註冊右鍵。
46. 身為使用者，解除安裝時我想讓新副檔名的右鍵選單也一起刪乾淨。
47. 身為 KDE／GNOME 使用者，我想讓新副檔名也出現在檔案管理員的選單。
48. 身為使用者，合併或轉檔中途按取消時，我想讓它停下來，而且不留下半成品（分割的資料夾也一樣）。

## Implementation Decisions

**Converter plugin（Rust）**

- **`Source` 記錄**：多帶 `videoCodec` 與 `audioCodec`。值是 `ffmpeg -i` 印出的名稱，空字串代表沒有這個串流或不知道。`probe_source` 用新的正規表示式 `Audio:\s+(\w+)` 解析音訊編碼，回傳 `audioCodec`，JS 佇列記錄存著它。
- **容器規則集中在純函式**：
  - `container_codecs(format)`：限定能用的編碼器，第一個是預設。WebM 是 VP9／AV1，MOV／M4V／TS 是 H.264／H.265，WMV 是 wmv2，MPG 是 mpeg2video。
  - `holds_video(format, codec)` 與 `holds_audio(format, codec)`：判斷能不能直接複製。
  - `audio_encoder(format)`：重新編碼聲音時用的編碼器。WebM 是 libopus，WMV 是 wmav2，MPG 是 mp2，其他是 aac。
  - `effective_codec`：照舊把 target-size 強制成 libx264，再套用 `container_codecs`。`"copy"` 原樣保留。
  - `video_encoder(v, src_codec)`：複製不了時退回容器預設的編碼器。
  - UI 的 `effectiveCodec` 照舊是 JS 手動複本，這次加上 `CONTAINER_CODECS`。
- **特殊影片輸出**（`is_special_video_out`）：`.gif`、`.apng`、`.png`、`.m4a`、`.mp3`。它們的指令各走自己的分支，編碼器下拉隱藏，也不能合併。
  - APNG 跟 GIF 共用 fps／速度／縮放的濾鏡鏈，加 `-plays 0`。
  - PNG 是 `-ss <Trim 起點或片長一半> -i … -frames:v 1`。
- **影片位元率**的計算抽成 `rate_args(v, 輸出秒數, 來源 kbps, 來源 fps)`，單檔與合併共用。
- **音訊編碼參數**抽成 `audio_codec_args(au, cover)`，單檔（`cover=true`：M4A 複製封面）與合併（`cover=false`）共用。
  - 新格式一律加 `-vn`。
  - Opus 的位元率上限是 256k。
  - `AudioSettings` 新增 `alac: bool`，serde 預設 false。
- **`PdfSettings`**
  - `optimize` 這個 key 沿用，值擴充為 `compress | linearize | extract | split | rotate | encrypt`。
  - 新增 `pages: String`（預設空）、`angle: i32`（預設 90，只接受 90／180／270）、`password: String`（預設空）。舊 JSON 不需要遷移。
  - `page_range()` 會去掉空白，只允許數字和 `,-zr`，空字串或不合法的字元都回錯誤。
  - 加密用舊式的位置參數 `--encrypt <pw> <pw> 256 --`，因為 macOS／Linux 的系統 qpdf 可能比 11 版舊。
  - `display_command` 會把 `--encrypt` 後面兩個參數遮成 `***`。
  - 已知風險：密碼仍然在 argv 裡，同一個使用者看程序清單看得到，用 ponytail 註解標出來。
- **分割的輸出是資料夾**
  - `Job::out_is_dir()`。
  - `unique_out_path` 多一個 suffix 參數（`_converted`／`_merged`／`_pages`）。
  - 資料夾用 `taken_dir`（`create_dir`）原子地佔住名稱。
  - 執行器在成功時回報資料夾內檔案的總大小，失敗、取消或 app 結束時 `remove_dir_all`；單檔照舊 `remove_file`。
  - `start_convert` 啟動失敗時也一樣刪掉。
- **合併**
  - 新的 plugin 指令 `start_merge(job: { sources: Source[], fileType, settings }, outDir, onEvent) -> { jobId, outPath }`，事件跟 `start_convert` 一樣，走 per-job Channel。
  - 純函式 `merge_args(job, out, listPath) -> MergePlan { args, list, seconds }`。
  - `list` 是影片走複製路線時要寫的 concat 清單，路徑寫成 `file '…'`，加上每段 Trim 的 `inpoint`／`outpoint`。plugin 把清單寫到系統 temp 底下的 `sorai-toolkit/concat/`，跟縮圖一樣在 setup 時刪掉 24 小時以前的檔案。
  - 進度用 `seconds`。
  - 輸出資料夾以第一個檔案為準（`resolve_out_dir`）。
  - 新指令要加進 `build.rs` 的 `COMMANDS` 與 `permissions/default.toml`，`plugin.js` 加上 `startMerge`。
- **大小預估**涵蓋新的輸出：保留原編碼的大小等於來源；PNG 約 1.5 byte／像素；只取音訊以 192 kbps 估算；ALAC 估 900 kbps；AIFF 估 1411 kbps；Opus 的位元率最多 256k。

**Converter UI**

- **格式清單**：`useFileManager` 的輸入副檔名清單，以及 `useSettings` 的 `VIDEO_FORMATS`／`AUDIO_FORMATS`，都加上新格式。
- **影片設定區**
  - 格式下拉的順序：MP4、MKV、WEBM、AVI、MOV、M4V、TS、WMV、MPG、GIF、APNG、PNG（擷取一張畫面）、M4A（只取音訊）、MP3（只取音訊）。
  - 開了 target-size 模式時，隱藏 GIF、APNG、PNG 和兩個只取音訊的選項。
  - 編碼器下拉多「保留原編碼」（值 `copy`），會依容器限制選項。實際使用的編碼器是 `copy` 時，隱藏畫質、fps、速度。
  - 特殊輸出要隱藏的欄位：PNG 隱藏全部；只取音訊只留速度；APNG 跟 GIF 一樣。
- **音訊設定區**：格式下拉多 Opus、AIFF、WMA、AC3。M4A 時出現「無損（ALAC）」勾選；勾了或格式是 AIFF 時，停用位元率。
- **PDF 設定區**
  - 下拉的標籤改成「操作」，列出六項。
  - 擷取頁面：頁碼範圍輸入框。
  - 旋轉：角度下拉，加上可留空的範圍輸入框。
  - 加密：密碼輸入框，`type=password`。
  - 等級與 Ghostscript 狀態行照舊只在壓縮時出現。
- **合併**
  - 勾選狀態放在 `App` 的 state，不放在 settings，所以不會進預設。
  - 只有在佇列有 ≥ 2 個檔案、類型是 video、audio 或 pdf，而且（影片時）輸出不是特殊輸出時才顯示。
  - 勾選後 `useExecute` 只跑一個 `startMerge` job。成功時在狀態列和 log 顯示輸出檔名，失敗時把錯誤標在第一列。
  - PDF 勾選合併時，隱藏操作下拉，因為合併本身就是操作。
- **重新排序**：`FileList` 每一列有上移、下移按鈕，第一列沒有上移、最後一列沒有下移。用 path 交換位置，所以執行中也安全。
- **文字**：中英文都加進 `dict.js`。

**Hub**

- **右鍵選單的副檔名清單**：`INPUT_EXTS`、`installer-hooks.nsh`、Linux 選單產生器（含 MIME）都加上新的輸入副檔名，**`.ts` 不加**。cargo test 照舊檢查 nsh 與 `INPUT_EXTS` 一致。
- **內建預設**：影片的內建格式清單加 `.mp3`，產生 `video-to-mp3`，內建從 21 個變成 22 個，Nautilus scripts 跟著變多一支。`suggest_name` 對新的值（copy、alac、PDF 操作）給合理名稱：
  - 「保留原編碼」
  - 「ALAC」
  - PDF 用操作名稱，加上範圍或角度
- **文件**：兩邊的 CLAUDE.md 都要同步更新。

## Testing Decisions

- 好的測試只看外部行為：
  - 產生的 ffmpeg／qpdf 參數（純函式）。
  - 實際輸出檔案的格式、編碼、長度、頁數，用 ffprobe 或 qpdf 檢查。
  - UI 上看得到的欄位與狀態。
  - 不測內部 state 的形狀。
- **Seam 1（既有）**：converter 的 `cargo test`，測 `build_args`、`merge_args`、`estimate`、`page_range`、`display_command`、`unique_out_path`／`taken_dir`、`parse_media_info`。前例是 `convert.rs` 和 `lib.rs` 現有的測試模組，用字串比對整串參數。
- **Seam 2（既有）**：hub 的 E2E `converter-convert.test.mjs`，透過 UI 加檔、選設定、按執行，再用 ffprobe 或 qpdf 驗證輸出。新增的測試案例：
  - MOV 用保留原編碼（輸出的影像編碼等於來源，而且很快）。
  - 影片 → M4A（音訊編碼是 aac，沒有影像）。
  - 影片 → PNG（1 張 PNG）。
  - 兩段影片合併（長度約等於總和，有聲音）。
  - 兩首音訊合併。
  - 兩份 PDF 合併（頁數相加）。
  - 擷取頁面、旋轉、加密（`qpdf --show-encryption`；log 裡沒有密碼）。
  - 分割（資料夾裡的檔案數等於頁數）。
  - Opus（單聲道 320k 成功）。
  - 上移／下移改變合併順序。
- **Hub cargo test**：`context_menu`（副檔名數量、沒有 `ts`、nsh 一致）、`presets`（22 個內建、`video-to-mp3`）、`self_install`（Nautilus 數量）。E2E `presets.test.mjs` 的內建數量跟索引也要跟著改。

## Out of Scope

- C 組全部不做：PDF → 圖片、HEIC／TIFF 等新圖片格式、字幕互轉、Office、OCR、Whisper。
- 影片 → 字幕（A7）。
- 影片的只降解析度（MaxHeight）、百分比目標大小、移除音軌、聲道與取樣率選項、圖片轉影片、移除 metadata。
- PDF 的 N-up、浮水印、頁碼。
- 圖片合併成一份 PDF。
- 合併時的轉場效果；影片合併只在同規格時複製，不做 ffprobe extradata 比對。
- 「保留原編碼」不檢查 pixel format 能不能播放（例如 4:4:4 的 H.264 會原樣複製）。
- `.vob`、`.mxf` 等更冷門的容器。

## Further Notes

- 試跑結果（隨附的 ffmpeg 與 qpdf 12.3.2）：
  - 新的輸出格式都能編碼；單聲道 Opus 320k 會失敗，所以設 256k 上限。
  - 合併的濾鏡路線（含 anullsrc 補靜音）可行；concat demuxer 複製（含 `inpoint`）可行，清單要是 UTF-8 檔案、用 Windows 路徑。
  - qpdf 的合併、`--pages . <range> --`、`--rotate=+90:1`、`--encrypt pw pw 256 --`、`--split-pages … doc-%d.pdf` 都可行。
- `more-formats` 分支（兩個 repo）已經從 `pdf-compression` 開出來。Converter 的 `convert.rs` 已經有一部分實作（容器規則、特殊輸出、`merge_args`、PDF 操作、預估），還沒編譯、也還沒提交，可以當第一張 ticket 的起點。
- 版號：跟 PDF 壓縮一起進 v2.2.0。發版順序照舊：先 push converter → hub 執行 `npm install sorai-toolkit-converter` → 再 push hub，而且只在使用者明確同意後進行。
