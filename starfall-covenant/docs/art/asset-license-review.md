# 素材授權審查：tos-art 參考包（2026-10-30）

審查對象：分支 `tos-art-reference-20261030` 的導覽文件，以及 release `tos-art-pack-20261030` 的 `tos-art-guide.zip` 逐檔清單（29,684 檔）。
抽查方式：讀 `SOURCE_INDEX.json`、`COLLECTION_REPORT.md`、逐檔清單與 17 個社群專案的 README／LICENSE；必要的檔案只用遠端讀取個別抽出，放在本機暫存區當參考，**沒有任何圖檔進入 repo**。

## 結論

**這包素材沒有任何一張圖會放進遊戲。** 《星骸契約》是原創作品（GDD 開頭的原創聲明），神魔之塔的卡圖、符石、介面與背景直接套上去，遊戲就成了神魔之塔換皮。所以這包只當「品質與節奏的參考」，美術一律依 [style-guide.md](style-guide.md) 重新做原創版本。

## 分類

### (a) 非神魔之塔 IP、授權明確可自由使用

| 素材 | 來源專案 | 授權 | 處理 |
|---|---|---|---|
| Noto Sans TC 字型 | boyan1001/Tower_of_Crush（副本） | SIL OFL 1.1 | 遊戲字型堆疊已指定 Noto Sans TC／Noto Serif TC，要內嵌時從 Google Fonts 官方取得，不用專案裡的副本 |
| Teko、Montserrat 字型 | AdmiJW/TOS_Spinner、Patrick-Cain/not-tos（副本） | SIL OFL 1.1 | 同上；數字字型可考慮 Teko，從官方取得 |
| Cubic 11（俐方體 11 號） | boyan1001/Tower_of_Crush（副本） | SIL OFL 1.1 | 像素風，不符合本作風格，不用 |
| Ubuntu 字型 | boyan1001/Tower_of_Crush（副本） | Ubuntu Font Licence | 不需要，不用 |

結果：**沒有可直接用的圖片**，所以這次 `assets/user/` 與 `CREDITS.md` 不新增檔案。

### (b) 神魔之塔 IP 或授權不明：只當參考，不得放進遊戲、main 或 Pages（含裁切、描摹、縮圖、調色版本）

| 資料夾 | 內容 | 說明 |
|---|---|---|
| `01-official-wallpapers`、`02-official-story` | 官方桌布與故事插畫 | Mad Head 版權，無再利用授權 |
| `05-artist-portfolios` | 原畫師展示稿、宣傳動畫截圖 | 為 Mad Head 繪製的委託作品 |
| `06-official-card-gallery` | 官方圖鑑卡面 4,348 張 | 官方公開瀏覽，未授權再利用 |
| `07-wiki-hd-card-art`、`08-wiki-supplement`、`10-korean-wiki-supplement` | Wiki 卡面、頭像、活動圖 | Wiki 文字是 CC BY-SA，但遊戲圖像版權仍屬原作 |
| `04-community-shared-packs` | 論壇解包的角色去背、介面拆圖 | 第三方解包，無授權 |
| `09-runtime-bundle-examples-2020` | 執行時檔案 | 遊戲解包資料 |
| `03-community-repositories` 中的遊戲圖 | 角色去背、符石、計時條、屬性圖示、卡框、敵人 | 即使專案本身是 MIT／Apache（jordengit/TowerOfSaviorsHelper、chenFlyingkite/MyTosWiki），程式碼授權不涵蓋其中複製來的神魔之塔圖像 |
| 社群 PSD 9 檔 | 符石、介面、抽卡、數字、血條 | 依神魔之塔介面製作或拆出，屬衍生作品 |

### (c) 其他社群素材：依原作者授權，結論都是不採用

| 素材 | 授權狀況 | 結論 |
|---|---|---|
| AdmiJW/TOS_Spinner `assets/img/Card_background.png` | 同資料夾 `license.txt` 寫 Viktor Hahn、CC BY 4.0，但沒寫是哪個檔案；同資料夾其他圖（符石、時鐘、消除特效）明顯是神魔之塔素材 | 無法確認哪一張屬於 CC BY，不用 |
| boyan1001/Tower_of_Crush `code/data/*`（背景、屬性徽章、怪物、頭像） | Repo 是 MIT，但圖片看起來是 AI 生成，其中有迪士尼角色（唐老鴨）與真人照片；來源無法確認 | 來源不明加上寫實 AI 風格和本作不合，不用 |
| liouh/puzzle、MikSuki/ToS、jtsai1120/Tower_of_Savior_Qt、Tony0921、Patrick-Cain/not-tos 的珠子與介面 | README 自述使用神魔之塔素材，或與神魔之塔素材相同 | 歸 (b) |

## 公開範圍提醒（由使用者決定）

repo `zsedfv447/my-games` 是公開的，release `tos-art-pack-20261030` 的 zip 不用登入就能下載（審查時實測 `tos-art-guide.zip` 匿名下載 HTTP 200）。等於這個 repo 公開散布了約 12 GB 的神魔之塔官方美術。建議把這個 release 和 `tos-art-reference-20261030` 分支刪除，或搬到私人 repo；要不要刪由使用者決定，本審查沒有刪除任何東西。
