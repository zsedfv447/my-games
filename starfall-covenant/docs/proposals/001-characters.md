# 提案 001：43 位角色設定與技能組合

> 提案人：創意顧問｜狀態：**總監已通過**（含第 8、9 節建議）｜依據：`docs/card-matrix.md`、`docs/GDD.md` 2.0、`src/core/types.ts`
>
> 全部角色、名稱、外觀與背景皆為本作原創，不取材任何既有作品的角色、名稱、美術或劇情，也不使用現實神話人物的名字。

## 0. 怎麼讀這份提案

- 每位角色先寫**流派定位**，技能與覺醒都從流派倒推：它讓玩家「怎麼轉珠」？
- 技能用 `types.ts` 現有的效果積木寫成 JSON，總監通過後可直接搬進 `skills.json`／`leader-skills.json`。數字是第一版建議值，最後以 `tools/sim/` 模擬結果為準。
- 冷卻寫成 `最大→最小`。進化角色列出兩個型態的差異，沒寫到的部分沿用前一型態。
- 每張 5★／6★ 的三個星紋覺醒也同樣服務流派（例：長串卡加轉珠時間、背水卡加生命抗毒）。
- 有 3 處使用總監已核准、但尚未加進 `types.ts` 的新積木（見第 9 節），等戰鬥組的 `skills/` PR 合併後再寫進資料檔。

## 1. 種族分配（card-matrix 檢查項）

條件：每個種族 ≥6 位、橫跨 ≥3 屬性。

| 種族 | 人數 | 屬性分布 | 成員（★ = 免抽） |
|---|---|---|---|
| 獸裔 | 6 | 焰 潮 森 輝 蝕 | c109★ c206★ c207★ c306★ c508★ c601★ |
| 龍嗣 | 7 | 焰 潮 森 輝 蝕 | c102 c107★ c204 c308★ c404 c501 c509★ |
| 機構 | 7 | 焰 潮 森 輝 蝕 | c104 c108★ c209★ c302 c407★ c409★ c511★ |
| 靈仙 | 7 | 焰 潮 森 輝 | c111★ c211★ c301 c309★ c311★ c401 c411★ |
| 冥裔 | 7 | 焰 潮 森 輝 蝕 | c201 c307★ c408★ c502 c504 c506★ c602★ |
| 人傑 | 9 | 焰 潮 森 輝 蝕 | c101 c106★ c202 c208★ c304 c402 c406★ c507★ c603★ |
| 合計 | **43** | | |

種族個性（決定種族隊的弱點，對應 GDD 原則 4）：
- **獸裔**：生命高、回復低，怕持久戰與中毒。
- **龍嗣**：攻擊最高、生命低，怕連擊型敵人。
- **機構**：防禦向、技能 CD 短，攻擊偏低，怕高防禦 Boss。
- **靈仙**：回復高、生命低，怕回復封印。
- **冥裔**：技能偏自損與固定傷害，怕高生命 Boss。
- **人傑**：數值平均、可混任何屬性，但上限不如其他種族，怕屬性減傷盾。

## 2. 焰屬性（熔爐、火山、灰燈港的鍛造區）

### c101 燼冕女王・伊格菈｜6★ 焰・人傑｜限定池
- **流派**：單屬爆發 L
- **外觀**：披著熔岩紋披風的高挑女王，頭冠是一圈不斷剝落又重生的餘燼，右手拄著燒紅的權杖。
- **背景**：七曜碎裂前統治「熔爐王朝」的最後一位君主。王朝被星骸吞沒時，她把整座王城熔進自己的冠冕，從此只回應願意把一切燒成同一種顏色的契印師。
- **主動技「萬焰歸冕」CD 14→8**：潮、森、輝珠轉為焰珠，本回合焰屬性攻擊 1.5 倍。
  `[{"type":"convertOrbs","from":["water","wood","light"],"to":"fire"},{"type":"buffAttack","target":{"attribute":"fire"},"multiplier":1.5,"turns":1}]`
- **隊長技「熔冠王令」**：焰屬性攻擊 3.5 倍、生命 1.3 倍。
  `[{"conditions":[{"type":"always"}],"effects":[{"type":"atkMultiplier","target":{"attribute":"fire"},"value":3.5},{"type":"hpMultiplier","target":{"attribute":"fire"},"value":1.3}]}]`
- **星紋覺醒**：焰珠傷害 +10%／轉珠時間 +0.5 秒／抵抗屬性減傷盾 30%（`resistStatus attributeShield`，正面回應單屬的弱點，但不抵銷）。

### c102 → c103 赤鱗狂嗣・薩爾姆 → 焚心龍騎・薩爾姆｜5★→6★ 焰・龍嗣｜常駐池
- **流派**：背水一戰 L ／ 長串貫穿 C
- **外觀**：5★ 是半身覆著裂開赤鱗的青年，鱗縫裡透出岩漿光；6★ 鱗片完全龍化，背後展開燃燒的骨翼，胸口有一顆露在外面的火心。
- **背景**：龍座墜落時被碎片擊中心臟的龍嗣，傷口從未癒合。他越接近死亡，心火就越旺，因此總是第一個衝進墜域。
- **主動技（5★）「裂鱗」CD 10→5**：自身扣除目前生命 50%，本回合全隊攻擊 2 倍。
  `[{"type":"selfDamage","percentCurrentHp":50},{"type":"buffAttack","multiplier":2,"turns":1}]`
- **主動技（6★）「焚心」CD 10→5**：同上，並把潮珠轉為焰珠，讓背水回合也能湊出長串。
  `[{"type":"selfDamage","percentCurrentHp":50},{"type":"convertOrbs","from":"water","to":"fire"},{"type":"buffAttack","multiplier":2,"turns":1}]`
- **隊長技（5★）「瀕火之誓」**：生命 < 30% 時全隊攻擊 4 倍。
  `[{"conditions":[{"type":"hpBelow","percent":30}],"effects":[{"type":"atkMultiplier","value":4}]}]`
- **隊長技（6★）「焚心之誓」**：生命 < 30% 時全隊攻擊 5 倍；一串消除 6 顆以上焰珠時再無視防禦。
  `[{"conditions":[{"type":"hpBelow","percent":30}],"effects":[{"type":"atkMultiplier","value":5}]},{"conditions":[{"type":"orbsInOneMatch","orb":"fire","count":6}],"effects":[{"type":"ignoreDefense"}]}]`
- **星紋覺醒**：生命 +500／抵抗中毒 50%／焰珠傷害 +10%。

### c104 → c105 熔軌工匠・卡朵 → 熔爐巨匠・卡朵｜5★→6★ 焰・機構｜常駐池
- **流派**：長串貫穿 C ／ 單屬爆發 C
- **外觀**：矮小的機械工匠，下半身是履帶，背著一座小型熔爐，手臂是可換的鉗子與熔漿噴嘴。6★ 熔爐變成背後的大型鍋爐，噴嘴可以澆出一整條熔流。
- **背景**：工匠座的維修機。主人在墜落時失蹤，她靠著鋪設熔軌把散落的零件一路串起來，相信只要軌道夠長，總有一天會接回主人身邊。
- **主動技（5★）「熔軌鋪設」CD 12→7**：森、心珠轉為焰珠。
  `[{"type":"convertOrbs","from":["wood","heart"],"to":"fire"}]`
- **主動技（6★）「熔流貫軌」CD 12→7**：森、心珠轉為焰珠並強化全部焰珠。
  `[{"type":"convertOrbs","from":["wood","heart"],"to":"fire"},{"type":"enhanceOrbs","orbs":"fire"}]`
- **星紋覺醒**：轉珠時間 +0.5 秒／轉珠時間 +0.5 秒／焰珠傷害 +10%（長串需要時間拉路線）。

### c106 焰紋見習・蘿希｜4★ 焰・人傑｜常駐池／第 1 章掉落
- **流派**：單屬爆發 L（免抽）
- **外觀**：綁著焰色馬尾的少女，穿著灰燈港鐵匠學徒的皮圍裙，手套上燒出了一枚歪歪的星紋。
- **背景**：灰燈港鐵匠的女兒，和主角同一天覺醒，是主角的第一位契約夥伴。嘴上說要當最強的契印師，其實只是想把熄掉的爐火重新點起來。主線劇情的固定搭檔。
- **主動技「學徒的火花」CD 8→4**：森珠轉為焰珠。
  `[{"type":"convertOrbs","from":"wood","to":"fire"}]`
