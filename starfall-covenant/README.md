# 星骸契約 Starfall Covenant

原創轉珠消除 × 卡牌養成 RPG，HTML5 網頁遊戲，手機直式畫面遊玩。

## 文件
- [遊戲設計規格](docs/GDD.md)
- [流派總表](docs/card-matrix.md)
- [分工說明與審核流程](docs/workstreams.md)

## 開發
```bash
cd starfall-covenant
npm install
npm run dev     # 本機開發（手機連同網段可直接測）
npm test        # 單元測試與資料驗證
npm run build   # 打包
```

推送到 `main` 後由 GitHub Actions 自動部署到 GitHub Pages：`/my-games/starfall-covenant/`。
