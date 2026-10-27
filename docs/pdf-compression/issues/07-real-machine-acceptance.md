# 07: 真機驗收

**What to build:** 在使用者的真實電腦上（透過使用者的 Terminal，不在沙箱裡）確認整個功能：真的從 conda-forge 下載 Ghostscript、壓縮真的掃描 PDF、彈窗與設定頁的外觀。

**Blocked by:** 03、05、06

**Status:** ready-for-agent

- [ ] 首次彈窗安裝 Ghostscript 成功，`%LOCALAPPDATA%` 底下真的有 `gswin64c.exe`，而且能執行
- [ ] 一份真的掃描 PDF 三個等級都明顯變小，用 PDF 閱讀器打開正常
- [ ] 右鍵「壓縮 PDF」使用新的壓縮器
- [ ] 設定頁移除 Ghostscript 後資料夾消失
