# 07: 全套回歸與真機驗收

**What to build:** 確認整個分支可以發版，並列出要使用者自己在真機上確認的項目。

**Blocked by:** 06

**Status:** done

- [x] converter `cargo test`（103）、hub `cargo test`（28）、hub 完整 `npm run test:e2e`（55，對 converter 的 mf07 worktree）全部通過
- [x] 兩個 repo 的 CLAUDE.md 反映所有新行為：格式清單手動複本的位置（hub「格式清單有多份手動複本」、converter 加檔一節）、`.ts` 不進右鍵選單（兩邊都有）、`start_merge`（converter「合併指令」；hub 只寫 E2E，指令細節照慣例留在工具 repo）、分割輸出是資料夾（converter「輸出是資料夾」、hub E2E 一節）
- [x] 給使用者一份真機清單（見下）

## 真機清單（只能使用者自己在真機上確認）

先裝這個分支的安裝檔（`npx tauri build` 的 NSIS，`/S` 也可以），打開 app 一次讓它寫右鍵選單。

1. **右鍵選單**：Explorer 對 `.mov`、`.m2ts`、`.wma` 各按右鍵，出現「SORAI Toolkit」子選單；對 `.ts` 按右鍵**沒有**這個選單。
2. **`video-to-mp3`**：對一支有聲音的影片按右鍵 →「轉成 MP3」：進度視窗出現、完成後自動關、旁邊多一個只有聲音的 `_converted.mp3`，播放正常。
3. **上移／下移排序**：Converter 佇列放 3 個以上的檔案，用每一列的上移／下移按鈕排序：按鈕位置好按、順序立刻改變、第一列沒有上移、最後一列沒有下移；勾「合併成一個檔案」後輸出的順序跟畫面一樣。
4. **加密的 PDF**：PDF 操作選「加密碼」轉出一份，用 Acrobat 或瀏覽器（Edge／Chrome）打開，要輸入密碼才能看；輸入正確密碼可以開。
5. **加密預設沒有密碼**（刻意）：選「加密碼」打好密碼再「存成右鍵預設」，對 PDF 右鍵執行那個預設：那一列顯示失敗（`no password`），`presets.json` 裡沒有密碼。
