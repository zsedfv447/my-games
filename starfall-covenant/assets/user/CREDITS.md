# 素材來源與授權

使用者提供的美術與音樂放在這個資料夾，**優先於程式產生的素材**。依下方命名放進對應資料夾即自動生效（`src/ui/assets.ts`），不必改程式。

| 資料夾 | 檔名 | 用途 |
|---|---|---|
| `cards/` | `<卡號>.webp`、`<卡號>_i.webp` | 卡片立繪、頭像（沒有頭像時用立繪裁切） |
| `enemies/` | `<敵人 id>.webp` | 敵人 |
| `backgrounds/` | `title`、`home`、`story`、`chapter-1`～`chapter-5`、`event`、`tower`，Boss 版加 `-boss`（例如 `chapter-4-boss`）；舊的通用名 `battle`、`battle-boss` 仍可用 | 場景背景（直式 390×844 或 2 倍；沒有檔案時用程式產生的原創場景） |
| `ui/` | `logo` 等 | 介面圖 |
| `bgm/` | `title`、`home`、`battle`、`boss`、`victory`（.ogg／.mp3） | 背景音樂 |
| `sfx/` | `tap`、`confirm`、`back`、`match`、`skill`、`win`、`lose`、`summon` | 音效（沒有檔案時用 Web Audio 合成） |

圖片建議轉成 WebP、音樂轉成 OGG 或 MP3 以縮小檔案。

| 檔案 | 來源 | 授權 | 提供者 |
|---|---|---|---|