- **隊長技「點爐」**：焰屬性攻擊 2.5 倍。
  `[{"conditions":[{"type":"always"}],"effects":[{"type":"atkMultiplier","target":{"attribute":"fire"},"value":2.5}]}]`

### c107 岩漿蜥・波吉｜4★ 焰・龍嗣｜常駐池／關卡掉落
- **流派**：長串貫穿 C（免抽）
- **外觀**：狗那麼大的胖蜥蜴，背脊是一排冷卻成黑色的熔岩刺，走過的地方會留下發亮的腳印。
- **背景**：龍嗣裡最小的一支，族人嫌牠不像龍。牠的夢想是吐出一道「從這頭到那頭」的火焰，所以每天練習把火吐得更長。
- **主動技「長長的火」CD 9→5**：蝕珠轉為焰珠，轉珠時間延長 1 秒（1 回合）。
  `[{"type":"convertOrbs","from":"dark","to":"fire"},{"type":"extendMoveTime","seconds":1,"turns":1}]`

### c108 煙囪鐘匠・諾斯｜4★ 焰・機構｜常駐池／關卡掉落
- **流派**：輔助（延遲敵人）／ 時之控場 C
- **外觀**：頭部是一座冒煙小鐘樓的機械老人，拉一下胸口的鍊子，整個戰場就會響起沉悶的鐘聲。
- **背景**：負責灰燈港報時的鐘機。他把敲鐘的時間往後撥一點點，全鎮的人就能多睡一會兒；對敵人也一樣。
- **主動技「慢一拍」CD 9→5**：敵人行動延遲 1 回合，轉珠時間延長 1 秒（1 回合）。
  `[{"type":"delayEnemy","turns":1},{"type":"extendMoveTime","seconds":1,"turns":1}]`
- **通用性**：延遲是所有流派的保險，特別給需要準備回合的強化珠隊和技能循環隊。

### c109 → c110 灰燼傭兵・拉卡 → 燼牙頭目・拉卡｜3★→4★ 焰・獸裔｜關卡掉落
- **流派**：背水一戰 L（免抽）
- **外觀**：一隻耳朵被燒缺的狼人傭兵，披著焦黑斗篷；4★ 換上狼頭骨肩甲，身後跟著一排燃燒的狼影。
- **背景**：墜域邊境最便宜的傭兵，因為他接的都是別人不敢接的工作。他說活得夠久的秘訣就是：每一場都當最後一場打。
- **主動技（3★）「舔傷」CD 8→4**：自身扣除目前生命 30%，本回合全隊攻擊 1.5 倍。
  `[{"type":"selfDamage","percentCurrentHp":30},{"type":"buffAttack","multiplier":1.5,"turns":1}]`
- **主動技（4★）「燼牙」CD 8→4**：同上，並獲得 1 回合瀕死保命。
  `[{"type":"selfDamage","percentCurrentHp":30},{"type":"surviveOnce","turns":1},{"type":"buffAttack","multiplier":1.5,"turns":1}]`
- **隊長技（3★）「亡命」**：生命 < 50% 時全隊攻擊 2 倍。
  `[{"conditions":[{"type":"hpBelow","percent":50}],"effects":[{"type":"atkMultiplier","value":2}]}]`
- **隊長技（4★）「燼牙亡命」**：生命 < 30% 時全隊攻擊 3.5 倍。
  `[{"conditions":[{"type":"hpBelow","percent":30}],"effects":[{"type":"atkMultiplier","value":3.5}]}]`

### c111 → c112 爐心精・小炭 → 爐心精靈・炭華｜3★→4★ 焰・靈仙｜關卡掉落
- **流派**：強化珠增幅 C ／ 單屬爆發 C（免抽）
- **外觀**：拳頭大的火苗精靈，頭頂一撮會變色的火焰；4★ 長成手掌大小的少女，裙襬是一圈一圈的火紋。
- **背景**：住在蘿希家火爐裡的精靈，靠吃火星長大。把她放進珠子裡，珠子就會亮起來。
- **主動技（3★）「添柴」CD 8→5**：強化全部焰珠。
  `[{"type":"enhanceOrbs","orbs":"fire"}]`
- **主動技（4★）「旺火」CD 8→5**：強化全部焰珠，2 回合內焰珠天降機率提升到 35%。
  `[{"type":"enhanceOrbs","orbs":"fire"},{"type":"setSkyfallRate","orb":"fire","rate":0.35,"turns":2}]`

## 3. 潮屬性（港灣、潮汐、深海與時間）

### c201 潮刻守時者・瑟琳｜6★ 潮・冥裔｜限定池
- **流派**：時之控場 L
- **外觀**：半透明的女子，身體由退潮後的海水組成，腰間掛著一只倒著走的貝殼懷錶，裙襬像潮線一樣來回漲落。
- **背景**：冥河座下負責「把時間退回去」的守時者。七曜碎裂那一刻，她把那一秒往回撥了無數次，卻始終阻止不了。如今她讓敵人的時間停在原地，好讓別人有機會做她做不到的事。
- **主動技「退潮之刻」CD 15→9**：敵人行動延遲 2 回合，並對全體敵人施加 3 回合持續傷害（每回合自身攻擊 3 倍）。
  `[{"type":"delayEnemy","turns":2},{"type":"damageOverTime","target":"all","multiplier":3,"turns":3}]`
- **隊長技「停潮」**：敵人攻擊倒數永遠 +1；全隊受到傷害減少 35%；潮屬性攻擊 2.5 倍。
  `[{"conditions":[{"type":"always"}],"effects":[{"type":"enemyCooldownPlus","turns":1},{"type":"damageReduction","percent":35},{"type":"atkMultiplier","target":{"attribute":"water"},"value":2.5}]}]`
- **星紋覺醒**：生命 +600／抵抗封印主動技 50%／回復 +150（磨局要撐得住，也要防技能被封）。

### c202 → c203 浪花舞姬・蜜瑟 → 潮宴舞后・蜜瑟｜5★→6★ 潮・人傑｜常駐池
- **流派**：連擊狂潮 L
- **外觀**：赤足的舞者，裙子是由無數小浪花縫成的，每轉一圈就濺出一串水珠；6★ 頭戴珊瑚冠，身邊跟著一圈發光的水泡。
- **背景**：灰燈港碼頭的街頭舞者。她發現自己跳的每一步都能讓星紋珠跟著節拍落下，於是把舞步編成了契印術。她最討厭的是「只跳一個大動作」的表演。
- **主動技（5★）「碎浪」CD 10→6**：轉珠時間延長 3 秒（1 回合）。
  `[{"type":"extendMoveTime","seconds":3,"turns":1}]`
- **主動技（6★）「浪宴」CD 10→6**：轉珠時間延長 3 秒，且本回合天降不會造成消除（方便精準拆 Combo）。
  `[{"type":"extendMoveTime","seconds":3,"turns":1},{"type":"noSkyfallCombo","turns":1}]`
- **隊長技（5★）「一拍接一拍」**：Combo ≥ 6 時全隊攻擊 2.5 倍，每多 1 Combo +0.5 倍，最高 4 倍。
  `[{"conditions":[{"type":"comboAtLeast","combo":6}],"effects":[{"type":"atkMultiplier","value":2.5,"perStep":0.5,"maxValue":4}]}]`
- **隊長技（6★）「潮宴無終」**：轉珠時間 +1 秒；Combo ≥ 6 時全隊攻擊 3 倍，每多 1 Combo +0.5 倍，最高 5 倍。
  `[{"conditions":[{"type":"always"}],"effects":[{"type":"extendMoveTime","seconds":1}]},{"conditions":[{"type":"comboAtLeast","combo":6}],"effects":[{"type":"atkMultiplier","value":3,"perStep":0.5,"maxValue":5}]}]`
- **星紋覺醒**：轉珠時間 +0.5 秒／抵抗轉珠時間縮短 50%／轉珠時間 +0.5 秒。

