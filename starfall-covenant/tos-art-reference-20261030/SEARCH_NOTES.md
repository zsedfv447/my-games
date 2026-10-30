# 愛給網「神魔之塔 75」查驗

查驗日期：2026-10-30。此來源沒有新增可正常公開下載並驗證的原始美術包；只保留索引，未登入、未付款、未繞過限制。

## 75 的實際意義

已從公開分類標籤核對到 `data-metric-code=magic_tower`、分類 id `66818`，正常篩選網址為：

[神魔之塔分類結果](https://www.aigei.com/s?type=game_pkg&dim=magic_tower)

本次原始 HTML 顯示文件數 **75**、每頁 40、總共 2 頁。但第一頁實際混合其他遊戲與泛塔防素材，例如《神魔九天》《神魔獸傳》《謎畫之塔》《神魔HD》，以及劍類附魔動態素材、像素森林村莊、各式塔防場景等。因此「75」不能直接解讀為 75 份神魔之塔專屬素材包。

第一頁的 40 個條目已記在 `aigei-sources.json`。正常第二頁網址回 `banip403` 禁止頁面，沒有繼續嘗試其他存取方式；剩餘 35 個條目沒有查驗完成。

## 唯一可明確辨識的神魔之塔條目

- 標題：**《神魔之塔》全套3D角色+UI+特效！2D手游资源。**
- 詳情索引：[shen_mo_zhi_t.html](https://www.aigei.com/item/shen_mo_zhi_t.html)
- 站內 id：`46585880`
- 結果頁類型：壓縮資源 `arcv`。

標題宣稱角色、UI、特效；這是網站上傳條目的宣傳用語，不能據此認定實際含完整 3D 角色，也不能認定包含 PSD、Unity 或其他編輯工程。

詳情頁同樣回 `banip403`。公開列表的檔案大小、格式、VIP／價格欄位為空白，屬需 JavaScript 補載欄位；本次沒有繞過詳情限制追隱藏下載接口。因此實際壓縮檔格式、大小、檔案數、作者、版本、銅幣價格與 VIP 要求均**未確認**，也沒有拿到可下載原始壓縮檔的 URL。

它是第三方平台的條目；沒有可見的 Mad Head 官方發佈、畫師授權或原始工程證據。可能是第三方整理／匯出，但尚未查看內容，不能把推測寫成已確認解包。

## 平台一般下載規則

[愛給官方 FAQ](https://www.aigei.com/faq/doc/14.html) 說明平台使用銅幣及 VIP 分級，普通會員可下載未標 VIP 的資源，VIP 標示資源限 VIP。這只能證明平台的一般制度，不能證明上述神魔包是否免費、實際需要多少銅幣或一定要付費。

[平台授權 FAQ](https://www.aigei.com/faq/doc/1.html) 另說明未明示授權的內容並非自由商用素材。「免費下載」不能等同官方原件、PSD 原檔或可再利用授權。

## 可交付下載項目

`aigei-sources.json` 的 `assets` 為空。已保留分類網址、第一頁 40 筆條目、明確神魔條目、存取限制與官方 FAQ。此來源沒有被混入主代理已成功取得的素材數量。


---

# 第三輪：中文分享包與公開替代載點追查

查驗日期：2026-10-30。僅新增本輪研究檔，沒有改動專案或下載重複大型素材包。

## 結果

本輪未確認有新的近代完整美術包，但找到一個應下載比較的有效 Box 候選：`sprite.zip` 為 177,498,747 bytes，與主代理已下載的 Dropbox 同名檔約 106.1MB 不同，不能只因同名就當重複。已放入 `round3-assets.json` 的 `assets`；需由主代理下載後比較內容與 SHA256。

## 143 條連結已追查

已逐一追查第一輪從巴哈原貼文抽出的 143 條不同網址；15.42 圖包和介面資料夾先前已確認 404／需登入，依指示不重試。

| 狀態 | 數量 | 實際意義 |
| --- | ---: | --- |
| 公開檔案檢視頁 | 47 | 43 首 MP3 背景音樂、1 個 LOCALE 文字檔、3 個已取得的 sprite／spritepng／skill 包 |
| 公開資料夾頁 | 2 | sprite 角色資料夾、BGM 資料夾 |
| Google 登入頁 | 51 | 停止，不登入、不改走限制端點 |
| HTTP 401 | 21 | 未授權，沒有認定為可取檔案 |
| HTTP 404 | 10 | 失效 |
| Imgur HEAD 200 | 10 | 原文零星角色圖，屬舊北域角色更新；沒有當新版全集補入 |
| 先前已確認受限、未重試 | 2 | 15.42 圖包與其他介面圖資料夾 |

完整逐網址結果、跳轉網址及頁面標題保存在 `sources-round3.json`。HTTP 200 預覽頁本身不等於已驗證壓縮檔內容；本輪將此界線保留。

## 原作者小屋

找到原作者 [2018 年 7 月 23 日的小屋文章](https://home.gamer.com.tw/artwork.php?sn=4068353)，是因原論壇串無法推文而另發。內容宣稱 15.42 有 2,014 張圖，然而仍使用第一輪已失效的相同 Google Drive 檔案，沒有公開替代位置。所見 2026-02-13 的讀者留言仍在詢問音檔失效問題，不能因此推定有更新大包。

## 補找到的 Box／OneDrive 鏡像

原帖還有第一輪 143 條清單之外的 Box／OneDrive 分享。OneDrive 兩個 ZIP 連結均回 403，停止追取。

Box 的兩個檔案仍公開可下載，且不是只有空預覽：其公開 metadata 的 `canDownload=true`；沿公開下載端點發 HEAD，最終回 HTTP 200、`application/zip`、正確 `Content-Disposition` 及檔案大小。

| 檔名 | 原始公開頁 | 大小 | 決定 |
| --- | --- | ---: | --- |
| sprite.zip | [Box tossprite](https://app.box.com/v/tossprite) | 177,498,747 bytes | 大小不同，待下載比較內容／SHA256 |
| spritepng.zip | [Box PNG 包](https://app.box.com/s/p1qrnbw2dxtb46vwod4ie6vzz6b494ai) | 98,263,970 bytes | 同作者舊版角色整理包鏡像，排除重複 |

Box sprite.zip 永久入口型直接下載端點已存 `round3-assets.json` 的 `assets`；spritepng 同大小鏡像先留在 `excluded_public_mirrors`。它們會跳至臨時 Boxcloud 簽名下載網址，應使用入口重新取得。本代理沒有下載或打開整包，不能宣稱檔內內容較 Dropbox 更新、更多或完全重複；原帖所屬更新段為 2015–2016 年版本。

## 其餘查證

- 以繁中、簡中、去背、原圖、PSD、素材包、Mega／網盤等組合持續搜尋，沒有找到 2018 之後可獨立驗證的角色全身去背全集。
- 原作者的 [縮圖網址說明](https://home.gamer.com.tw/artwork.php?sn=2858102) 明記舊 512 圖示端點已失效；其餘為 100／128 像素小圖示，不合本輪大圖條件。
- 公開美術 Wiki 作者外部連結索引已檢查；沒有找到新的近代完整素材分享包。社群、ArtStation 原作頁與之前研究重疊，沒有重複聲稱新增。
- 官方 WordPress 媒體目錄回 `401 rest_login_required`。沒有登入或繞過限制；官方既有公開桌布／故事網站由主代理處理，本輪不重複新增。
- 2021 年解包討論找到的是提問與操作截圖，沒有成品大包；2016 年 TEX Converter 2.0 屬工具原始碼，仍不能當作遊戲美術原始工程。

以上結果是「已找到且檢查的公開來源」範圍，不是對所有社群、私人分享或未索引網站的存在與否做保證。


---

# 《神魔之塔》中文來源與官方圖鑑研究

查驗日期：2026-10-30。只新增本研究資料夾，未改動任何現有專案或遠端倉庫；素材整包由主代理統一下載。本代理僅下載研究網頁、索引與少量圖片樣本。

## 可以立即採用的素材目錄

| 來源 | 實際取得的目錄 | 規模及範圍 | 性質 |
| --- | --- | --- | --- |
| [官方神魔之塔圖鑑](https://gallery.tosgame.com/) | `gallery-manifest.json` | 4,353 張完整卡面，含 246 張 2026 版本角色 | 官方 JPG 成品；抽樣 640×427，有背景 |
| [繁中神魔維基 allimages](https://tos.fandom.com/zh/api.php?action=query&list=allimages&ailimit=500&aidir=descending&aisort=timestamp&aiprop=url%7Csize%7Csha1%7Cmime%7Ctimestamp&format=json) | `wiki-allimages-with-sha1.json` | 34,418 張全部圖片；69 頁完整列舉，與 siteinfo 圖片數相符；全數有 SHA1 | 網友上傳的遊戲圖、介面、截圖、活動圖等混合內容 |
| 同上，全尺寸優先 | `wiki-priority-manifest.json` | 4,385 張 Pet/n 全尺寸卡圖＋162 張背景／活動／插畫候選；宣告原始大小共 6,403,635,702 bytes | 4,547 張；不是 PSD，PNG 不代表去背 |
| 同上，近期子集 | `wiki-recent-2024plus.json` | 870 張；依檔案最後上傳／更新時間 ≥ 2024 篩選 | 時間不是角色實裝日期 |
| 同上，大頭像 | `wiki-large-icons.json` | 4,006 張數字 i 圖，最短邊 ≥ 400；約 1.72 GB | 與完整立繪分開。透明圓角不代表角色去背 |

每份 normalized manifest 均使用 `assets` 陣列，各筆保留 `url`、`source_page`、`title`、`category`；維基另有 `width`、`height`、`size`、`timestamp`、`sha1`。`wiki-allimages.json` 是未補 SHA1 版，正式建議使用 `wiki-allimages-with-sha1.json`。優先清單也已補入 SHA1。

### 官方圖鑑如何確認

[官方社群頁](https://towerofsaviors.com/official-community/) 明確將 gallery.tosgame.com 列為官方圖鑑。本次可直接取得首頁及 [主程式 JS](https://gallery.tosgame.com/static/js/main.b2399f93.chunk.js)，其中 `Ka` 角色陣列有 4,408 筆；排除缺少 id／版本 groupId 的空白或特殊記錄，產生 4,353 筆卡面 URL。不是猜測編號掃描。

同一 JS 的 `z(a)` 函式只有將 id 補到至少 4 位後組成公開 CDN 網址，UI 的大圖按鈕與圖片標籤皆直接使用 `z(t.id)`：

`https://d1h5mn9kk900cf.cloudfront.net/toswebsites/gallery/cards/{至少4位id}.jpg`

最新樣本 [11306 靈鯉化形 ‧ 軒轅](https://d1h5mn9kk900cf.cloudfront.net/toswebsites/gallery/cards/11306.jpg) 與 [11305 魔領君后 ‧ 巴力與夏娃](https://d1h5mn9kk900cf.cloudfront.net/toswebsites/gallery/cards/11305.jpg) 均回 HTTP 200、有效 JPEG、640×427。版本記錄為 v2026.600。

主代理回報批量 4,348 成功、11016–11020 五張 403。本代理再次查 JS，未見把五張映射至 11015 或其他基底的公開邏輯，因此保留失敗而不造別名。繁中維基恰有 `Pet11016.png` 至 `Pet11020.png`，均 960×540，可補卡面；已存 `wiki-gallery-missing-5.json`。

### 維基格式與透明度實測

API 的原始圖片 URL 如果不加參數，Fandom 可能自動回 WebP。例如 `Pet11306.png` 原始宣告 940,271 bytes，直接抓取僅 175,368 bytes 的 WebP；加 `&format=original` 後回真正 PNG 940,271 bytes。所有正式 manifest 的下載 URL 均已加 `format=original`，並保留 `original_api_url`。

`Pet11306.png`、`Pet11305.png`、`Pet11302.png` 是 960×540 的完整角色與場景組圖。原始 PNG 為 RGBA，但樣本 alpha 全 255，沒有去背。較舊 Pet 圖常有 1700×956，能補官方圖鑑較小 JPG 的解析度。

`11306i.png`、`11305i.png`、`11302i.png`、`2977i.png`、`001i.png` 均為 512×512 RGBA、alpha 0..255；實際查看是帶金框、屬性旗與裁切臉部的卡面頭像。透明區域在圓角外側，不能稱角色全身去背。另 `11294i.png` 只有 160×160。已將 4,006 張大 i 圖另列。

全維基數字 n 檔名僅少量早期記錄，並含 JPEG／大小寫副檔名；n 名稱本身也不能證明去背。本次未找到近期角色透明立繪的完整中文公開分享包。

## 巴哈仍能開啟的角色及介面分享包

原作者：[★☆TWY☆★ / wingyintang 的長期整理串](https://forum.gamer.com.tw/C.php?bsn=23805&snA=414338)。網頁搜尋工具有時 403，但正常讀取公開頁面可得完整內容。本次抽出 143 個不重複 Dropbox／Google Drive／Imgur 原始連結，存 `forum-all-unique-links.json`，沒有把未測試者都列為有效。

- [sprite.zip](https://www.dropbox.com/scl/fi/x2keiymrc7duwu8twrcfe/sprite.zip?rlkey=y5j91cmaqxtw7x90z98pljxko&dl=1)：角色 PNG／TGA 成品整理。論壇舊更新段註明 9.01、1–800、194MB；後續更新也沿用同連結，實際檔內版本以主代理開包結果為準。
- [spritepng.zip](https://www.dropbox.com/scl/fi/b3yl7nomat156am47zkry/spritepng.zip?rlkey=hbvhfqltckl7dyrx477xk8ihu&dl=1)：PNG-only 版本，舊更新段標示 125MB。
- [skill.zip](https://www.dropbox.com/scl/fi/m2b0klv26pgrj8a73t40i/skill.zip?rlkey=zgm8pcsdcovwnaoimzzy4legv&dl=1)：同串 38 樓提供的敵人技能拆圖，屬介面素材。
- [角色獨立下載資料夾](https://www.dropbox.com/scl/fo/jerqk94hcxlyna1l3dr1g/AGuVXmwRzfCBtfSB09TUOe0?rlkey=2fglbq4s4nx0faa7z9m8355r2&dl=0)：HTTP 200、Dropbox 資料夾頁，標題 sprite。

前三項本代理確認回正常 Dropbox 檔案頁；實際大檔下載及解壓驗證由主代理進行。這些是第三方從遊戲整理出的點陣圖片，不是畫師 PSD，也不是可還原完整遊戲的工程。

同串較新的 [15.42 PNG ZIP](https://drive.google.com/file/d/1YVTNqjiiEvqe8NYPjN0n7CZ42juu1GG5/view?usp=sharing) 現在 HTTP 404；其他 KTX／介面／背景資料夾會轉 Google 登入，未越過權限。26 樓描述含主畫面、卡框、COMBO、GAMEOVER、VICTORY、公會圖示等，但不能把描述當已成功取得全部檔案。

## PSD／原始工程查證

有找到兩個真正標為 PSD 的玩家卡面模板，但目前連結都失效：

1. [阿銘／toby70609 於 2013 年分享的圖鑑版面 PSD／UFO](https://forum.gamer.com.tw/Co.php?bsn=23805&sn=140210)：Dropbox `null.psd` 回 HTTP 200 但頁名 `shared_link_disabled`，實質不能下載。它是玩家卡框模板，非官方畫師角色 PSD。
2. [封印卡設計大賞 PSD 組合包](https://forum.gamer.com.tw/G2.php?bsn=23805&lorder=4&parent=954&sn=880)：原 Google Drive id `0B0SkDWzfosNjdTFRdVk1MnZoS2M`，現在 404。文章描述包含字體、可編輯文字與圖層選單，仍是玩家模板。

本次中文來源未查到可公開下載、能確認出自神魔畫師的角色分層 PSD，亦未取得官方 Unity／Spine／AE 等編輯工程。

[TERENCEYAO 的 2014 年 TEX 提取教學](https://forum.gamer.com.tw/Co.php?bsn=23805&sn=999204) 仍有可用 MediaFire 下載頁：

- [TOS Tex Converter](https://www.mediafire.com/file/294w2eev7e74v83/TOS+Tex+Converter.rar/file)，904.97KB。
- [TTC Example](https://www.mediafire.com/file/zb4i5acf1b4qjqe/TTC+Example.rar/file)，1.79MB，舊遊戲 TEX 範例。
- [轉換工具 Source Code](https://www.mediafire.com/file/ea7xvrl5nna0sxh/TOS+Tex+Converter+Source+Code.rar/file)，1.79MB，作者自己的 MFC／C++ 工具工程。

原始碼是「貼圖轉換器」而非神魔遊戲或美術工程；沒有執行未知 EXE。即時直接下載網址已存 `sources.json`，可能過期，日後可從 MediaFire 檔案頁重新取得。

另找到 [Kingsmai/apk-extract 公開程式庫](https://git.tootaio.com/Kingsmai/apk-extract)，README 描述可整理神魔之塔 Unity、Spine、FairyGUI、圖片及音訊。沒有公開成品素材包；README 也區分執行時骨架與原編輯工程。僅閱讀，沒有修改、下載或執行該專案。

## 畫冊：保留索引，尚未納入整包

[2017 年星星／kratos2006 的高清整合版畫冊文](https://forum.gamer.com.tw/Co.php?bsn=23805&sn=3237440) 提供 29 張 JPG ZIP、PDF 與 Imgur 相簿；Dropbox 檢視頁目前仍可開啟。作者表示圖片來自官方免費釋出後合併，但文內沒有官方首次發布網址。經多輪中文與英文搜尋，仍未取得官方免費數位版本的一手證據，也不能排除實體出版內容重製。

依主代理指示，來源及連結保存在 `sources.json`，標示 `do_not_bundle=true`，沒有下載整本畫冊。這與已明確公開的官方單張卡面、桌布分開處理。

## 其他中文線索及限制

- [神魔之塔美術 Wiki](https://towerofsaviorsart.fandom.com/zh-tw/wiki/圖鑑) 有畫師目錄，可追 Shin Chan、Katew、老湯、陸六鹿、Panda Pen 等原作者；API 可讀，但最新抽樣更新是 2021-10-25，且圖鑑含無效檔案連結，不是近期完整庫。
- [簡中 toscn Wiki](https://toscn.fandom.com/zh/wiki/神魔之塔_维基) API 可讀，抽樣是 2013 年的早期 001i 等；作為中國版舊圖補充，未重複全下載。
- [Steam 神魔立繪替換模組](https://steamcommunity.com/sharedfiles/filedetails/?id=3432327245&l=schinese) 頁面顯示已因違反社群指引移除，未追繞取得檔案。

所有圖片公開可下載與取得二次利用權利是不同問題。官方、合作 IP 及第三方上傳圖均未見整體放棄權利的授權；Fandom 的一般社群 CC BY-SA 說明不能直接涵蓋遊戲原作圖像。這份研究記錄來源與檔案形式，沒有把點陣圖、解包資料或玩家模板稱為官方原始美術工程。


---

# 其他語言與補漏查詢

查驗日期：2026-10-30。以下是主代理補做的查詢，不宣稱已窮盡各語言所有網站。

| 語言 | 實際搜尋詞 | 主要結果與處理 |
| --- | --- | --- |
| 印尼文 | Tower of Saviors ilustrasi aset download | TapTap印尼頁與PNGEgg聚合圖，未確認新增原始工程 |
| 泰文 | Tower of Saviors ภาพ ตัวละคร ดาวน์โหลด | TapTap泰文頁、官方圖庫；App截圖不冒充素材原件 |
| 韓文 | Tower of Saviors 원화 리소스 | 找到 tos.fandom.com/ko 的韓文Wiki；追公開索引比對 |
| 西班牙文 | Tower of Saviors assets descargar | 多回到官方、英文Wiki與聚合圖，未確認新的PSD庫 |
| 法文 | Tower of Saviors illustrations ressources téléchargement | 主要返回官方桌布、原畫師作品，已由其他研究涵蓋 |
| 越南文 | Tower of Saviors hình ảnh nhân vật tải | App介紹與截圖，未把遊戲APK介紹頁當美術包 |
| 日文補查 | 神魔の塔 素材 イラスト 原画 ダウンロード | 小說同名誤命中已排除；官方稱呼一手證據見日文研究 |
| 簡中補查 | 神魔之塔 素材包 PSD 原画 下载 | 找到愛給網分類聲稱75項；另由中文代理查驗可下載性與來源 |

其他線索：

- https://sketchfab.com/3d-models/tower-of-saviors-9ec8ea6fafe74a5fb32249872fc11dc8 ：頁面403，未取得模型、授權或下載檔，不算已收3D原件。
- https://wall.alphacoders.com/big.php?i=994506 ：列mike siu、1920×1187桌布與私人個人用途限制；不是官方分層原稿。公開圖片連結是 https://images6.alphacoders.com/994/thumb-1920-994506.jpg 。
- https://www.aigei.com/game2d/pkg/ ：分類搜尋索引列神魔之塔75，正文403，由中文代理補查獨立項目。搜尋數字不算實際下載數。


---

# 神魔之塔美術素材：日文、原作者作品與官方桌布

查證日期：2026-10-30。僅新增本研究資料夾的研究檔；未碰目標專案、Git 或 GitHub。圖片由主代理統一下載。本代理只以唯讀請求核對HTTP狀態、尺寸與公開展示內容。

## 最有價值的可下載成果

| 清單 | 筆數 | HTTP200 | 已知大小 | 內容 |
|---|---:|---:|---:|---|
| `sources.json` 的 `assets` | 41 | 41 | 124,115,701 bytes | Ren Tu原畫師11張JPG＋官方30張桌布 |
| `assets-round2.json` 的 `assets` | 22 | 22 | 35,211,341 bytes | Paperbox18張動畫截圖＋2個標題橫幅＋泡啾2張插畫 |

1. **Ren Tu高解析角色圖**：10張實測6000×4000，另龐貝1張9,082,335 bytes，因JPEG前置資料較大未由部分讀取解析到尺寸。包括梅蜜、伊蓮姑、蓋倫、潛解高柏飛、藍德南、兔比、丁香、桃樂絲、伽瑪、韓湘子與龐貝。原頁逐張標中文角色名，並明列神魔之塔客戶：[作者作品集](https://rentu621.wixsite.com/renart)。是作者展示用完成圖／合成稿，**不是PSD、不含分層或透明通道**。
2. **官方英文站30張桌布**：含Fallen Halos手機圖、PC與舊手機桌布。[官方桌布](https://en.towerofsaviors.com/wallpaper/)由[Media入口](https://en.towerofsaviors.com/media-2/)連入。從官方HTML擷取圖片、移除WordPress縮圖代理參數後逐張驗證原站圖檔，解析度以JSON實測為準，不以網址或頁面標題推估。
3. **蚩尤宣傳動畫18張1920×1080展示截圖**：[Paperbox製作商自己的案例頁](https://www.paperboxcreations.com/tower-of-saviors-chiyou-promotional-video)。直接取公開img/srcset中最大尺寸，未猜測CDN原圖位置。另3840×384 JPG與1200×135 GIF只是案例標題橫幅，優先度低，不能算作角色／背景／特效圖。無AE、Spine、PSD、骨架或VFX工程下載。
4. **泡啾PauJiou兩張商業社群插畫**：酒吧雙人2500×4000、情人節2894×4093。[作者首頁](https://paujiou.wixsite.com/paujiou/)明列神魔之塔社群宣傳插畫；[商業合作頁](https://paujiou.wixsite.com/paujiou/%E5%95%86%E6%A5%AD%E5%90%88%E4%BD%9C)混合多客戶。酒吧圖已與[明確標神魔官方宣傳插畫2018–2021的Behance封面](https://www.behance.net/gallery/73611705/-20182021)逐圖比對，情人節圖可見遊戲魔法石；未將其他客戶插畫混入。

HTTP200與圖檔標頭解析只證明查證時可讀、內容類型與尺寸。本代理未保存完整圖檔，**不宣稱完整下載、SHA256或整張畫面驗收**。兩批全部為匯出圖／動畫展示，沒有找到公開可下載的官方角色PSD、Spine骨架、Live2D或特效工程。

## 日本名稱與日文搜尋

日本合作方一手文件確實使用 **「神魔の塔」**：[Forside 2018-02-09合作公告PDF](https://www.forside.co.jp/wordpress/wp-content/uploads/2018/02/180209_PR_FD_Mad-Head-Games%E3%81%A8%E3%81%AE%E5%8D%94%E6%A5%AD%E5%B1%95%E9%96%8B.pdf)第1頁介紹Mad Head Limited主力遊戲時明文如此稱呼，圖片商標仍為TOWER OF SAVIORS／神魔之塔。這證明日文稱呼，不能推論有日本版或日本專用素材庫。**未找到官方使用「タワーオブセイバーズ」證據，不把音譯當正式日文名。**

交叉搜尋神魔之塔／神魔の塔／タワーオブセイバーズ／Tower of Saviors，搭配画像、素材、立ち絵、抽出、イラスト、壁紙、PSD。主要導回繁中／英文官方與畫師頁，沒有找到可信獨立日文PSD庫。

- [APPLION圖片頁](https://applion.jp/%E7%A5%9E%E9%AD%94%E4%B9%8B%E5%A1%94-%E6%94%BB%E7%95%A5-Tower-of-Saviors/android-coolapp.tower/gallery/)是Starasonic第三方攻略App截圖，不是遊戲官方素材。
- [PNGWing日文頁](https://www.pngwing.com/ja/free-png-tujeb)是512×512／199.41KB聚合PNG，標非營利用；不是官方原稿或授權證明，優先度低。

## 可確認的原作者作品：ArtStation存取限制

web檢索能讀部分正文，直接HTTP、正常公開RSS及公開JSON均403，未登入或繞過限制，未編造CDN直連。作品頁與限制完整列於`sources.json`，可留待一般瀏覽器人工查看／另存。

### Ren Tu

[神魔專案](https://ren_tu621.artstation.com/projects/a0mLAL)自述多年為神魔繪製立繪，列Randena、Bonnie、Han Xiangzi與Basti。頁底All rights reserved。實際可讀高解析圖以作者Wix為主。

### Chris Ng：怪物、角色、線稿、平塗與初稿

- [creatures and characters illustrations](https://chrisnfy85.artstation.com/projects/kQvw6n)作者明寫為神魔工作；[design集](https://chrisnfy85.artstation.com/projects/VJngvR)。
- [沃瓦道（火魔）](https://chrisnfy85.artstation.com/projects/NxZE3b)明列Final、Flat colors、Lines，描述初稿方向與Daniel Fong協助。這是珍貴**過程展示**，不是PSD下載。
- [compilation 3](https://chrisnfy85.artstation.com/projects/B1vyJD)列Cthulhu版本Neptune、水下近戰重機械、新年造型；[Compilation2](https://chrisnfy85.artstation.com/projects/8emG5q)、[Compilation](https://chrisnfy85.artstation.com/projects/48abdL)、[慈禧討債小隊](https://chrisnfy85.artstation.com/projects/5XearA)。
- [DeviantArt替代作品集](https://www.deviantart.com/chrisnfy85/gallery)正常200，但目前公開索引主要是DeNA及其他早期遊戲圖；未確認神魔作品，故未擅自納入。

### Gus Mukin：早期美術總監

[Works Of Tower Of Saviors](https://gusmukin.artstation.com/projects/RYvZBX)；[本人履歷](https://gusmukin.artstation.com/resume)明列2012/9–2014/6 Madhead Art Director與2013神魔作品。作品頁可確認，圖檔403。

### Mark Ho：重要背景原作者

[作品總覽](https://minimark.artstation.com/projects)有神魔分類。[第八封第2場景](https://minimark.artstation.com/projects/8lVl5x)正文明寫Tower of Saviors stage scene design。

- [要塞Boss](https://minimark.artstation.com/projects/w8b95Z)、[要塞場景](https://minimark.artstation.com/projects/1nVZaq)、[北歐](https://minimark.artstation.com/projects/oOoOQw)。
- [第九封第1場景](https://minimark.artstation.com/projects/gJLYNG)、[第2場景](https://minimark.artstation.com/projects/4bxWQ4)、[最終場景](https://minimark.artstation.com/projects/DxyaG0)。
- [青木原第1場景](https://minimark.artstation.com/projects/baW0Ea)、[第2場景](https://minimark.artstation.com/projects/k43wqd)。
- 正常公開`/users/minimark/projects.json`及`/projects/8lVl5x.json`均403。這些是實際作品總覽中的連結，尚未取得原圖直連，保留為待人工存圖來源。

### Ku Chung：UI、道具、Map、公會任務與角色

[本人作品集](https://ku103.artstation.com/)與[履歷](https://ku103.artstation.com/resume)明列2014/11–2017/1 Madhead，負責角色、Map、UI、Guild Cabinet。

- [瓦倫西亞](https://ku103.artstation.com/projects/8weNeR)、[神魔×怪物彈珠關卡](https://ku103.artstation.com/projects/rDEN6)正文可讀；後者列Fire/Wood Level1/2並附[遊戲影片](https://www.youtube.com/watch?v=RoV8vf1EQN0)。
- [Map](https://ku103.artstation.com/projects/nNQaK)、[COK Guild Mission](https://ku103.artstation.com/projects/Lx32R)、[2016復活節](https://ku103.artstation.com/projects/Dlx00)、[2015萬聖節](https://ku103.artstation.com/projects/OXqNy)、[軒轅劍與仙劍](https://ku103.artstation.com/projects/3ZdKJ)。

### Dormouse眠

[本人網站](https://dormousee.mystrikingly.com/)自述2014/10–2015/12神魔台灣分公司，研發美術、主UI、角色、原畫、SPINE動態。作品混合多款遊戲，未逐張標神魔，不能把Spine分頁所有展示都當成神魔。沒找到可下載骨架專案。

## 特效動畫與社群設計一手案例

- [Paperbox蚩尤案例](https://www.paperboxcreations.com/tower-of-saviors-chiyou-promotional-video)：client Mad Head App Limited；animation/vfx Paperbox；illustration Ren Tu、Wong Hui Yin；audio Out of Tune Music。[Behance對照](https://www.behance.net/gallery/113492915/Tower-of-Saviors-Chiyou-Promotional-Video)、[Vimeo播放](https://vimeo.com/512193438)。
- [白鹿動畫千古一帝秦始皇](https://www.behance.net/gallery/75654473/_)由[公司總覽](https://www.behance.net/whitedeer)確認。公司自述視效、3D場景與動畫服務；作品頁403，未得工程原檔。
- [Vicky Lam作品集](https://www.behance.net/lvickywk)明列[Madhead繪圖](https://www.behance.net/gallery/207748881/Madhead)、[2021神魔盃活動圖](https://www.behance.net/gallery/207495095/2021)、[社群貼文](https://www.behance.net/gallery/207358565/_)、[攻略設計](https://www.behance.net/gallery/207121803/_)；作品頁cache miss，保留作者列表證據。

## 官方UI圖解

2020年英文站有大量舊介面全畫面PNG與影片：適合參考舊設計，**不是拆開的UI sprite，也不是2026最新介面**。

[主地圖](https://en.towerofsaviors.com/2020/01/21/ui-intro-main-map/)、[隊伍](https://en.towerofsaviors.com/2020/01/20/ui-intro-team/)、[社群](https://en.towerofsaviors.com/2020/01/20/ui-intro-community/)、[商城](https://en.towerofsaviors.com/2020/01/20/ui-intro-shop/)、[競技場](https://en.towerofsaviors.com/2020/01/20/ui-intro-arena/)。主地圖原頁HTTP200，內含10張PNG。

## PSD、工程原檔、畫冊與誤命中

1. [巴哈2013卡框PSD組合包](https://forum.gamer.com.tw/G2.php?bsn=23805&lorder=4&parent=954&sn=880)是**玩家卡面模板**，文字／數值可改、包含字體，不是官方角色PSD。原[Google Drive](https://drive.google.com/file/d/0B0SkDWzfosNjdTFRdVk1MnZoS2M/view)實測404。
2. [一起創造召喚獸](https://forum.gamer.com.tw/Co.php?bsn=23805&sn=140210)搜尋索引提舊Dropbox UFO/PSD與去背屬性圖；目前正文讀到別樓，未取得Dropbox直連，不列可下載。
3. [hehagame PSD徵稿](https://tos.hehagame.com/ShowArt146388.html)實際是**百萬亞瑟王**1600×2240徵稿規格，因被收在神魔攻略站誤命中，已排除。
4. [官方TGS2023](https://towerofsaviors.com/tgs2023/)明列前100名早鳥贈「神魔之塔畫冊（第六版）」；[官方2018電玩展](https://towerofsaviors.com/2018/01/17/%E3%80%8A%E7%A5%9E%E9%AD%94%E4%B9%8B%E5%A1%94%E3%80%8B5-%E9%80%B1%E5%B9%B4%E7%94%9F%E6%97%A5%E5%A4%A7%E6%B4%BE%E5%B0%8D%E7%9B%A1%E5%9C%A8-2018-%E5%8F%B0%E5%8C%97%E5%9C%8B%E9%9A%9B%E9%9B%BB%E7%8E%A9/)明列第二版。都是限量**實體畫冊**，沒有查到官方畫冊PDF、PSD原稿包或可商用媒體包。

## 授權界線

官方桌布供公開取得，作者作品頁多標All rights reserved。本次沒有找到允許遊戲重製、公開發布或商用的授權。**可下載與可用於自己的公開遊戲是不同問題**。JPG／動畫截圖不等於官方分層原稿，圖片公開也不代表開源。全部判定以來源明文為準。

完整58筆來源與搜尋詞見`sources.json`。兩批共63筆可讀圖檔，其中2筆僅案例頁標題橫幅；沒有重複計算不同尺寸縮圖。


---

# 第三輪：現代美術管線公開索引查核

2026-10-30查驗結論：**在不登入、不破解或解密、也不執行陌生程式的範圍內，尚未取得可映射至2024–2026角色的完整去背PNG／Spine圖片bundle集合。** 公開工具可以證實這些資源類型存在，但沒有提交可直接沿用的索引。

## 公開原始碼能確認的部分

來源：[Kingsmai/apk-extract](https://git.tootaio.com/Kingsmai/apk-extract)，目前唯一commit `e8e450d6083c11fc0ec1087322a40e57609efc5b`。公開archive為264,201 bytes、92項；本次只在記憶體中讀取文字，沒有執行任何成員。`verify_resources.py:27`明列作者曾使用的APK為2026.512／27375。

- [organize_resources.py](https://git.tootaio.com/Kingsmai/apk-extract/src/commit/e8e450d6083c11fc0ec1087322a40e57609efc5b/scripts/organize_resources.py)將`monstertexture2x`分到高清立繪，`monstericons`分到頭像，`monsters`分到骨架動畫。小怪動畫為`littlemonsters`，其他骨架為`miscspine`。這些分類不能混用。
- 相同檔案第210行說明角色透明度重建依據為MonsterTextureLoader、Sam/Monster材質與UV JSON。劇情人物使用VisualNovelCharacter的embedded alpha布局。因此近代素材未必是可直接下載的透明PNG，可能需要色圖、遮罩與版面資料合成。
- [build_resource_plans.py](https://git.tootaio.com/Kingsmai/apk-extract/src/commit/e8e450d6083c11fc0ec1087322a40e57609efc5b/scripts/build_resource_plans.py)第32–40行從版本配置的patch主機及解碼CSV建立`assetBundleFiles/android/<SHA1>.assetbundle`網址，並核對size／SHA1。**資源名稱和hash映射不在公開Git提交內。**

## 直接實測結果

| 公開端點 | HTTP結果 | 能支持的結論 |
|---|---|---|
| https://cf.tosconfig.com/loginConfigs | 403 AccessDenied | 根端點不能列舉版本配置 |
| https://tos-config.s3.amazonaws.com/loginConfigs | 403 AccessDenied | 備援根端點同樣不能列舉 |
| https://ab.tosconfig.com/assetBundleFiles/android/43B376A89BD0C9E39E408C5A0143436563CEAB6D.assetbundle | 200，9,421 bytes | 真實公開UnityFS資源包，但無現代角色對應 |
| https://ab.tosconfig.com/assetBundleFiles/android/CC54ADA3298065E0C169EE94001273A5C150EB50.assetbundle | 200，914,228 bytes | 真實公開UnityFS資源包，但無現代角色對應 |

兩個bundle網址出自[2020年9月的UABE討論](https://community.thefunpimps.com/threads/uabe-asset-bundle-extractor.1871/page-41)，不是2024–2026資源證據。僅讀取HTTP標頭及前4KB檔頭，確認以UnityFS開頭，沒有執行解包。該帖指出樣本來自Unity2019.3.0f6且版號字串被移除；已具備正當來源映射的包，可由相容Unity資源檢視器讀取，不能據此宣稱已驗證內容。

## 為何未往下取得近期去背圖

公開Git未包含`version_config.json`、`android_patch.csv`、下載plan或Organized成品；`.gitignore`明列不提交這些輸出。版本專用配置需APK內的版本識別資料。更關鍵的是，[decode_remote.py](https://git.tootaio.com/Kingsmai/apk-extract/src/commit/e8e450d6083c11fc0ec1087322a40e57609efc5b/scripts/decode_remote.py)明確將Android patch清單作ChaCha20解密，再交給下載計畫。依本輪「不要破解加密」指示，沒有執行、改寫或復現這一步，也沒有猜測版本路徑或hash。

官方圖片CDN`public.tosconfig.com`與`d1mcde1f7zaaai.cloudfront.net`只在已解碼表格與已列舉HTML中掃描引用；公開工具本身沒有提供可核對的現代全角色PNG清單。搜尋公開索引亦未找到額外可直接沿用的monstertexture2x／android_patch索引。

目前可交付的可靠區分是：2,011張舊式無框n圖片已可取得；官方完整卡面是有背景的合成圖；數字i圖片是有框頭像。近期原生去背或骨架工程仍應標示「未取得」，不可將上述類別互相替代。


---

# 最終素材品質獨立複核

查核日期：2026-10-30。對實際交付目錄唯讀檢查，未改動任何交付素材、清單或建置程式；本檔是唯一新增的稽核報告。這是獨立抽查與程式閱讀，不代替主代理後續全量圖片解碼及ZIP驗證。

## 重大發現及處理界線

1. **islu有一個原庫空占位檔，不能算可用圖片。** `03-community-repositories/islu__TOS/image/monster/630n.png`實際0 bytes，GitHub樹索引也明列size=0、blob SHA為`e69de29bb2d1d6434b8b29ae775ad8c2e48c5391`，可確認不是下載損壞。此目錄應描述為2,010個有效圖片＋1個原庫空占位檔，而非2,011張可用去背圖。已即時回報主代理，主代理已表示會保留空檔、從有效圖數排除並更正導覽。
2. **兩個element.psd的初次驗證失敗不能直接當素材壞檔。** 初次summary列兩份element.psd為解析失敗；獨立逐一讀取檔頭、完整載入影像及後續verify均通過，圖層數為37。主代理已定位為讀取`is_animated`屬性導致PSD圖層解析錯誤，並表示會限制動畫屬性讀取格式、加入完整像素load。最終狀態應以修正後全量重驗結果為準。
3. **原件及完整立繪的稱呼已保守區分。** 數字i.png是金框、屬性旗及裁切頭像，即使有透明圓角仍不能叫完整角色立繪；官方JPG與Wiki Pet是成品卡面；PSD是社群UI／符石／數字等分層工程；畫師動畫展示圖不能叫角色原始稿或特效工程。閱讀目前build_report.py及build_inventory.py，未見重新混稱這些類別的問題。

主代理另回報已發現macOS大小寫不敏感造成Pet596.png與Pet596.PNG不同內容碰撞，會以穩定hash後綴保留大寫版；Pet377兩case同內容不重複記。本稽核未獨立重跑該去重／改名流程，應由主代理最終清單驗證。

## 實體圖片抽查

以下檔案均以Pillow完整`load()`讀取；注明目視者亦已實際觀看圖片。

| 交付檔案／樣本 | 實際格式與尺寸 | 分類結果 |
|---|---|---|
| 官方圖鑑11305「魔領君后 ‧ 巴力與夏娃」 | JPEG RGB，640×427，144,935 bytes | 目視為完整人物與特效的白底成品；沒有透明通道，不是分層原稿 |
| 官方圖鑑11302「邪蔓植根 ‧ 瘴化魔女」 | JPEG RGB，640×427，146,479 bytes | 完整卡面成品，非原生去背PNG |
| Wiki Pet11302.png | PNG RGBA，960×540，947,429 bytes，alpha全255 | 已目視，完整角色與場景合成卡面，沒有透明背景 |
| Wiki Pet11297.png | PNG RGBA，960×540，916,354 bytes，alpha全255 | 高畫質卡面成品，不能憑RGBA稱去背 |
| islu monster/1000n.png | PNG RGBA，512×512，85,657 bytes，alpha 0–255 | 已目視，無框完整角色，含腳部與特效，是真去背成品 |
| islu monster/1n.png | PNG RGBA，256×256，27,965 bytes，alpha 0–255 | 已目視，無框完整莫莉，是較早期的小尺寸去背成品 |
| sprite-box-extracted/767.tga | TGA RGBA，512×512，1,048,594 bytes，alpha 0–240 | 已目視，無框完整持棍角色與特效；為執行時美術圖，不是PSD原稿 |
| sprite-box-extracted/48.tga | TGA RGBA，256×256，262,162 bytes，alpha 0–240 | 已目視，完整怪物去背成品；不是頭像 |

TGA的alpha最大值240是檔案現有資料，並未替它自動改成255或重存交付圖。目視預覽在記憶體合成灰底展示，未寫入交付目錄。

## PSD逐檔抽查

交付中9個PSD均實測可完整載入合成影像，8BPS檔頭與圖層記錄合理；內容雜湊去重為8份，兩個element.psd是同內容副本。並未把9條路徑宣稱9個不同原稿。

| PSD | 尺寸 | 圖層 |
|---|---:|---:|
| Runestones element.psd | 128×128 | 37 |
| website element.psd | 128×128 | 37 |
| website creature.psd | 100×100 | 11 |
| TOS_Spinner elims.psd | 320×128 | 8 |
| TowerOfSaviorsHelper number.psd | 480×72 | 14 |
| TowerOfSaviorsHelper icon.psd | 600×600 | 5 |
| TowerOfSaviorsHelper 抽卡.psd | 800×1200 | 18 |
| TowerOfSaviorsHelper 技能类型.psd | 80×28 | 2 |
| TowerOfSaviorsHelper 血条.psd | 750×1334 | 27 |

其中抽卡及血條合成影像已目視，符合介面素材用途；沒有證據將其稱Mad Head角色繪畫原始工程。

## 數量及來源記錄的程式閱讀

- build_inventory.py對每個檔案記錄SHA256及SHA1，另列內容去重數；README文字明確區分檔案路徑數與不同內容數，沒有將它說成不同角色數。
- 原始summary的`image_files`將解析失敗項也算入，須由主代理修正為有效圖片統計或另列失敗／空檔。已回報，不能引用修正前29,648為全部驗證通過圖片數。
- `.png`實際JPEG/WebP、`.jpg`實際PNG的來源命名差異有單列，README也表示保留原始路徑及實際format；這可接受，但不可宣稱所有副檔名都是格式正確。
- `collect_repos.py`確有以Git blob方式計算並比較來源SHA，不只是記錄檔名；Wiki CDN變體則單列`cdn-served-variant-valid-image`，沒有聲稱與上傳原檔逐位元組一致。
- 原始`im.verify()`不足以支持每張圖片已完整解碼的強宣稱。主代理已表示補上重新open及load；此項仍以主代理修正後全量報告為驗收依據。
- 原始壓縮包及解壓副本都可能保留，清單採內容雜湊去重並說明不同來源路徑保留，因此不應直接把路徑總數當不同美術張數。

## 結論

抽查素材的實體、格式、尺寸和用途可互相對應。需處理的數量問題是原庫630n空檔，以及PSD動畫屬性造成的驗證誤報；兩者都已及時回報並由主代理接手。沒有發現抽查樣本將頭像或動畫展示截圖冒稱完整人物原稿的現行報告問題。最終全量解碼結果、清單數量、大小寫碰撞處理及ZIP完整性仍由主代理確認。


---

# 神魔之塔公開美術來源調查（英語與 GitHub）

查驗時間：2026-10-30。僅研究及查驗公開檔案，未執行任一來源專案。完整逐檔路徑、大小、Git blob SHA、原始下載網址與全樹保存在 `sources-round1.json`。

## 建議優先下載

| 專案 | 主要美術 | 查驗重點 |
|---|---|---|
| [islu/TOS](https://github.com/islu/TOS) | image/monster 2,011 張；image/monster_icon 92 張；187 張UI/背景 | 1000n.png 已目視：512×512無框完整角色，含腳部、武器與特效，透明背景 |
| [kelp404/Tower-of-Saviors](https://github.com/kelp404/Tower-of-Saviors) | 475張100縮圖、32張128縮圖、445張600卡面、25張700卡面 | 600樣本600×337 RGB；700/449.png雖RGBA但alpha全255，不能算去背 |
| [jordengit/TowerOfSaviorsHelper](https://github.com/jordengit/TowerOfSaviorsHelper) | 2,214張monster頭像、157張技能小圖、38張消除特效、23張combo、17張符石、5張數字圖及完整UI | 含5個真分層PSD；.atlas在此是SpriteKit素材資料夾，不等同Spine骨架 |
| [tower-of-saviors/website](https://github.com/tower-of-saviors/website) | 1,830個美術/相關檔，含符石、關卡地圖、敵人頭像、PSD | 與kananats/TOSwebsite tree SHA完全相同，勿重複下載 |
| [pionxzh/Runestones](https://github.com/pionxzh/Runestones) | 325張Icon檔、10張UI、element.psd | element.psd與website版本相同；合併去重 |
| [AdmiJW/TOS_Spinner](https://github.com/AdmiJW/TOS_Spinner) | 符石消除圖、背景、游標、時間條、elims.psd | elims.psd確有8層 |
| [jtsai1120/Tower_of_Savior_Qt](https://github.com/jtsai1120/Tower_of_Savior_Qt) | character/17圖、enemy/7圖、halo_vfx/6圖、UI17圖、符石18圖 | 可補效果與模擬戰鬥素材；整包還有非美術zip，建議依清單抽取 |

## 真正有圖層的 PSD

| 專案與檔案 | 尺寸／層數 |
|---|---|
| [pionxzh/Runestones/src/assets/Icon/element.psd](https://raw.githubusercontent.com/pionxzh/Runestones/master/src/assets/Icon/element.psd) | 128×128／37層 |
| [jordengit/TowerOfSaviorsHelper/Materials/icon.psd](https://raw.githubusercontent.com/jordengit/TowerOfSaviorsHelper/master/Materials/icon.psd) | 600×600／5層 |
| [jordengit/TowerOfSaviorsHelper/Materials/number.psd](https://raw.githubusercontent.com/jordengit/TowerOfSaviorsHelper/master/Materials/number.psd) | 480×72／14層 |
| [jordengit/TowerOfSaviorsHelper/Materials/技能类型.psd](https://raw.githubusercontent.com/jordengit/TowerOfSaviorsHelper/master/Materials/%E6%8A%80%E8%83%BD%E7%B1%BB%E5%9E%8B.psd) | 80×28／2層 |
| [jordengit/TowerOfSaviorsHelper/Materials/抽卡.psd](https://raw.githubusercontent.com/jordengit/TowerOfSaviorsHelper/master/Materials/%E6%8A%BD%E5%8D%A1.psd) | 800×1200／18層 |
| [jordengit/TowerOfSaviorsHelper/Materials/血条.psd](https://raw.githubusercontent.com/jordengit/TowerOfSaviorsHelper/master/Materials/%E8%A1%80%E6%9D%A1.psd) | 750×1334／27層 |
| [tower-of-saviors/website/img/Creature/creature.psd](https://raw.githubusercontent.com/tower-of-saviors/website/master/img/Creature/creature.psd) | 100×100／11層 |
| [tower-of-saviors/website/img/Icon/element.psd](https://raw.githubusercontent.com/tower-of-saviors/website/master/img/Icon/element.psd) | 128×128／37層 |
| [AdmiJW/TOS_Spinner/assets/img/elims.psd](https://raw.githubusercontent.com/AdmiJW/TOS_Spinner/master/assets/img/elims.psd) | ?×?／8層 |

PSD圖層區塊已直接解析；角色繪畫原始稿、官方繪師圖層工程並未找到。現有PSD主要是社群整理的UI、符石、數字、抽卡與血條工程，不能宣稱Mad Head原稿。

## 授權與來源界線

- jordengit專案含MIT LICENSE；chenFlyingkite/MyTosWiki為Apache-2.0；kelp404 README連到MIT，但GitHub license metadata為null。這些描述程式專案授權，尚無Mad Head原美術與合作角色的另行授權證據。
- 其餘主要圖檔專案未找到明確素材授權，不可自動當作商用免費素材。
- 實際圖片、背景、角色、UI屬Mad Head／合作IP權利範圍，下載研究與商業重製應分開處理。官方聲明可參考[Terms of Service](https://towerofsaviors.com/terms-of-service/)。

## 素材工坊 Gitea 查核

[Kingsmai/apk-extract](https://git.tootaio.com/Kingsmai/apk-extract) 只有工具程式與文件，根樹沒有Organized。`.gitignore`明確排除 `/Organized/`、`/remote/`、`/exports/`、APK；README成品張數是作者本機測試宣稱，不是已公開的美術包。其公開程式碼說明高畫質角色在 monstertexture2x、角色骨架在 monsters、小怪動畫 littlemonsters，並使用公開patch清單推導 ab.tosconfig.com/assetBundleFiles/android/<hash>.assetbundle。未執行該程式，也未取得其本機成品。

## 其他探索

- 英語Fandom Wiki API可以列舉20,247張圖片的原始URL、尺寸與SHA1，已交由其他分工進行，避免重複。
- Spriters Resource搜尋未找到可驗證的Tower of Saviors專頁；一般PNG聚合站無完整可核對集合，不列優先。
- Mark Ho ArtStation有Tower of Saviors場景概念作品，可作繪師來源補充，未找到公開PSD下載。

## 英語Wiki全量索引（第二輪）

`sources-english-final.json` 為最終檔；`complete=true`，41頁全量列舉20,247項。檔案內容保留 `name`、`size`、`width`、`height`、`sha1`、`mime`、`url`，並加上 `download_url`（`format=original`）和 `suggested_category`。MediaWiki SHA1是原檔內容雜湊，與Git blob SHA不可直接混比。

- 數字i.png且至少400×400：3,707張，1,601,143,629 bytes。001i與1000i目視為512×512金框、屬性旗、頭臉裁切的大頭像；透明僅在外框。這批已更正為large_card_icon，不能稱完整立繪。
- Pet數字.png至少400×400：3,701張，4,100,793,991 bytes。Pet001抽樣1700×956 RGB完整卡面，來源bytes吻合。
- Pet數字.jpg：63張，54,239,946 bytes。Pet293.jpg出現CDN回應與metadata大小不同，即使format=original仍需記錄雜湊不符，不可聲稱所有JPEG已驗原檔。
- MemB／CHRONON高畫質收藏美術：131張，77,230,663 bytes；CHRONON_1_1是1024×2048，RGBA但alpha全255。
- 全部來源metadata大小8,427,071,697 bytes；1,369筆非一般圖片已標skip_non_image，包含1,366筆YouTube。其餘包含截圖、攻略圖、UI，需按用途挑選，不能把全量條目當全部純美術。

[MediaWiki allimages索引](https://towerofsaviors.fandom.com/api.php?action=query&list=allimages&ailimit=500&aiprop=url%7Csize%7Csha1%7Cmime%7Ctimestamp&format=json)可用continue游標重現。

## 電子圖鑑與可編輯動畫工程補查

[28921085/Tower-of-Saviors-e-book](https://github.com/28921085/Tower-of-Saviors-e-book) 是SwiftUI圖鑑App。CharacterView.swift明列「卡片一覽」，MainLevelView.swift為「主線封印」，內含141張角色頭像、50張關卡圖片、6張UI。角色JPEG抽樣為160×160；未見出版品掃描或整本畫冊內容。

本輪英文/中文搜尋與17個GitHub專案樹中，未找到可直接下載、已確認屬神魔之塔的原始Spine編輯工程、Live2D工程、FairyGUI編輯工程。Gitea公開工具能處理骨架但成品未提交；其執行階段骨架JSON亦不能當原生Spine專案。GitHub中的`.atlas`主要是SpriteKit裝PNG的資料夾。

## 目視更正（重要）

先前僅憑alpha通道將英語Wiki數字i.png稱為「透明角色立繪候選」是錯誤判斷。已目視001i.png和1000i.png：兩者均有金色邊框、屬性旗，角色被裁成頭像，透明像素位於外框之外。最終metadata已全部改列 `large_card_icon`，優先程度應低於真正無框完整人物。

`islu/TOS/image/monster/1000n.png` 則已目視確認為真正透明底、無框完整人物，腳部、武器及特效齊全。`Pet001.png` 為有場景背景的完整卡面。

英文Wiki真正去背人物另找到並逐張目視：`1310n.png`（493×337，持劍戰士與特效）及`Jf-6003n.png`（512×512，綠髮持鐮角色），最終metadata已標 `full_body_transparent_verified`。全量英文索引沒有完整數字n.png系列，也未找到fullbody／portrait命名全集。

islu/TOS/image/monster共2,011張，檔名全是數字n.png，角色ID範圍1至50018（非連號）。另外目視1n為256×256完整莫莉，100n為128×128完整史萊姆；因此該集合可作優先去背角色來源，但尺寸各異，並非全512×512。

額外GitHub搜尋發現aa04047878/TowerOfAdventure為大型Unity同人遊戲，主要圖庫路徑為AssetStore及jewel-s-free100j，尚未確認有獨特神魔之塔美術，因此未列建議收錄。
