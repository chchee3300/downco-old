# 03: PDF 圖片降解析度

**What to build:** 內建壓縮器依等級（72／150／300 dpi，JPEG 品質 55／65／85）縮小並重新編碼 PDF 裡的圖片，讓掃描檔和照片多的 PDF 真的變小。圖片依它在頁面上實際被畫出的最大尺寸計算解析度。

**Blocked by:** 02

**Status:** done

- [x] 追蹤頁面、表單 XObject、註解外觀的內容串流（`q`/`Q`/`cm`/`Do`），算出每張圖片顯示的最大尺寸；追蹤不到的圖片當作畫滿整頁
- [x] 解析度超過等級的 1.5 倍才縮小到等級解析度；照片存成 JPEG，256 色以下的圖片用 Flate 無損；原本是 JPEG 且尺寸沒變時，要省 10% 以上才重新編碼；結果比較小才替換
- [x] 處理每色 8 bit 的 Gray／RGB／ICCBased（N=1、3），編碼為 DCT、Flate（含 PNG predictor）或未壓縮；CMYK、1-bit、遮罩、索引色、JPX、JBIG2、CCITT、有 color-key mask 的保持原樣
- [x] SMask 跟著圖片縮放，維持無損
- [x] 進度以「已處理的圖片數 / 總數」回報
- [x] cargo test：巢狀 `cm` 與表單 XObject 的顯示尺寸、各種圖片類型的處理或保留、SMask
- [x] 掃描型 fixture PDF 用「平衡」至少縮小 50%，三個等級的大小依序遞減