### c204 → c205 雙月海龍・瑟恩與露恩 → 潮輝雙曜・瑟恩與露恩｜5★→6★ 潮・龍嗣｜常駐池
- **流派**：雙屬共鳴 L（潮＋輝）
- **外觀**：一青一金兩條纏在一起的細長海龍，總是頭尾相咬繞成一個圓；6★ 圓環中間浮出一輪滿月，兩條龍的鱗色在交界處融成銀白。
- **背景**：龍座裡一對永遠不分開的雙生龍，一條掌管海面的月光，一條掌管海底的暗潮。牠們只有同時出力時才算完整，所以只聽「兩種顏色一起消」的命令。
- **主動技（5★）「月映潮」CD 11→6**：焰珠轉為潮珠，蝕珠轉為輝珠。
  `[{"type":"convertOrbs","from":"fire","to":"water"},{"type":"convertOrbs","from":"dark","to":"light"}]`
- **主動技（6★）「雙曜同輝」CD 11→6**：同上，並強化潮珠與輝珠。
  `[{"type":"convertOrbs","from":"fire","to":"water"},{"type":"convertOrbs","from":"dark","to":"light"},{"type":"enhanceOrbs","orbs":["water","light"]}]`
- **隊長技（5★）「雙月」**：同時消除潮珠與輝珠時全隊攻擊 3.5 倍。
  `[{"conditions":[{"type":"attributesMatched","count":2,"attributes":["water","light"]}],"effects":[{"type":"atkMultiplier","value":3.5}]}]`
- **隊長技（6★）「雙曜」**：同上改為 4 倍；潮、輝屬性生命 1.3 倍。
  `[{"conditions":[{"type":"attributesMatched","count":2,"attributes":["water","light"]}],"effects":[{"type":"atkMultiplier","value":4}]},{"conditions":[{"type":"always"}],"effects":[{"type":"hpMultiplier","target":{"attribute":["water","light"]},"value":1.3}]}]`
- **星紋覺醒**：潮珠傷害 +10%／輝珠傷害 +10%／抵抗珠子鎖定 50%（雙屬的弱點是單色被鎖）。

### c206 信號海豹・提米｜4★ 潮・獸裔｜常駐池／第 1 章掉落
- **流派**：連擊狂潮 L（免抽）
- **外觀**：戴著港務局帽子的圓滾滾海豹，脖子上掛著一面小旗，會用鰭拍出節奏給船打信號。
- **背景**：灰燈港的吉祥物，負責用旗語指揮進港船隻。牠拍旗的速度快到能一口氣傳出十幾個訊號，連契印師都學牠的節奏轉珠。
- **主動技「快打旗語」CD 7→4**：轉珠時間延長 2 秒（1 回合）。
  `[{"type":"extendMoveTime","seconds":2,"turns":1}]`
- **隊長技「打拍子」**：Combo ≥ 5 時全隊攻擊 2 倍，每多 1 Combo +0.25 倍，最高 3 倍。
  `[{"conditions":[{"type":"comboAtLeast","combo":5}],"effects":[{"type":"atkMultiplier","value":2,"perStep":0.25,"maxValue":3}]}]`

### c207 墨潮章魚・歐克｜4★ 潮・獸裔｜常駐池／關卡掉落
- **流派**：雙屬共鳴 C（免抽，服務蝕＋潮）
- **外觀**：一半身體是潮藍、一半是墨紫的章魚，八隻腳各拿著不同顏色的珠子在拋接。
- **背景**：沉船灣的墨商，用自己的墨汁替人染色。藍的變紫、紅的變藍，只要價錢談得攏。
- **主動技「兩色墨」CD 9→5**：焰珠轉為潮珠，森珠轉為蝕珠。
  `[{"type":"convertOrbs","from":"fire","to":"water"},{"type":"convertOrbs","from":"wood","to":"dark"}]`
- **搭配**：與 c506 沉船幽靈・莉薇（蝕＋潮雙屬隊長）組成免抽雙屬隊。

### c208 白沫醫者・珊｜4★ 潮・人傑｜常駐池／關卡掉落
- **流派**：輔助（回血）／ 心之守護 C
- **外觀**：穿著漁家白圍裙的年輕醫者，提著一桶會冒泡的海水，泡沫落在傷口上就會癒合。
- **背景**：灰燈港唯一的醫生，免費替契印師看病，條件是要聽她碎念。
- **主動技「白沫」CD 8→5**：回復生命上限 25%，3 回合內心珠天降機率提升到 30%。
  `[{"type":"heal","mode":"percentMaxHp","value":25},{"type":"setSkyfallRate","orb":"heart","rate":0.3,"turns":3}]`

### c209 → c210 潮汐鐘機・咕嚕 → 大潮鐘機・咕嚕咕｜3★→4★ 潮・機構｜關卡掉落
- **流派**：時之控場 L（免抽）
- **外觀**：一顆背著鐘殼的機械蝸牛，殼上的指針跟著潮汐轉；4★ 殼變成燈塔一樣的大鐘塔，觸角是兩根擺錘。
- **背景**：工匠座用來測量潮汐的儀器。牠走得很慢，但牠在的地方，連時間都會跟著慢下來。
- **主動技「慢慢來」CD 8→5**：敵人行動延遲 1 回合。
  `[{"type":"delayEnemy","turns":1}]`
- **隊長技（3★）「慢潮」**：敵人攻擊倒數永遠 +1。
  `[{"conditions":[{"type":"always"}],"effects":[{"type":"enemyCooldownPlus","turns":1}]}]`
- **隊長技（4★）「大潮」**：敵人攻擊倒數永遠 +1；全隊受到傷害減少 20%；潮屬性攻擊 1.5 倍。
  `[{"conditions":[{"type":"always"}],"effects":[{"type":"enemyCooldownPlus","turns":1},{"type":"damageReduction","percent":20},{"type":"atkMultiplier","target":{"attribute":"water"},"value":1.5}]}]`

### c211 → c212 泡泡水母・啵啵 → 泡沫女王・啵啵菈｜3★→4★ 潮・靈仙｜關卡掉落
- **流派**：連擊狂潮 C（免抽）
- **外觀**：一朵會漂浮的透明水母，傘蓋裡裝滿小泡泡；4★ 傘蓋變成泡泡皇冠，觸手末端各掛一顆不同顏色的小珠。
- **背景**：羽座裡最愛玩的靈仙，喜歡把東西拆成一顆一顆的小泡泡。她不懂「一次解決」有什麼好玩。
- **主動技（3★）「別掉下來」CD 8→5**：本回合天降不造成消除，轉珠時間延長 1 秒。
  `[{"type":"noSkyfallCombo","turns":1},{"type":"extendMoveTime","seconds":1,"turns":1}]`
- **主動技（4★）「泡泡重排」CD 9→5**：重整盤面，本回合天降不造成消除，轉珠時間延長 2 秒。
  `[{"type":"refreshBoard"},{"type":"noSkyfallCombo","turns":1},{"type":"extendMoveTime","seconds":2,"turns":1}]`

## 4. 森屬性（古樹、苔原、藥草與毒藤）

### c301 千年樹母・艾菈蒂｜6★ 森・靈仙｜限定池
- **流派**：心之守護 L
- **外觀**：身體與一棵巨樹相連的女性，長髮是垂落的藤蔓，胸前開著一朵粉色的心形花，花瓣會隨呼吸開合。
- **背景**：羽座之下最古老的靈仙，墜落時把根扎進了大地，從此再也無法離開。她把所有吸進來的星骸毒素轉成養分，也把契印師受的傷轉成反擊的力量。
- **主動技「心花盛放」CD 15→9**：焰、蝕珠轉為心珠，2 回合內把回復力的 2 倍加到攻擊上。
  `[{"type":"convertOrbs","from":["fire","dark"],"to":"heart"},{"type":"rcvToAtk","ratio":2,"turns":2}]`
- **隊長技「根之庇護」**：全隊回復 2 倍、受到傷害減少 40%；消除 3 顆以上心珠時全隊攻擊 3.5 倍。
  `[{"conditions":[{"type":"always"}],"effects":[{"type":"rcvMultiplier","value":2},{"type":"damageReduction","percent":40}]},{"conditions":[{"type":"heartsMatched","count":3}],"effects":[{"type":"atkMultiplier","value":3.5}]}]`
