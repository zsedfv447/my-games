# 神魔之塔美術素材蒐集包

查證日期：2026-10-30。以美術為最高優先，透過中文、英文、日文與原畫師來源交叉搜尋。所有內容存放於這次新增的獨立資料夾，沒有搬動或覆寫任何原有遊戲專案檔。

本包有 **29,684 個素材與來源檔案**，共 **12.57 GB**；其中 **29,639 個圖片檔**，依檔案位元組去重為 **26,677 份不同圖片檔案內容**。這不是不同角色數；同圖不同格式或尺寸仍可能重複。統計不含本導覽、清單與縮圖；相同內容在不同原始專案的路徑仍保留，避免破壞圖集關係。

## 建議先看這些

1. **真正角色去背圖集**：`03-community-repositories/islu__TOS/image/monster/` 有 2,010 張數字 n.png。抽查為無框完整角色、透明背景；尺寸依角色而異，包含128、256、512像素等，屬較早期素材，不能稱2026最新去背全集。
2. **近期官方卡面**：`06-official-card-gallery/`，依編號與中文角色名命名，包含2026版本。卡面是帶背景的成品圖，JPG不是分層原畫。
3. **高解析完整卡面**：`07-wiki-hd-card-art/`，Pet圖片通常比官方圖鑑JPG大，部分1700×956、近期抽樣960×540。依公開來源保留原始尺寸。
4. **原畫師展示稿**：`05-artist-portfolios/Ren-Tu/`，11張角色設計成品，10張實測6000×4000。另有泡啾插畫與Paperbox蚩尤宣傳動畫18張1920×1080展示圖。
5. **可編輯PSD**：共有 9 個PSD檔，內容去重為 8 份。是社群符石、介面、抽卡、數字與特效素材，並非已證實的官方角色分層PSD。
6. **大型頭像**：`08-wiki-supplement/large-card-icons/`。有金框、屬性旗、裁切頭部；即使有透明圓角，也不算全身去背立繪。

## 實際取得內容

| 資料夾 | 內容 | 檔案數 | 圖片數 | 大小GB |
| --- | --- | ---: | ---: | ---: |
| `01-official-wallpapers` | 官方桌布 | 43 | 43 | 0.036 |
| `02-official-story` | 官方故事插畫／網站圖片 | 37 | 37 | 0.027 |
| `03-community-repositories` | 17個公開專案的美術、PSD與圖集 | 9,635 | 9,596 | 0.777 |
| `04-community-shared-packs` | 論壇公開圖片包及解壓檔 | 4,629 | 4,625 | 1.580 |
| `05-artist-portfolios` | 原畫師、插畫與動畫成品展示 | 33 | 33 | 0.135 |
| `06-official-card-gallery` | 官方圖鑑全卡面 | 4,348 | 4,348 | 0.477 |
| `07-wiki-hd-card-art` | 繁中Wiki高清卡面／背景候選 | 4,547 | 4,547 | 6.389 |
| `08-wiki-supplement` | 大型頭像、補充卡面、活動美術 | 5,969 | 5,969 | 3.117 |
| `09-runtime-bundle-examples-2020` | 2020公開UnityFS執行時檔案範例 | 2 | 0 | 0.001 |
| `10-korean-wiki-supplement` | 韓文Wiki舊版／在地化補圖 | 441 | 441 | 0.030 |

## PSD逐檔驗證

| 檔案 | 尺寸 | 圖層數 |
| --- | ---: | ---: |
| `03-community-repositories/AdmiJW__TOS_Spinner/assets/img/elims.psd` | 320×128 | 8 |
| `03-community-repositories/jordengit__TowerOfSaviorsHelper/Materials/icon.psd` | 600×600 | 5 |
| `03-community-repositories/jordengit__TowerOfSaviorsHelper/Materials/number.psd` | 480×72 | 14 |
| `03-community-repositories/jordengit__TowerOfSaviorsHelper/Materials/技能类型.psd` | 80×28 | 2 |
| `03-community-repositories/jordengit__TowerOfSaviorsHelper/Materials/抽卡.psd` | 800×1200 | 18 |
| `03-community-repositories/jordengit__TowerOfSaviorsHelper/Materials/血条.psd` | 750×1334 | 27 |
| `03-community-repositories/pionxzh__Runestones/src/assets/Icon/element.psd` | 128×128 | 37 |
| `03-community-repositories/tower-of-saviors__website/img/Creature/creature.psd` | 100×100 | 11 |
| `03-community-repositories/tower-of-saviors__website/img/Icon/element.psd` | 128×128 | 37 |

