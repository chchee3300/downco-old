# 05: Converter：拖曳和瀏覽加檔、來源資訊卡、縮圖

**What to build:** 使用者把檔案從檔案總管拖進 Converter 視窗的任何地方，或用瀏覽對話框選檔，檔案就會加入佇列，直接使用原始路徑、不複製。拖曳時整個視窗會顯示提示遮罩。不支援的類型、資料夾、重複的檔案會被略過。類型混雜時，跳出既有的混合類型選擇視窗。每個項目顯示縮圖和來源資訊（解析度、fps、原始編碼、長度）。

**Blocked by:** 01（Plugin 骨架、跨 repo 開發模式、E2E 測試框架）

**Status:** ready-for-agent

- [ ] 拖曳改用 Tauri 原生的 drag-drop 事件，遮罩由 enter、leave、drop 事件驅動；Neutralino 的 filesDropped、瀏覽器模式的 dataTransfer 讀檔和分塊複製流程全部移除；刪除 Phase 0 的探測器
- [ ] 來源資訊探測和縮圖指令都在 Converter plugin 的 Rust 端，解析部分用 `cargo test` 覆蓋
- [ ] 縮圖透過 asset protocol 提供，scope 只開放 app 的暫存資料夾
- [ ] E2E：替換瀏覽對話框後加入多個 fixture 檔（包含檔名有中文和空白的），能看到縮圖和資訊卡；重複加入同一個檔案時會被略過
- [ ] 拖曳需要使用者用真實滑鼠驗證：多個檔案、檔名有中文和空白、資料夾、類型混雜
