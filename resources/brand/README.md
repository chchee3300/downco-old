# downco 標誌使用規範

**概念**：一條線先繞一圈（轉檔），轉回來往下落成下載箭頭；起點也是箭頭。download ＋ convert 合成一筆。

## 檔案
| 檔案 | 用途 |
|---|---|
| `downco-symbol.svg` | 標誌母檔（黑），48 px 以上 |
| `downco-symbol-small.svg` | 小尺寸版（線條加粗、箭頭加大），16–40 px：favicon、系統匣、選單圖示 |
| `downco-lockup-horizontal.svg` | 橫式組合（標誌＋字標），預設用這個 |
| `downco-lockup-stacked.svg` | 直式組合，方形空間用 |
| `downco-wordmark.svg` | 只有字標 |
| `*-blue.svg`／`*-blue-deep.svg`／`*-black.svg`／`*-white.svg` | 上面每個檔的四種顏色 |
| `downco-app-icon-tile.svg`／`downco-app-icon-tile-1024.png` | App 圖示：深色圓角方塊＋藍色標誌（安裝檔、exe、`src-tauri/icons/` 由它產生） |
| `downco-tray-white.svg`／`downco-tray-black.svg` | 系統匣（小尺寸版，裁到墨跡） |
| `downco-lockup-horizontal-*-1200w.png` | 橫式組合 PNG（README、社群） |

全部是純路徑（沒有 `<text>`、濾鏡、漸層），字標是 Inter SemiBold 轉外框（OFL 授權，可以用在標誌）。

## 顏色（跟 app 的配色同一組）
| 名稱 | HEX | RGB | 用在 |
|---|---|---|---|
| Blue | `#5b7fff` | 91 127 255 | 深色背景上的品牌色（app 深色主題的 accent） |
| Blue Deep | `#4060e8` | 64 96 232 | 淺色背景上的品牌色（app 淺色主題的 accent） |
| Ink | `#0d1017` | 13 16 23 | 單色版（淺色背景） |
| Paper | `#eef0f4` | 238 240 244 | 反白單色版（深色背景） |
| Night | `#070809` | 7 8 9 | App 圖示底色、深色背景 |

深色背景用 Blue 或 Paper，淺色背景用 Blue Deep 或 Ink。不要把 Blue 放在淺色背景上做小字（對比不足）。

## 留白與最小尺寸
- 四周至少留「下載箭頭的寬度」一半的空白（約標誌寬度的 25%）。
- 標誌母檔最小 48 px；更小一律換小尺寸版（最小 16 px）。
- 橫式組合最小高度 24 px。

## 不要
- 拉長、壓扁、旋轉、翻轉（翻轉後箭頭方向就錯了）。
- 把兩個箭頭分開上不同顏色，或加陰影、漸層、外框。
- 換字型或重新排字標，一律用提供的檔案。
- 把字標放在標誌左邊或上面。

## App 內的工具圖示
主選單的轉檔與下載圖示是標誌拆成兩半：轉檔＝迴圈（封閉的圓分成兩段、各帶箭頭），下載＝轉折落下的箭頭＋底線。24 格線、線寬 1.4、圓頭，跟 app 其他線條圖示一致。`python source/tool-icons.py` 印出路徑（轉檔是 `converter_closed()`），貼到 `src/components/HubMenu.jsx`。

## 尚未完成
- 沒有做過商標檢索（建議上線前查一下台灣智慧財產局與 USPTO／EUIPO）。
- 字標目前是 Inter 原樣只調字距，沒有專屬的字形細節。

## 重新產生
形狀由 `source/` 的腳本以圓弧精確計算（迴圈半徑 64、線寬 32、轉折弧半徑 32，下載箭頭 88×52）。在一個暫存資料夾裡依序跑：
`python source/symbol.py`（母檔與小尺寸版）→ `python source/lockups.py`（字標與組合，讀 `resources/fonts/inter-latin-600.woff2`，路徑以腳本位置為準）→ `python source/variants.py`（四色變體與 PNG 清單）→ `node source/render.mjs out/png-jobs.json`（用 hub 的 Playwright Chromium 輸出透明 PNG；`CHROMIUM` 可指定執行檔）。App 圖示：把 tile 的 1024 PNG 存成 `resources/icons/appIcon.png` 後 `npx tauri icon resources/icons/appIcon.png`（再刪掉產生的 `android/`、`ios/`）。