來源原庫的 `islu__TOS/image/monster/630n.png` 是0-byte空占位檔，Git blob與來源一致；保留原始路徑，但不算有效圖片或去背圖。兩份element.psd均已完整解碼且有37層，最初的動畫屬性解析誤報已修正。

macOS不區分大小寫的檔案系統會讓Pet596.png／Pet596.PNG、Pet377.png／Pet377.PNG衝突，因此將大寫版檔名加來源SHA1短後綴；原始檔名、原始網址與實際雜湊仍保留在清單中，沒有覆寫不同版本。

## 原件、檔案比對與缺漏

部分原始專案檔名副檔名與實際圖片格式不同（例如.png實際是JPEG/WebP），原始路徑保留，CSV的format欄列出實際格式，不將它們轉檔冒充PNG。圖片保留下載取得的檔案，不放大、不AI重繪、不用截圖假裝PSD。GitHub素材逐檔核對Git blob SHA；下載後再記錄SHA256、尺寸與圖片可讀性。PSD驗證8BPS檔頭與圖層記錄。

Wiki有 **3,244 張**實際下載圖片的位元組與來源API記錄不同；目前保留網站實際提供且能解析的圖檔，清單標記 `cdn-served-variant-valid-image`，保留API原始大小與SHA1。這些檔案不宣稱與上傳原件逐位元組相同。其餘Wiki下載有核對當時來源中提供的檔案大小／SHA1；完整記錄見JSONL。

- 官方圖鑑4353個可組成卡面網址，實際4348張成功。11016–11020五張回403；對應Wiki Pet11016–Pet11020可補圖，不猜測官方別名映射。
- 沒有找到能確認為官方畫師原始角色PSD、原始Unity專案、Spine／Live2D編輯工程或AE特效工程的公開下載全集。執行時圖集或解包程式不等於原始編輯工程。
- 舊15.42角色PNG Google Drive回404；其他部分資料夾需登入。沒有越過存取權限。
- 2017玩家整合畫冊缺少官方首次免費發布的一手證據，僅在來源索引保留連結，沒有打包整本畫冊。
- Mark Ho、Gus Mukin、Chris Ng等原作者ArtStation作品頁已列入研究，但直接原圖存取受限，沒有把頁面或HTTP200預覽當作原圖已下載。
- 公開可下載不代表開源或已取得商用／遊戲重製權；本包沒有擅自套用MIT或CC授權到原遊戲圖片。

## 清單與來源

- `00-collection-guide/檔案清單.csv`：可用Excel或Google Sheets開啟；逐檔列尺寸、大小、用途、來源與SHA256。
- `00-collection-guide/file-inventory.jsonl`：完整逐檔紀錄，另有來源預期雜湊及差異註記。
- `00-collection-guide/duplicate-groups.json`：相同內容的來源路徑，數量不灌水。
- `00-collection-guide/source-indexes/`：完整中英文與韓文Wiki索引（34418＋20247＋806筆）、官方圖鑑、17個公開專案、143個論壇分享連結與畫師清單；JSON以gzip壓縮。索引筆數不代表全部檔案已下載。
- `00-collection-guide/research/`：中文、英文、日文三路詳細研究與第三輪補漏。
- `00-collection-guide/美術素材預覽.jpg`：美術分類縮圖。

主要一手或原始整理來源：

- [官方圖鑑](https://gallery.tosgame.com/)
- [官方桌布](https://towerofsaviors.com/picture/) ／ [官方故事插畫](https://story.towerofsaviors.com/)
- [繁中Wiki](https://tos.fandom.com/zh/wiki/神魔之塔_維基) ／ [英文Wiki](https://towerofsaviors.fandom.com/wiki/Tower_of_Saviors_Wiki)
- [islu/TOS角色與介面素材](https://github.com/islu/TOS)
- [Ren Tu原畫師作品集](https://rentu621.wixsite.com/renart)
- [Paperbox蚩尤動畫案例](https://www.paperboxcreations.com/tower-of-saviors-chiyou-promotional-video)
- [原始角色去背圖與音樂整理串](https://forum.gamer.com.tw/C.php?bsn=23805&snA=414338)

GitHub交付使用獨立分支 `tos-art-reference-20261030`，只新增 `starfall-covenant/tos-art-reference-20261030/` 的導覽與來源說明；大型素材以獨立下載附件交付，不改動main或現有程式。