- **星紋覺醒**：心珠回復 +15%／抵抗回復封印 50%／回復 +200。

### c302 → c303 苔晶園丁・葛瑞 → 晶園主・葛瑞｜5★→6★ 森・機構｜常駐池
- **流派**：強化珠增幅 L
- **外觀**：長滿苔蘚的園丁機器人，肩上背著一台會噴出發光孢子的灑水器；6★ 全身被翠綠晶簇覆蓋，走到哪裡地面就長出晶花。
- **背景**：工匠座造來照顧星座花園的園丁。花園碎了，他就在每顆珠子裡種下一點晶苗，等它們一起開花。
- **主動技（5★）「播晶」CD 11→6**：強化全部森珠與心珠。
  `[{"type":"enhanceOrbs","orbs":["wood","heart"]}]`
- **主動技（6★）「滿園晶花」CD 12→7**：強化全部珠子，3 回合內天降強化珠機率提升到 30%。（新積木 `setEnhancedSkyfallRate`）
  `[{"type":"enhanceOrbs","orbs":"all"},{"type":"setEnhancedSkyfallRate","rate":0.3,"turns":3}]`
- **隊長技（5★）「晶花滿開」**：消除 3 顆以上強化珠時全隊攻擊 2.5 倍，每多 1 顆 +0.25 倍，最高 4 倍。
  `[{"conditions":[{"type":"enhancedOrbsMatched","count":3}],"effects":[{"type":"atkMultiplier","value":2.5,"perStep":0.25,"maxValue":4}]}]`
- **隊長技（6★）「晶園盛宴」**：同上最高改為 5 倍；全隊生命 1.2 倍。
  `[{"conditions":[{"type":"enhancedOrbsMatched","count":3}],"effects":[{"type":"atkMultiplier","value":2.5,"perStep":0.25,"maxValue":5}]},{"conditions":[{"type":"always"}],"effects":[{"type":"hpMultiplier","value":1.2}]}]`
- **星紋覺醒**：森珠傷害 +10%／生命 +500（準備回合要撐住）／抵抗珠子鎖定 30%。

### c304 → c305 荊棘藥師・薇妮 → 荊冠藥聖・薇妮｜5★→6★ 森・人傑｜常駐池
- **流派**：固定傷害 C ／ 心之守護 C
- **外觀**：戴著鳥嘴面具的藥師，腰間掛滿試管，背後的藥箱裡伸出帶刺的藤蔓；6★ 面具摘下，頭上長出荊棘花冠。
- **背景**：墜域的瘟疫醫生。她的藥一半救人一半殺人，用量差一滴而已。她說星骸再硬也有血管，只要找得到就能毒倒。
- **主動技（5★）「一滴之差」CD 12→7**：對全體敵人造成 30000 固定傷害（無視防禦與護盾），回復生命上限 15%。
  `[{"type":"damage","target":"all","mode":"fixed","value":30000,"ignoreDefense":true,"ignoreShield":true},{"type":"heal","mode":"percentMaxHp","value":15}]`
- **主動技（6★）「荊冠藥方」CD 12→7**：同上改為 50000，並把蝕珠轉為心珠。
  `[{"type":"damage","target":"all","mode":"fixed","value":50000,"ignoreDefense":true,"ignoreShield":true},{"type":"heal","mode":"percentMaxHp","value":15},{"type":"convertOrbs","from":"dark","to":"heart"}]`
- **星紋覺醒**：心珠回復 +10%／回復 +150／抵抗中毒 50%。

### c306 苔背刺蝟・波可｜4★ 森・獸裔｜常駐池／第 1 章掉落
- **流派**：心之守護 L（免抽）
- **外觀**：背上長的不是刺而是一叢叢苔蘚與小蘑菇的刺蝟，緊張時會縮成一顆綠色的毛球。
- **背景**：苔原上的膽小鬼，誰都打不贏，但誰也打不穿牠。牠會把同伴藏進自己的苔背裡。
- **主動技「縮成一團」CD 8→5**：蝕珠轉為心珠。
  `[{"type":"convertOrbs","from":"dark","to":"heart"}]`
- **隊長技「苔背」**：全隊回復 1.5 倍、受到傷害減少 20%；消除 3 顆以上心珠時全隊攻擊 2.5 倍。
  `[{"conditions":[{"type":"always"}],"effects":[{"type":"rcvMultiplier","value":1.5},{"type":"damageReduction","percent":20}]},{"conditions":[{"type":"heartsMatched","count":3}],"effects":[{"type":"atkMultiplier","value":2.5}]}]`

### c307 毒藤刺客・絲蔓｜4★ 森・冥裔｜常駐池／關卡掉落
- **流派**：固定傷害 L（免抽）
- **外觀**：全身纏著紫綠藤蔓的纖瘦刺客，臉被兜帽遮住，只露出一雙像花苞的眼睛；她的影子是一株會動的毒藤。
- **背景**：被冥河座收留的森之亡魂。她早就感覺不到疼痛，所以也不在乎敵人有多強壯，只計算要多少毒才夠。
- **主動技「定量」CD 9→5**：對單體敵人造成 15000 固定傷害（無視防禦）。
  `[{"type":"damage","target":"single","mode":"fixed","value":15000,"ignoreDefense":true}]`
- **隊長技「藤毒」**：消除 3 顆以上心珠時追加 3000 固定傷害；全隊生命 1.3 倍。
  `[{"conditions":[{"type":"heartsMatched","count":3}],"effects":[{"type":"followUpDamage","mode":"fixed","value":3000}]},{"conditions":[{"type":"always"}],"effects":[{"type":"hpMultiplier","value":1.3}]}]`

### c308 苔甲地龍・歐登｜4★ 森・龍嗣｜常駐池／關卡掉落
- **流派**：輔助（減傷）
- **外觀**：背甲像一塊長滿青苔的巨岩的矮胖地龍，爬得很慢，躲在牠身後就像躲在山後面。
- **背景**：龍嗣裡唯一不會飛的一支。別的龍嗣去戰鬥，牠負責站在原地，讓所有人有地方可以回來。
- **主動技「化為山」CD 9→5**：受到傷害減少 50%（2 回合）。
  `[{"type":"reduceDamage","percent":50,"turns":2}]`
- **通用性**：所有流派都用得上；同時是龍嗣種族隊少數的免抽成員。

### c309 → c310 種子鳥・啾波 → 森歌鳥・啾波琳｜3★→4★ 森・靈仙｜關卡掉落
- **流派**：強化珠增幅 L（免抽）
- **外觀**：圓滾滾的綠色小鳥，尾羽是三片嫩葉；4★ 尾羽變成一整株開花的枝條，唱歌時羽毛會發光。
- **背景**：專門把種子播進星紋珠的小鳥。牠每唱一首歌，就有一顆珠子發芽。
- **主動技「播種歌」CD 8→5**：強化全部森珠。
  `[{"type":"enhanceOrbs","orbs":"wood"}]`
- **隊長技（3★）「發芽」**：消除 3 顆以上強化珠時全隊攻擊 2 倍。
  `[{"conditions":[{"type":"enhancedOrbsMatched","count":3}],"effects":[{"type":"atkMultiplier","value":2}]}]`
- **隊長技（4★）「森歌」**：消除 3 顆以上強化珠時全隊攻擊 2 倍，每多 1 顆 +0.25 倍，最高 3 倍。
  `[{"conditions":[{"type":"enhancedOrbsMatched","count":3}],"effects":[{"type":"atkMultiplier","value":2,"perStep":0.25,"maxValue":3}]}]`

### c311 → c312 羽葉精靈・琪雅 → 羽座領唱・琪雅｜3★→4★ 森・靈仙｜關卡掉落
- **流派**：種族羈絆 L（靈仙，免抽）
- **外觀**：背上長著兩片葉形翅膀的小精靈，拿著一根蘆葦笛；4★ 翅膀變成四片，笛聲能讓其他靈仙的翅膀一起發光。
- **背景**：羽座合唱團的領唱。星座碎了，同伴四散各地，她一路吹著集合的笛聲，聽到的靈仙都會飛回來。
- **主動技（3★）「集合笛」CD 9→6**：靈仙攻擊 1.5 倍（1 回合）。
  `[{"type":"buffAttack","target":{"race":"sylph"},"multiplier":1.5,"turns":1}]`
