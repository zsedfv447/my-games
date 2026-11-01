# 星光冒險網頁版（v7.2）

上線目標：https://zsedfv447.github.io/my-games/starlight-ro/

來源是本機 `starlight-ro-v2` 最新程式（package.json 7.2.0），原始資料夾保留。玩法沿用此版本，本次僅處理上線與子目錄相容性；版本進度請讀 HANDOFF_v4.8.md 內 v7.2 段落。

## 開發與發布

- `npm ci`
- `npm test -- --maxWorkers=1 --no-file-parallelism`
- `PAGES_BASE=/my-games/starlight-ro/ npm run build`
- `.github/workflows/starfall.yml` 會一起驗證與部署星骸契約、星光冒險，避免更新其中一款時覆蓋另一款網站。

## 存檔搬移

本機網址與 GitHub 網站使用不同的瀏覽器儲存空間，舊進度不會自動出現在網頁版。

1. 在原本遊戲開啟要搬的角色，按 Esc 進入冒險設定，按「匯出存檔」並保存文字。
2. 在網頁版選擇目的角色欄，進入遊戲後開設定，把文字貼入存檔區，按「匯入存檔」。
3. 每個角色各操作一次。匯出只包含目前角色，不是全部六個角色的集合。

匯入會經過既有資料驗證。原本本機網址的進度仍保存在原本瀏覽器資料中；試玩 `?lab=` 模式不能匯入。

## 保留素材來源

原有素材來源與授權文件均隨原始碼保留；模型資料夾保留各自 LICENSE，THIRD_PARTY_LICENSES 亦隨網站發布在 licenses/。
