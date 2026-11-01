# 星光冒險 v4.3｜交接

日期：2026-10-16。原始碼：`outputs/starlight-ro-v2`（package 4.3.0，存檔仍為 version 2，新欄位皆為選用、舊存檔可直接讀）。

## 人物（VRM）
- 主角與 NPC 改用 VRoid CC0 人物（`public/models/vrm/`，授權見該資料夾 LICENSE.txt）。主角 6 名可選（`src/data/avatars.ts`，存檔 `char.hair` 為索引）；NPC 用另外 8 名，不與主角共用（`src/render3d/npc-hero.ts`）。
- 動作：`src/render3d/retarget.ts` 把 Quaternius 動作庫烘焙到人形骨架（脊椎用旋轉差、四肢用方向對齊、手部用掌面方向）。VRoid 骨架名稱一致，只烘焙一次再按髖高縮放共用。
- 職業外觀：`src/render3d/vrm-gear.ts`，衣服貼圖亮度重新映射成職業配色＋程式產生的長袍／戰袍／披風／帽子。

## 效能
- NPC 烘焙：`src/render3d/vrm-bake.ts` 把一名 VRoid NPC 約 70 個零件合併成單一 SkinnedMesh＋貼圖集，骨架保留（頭髮彈簧骨仍會動）；注意各 glTF skin 的 inverse bind 不同，已換算到同一空間。
- 人物不進 AO pass、NPC 用圓形接地陰影、畫面外 NPC 不繪製也不更新、HUD 只在內容變化時寫 DOM。
- 依實際幀時間自動調整畫質（AO／解析度三段，`Engine.setLevel`）。
- 實測（2560×1600、最高畫質、含 GPU 同步）：城鎮每格 24ms → 10ms；繪製呼叫 2386 → 905。

## 新系統
- 坐騎（`B` 夥伴視窗購買、`R` 騎乘）：移速 ×1.45～1.6，攻擊／施法自動下坐騎；天使波利由擊敗果凍國王解鎖。
- 傭兵：劍士雷恩（嘲諷）、祭司艾琳（治癒／祝福）、獵人希爾（二連矢）。模擬在 `World.allyAct`，怪物以 `aggroAlly` 轉移仇恨；傭兵使用獨立亂數流，不影響魔物與掉落的決定性。
- 表情動作 8 種、技能熟練度與覺醒（`src/data/mastery.ts`；11 個攻擊技能各有覺醒效果，傷害最高 ×1.25）。
- 建築遮擋淡出：`src/render3d/occlusion-fade.ts`。

## 驗證
- `npm test -- --maxWorkers=2`：26 檔、315 項通過（新增 companion.test.ts、mastery.test.ts）。
- `npm run build` 成功。
- 瀏覽器實測：建角、城鎮、草原自動戰鬥（傭兵嘲諷／協攻）、騎乘位置、表情、夥伴視窗。
- 未驗證：長時間平衡（熟練度與傭兵對升級速度的影響）、真人 120Hz、聲音。

## 開發頁（不列入正式建置）
`vrm.html`（VRM 人物陣列）、`retarget.html`（Styloo 動作轉接）、`hero.html`。
