# 03: 保留原編碼（免重新編碼換容器）

**What to build:**
- 影片編碼器下拉多「保留原編碼（最快、不失真）」。選了之後隱藏畫質、fps、速度欄位，預估大小等於來源，實際執行 `-c:v copy`；聲音容器裝得下就複製，裝不下就只重新編碼聲音。
- 原編碼放不進目標容器時，自動用該容器的預設編碼器重新編碼，log 的指令看得出來。
- target-size 模式照舊強制 H.264。
- 可以存成右鍵預設，`suggest_name` 會寫出「保留原編碼」。

**Blocked by:** 02

**Status:** done

- [x] E2E：MP4（h264＋aac）→ MOV 保留原編碼：輸出影像是 h264，log 有 `-c:v copy`，畫質、fps、速度欄位隱藏
- [x] E2E：h264 → WebM 保留原編碼會退回 VP9，並且成功
- [x] 預估：保留原編碼時大約等於來源大小
- [x] hub cargo test：`suggest_name` 對 copy 有名稱
