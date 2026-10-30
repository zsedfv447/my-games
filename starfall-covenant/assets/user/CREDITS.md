# 素材來源與授權

使用者提供的美術與音樂放在這個資料夾，**優先於程式產生的素材**。依下方命名放進對應資料夾即自動生效（`src/ui/assets.ts`），不必改程式。

| 資料夾 | 檔名 | 用途 |
|---|---|---|
| `cards/` | `<卡號>.webp`、`<卡號>_i.webp` | 卡片立繪、頭像（沒有頭像時用立繪裁切） |
| `enemies/` | `<敵人 id>.webp` | 敵人 |
| `backgrounds/` | `title`、`home`、`story`、`battle`、`battle-boss`、`chapter-1`… | 場景背景 |
| `ui/` | `logo` 等 | 介面圖 |
| `bgm/` | `title`、`home`、`battle`、`boss`、`victory`（.ogg／.mp3） | 背景音樂 |
| `sfx/` | `tap`、`confirm`、`back`、`match`、`skill`、`win`、`lose`、`summon`；結算演出：`reward`（項目跳出）、`gem`（星晶）、`count`（數字滾動）、`star`（星章點亮）、`levelup`（玩家升級）、`finisher`（最後一擊） | 音效（沒有檔案時用 Web Audio 合成；結算演出這 6 種目前全部是合成音） |

圖片建議轉成 WebP、音樂轉成 OGG 或 MP3 以縮小檔案。

| 檔案 | 來源 | 授權 | 提供者 |
|---|---|---|---|

## 字型

| 字型 | 來源 | 授權 | 用途 |
|---|---|---|---|
| Noto Sans TC | Google Fonts（`index.html` 外連載入，未放入 repo） | SIL Open Font License 1.1 | 內文 |
| Noto Serif TC | Google Fonts（`index.html` 外連載入，未放入 repo） | SIL Open Font License 1.1 | 標題、卡片名字 |

## 2026-10-30 個人遊玩素材整合

本次從使用者提供的 `tower-of-saviors-art-20261030` 素材包選入 263 張現有圖片，涵蓋全部 84 張正式卡片的立繪與頭像、40 種正式敵人、6 張練習卡與 5 種練習敵人，以及場景、符石、盤面和介面素材。來源原圖以原始位元組複製，未放大、重新繪製或修改原始素材包。

角色以畫面屬性、配色與近似定位配圖，遊戲原有角色名稱、數值、技能及存檔編號不變。這是替換美術，並非宣稱原遊戲角色與《星骸契約》角色是同一人物。原素材角色編號與中文名稱完整保留在 `asset-manifest.json`。

| 選用內容 | 原始來源 | 權利註記 |
|---|---|---|
| 透明角色立繪、敵人、符石與種族圖示 | https://github.com/islu/TOS | 原遊戲美術權利屬原權利人；來源庫公開不等於遊戲美術開源 |
| 大型卡片頭像 | 繁中《神魔之塔》Wiki 圖檔，少數早期頭像由韓文 Wiki 補圖 | 原圖網址與來源頁逐檔記錄於 manifest；不宣稱商用授權 |
| 標題、主城、戰鬥、召喚、對話框與紋理 | Patrick-Cain/not-tos、28921085/Tower-of-Saviors-e-book、jordengit/TowerOfSaviorsHelper、pionxzh/Runestones 公開專案內既有素材 | 每張來源路徑、來源網址與雜湊記錄於 manifest；不改變原素材權利歸屬 |

素材只供本次使用者要求的個人遊玩版本。公開可取得不代表已取得商業或公開重製授權；本說明沒有替原遊戲美術套用 MIT、CC 或其他新授權。

### 素材查核

`asset-manifest.json` 記錄原包相對路徑、來源網址、來源 SHA-256、遊戲內路徑、輸出 SHA-256、圖片尺寸、用途與角色對照。所有輸出檔均可解碼，原件與輸出雜湊相同。未找到「強化且鎖定」的獨立符石原圖，因此只提供正常、強化、鎖定三組；額外鎖鏈由程式疊繪。
- `backgrounds/growth.webp`：2026-10-31 以 OpenAI image_gen 依《星骸契約》星骸祭壇、契約星紋與五屬性星核文字描述原創生成，未使用既有遊戲圖片作為輸入；經 Pillow 調整為 780×1688 並壓縮為 WebP，供卡片養成畫面共用。

### 商店、登入、任務、成就素材（2026-10-31）

`ui/shop-refill.png`、`ui/shop-expand.png`、`ui/shop-coin-bag.png`、`ui/shop-gems.png`、`ui/login-chest.png`、`ui/shop-banner.webp`、`ui/login-banner.webp`、`ui/quest-banner.webp` 由 Codex CLI（`codex exec -m gpt-6-astra`）呼叫其內建圖像工具 `image_gen.imagegen`（底層模型未公開）以文字提示詞生成的原創圖，未使用既有作品素材作為輸入。各檔的工具、提示詞與後製方式記錄於 `ui/economy-sources.json`。

## NPC 助戰頭像（2026-10-31）

`ui/npc-*.png` 共 12 張，是選擇助戰畫面的「流浪契印師」頭像（256×256 PNG），由 Codex CLI（`gpt-6-astra`）為本作原創產生，對應 `data/helpers.json` 的 NPC id。未使用任何既有作品的角色或素材。

## 2026-10-31 新手教學原創素材

以下兩張圖片為本次《星骸契約》新手教學使用 OpenAI imagegen 原創生成，並轉存為保留透明背景的 WebP：

- `ui/tutorial-guide.webp`（原圖 768×1024，接入遊戲時縮為 384×512 以減少下載量）：全新原創角色「引星者・薇菈」，契約之門的守門人與新手引路人立繪。
- `ui/tutorial-finger.webp`（256×256）：用於轉珠拖曳與按鈕操作提示的原創手指圖示，指尖位於圖片左上方附近。