- **主動技（4★）「合唱」CD 9→6**：靈仙攻擊 1.8 倍（1 回合），回復生命上限 10%。
  `[{"type":"buffAttack","target":{"race":"sylph"},"multiplier":1.8,"turns":1},{"type":"heal","mode":"percentMaxHp","value":10}]`
- **隊長技（3★）「羽之歌」**：靈仙攻擊 2 倍、回復 1.2 倍。
  `[{"conditions":[{"type":"always"}],"effects":[{"type":"atkMultiplier","target":{"race":"sylph"},"value":2},{"type":"rcvMultiplier","target":{"race":"sylph"},"value":1.2}]}]`
- **隊長技（4★）「羽座合唱」**：靈仙攻擊 2.5 倍、生命 1.3 倍、回復 1.3 倍。
  `[{"conditions":[{"type":"always"}],"effects":[{"type":"atkMultiplier","target":{"race":"sylph"},"value":2.5},{"type":"hpMultiplier","target":{"race":"sylph"},"value":1.3},{"type":"rcvMultiplier","target":{"race":"sylph"},"value":1.3}]}]`

## 5. 輝屬性（星光、稜鏡、占星與齒輪）

### c401 虹羽聖詠・菈米耶｜6★ 輝・靈仙｜限定池
- **流派**：七彩齊攻 L
- **外觀**：六片翅膀各是一種顏色的靈仙歌者，翅膀張開時會在身後投出一道完整的虹，雙眼是不同顏色的星。
- **背景**：七曜還完整時，她負責在每晚為七個星座依序唱名。如今星座碎了，她仍每晚唱完整首歌，少了哪個音就停下來等。
- **主動技「虹之唱名」CD 14→8**：盤面重整為各色平均，本回合全隊攻擊 1.5 倍。
  `[{"type":"balanceBoard"},{"type":"buffAttack","multiplier":1.5,"turns":1}]`
- **隊長技「七曜詠歌」**：同時消除 4 種屬性時全隊攻擊 4 倍，消除 5 種時 6 倍；全隊生命 1.2 倍。
  `[{"conditions":[{"type":"attributesMatched","count":4}],"effects":[{"type":"atkMultiplier","value":4,"perStep":2,"maxValue":6}]},{"conditions":[{"type":"always"}],"effects":[{"type":"hpMultiplier","value":1.2}]}]`
- **星紋覺醒**：轉珠時間 +0.5 秒／抵抗珠子鎖定 50%／抵抗暗珠 50%（`resistStatus darkOrbs`）。

### c402 → c403 星盤占卜師・歐倫 → 天機觀星者・歐倫｜5★→6★ 輝・人傑｜常駐池
- **流派**：技能循環 L
- **外觀**：駝背的老占星師，背著一個巨大的黃銅星盤，星盤的圈環會自己轉動；6★ 星盤浮到他頭頂，像光環一樣緩緩旋轉。
- **背景**：灰燈港天文台的台長，是第一個算出「七曜還會再碎一次」的人。沒人相信他，所以他只好讓每一個契印師都比預定更早準備好。
- **主動技（5★）「提前預言」CD 10→6**：全部隊友技能冷卻減少 2 回合。
  `[{"type":"reduceAllyCooldown","turns":2}]`
- **主動技（6★）「天機連轉」CD 10→6**：全部隊友技能冷卻減少 2 回合；3 回合內每施放 1 次主動技追加自身攻擊 5 倍傷害。
  `[{"type":"reduceAllyCooldown","turns":2},{"type":"chainOnSkill","multiplier":5,"turns":3}]`
- **隊長技（5★）「星盤就位」**：開場全員技能冷卻已滿；本回合施放過主動技時全隊攻擊 3 倍。
  `[{"conditions":[{"type":"always"}],"effects":[{"type":"skillCooldownStart","charged":true}]},{"conditions":[{"type":"skillUsedThisTurn"}],"effects":[{"type":"atkMultiplier","value":3}]}]`
- **隊長技（6★）「天機」**：同上倍率改為 3.5 倍，並且每回合全員技能冷卻額外 −1。（新積木 `allyCooldownPerTurn`）
  `[{"conditions":[{"type":"always"}],"effects":[{"type":"skillCooldownStart","charged":true},{"type":"allyCooldownPerTurn","turns":1}]},{"conditions":[{"type":"skillUsedThisTurn"}],"effects":[{"type":"atkMultiplier","value":3.5}]}]`
- **星紋覺醒**：抵抗封印主動技 50%／抵抗封印主動技 50%（合計 100%，等於這隊的唯一保險）／回復 +150。

### c404 → c405 金曜聖龍・艾斯特拉 → 曜冠龍皇・艾斯特拉｜5★→6★ 輝・龍嗣｜常駐池
- **流派**：種族羈絆 L（龍嗣）
- **外觀**：鱗片像金箔一樣層層疊起的巨龍，頭頂長著一圈星芒狀的角；6★ 角連成一頂光之王冠，展翼時翼膜上映出整片星空。
- **背景**：龍座的守星者，在碎裂時用身體擋住了最大的一塊碎片，因此失去了半數的記憶。她記得每一位同族的名字，只要同族聚在她身邊，她就能想起更多。
- **主動技（5★）「龍族集結」CD 11→6**：龍嗣攻擊 1.8 倍（2 回合）。
  `[{"type":"buffAttack","target":{"race":"dragon"},"multiplier":1.8,"turns":2}]`
- **主動技（6★）「曜冠龍嘯」CD 11→6**：龍嗣攻擊 2 倍（2 回合），並對全體敵人造成自身攻擊 10 倍的輝屬性傷害。
  `[{"type":"buffAttack","target":{"race":"dragon"},"multiplier":2,"turns":2},{"type":"damage","target":"all","mode":"multiplier","value":10,"attribute":"light"}]`
- **隊長技（5★）「龍之血契」**：龍嗣攻擊 3 倍、生命 1.3 倍。
  `[{"conditions":[{"type":"always"}],"effects":[{"type":"atkMultiplier","target":{"race":"dragon"},"value":3},{"type":"hpMultiplier","target":{"race":"dragon"},"value":1.3}]}]`
- **隊長技（6★）「曜冠血契」**：龍嗣攻擊 3.5 倍、生命 1.5 倍、回復 1.2 倍；隊伍全是龍嗣時受到傷害減少 20%。
  `[{"conditions":[{"type":"always"}],"effects":[{"type":"atkMultiplier","target":{"race":"dragon"},"value":3.5},{"type":"hpMultiplier","target":{"race":"dragon"},"value":1.5},{"type":"rcvMultiplier","target":{"race":"dragon"},"value":1.2}]},{"conditions":[{"type":"teamAll","filter":{"race":"dragon"}}],"effects":[{"type":"damageReduction","percent":20}]}]`
- **星紋覺醒**：生命 +800（補龍嗣生命低的短板）／輝珠傷害 +10%／抵抗連擊 30%（`resistStatus multiHit`）。

### c406 稜鏡少女・普莉茲｜4★ 輝・人傑｜常駐池／第 2 章掉落
- **流派**：七彩齊攻 L（免抽）
- **外觀**：戴著三稜鏡眼鏡的書呆子少女，抱著一本封面會折射彩光的筆記本，裙子上有彩虹色的滾邊。
- **背景**：歐倫的學徒，研究為什麼星光穿過稜鏡會分成七色。她相信只要把七種光重新疊起來，就能拼回碎掉的星座。
- **主動技「折射」CD 9→5**：盤面重整為各色平均。
  `[{"type":"balanceBoard"}]`
- **隊長技「分光」**：同時消除 4 種屬性時全隊攻擊 3 倍，消除 5 種時 4 倍。
  `[{"conditions":[{"type":"attributesMatched","count":4}],"effects":[{"type":"atkMultiplier","value":3,"perStep":1,"maxValue":4}]}]`

