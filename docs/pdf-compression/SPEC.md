# Spec：真正的 PDF 壓縮與選配引擎（Ghostscript）

狀態：`ready-for-agent`　·　範圍：`sorai-toolkit-converter`（壓縮、引擎、首次彈窗）、`sorai-toolkit`（設定頁「轉換引擎」）　·　平台：壓縮全平台；引擎下載只有 Windows　·　前置：v2.1.0

參考：KnifeLemon/Filee 的 `docs/ENGINES.md`「PDF compression」一節與其引擎設定頁。

## Problem Statement

Converter 的 PDF「壓縮」現在只是 `qpdf --stream-data=compress`（`plugin/src/convert.rs`），只重壓資料串流、不碰圖片。PDF 的體積大多是圖片，所以結果幾乎不會變小，有時甚至變大。右鍵預設「壓縮 PDF」也是同一套，等於沒用。

## Solution

1. **內建壓縮（不必下載）**：在 Rust 裡把 PDF 中的圖片降解析度、重新編碼成 JPEG，其他串流用最高等級 Flate 重壓，刪掉縮圖和私有資料，重複的圖片只留一份。
2. **三段等級**取代原本的「壓縮」選項：

   | 等級 | 圖片最高解析度 | JPEG 品質 | Ghostscript 對應 |
   |---|---|---|---|
   | 最小 `screen` | 72 dpi | 55 | `/screen` |
   | 平衡 `ebook`（預設） | 150 dpi | 65 | `/ebook` |
   | 高品質 `printer` | 300 dpi | 85 | `/printer` |

   「線性化（網頁快速顯示）」保留為獨立選項，維持現在的 qpdf 行為。
3. **選配 Ghostscript**：裝了就再用 `gswin64c -sDEVICE=pdfwrite -dPDFSETTINGS=/<level> -dCompatibilityLevel=1.6` 跑一次，兩個結果取小的；GS 失敗時內建結果照用。
4. **不會變大**：兩條路都沒有比原檔小，就複製原檔當輸出，並在佇列和進度視窗顯示「已經無法再壓縮」。這不是錯誤，右鍵批次仍算成功。
5. **引擎安裝**：
   - 第一次進 Converter 時跳一次彈窗，列出選配引擎（目前只有 Ghostscript），附上用途、大小和授權說明，讓使用者勾選安裝或略過。不論選哪個都不再自動跳出。
   - hub 設定頁新增「轉換引擎」區塊，可以安裝、移除，或「使用我的程式…」指定電腦上已有的 gswin64c，並顯示目前狀態：已安裝、使用電腦上已有的程式、未安裝。

## User Stories

1. As a 使用者, I want 壓縮掃描檔或照片很多的 PDF 時檔案真的變小, so that 我可以寄 email 或上傳到有大小限制的地方
2. As a 使用者, I want 選「最小／平衡／高品質」而不是調 DPI, so that 我不用懂 PDF 也能選對
3. As a 使用者, I want 壓縮後文字、字型、向量圖、連結、書籤、表單都還在, so that 文件還能正常使用
4. As a 使用者, I want 已經很小的 PDF 不會被壓得更大, so that 壓縮永遠不會讓情況變糟
5. As a 使用者, I want 不安裝任何東西也能壓縮, so that 預設就有用
6. As a 想要最小檔案的使用者, I want 選擇安裝 Ghostscript 讓壓縮更有效, so that 遇到難壓的檔案也能再小一點
7. As a 新使用者, I want 第一次打開 Converter 時就被告知有選配引擎可以裝, so that 我知道有這個選項
8. As a 使用者, I want 安裝時看到下載進度、可以取消, so that 我知道它在做什麼
9. As a 使用者, I want 在設定裡之後再安裝或移除引擎, so that 第一次略過也沒關係
10. As a 已經裝了 Ghostscript 的使用者, I want 指定我自己的 gswin64c.exe, so that 不用再下載一份
11. As a 右鍵預設的使用者, I want 舊的「壓縮 PDF」預設升級成「平衡」等級, so that 更新後不必重新設定
12. As a macOS／Linux 使用者, I want 系統上有 `gs` 就自動使用，沒有就看到 brew／apt 的安裝指令, so that 我也能用上

## Implementation Decisions

### 內建壓縮器（converter plugin，新模組 `pdf_compress.rs`）
- 用 `lopdf` 讀寫 PDF，`image` crate 負責縮放（Lanczos）和 JPEG 編碼。
- **圖片實際顯示大小**：追蹤頁面、表單 XObject、註解外觀的內容串流（`q`/`Q`/`cm`/`Do`），找出每張圖片被畫出的最大尺寸。圖片解析度超過等級的 1.5 倍才縮小（同 GS）。追蹤不到的圖片，就當作以整頁大小顯示。
- **會處理的圖片**：每色 8 bit 的 Gray、RGB、ICCBased（N=1/3），編碼為 DCT、Flate（含 PNG predictor）或未壓縮。
- **原樣保留的圖片**：CMYK、1-bit、遮罩、索引色、JPX、JBIG2、CCITT、有 color-key mask 的圖片。
- **編碼方式**：照片用 JPEG。256 色以下的圖片用 Flate 無損壓縮。原本就是 JPEG、尺寸不變的圖片，要省 10% 以上才重新編碼。結果沒有比較小就不替換。
- **SMask**：跟著圖片一起縮放，並保持無損。
- **其他清理**：其他串流也用 Flate 最高等級重壓，比較小才替換。刪掉 `Thumb`、`PieceInfo`、沒用到的物件。內容相同的圖片串流合併成一份。
- 加密的 PDF 回傳和現在一樣的錯誤訊息。
- 進度以「已處理的圖片數 / 總數」回報，沿用現有的 job Channel。

