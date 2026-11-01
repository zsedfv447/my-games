# Quaternius RPG Character Pack

官方來源：https://quaternius.com/packs/rpgcharacters.html
官方連結的原始下載夾：https://drive.google.com/drive/folders/1MIRQXLfTd21HMI5rwOb6Xy0rv0xv1m8b
下載日期：2026-10-16。原始授權見 LICENSE.txt：CC0 1.0 Universal。

六個 glTF 均保留作者完整人物、原生骨架、11–15 個動畫與內嵌 buffer/圖片；無外部缺件。原檔另存 outputs/asset-downloads/rpg-characters。
NPC 使用各自原生 Idle，不將舊包骨骼重綁到玩家；只有尺寸正規化、非戰鬥 NPC 隱藏武器、少量材質色調差異。

實際載入尺寸：先播放原生 Idle，依角色全身 bounding box 正規化為 1.42–1.60 遊戲單位高；不改動原始檔比例。每個檔案大小、SHA-256、內嵌動畫清單、外部相依檢查見 manifest.json。

主角職業盔甲與袍並非此包付費衣服：src/render3d/profession-outfit.ts 為本專案原創幾何，胸甲／肩甲／護脛附現有骨架；袍使用現有骨架蒙皮。沒有換頭、沒有修改存檔或遊戲規則。