### c407 黃銅守衛・M-7「麥塔」｜4★ 輝・機構｜常駐池／關卡掉落
- **流派**：種族羈絆 L（機構，免抽）
- **外觀**：方正的黃銅色守衛機，胸口刻著「M-7」，一隻眼睛是會發光的星紋鏡頭，肩上插著一面破舊的工匠座旗幟。
- **背景**：工匠座的第七號守衛，是唯一還能運作的指揮型號。它會把散落各地的機構重新編號，編進同一支隊伍裡。
- **主動技「重新編隊」CD 9→6**：機構攻擊 1.5 倍（1 回合），受到傷害減少 30%（1 回合）。
  `[{"type":"buffAttack","target":{"race":"machina"},"multiplier":1.5,"turns":1},{"type":"reduceDamage","percent":30,"turns":1}]`
- **隊長技「編號點名」**：機構攻擊 2.5 倍、生命 1.3 倍。
  `[{"conditions":[{"type":"always"}],"effects":[{"type":"atkMultiplier","target":{"race":"machina"},"value":2.5},{"type":"hpMultiplier","target":{"race":"machina"},"value":1.3}]}]`

### c408 燭光修士・亞柏｜4★ 輝・冥裔｜常駐池／關卡掉落
- **流派**：輔助（解除異常）／ 七彩齊攻 C
- **外觀**：提著一盞白燭燈的骷髏修士，袍子乾淨得發亮，燭火照到的地方，鎖鏈與黑霧都會消散。
- **背景**：冥河座的引路人，專門替迷路的亡魂點燈。他死了很久，卻是全隊最溫柔的一位。
- **主動技「點燭」CD 8→5**：解除隊伍身上的異常狀態（含珠子鎖定、暗珠），回復生命上限 10%。
  `[{"type":"cleanse"},{"type":"heal","mode":"percentMaxHp","value":10}]`
- **通用性**：解除珠子鎖定正好補七彩隊與雙屬隊的弱點，所以建議同時標上 `rainbow` 輔助（見第 8 節）。

### c409 → c410 齒輪書記・帕奇 → 機要書記・帕奇｜3★→4★ 輝・機構｜關卡掉落
- **流派**：技能循環 L（免抽）
- **外觀**：一隻腳是發條、一隻腳是筆尖的小機器人，頭頂的齒輪會隨著它寫字的速度轉；4★ 背後多了一座會自動翻頁的機械書架。
- **背景**：天文台的記錄機，替歐倫抄寫所有預言。它記得每個技能上次用了多久，總會在剛好的時候提醒大家。
- **主動技（3★）「提醒」CD 9→6**：全部隊友技能冷卻減少 1 回合。
  `[{"type":"reduceAllyCooldown","turns":1}]`
- **主動技（4★）「備忘錄」CD 8→5**：同上。
  `[{"type":"reduceAllyCooldown","turns":1}]`
- **隊長技（3★）「預先準備」**：開場全員技能冷卻已滿。
  `[{"conditions":[{"type":"always"}],"effects":[{"type":"skillCooldownStart","charged":true}]}]`
- **隊長技（4★）「機要」**：開場全員技能冷卻已滿；本回合施放過主動技時全隊攻擊 2.5 倍。
  `[{"conditions":[{"type":"always"}],"effects":[{"type":"skillCooldownStart","charged":true}]},{"conditions":[{"type":"skillUsedThisTurn"}],"effects":[{"type":"atkMultiplier","value":2.5}]}]`

### c411 → c412 光蝶・芙洛 → 虹翅光蝶・芙洛菈｜3★→4★ 輝・靈仙｜關卡掉落
- **流派**：七彩齊攻 C（免抽）
- **外觀**：翅膀像薄玻璃一樣透光的小蝴蝶，飛過的軌跡會留下彩色光粉；4★ 翅膀上浮現五色斑紋，對應五種星紋。
- **背景**：菈米耶歌聲裡誕生的小靈仙，哪裡少了顏色，牠就飛過去把光粉灑上。
- **主動技（3★）「灑粉」CD 9→6**：重整盤面，轉珠時間延長 1 秒。
  `[{"type":"refreshBoard"},{"type":"extendMoveTime","seconds":1,"turns":1}]`
- **主動技（4★）「補色」CD 9→6**：盤面上缺少的屬性各補 3 顆，轉珠時間延長 1 秒。（新積木 `fillMissingOrbs`）
  `[{"type":"fillMissingOrbs","count":3},{"type":"extendMoveTime","seconds":1,"turns":1}]`

## 6. 蝕屬性（深淵、冥河、影與血契）

### c501 深淵吞星者・莫爾德｜6★ 蝕・龍嗣｜限定池
- **流派**：長串貫穿 L
- **外觀**：沒有眼睛、只有一張巨口的漆黑長龍，身體是一條流動的暗紫星河，吞下的星光在腹中排成一長串。
- **背景**：傳說他就是擊碎七曜的元凶之一，但他自己不記得。他唯一的本能是「一口吞下一整串」，因此成為最可怕也最可靠的契約者。（第 5 章揭露的伏筆角色，總監可決定是否採用此設定）
- **主動技「一口吞盡」CD 14→8**：潮珠與心珠轉為蝕珠，並強化全部蝕珠。
  `[{"type":"convertOrbs","from":["water","heart"],"to":"dark"},{"type":"enhanceOrbs","orbs":"dark"}]`
- **隊長技「吞星」**：一串消除 6 顆以上珠時全隊攻擊 3.5 倍，每多 1 顆 +0.5 倍，最高 5 倍，並無視防禦。
  `[{"conditions":[{"type":"orbsInOneMatch","count":6}],"effects":[{"type":"atkMultiplier","value":3.5,"perStep":0.5,"maxValue":5},{"type":"ignoreDefense"}]}]`
- **星紋覺醒**：轉珠時間 +0.5 秒／蝕珠傷害 +10%／抵抗 Combo 盾 30%（`resistStatus comboShield`）。

### c502 → c503 冥燈渡者・伊薩 → 冥河燈主・伊薩｜5★→6★ 蝕・冥裔｜常駐池
- **流派**：固定傷害 L
- **外觀**：站在一艘窄長黑舟上的高瘦身影，臉藏在兜帽的黑暗裡，手中的長篙頂端掛著一盞青色冥燈；6★ 舟身兩側亮起一排排冥燈，每盞燈裡都有一個小小的人影。
- **背景**：冥河座的擺渡人，只收「一盞燈」作為船資。他不在乎客人生前多強大，每個人都只換得到一盞燈的重量，對敵人也是一樣。
- **主動技（5★）「渡資」CD 12→7**：對全體敵人造成 40000 固定傷害（無視護盾）。
  `[{"type":"damage","target":"all","mode":"fixed","value":40000,"ignoreShield":true}]`
- **主動技（6★）「百燈渡河」CD 12→7**：對全體敵人造成 60000 固定傷害（無視防禦與護盾），心珠天降機率提升到 30%（2 回合）。
  `[{"type":"damage","target":"all","mode":"fixed","value":60000,"ignoreDefense":true,"ignoreShield":true},{"type":"setSkyfallRate","orb":"heart","rate":0.3,"turns":2}]`
- **隊長技（5★）「一盞燈」**：消除 3 顆以上心珠時追加 8000 固定傷害；全隊生命 1.5 倍。
  `[{"conditions":[{"type":"heartsMatched","count":3}],"effects":[{"type":"followUpDamage","mode":"fixed","value":8000}]},{"conditions":[{"type":"always"}],"effects":[{"type":"hpMultiplier","value":1.5}]}]`
- **隊長技（6★）「百燈」**：同上改為 15000，生命 1.8 倍。
  `[{"conditions":[{"type":"heartsMatched","count":3}],"effects":[{"type":"followUpDamage","mode":"fixed","value":15000}]},{"conditions":[{"type":"always"}],"effects":[{"type":"hpMultiplier","value":1.8}]}]`
- **星紋覺醒**：心珠回復 +10%／抵抗回復封印 50%／生命 +600。

