# 06: 第一次進 Converter 時詢問安裝引擎

**What to build:** 使用者第一次打開 Converter 時，跳出一次彈窗，介紹選配引擎（目前只有 Ghostscript：用途、大小、授權），可以勾選後按「安裝所選」或「略過」。不論選哪個，之後都不會再自動跳出。安裝時在彈窗裡顯示進度；關掉彈窗也會在背景繼續，裝完發通知。macOS／Linux 顯示安裝指令，沒有下載。

**Blocked by:** 05

**Status:** done

- [x] 「已經問過」記在 `engines.json` 的 `prompted`；已經裝好 Ghostscript 的使用者不跳
- [x] 彈窗照 Trim/Crop 的 `.modal-content` 做，不套玻璃語言；文案繁中＋英文
- [x] 右鍵預設的背景啟動、`--sorai-open` 進來的 Converter 也只在第一次跳，背景進度視窗永遠不跳
- [x] E2E：第一次進 Converter 出現、略過後重新進入不再出現；安裝路徑用 05 的假套件