### Ghostscript 路線
- `program()` 不再只有 sidecar：引擎路徑由 `engines.rs` 解析。Windows 的解析順序是：使用者指定的路徑 → app 自己下載的那份 → PATH 上的 `gswin64c`。macOS／Linux 只找 PATH 和 Homebrew 的位置找 `gs`。
- 內建壓縮和 GS 依序執行，各自寫到暫存檔，最後取最小的；兩個都不比原檔小時，就沿用原檔（見「不會變大」）。取消時兩邊都要停，暫存檔要清掉。

### 引擎下載（Windows，`engines.rs`）
- 套件固定版本並比對 SHA-256，寫在程式碼裡，不從網路取得清單：
  `https://conda.anaconda.org/conda-forge/win-64/ghostscript-10.08.0-hac47afa_0.conda`，SHA-256 `512BE9413C58B0AD3A2CD95A63EAEA73CBE32D9A6B9170C848BF825694A4ADB0`，19,295,904 bytes。
- `.conda` 是 zip，裡面有 `pkg-*.tar.zst`。用 `zip`、`zstd`、`tar` 三個 crate 解開，只取 `Library/bin`，放到 `%LOCALAPPDATA%\<identifier>\engines\ghostscript\`。
- 安裝是先下載到暫存資料夾、驗證、解壓，再 rename 到正式位置，所以中途失敗不會留下半套。可以取消。
- 移除就是刪掉那個資料夾。app 更新時保留；NSIS 解除安裝時一起刪掉（加到 `installer-hooks.nsh`）。
- 授權：Ghostscript 是 AGPL-3.0，由使用者選擇下載、以獨立程式執行，不放進我們的安裝檔。彈窗和設定頁都要寫明授權並附官網連結。
- conda 的 gs 需要 MSVC runtime。我們的 Tauri exe 本來就要求它，所以不另外處理。執行失敗時，顯示「Ghostscript 無法啟動」，並且退回內建結果。

### 設定與資料
- `PdfSettings` 保留 `optimize: "compress" | "linearize"`，新增 `level: "screen" | "ebook" | "printer"`。`level` 在 serde 和 JS 端都預設為 `ebook`，所以 localStorage 和 `presets.json` 裡的舊設定不用遷移，讀進來就是「平衡」。
- 內建預設 `pdf-compress` 明確寫 `level: "ebook"`。`suggest_name` 在等級不是預設值時，把等級加進名稱。
- 引擎設定存在 app config 的 `engines.json`：使用者指定的路徑，以及 `prompted: true`（首次彈窗已經出現過）。
- 新增 commands：`engine_status`、`engine_install`（Channel 回報進度）、`engine_cancel`、`engine_remove`、`engine_set_path`。

### UI
- Converter 的 PDF 設定：模式下拉選單（壓縮／線性化）。選壓縮時多一個等級下拉選單，以及一行狀態：Ghostscript 已啟用，或「安裝 Ghostscript 可壓得更小」，後者連到設定。
- **首次彈窗**（Converter）：引擎卡片，包含名稱、用途、大小、授權和勾選框；按鈕是「安裝所選」和「略過」。安裝時在彈窗裡顯示進度，關掉彈窗也會在背景繼續，完成時發通知。macOS／Linux 顯示安裝指令，不提供下載。
- **hub 設定 `#settings-engines`**：每個引擎一列，顯示狀態標籤和路徑，按鈕有安裝／移除、使用我的程式…（檔案選擇器）、重新檢查。
- 文案加進現有 i18n（繁中、英文）。

## Testing Decisions

- **cargo**：
  - 以 fixture 測試：掃描型 PDF 至少縮小 50%，純文字 PDF 走「不會變大」並複製原檔。
  - 內容串流追蹤：測 `cm` 巢狀和表單 XObject 的顯示尺寸。
  - 各種圖片類型的處理或保留判斷。
  - SMask 保持無損。
  - 舊 `optimize` 設定的遷移。
  - SHA 不符時拒絕安裝。
  - `.conda` 解壓只取 `Library/bin`，用一個小的假 `.conda` fixture。
  - 引擎路徑的解析順序。
- **E2E**：
  - 在 Converter 壓縮 fixture PDF，檢查輸出更小，`qpdf --check` 通過，頁數和文字（`qpdf --qdf` 後 grep）都還在。
  - 首次彈窗只出現一次。
  - 設定頁「使用我的程式…」能指到一個假的 gs 並顯示狀態。
  - 下載用本機 HTTP server，餵假套件，並用環境變數蓋掉 URL 和 SHA（只有 dev build 讀這個變數）。
- 真機：用使用者的 Terminal 實際下載 conda 套件並壓一份真的掃描 PDF（見 CLAUDE.md 的 sandbox 坑）。

## Out of Scope

- 其他選配引擎（ffmpeg 改選配、Tesseract OCR、LibreOffice）：下載機制做成可以多加引擎，但這次只上 Ghostscript。
- 字型子集化、物件串流（只有 GS 路線會產生）、灰階轉換、透明平面化。
- PDF 合併、拆分、頁碼範圍、PDF 轉圖片：另外開一份 spec。
- macOS／Linux 的引擎下載。