### c504 → c505 影織傀儡師・諾瓦 → 千影傀儡師・諾瓦｜5★→6★ 蝕・冥裔｜常駐池
- **流派**：連擊狂潮 C ／ 技能循環 C
- **外觀**：十指牽著影子絲線的少年，腳邊有幾個巴掌大的影子人偶在跳舞；6★ 身後浮出一座影子劇場，幕布上的人偶各自操縱一顆珠子。
- **背景**：冥河邊的流浪藝人，他的觀眾全是影子。他能讓影子替人轉珠，一場戲演完，台下的契印師才發現自己什麼都沒動。
- **主動技（5★）「影絲」CD 10→6**：轉珠時間延長 2 秒，本回合天降不造成消除，其他隊友技能冷卻減少 1 回合。
  `[{"type":"extendMoveTime","seconds":2,"turns":1},{"type":"noSkyfallCombo","turns":1},{"type":"reduceAllyCooldown","turns":1}]`
- **主動技（6★）「千影劇場」CD 10→6**：轉珠時間延長 3 秒，本回合天降不造成消除，其他隊友技能冷卻減少 1 回合，2 回合內每施放 1 次主動技追加自身攻擊 3 倍傷害。
  `[{"type":"extendMoveTime","seconds":3,"turns":1},{"type":"noSkyfallCombo","turns":1},{"type":"reduceAllyCooldown","turns":1},{"type":"chainOnSkill","multiplier":3,"turns":2}]`
- **星紋覺醒**：轉珠時間 +0.5 秒／抵抗轉珠時間縮短 50%／抵抗封印主動技 30%。

### c506 沉船幽靈・莉薇｜4★ 蝕・冥裔｜常駐池／第 2 章掉落
- **流派**：雙屬共鳴 L（蝕＋潮，免抽）
- **外觀**：半身浸在水裡的少女幽靈，穿著褪色的船長外套，裙襬與海水分不清界線，一手提著滴水的提燈。
- **背景**：沉船灣那艘幽靈船的船長，一直在等永遠不會回來的船員。她的船一半在海上、一半在冥河，所以只有潮與蝕一起出現時，船才能靠岸。
- **主動技「沉錨」CD 9→5**：輝珠轉為蝕珠。
  `[{"type":"convertOrbs","from":"light","to":"dark"}]`
- **隊長技「兩界之船」**：同時消除蝕珠與潮珠時全隊攻擊 3 倍。
  `[{"conditions":[{"type":"attributesMatched","count":2,"attributes":["dark","water"]}],"effects":[{"type":"atkMultiplier","value":3}]}]`

### c507 血契狂戰士・格雷｜4★ 蝕・人傑｜常駐池／關卡掉落
- **流派**：背水一戰 C（免抽）
- **外觀**：滿身舊傷疤的光頭戰士，扛著一把比他還高的血紋巨劍，劍柄上纏著用自己的血簽下的契約書。
- **背景**：曾經是英雄座的護衛隊長，用血與星骸簽下「只要還有一口氣就不倒下」的契約。代價是他永遠只剩一口氣。
- **主動技「血契」CD 9→5**：自身扣除目前生命 40%，獲得 2 回合瀕死保命。
  `[{"type":"selfDamage","percentCurrentHp":40},{"type":"surviveOnce","turns":2}]`
- **搭配**：與 c109 拉卡組成免抽背水隊：拉卡負責「把血量壓下去」，格雷負責「壓下去之後不會死」。

### c508 夜梟哨兵・烏爾｜4★ 蝕・獸裔｜常駐池／關卡掉落
- **流派**：輔助（延遲敵人）／ 時之控場 C
- **外觀**：披著夜色斗篷的貓頭鷹獸人，眼睛是兩輪紫色的新月，翅膀一張就把敵人罩進黑暗。
- **背景**：墜域邊界的守夜人，負責在黑暗裡盯住敵人。被他盯上的東西會不自覺地停下來，以為天還沒亮。
- **主動技「長夜」CD 10→6**：敵人行動延遲 2 回合。
  `[{"type":"delayEnemy","turns":2}]`
- **與 c108 的差異**：諾斯延遲短、加轉珠時間，偏輔助進攻；烏爾延遲長、CD 長，偏純控場。

### c509 → c510 蝕晶幼龍・蓋布 → 蝕晶龍・蓋布瑞｜3★→4★ 蝕・龍嗣｜關卡掉落
- **流派**：長串貫穿 L（免抽）
- **外觀**：身上長著紫水晶尖刺的幼龍，打噴嚏會噴出一串晶石；4★ 尖刺連成一整排晶脊，尾巴像一條結晶鏈。
- **背景**：在星骸礦坑裡孵化的龍嗣，從小吃晶石長大。牠吐出的晶石總是排成一直線，因為牠只會往前噴。
- **主動技（3★）「晶石噴嚏」CD 8→5**：心珠轉為蝕珠。
  `[{"type":"convertOrbs","from":"heart","to":"dark"}]`
- **主動技（4★）「晶脊」CD 9→5**：心珠與森珠轉為蝕珠。
  `[{"type":"convertOrbs","from":["heart","wood"],"to":"dark"}]`
- **隊長技（3★）「一直線」**：一串消除 6 顆以上珠時全隊攻擊 2.5 倍。
  `[{"conditions":[{"type":"orbsInOneMatch","count":6}],"effects":[{"type":"atkMultiplier","value":2.5}]}]`
- **隊長技（4★）「晶脊貫穿」**：一串消除 6 顆以上珠時全隊攻擊 3 倍並無視防禦。
  `[{"conditions":[{"type":"orbsInOneMatch","count":6}],"effects":[{"type":"atkMultiplier","value":3},{"type":"ignoreDefense"}]}]`

### c511 → c512 發條蝙蝠・奇克 → 鐘塔蝙蝠・奇克斯｜3★→4★ 蝕・機構｜關卡掉落
- **流派**：技能循環 C（免抽）
- **外觀**：翅膀是兩片鐵皮、背後插著一把發條鑰匙的蝙蝠；4★ 鑰匙變成一座小鐘，牠每轉一圈，隊友的技能就跟著轉快一格。
- **背景**：住在天文台鐘塔裡的機械蝙蝠，帕奇的搭檔。牠白天睡覺，晚上幫所有人上發條。
- **主動技（3★）「上發條」CD 8→5**：全部隊友技能冷卻減少 1 回合。
  `[{"type":"reduceAllyCooldown","turns":1}]`
- **主動技（4★）「鐘響連轉」CD 8→5**：全部隊友技能冷卻減少 1 回合；2 回合內每施放 1 次主動技追加自身攻擊 3 倍傷害。
  `[{"type":"reduceAllyCooldown","turns":1},{"type":"chainOnSkill","multiplier":3,"turns":2}]`

## 7. 活動／挑戰之塔限定（種族隊長）

### c601 金鬃獅王・格魯｜4★ 輝・獸裔｜活動兌換
- **流派**：種族羈絆 L（獸裔，免抽）
- **外觀**：鬃毛像陽光一樣散開的老獅子，左眼戴著眼罩，脖子上掛著獸座所有部族的牙飾。
- **背景**：獸座崩落後四散的部族中，唯一還能把所有人叫回來的老王。首發活動「獸王的召集令」的主角。
- **主動技「王之吼」CD 10→6**：獸裔攻擊 1.5 倍（2 回合）。
  `[{"type":"buffAttack","target":{"race":"beast"},"multiplier":1.5,"turns":2}]`
- **隊長技「群聚」**：獸裔攻擊 2.5 倍、生命 1.5 倍。
  `[{"conditions":[{"type":"always"}],"effects":[{"type":"atkMultiplier","target":{"race":"beast"},"value":2.5},{"type":"hpMultiplier","target":{"race":"beast"},"value":1.5}]}]`

### c602 冥火司書・薇絲珀｜4★ 焰・冥裔｜挑戰之塔第 10 層
- **流派**：種族羈絆 L（冥裔，免抽）
- **外觀**：抱著一本燃燒青色火焰的厚書的女性亡靈，眼鏡後面是兩點火光，書頁每翻一頁就飄出一個亡者的名字。
- **背景**：冥河座的圖書館員，把所有渡河者的名字抄進書裡。挑戰之塔的每一層，都是她書中的一章。
- **主動技「翻頁」CD 10→6**：冥裔攻擊 1.5 倍（1 回合），對全體敵人造成 10000 固定傷害。
  `[{"type":"buffAttack","target":{"race":"nether"},"multiplier":1.5,"turns":1},{"type":"damage","target":"all","mode":"fixed","value":10000}]`
