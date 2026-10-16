# video-clipstitch

在瀏覽器中從影片挑選多段片段，串接輸出成 MP4 或 GIF。
全程在本機處理，影片不會上傳到任何伺服器。

**線上使用：** https://jpking7055.github.io/video-clipstitch/

![截圖](docs/screenshot.png)

## 功能

- 載入本機影片，用時間軸、逐格移動、快捷鍵精準定位
- 設定起點與終點，加入多個片段，可調整順序、刪除
- 每個片段可單獨設定播放速度
- 依列表順序串接，輸出 MP4 或 GIF
- 可調整輸出寬度與幀率，輸出前顯示預估長度與畫面數

## 使用方式

1. 開啟網頁，選擇或拖入影片檔
2. 定位到想要的位置，設為起點與終點，按「加入片段」
3. 重複步驟 2 加入多段，調整順序與速度
4. 選擇輸出格式與設定，按輸出並下載

## 瀏覽器支援(一般狀況，非實機測試)

MP4 輸出使用瀏覽器的 WebCodecs，建議使用桌面版 Chrome 或 Edge。
不支援時可改用 GIF 或 WebM 輸出。

## 本機執行

需要 [Node.js](https://nodejs.org)：

    npm install
    npm run dev

## 授權

MIT License，詳見 [LICENSE](LICENSE)。

## 備註

本專案使用 Google AI Studio 輔助產生程式碼。