- **隊長技「亡者名錄」**：冥裔攻擊 2.5 倍、生命 1.3 倍。
  `[{"conditions":[{"type":"always"}],"effects":[{"type":"atkMultiplier","target":{"race":"nether"},"value":2.5},{"type":"hpMultiplier","target":{"race":"nether"},"value":1.3}]}]`

### c603 無名見證者・雷恩｜4★ 森・人傑｜挑戰之塔第 30 層
- **流派**：種族羈絆 L（人傑，免抽）
- **外觀**：穿著樸素旅行斗篷的中年男子，背著一面沒有圖案的盾，盾面會映出站在他身旁每個同伴的臉。
- **背景**：英雄座的星靈之一，卻不記得自己做過什麼偉大的事。他相信英雄不是一個人，而是一群願意站在一起的普通人。塔頂的獎勵，也是主角未來的導師。
- **主動技「並肩」CD 10→6**：人傑攻擊 1.5 倍（1 回合），受到傷害減少 30%（1 回合）。
  `[{"type":"buffAttack","target":{"race":"human"},"multiplier":1.5,"turns":1},{"type":"reduceDamage","percent":30,"turns":1}]`
- **隊長技「眾人之盾」**：人傑攻擊 2.5 倍、生命 1.3 倍、回復 1.3 倍。
  `[{"conditions":[{"type":"always"}],"effects":[{"type":"atkMultiplier","target":{"race":"human"},"value":2.5},{"type":"hpMultiplier","target":{"race":"human"},"value":1.3},{"type":"rcvMultiplier","target":{"race":"human"},"value":1.3}]}]`

## 8. 流派自查：每個流派的成員與免抽入門隊

| 流派 | 隊長（抽／免抽） | 核心 | 輔助 | 免抽入門隊（隊長在前） |
|---|---|---|---|---|
| 單屬爆發 | c101／c106 | c104 c111 | c108 | c106 + c107 c111 c109 c108 |
| 七彩齊攻 | c401／c406 | c411 | c408 | c406 + c411 c107 c206 c306（缺蝕可由助戰補） |
| 連擊狂潮 | c202／c206 | c211 c504 | c108 | c206 + c211 c209 c208 c207 |
| 長串貫穿 | c501／c509 | c102 c104 c107 | — | c509 + c107 c506 c511 c508 |
| 心之守護 | c301／c306 | c304 c208 | c308 | c306 + c208 c308 c307 c309 |
| 種族羈絆 | c404 龍嗣（抽）／c311 靈仙、c407 機構、c601 獸裔、c602 冥裔、c603 人傑 | 各種族 | — | 靈仙 c311 + c111 c211 c309 c411；機構 c407 + c108 c209 c409 c511；獸裔 c601 + c109 c206 c207 c306；人傑 c603 + c106 c208 c406 c507；冥裔 c602 + c307 c408 c506（4 人） |
| 強化珠增幅 | c302／c309 | c111 | c308 | c309 + c111 c308 c108 c208 |
| 時之控場 | c201／c209 | c108 c508 | c308 | c209 + c508 c108 c308 c208 |
| 背水一戰 | c102／c109 | c507 | c308 | c109 + c507 c107 c111 c208 |
| 雙屬共鳴 | c204／c506 | c207 | c408 | c506 + c207 c508 c209 c211 |
| 技能循環 | c402／c409 | c504 c511 | — | c409 + c511 c108 c508 c408 |
| 固定傷害 | c502／c307 | c304 | c208 | c307 + c208 c306 c308 c408 |

**缺口與處理（總監已全部採納，card-matrix 已更新）**
1. **強化珠增幅的免抽核心只有 c111 一張**，且是焰屬，和森屬隊長不同色。建議把 c309 的主動技也標成 `enhance` 核心（它本身就是強化森珠），或在敵人提案時讓第 3 章掉落一張森屬強化輔助。
2. **龍嗣沒有免抽隊長**（card-matrix 已註明）。我讓龍嗣有 3 張免抽成員（c107、c308、c509），之後若要補，建議把下一個活動的種族隊長給龍嗣。
3. **冥裔免抽成員只有 4 位**（含隊長），第 5 格要靠助戰。可以接受，或之後的活動卡優先給冥裔。
4. **固定傷害與長串貫穿的免抽輔助較少**：建議 c408 燭光修士多掛 `fixed` 輔助（固定傷害隊最怕的是被封回復與異常）。
5. 建議新增流派標籤：c408 → `rainbow` support、`dual` support；c308 → `heart` support、`enhance` support；c208 → `fixed` support。這些是在 card-matrix 原本角色之外的「跨流派」標籤，對應 GDD 原則 5。

## 9. 新積木（總監已核准）

下列三個積木已核准，由戰鬥組在 `skills/` 的 PR 裡加進 `types.ts`。本提案已改用這些寫法，**等那個 PR 合併後再寫進資料檔**。

| 效果 | 用在 | 型別 |
|---|---|---|
| 補缺色（盤面缺哪種屬性就補指定顆數） | c412 | `SkillEffect { type: 'fillMissingOrbs'; count: number }` |
| 天降強化珠機率提升 | c303 | `SkillEffect { type: 'setEnhancedSkyfallRate'; rate: number; turns: number }` |
| 隊長技：每回合全員技能 CD 額外減少 | c403 | `LeaderEffect { type: 'allyCooldownPerTurn'; turns: number }` |

寫入 `cards.json` 時另需加上第 8 節採納的跨流派標籤：c309 `enhance` core；c408 `rainbow`、`dual`、`fixed` support；c308 `heart`、`enhance` support；c208 `fixed` support。

## 10. 素材卡命名（20 張）

| 卡號 | 名稱 | 說明 |
|---|---|---|
| c901–c903 | 焰塵靈・微光／焰塵靈・燭光／焰塵靈・烈光 | 焰屬強化素材 小／中／大 |
| c904–c906 | 潮塵靈・微光／潮塵靈・燭光／潮塵靈・烈光 | 潮屬強化素材 |
| c907–c909 | 森塵靈・微光／森塵靈・燭光／森塵靈・烈光 | 森屬強化素材 |
| c910–c912 | 輝塵靈・微光／輝塵靈・燭光／輝塵靈・烈光 | 輝屬強化素材 |
| c913–c915 | 蝕塵靈・微光／蝕塵靈・燭光／蝕塵靈・烈光 | 蝕屬強化素材 |
| c916–c920 | 焰星核／潮星核／森星核／輝星核／蝕星核 | 各屬進化素材 |

外觀統一：星塵靈是一團帶眼睛的發光星塵，越高階越亮、輪廓越像小星星；星核是一顆內部有星座紋路在轉的水晶球。卡號順序若與總監規劃不同，以總監為準。

## 11. 其他可加進遊戲的創意

總監決定：1、3 納入 v0.1（流派試煉每流派 1 關，共 12 關，與星座章節一起在敵人與劇情提案中規劃）；2、4 列入 v0.2 備忘。

1. **流派試煉**：流派圖鑑裡每個流派有一關「教學試煉」，強制使用該流派的免抽入門隊，通關送該流派缺的一張免抽卡。讓「入門一定拿得到」變成可玩的內容，也是最自然的流派教學。
2. **契約羈絆對話**：特定兩張卡同隊時，戰鬥開場會有一句專屬對話並給小加成（例：c109 拉卡＋c507 格雷「背水搭檔」、c409 帕奇＋c511 奇克「天文台二人組」）。資料上可做成 `bonds.json`，用來鼓勵玩家嘗試劇情裡有關係的組合。
3. **星座章節＝種族**：第 1–5 章各自對應一個星座遺跡，Boss 掉落該種族的免抽卡，讓「種族羈絆」流派的收集路線跟著主線走。
4. **流派克星週**：每日關卡之外，每週輪替一個「本週考驗流派」的特殊關卡（例：Combo 盾週考驗低 Combo 隊），通關給星晶，自然推動玩家練第二套隊伍。

下一份提案我會依這份角色設定做約 40 種敵人（每種敵人技能都對應「考驗哪個流派」），再接 5 章劇情腳本。
