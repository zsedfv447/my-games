// Generates 給AI_星光冒險世界設定.md straight from game data, so the numbers are always exact.
// Run: npx vite-node tools/world-doc.ts
import { writeFileSync } from 'fs';
import { maps } from '../src/data/maps';
import { monsters } from '../src/data/monsters';
import { items, cards, modules, moduleCoefficient, type EquipDef } from '../src/data/items';
import { jobs, skills, baseLevelCap, baseExpNeed, elementNames, JOB2_MAX, JOB2_REQ } from '../src/data/jobs';
import { GEAR_FX } from '../src/data/ascension-items';
import { quests, challengeIds } from '../src/data/quests';
import { pets } from '../src/data/pets';
import { costumes } from '../src/data/costumes';
import { mounts, companions, COMPANION_MODES } from '../src/data/adventure';
import { landmarks } from '../src/data/landmarks';
import { TRIALS, MAP_TIER, SECRET_AREAS } from '../src/data/explore';
import { HABITATS } from '../src/data/habitats';
import { recipes } from '../src/data/crafting';
import { awakenings, MASTERY_TIERS, MASTERY_BONUS } from '../src/data/mastery';
import { LOOP } from '../src/data/elements';
import { TRAIT_STEPS, TRAIT_NAMES } from '../src/rules/refine-traits';
import { WORLD_EVENT } from '../src/world/sim';
import pkg from '../package.json';

const L:string[]=[];const P=(s='')=>L.push(s);
const strip=(h:string)=>h.replace(/<[^>]*>/g,'');
const mapName=(id:string)=>maps[id]?.name??id;
const whereMon=(mid:string)=>Object.values(maps).filter(m=>m.spawns.some(s=>s.monster===mid)).map(m=>m.name).join('、')||'（召喚／事件）';
const gearStats=(d:EquipDef)=>[d.atk?`ATK ${d.atk}`:'',d.matk?`MATK +${d.matk}%`:'',d.def?`DEF ${d.def}`:'',d.mdef?`MDEF ${d.mdef}`:'',d.hp?`HP +${d.hp}`:'',d.sp?`SP +${d.sp}`:'',
  ...Object.entries(d.stats??{}).map(([k,v])=>`${k.toUpperCase()} +${v}`),d.cast?`詠唱 −${d.cast}%`:'',d.delay?`延遲 −${d.delay}%`:'',d.aspd?`攻速 +${d.aspd}%`:'',d.crit?`爆擊 +${d.crit}%`:'',
  d.spCost?`SP消耗 −${d.spCost}%`:'',d.spRegen?`SP回復 +${d.spRegen}%`:'',d.loop?`追加傷害 +${d.loop}%`:'',d.skill?`技能傷害 +${d.skill}%`:'',d.refine7?`+7：${Object.entries(d.refine7).map(([k,v])=>`${k}+${v}`).join(',')}`:''].filter(Boolean).join('、');
const sources=(id:string)=>{const out:string[]=[];for(const m of Object.values(monsters))for(const d of m.drops)if(d.item===id)out.push(`${m.name}${m.mvp?'(MVP)':''} ${(d.rate*100).toFixed(1)}%`);
  for(const r of recipes)if(r.out===id)out.push('工匠打造');return out.join('；')||'商店';};

P(`# 星光冒險 世界設定總覽（v${pkg.version}，由遊戲資料自動產生）`);P();
P('> 給協助設計的 AI：這份文件列出遊戲目前「全部」的世界、地圖、魔物、裝備、技能與系統。所有數值都是從程式資料直接匯出的，請以此為準。文末有本次的設計任務與限制。');P();

P('## 1. 遊戲概要');
P(`- 仙境傳說（RO）風格的單人瀏覽器 ARPG，俯視 3D，Q 版動漫角色（VRM 模型）。滑鼠點擊移動／攻擊，數字鍵 1～9 放技能，Z 自動戰鬥。`);
P(`- 等級上限：Base ${baseLevelCap}；職業：初心者 Job 10 → 一轉（劍士／法師／弓手）Job 70 → **二轉**（星誓騎士／星紋魔導士／蒼穹遊俠）二轉 Job ${JOB2_MAX}。`);
P(`- 二轉條件：Base ${JOB2_REQ.baseLv}＋一轉 Job ${JOB2_REQ.jobLv}；曙光前哨的艾德發布「星路的徵召」→ 誓約試煉場 → 轉職儀式。二轉後職業經驗同時進一轉與二轉兩條軌道。`);
P(`- 經驗：Base Lv.n 升級需求 = (10+6n²)×(1+max(0,n−45)×0.12)。例：Lv.30 ${baseExpNeed(30)}、Lv.45 ${baseExpNeed(45)}、Lv.60 ${baseExpNeed(60)}、Lv.79 ${baseExpNeed(79)}。`);
P('- 素質：STR AGI VIT INT DEX LUK，上限 99。詠唱倍率 = 1 − DEX/150 − 裝備詠唱%（裝備最多算 45%），可達零詠唱。');
P('- 單機、無伺服器；美術只能用免費授權素材或程式生成；音效與音樂為程式合成。使用者非常在意「不能卡」。');P();

P('## 2. 世界地圖（依推進順序）');
P('| 地圖 | 等級 | 外觀 | 一般魔物 | MVP | 連到 |');P('|---|---|---|---|---|---|');
for(const m of Object.values(maps)){const reg=[...new Set(m.spawns.filter(s=>!monsters[s.monster].mvp).map(s=>monsters[s.monster].name))].join('、')||'—';
  const mvp=m.spawns.filter(s=>monsters[s.monster].mvp).map(s=>monsters[s.monster].name).join('、')||'—';
  P(`| ${m.name}（${m.id}） | ${m.levelHint} | ${m.theme}${m.variant?'/'+m.variant:''} | ${reg} | ${mvp} | ${[...new Set(m.warps.map(w=>mapName(w.to)))].join('、')} |`);}
P();P('**隱藏區域**（完成該地標試煉一次後，從地標對話進入）：');
for(const [k,a] of Object.entries(SECRET_AREAS))P(`- ${landmarks[k.split(':')[0]]?.[+k.split(':')[1]]?.name}（${mapName(k.split(':')[0])}）→ ${a.name}：${a.desc}`);
P();P('**城鎮 NPC**：');for(const m of Object.values(maps))if(m.npcs.length)P(`- ${m.name}：${m.npcs.map(n=>`${n.name}（${n.kind}）`).join('、')}`);P();

P('## 3. 魔物一覽');
P('| 魔物 | Lv | HP | 屬性 | 主動 | 出沒 | 掉落 | 卡片→模組 |');P('|---|---|---|---|---|---|---|---|');
for(const m of Object.values(monsters).sort((a,b)=>a.level-b.level)){
  const c=cards[m.card];P(`| ${m.name}${m.mvp?' **MVP**':''} | ${m.level} | ${m.hp.toLocaleString()} | ${elementNames[m.element]} | ${m.aggressive?'是':'否'} | ${whereMon(m.id)} | ${m.drops.map(d=>`${items[d.item]?.name??d.item} ${(d.rate*100).toFixed(1)}%`).join('、')} | ${c?`${c.name}→${modules[c.moduleId]?.name}`:'—'} |`);}
P();P(`- 一般怪 HP 約 1.2×等級²（依體型係數），Lv.50 以上用「有效等級」放緩成長（玩家素質 99 後輸出趨平）；MVP 約 29.6×有效等級²，會預警重擊與召喚小怪，打倒後有重生冷卻。`);
P('- 稀有亞種（exp_ 開頭）每圖各 1 隻，有獨立卡片；地下城／秘境的魔物是同種怪的強化版與【精英】。');P();

P('## 4. 職業與技能（一轉＋二轉）');
for(const j of Object.values(jobs)){const list=Object.values(skills).filter(s=>s.job===j.id);if(!list.length)continue;
  P(`### ${j.name}（Job 上限 ${j.maxJobLv}）`);
  for(const s of list)P(`- **${s.name}**（${s.id}，Lv.${s.maxLv}，${s.target}，${elementNames[s.element]}，tags: ${s.tags.join('/')}${Object.keys(s.prereq).length?`，前置 ${Object.entries(s.prereq).map(([k,v])=>`${skills[k].name}${v}`).join('、')}`:''}）：${strip(s.desc(s.maxLv))}`);
  P();}
P('### 法師三系循環（v4.4 設計核心）');
P(`- 火：火焰矢疊灼燒（每層每秒 ${LOOP.burn.perStackPerSec*100}% MATK，最多 ${LOOP.burn.maxStacks} 層）→ 爆炎球引爆（每層 +${LOOP.detonate.perStack*100}%）並擴散。`);
P(`- 冰：冰霜矢疊寒氣（每層緩速 ${LOOP.chill.slowPerStack*100}%），${LOOP.chill.maxStacks} 層化為寒冰印記 → 冰封術碎冰（+${LOOP.shatter.bonus*100}% 與冰片），MVP 也有效。`);
P(`- 雷：雷鳴矢感電＋充能，每 ${LOOP.charge.need} 次落雷；${LOOP.chain.chance*100}% 連鎖／無目標時回彈；雷暴對感電 +${LOOP.storm.shockedBonus*100}%。`);
P('- 屬性相剋倍率已全部移除（全部 ×1），屬性只作為標籤與「元素增幅」卡的條件。');P();
P('### 熟練度與覺醒');P(`- 施放 ${MASTERY_TIERS.slice(1).join('／')} 次：熟練 I／II／覺醒，加成 ${MASTERY_BONUS.slice(1).map(b=>`傷害×${b.dmg} SP×${b.sp} 詠唱×${b.cast}`).join('；')}。`);
for(const [k,a] of Object.entries(awakenings))P(`- ${skills[k]?.name}・覺醒「${a.name}」：${a.desc}`);P();

P('## 5. 卡片模組（卡片插在穿著的裝備，模組配到技能上才生效；多段技能每段各自判定）');
P('| 模組 | 適用技能標籤 | 效果（Lv.1） | 來源卡片 |');P('|---|---|---|---|');
for(const md of Object.values(modules)){const src=Object.values(cards).filter(c=>c.moduleId===md.id).map(c=>c.name);P(`| ${md.name} | ${md.tags.join('/')} | ${strip(md.desc(moduleCoefficient(src.length?Object.values(cards).find(c=>c.moduleId===md.id)!.id:'',1)))} | ${src.join('、')} |`);}
P();

P('## 6. 裝備');
P(`- 部位：武器、頭、衣服、披風、鞋、飾品；卡槽 0～2。精煉 +1～+7（武器 ATK+3/級、法杖另 MATK+3%/級、防具 DEF+1/級；飾品也可精煉）。`);
P(`- **精煉特性**：每件裝備依其特色自動判定一種特性，+3/+5/+7 逐步強化（${Object.entries(TRAIT_STEPS).map(([k,v])=>`${TRAIT_NAMES[k as keyof typeof TRAIT_NAMES]} ${v.join('/')}`).join('；')}），招牌裝備 +7 另有加成。`);
P('- 建構屬性：詠唱−%（上限 45）、技能延遲−%、攻速+%、爆擊+%、SP 消耗−%（最終下限 50%）、SP 回復+%、追加傷害+%、技能傷害+%。');P();
const eq=Object.values(items).filter((d):d is EquipDef=>d.kind==='equip'&&!d.id.startsWith('exp_')).sort((a,b)=>a.reqLv-b.reqLv);
P('**二轉裝備特效**（流派武器與配裝）：');for(const d of eq)if(d.fx)P(`- ${d.name}：${GEAR_FX[d.fx]}`);P();
P('| 裝備 | 部位 | 職業 | Lv | 能力 | 取得 |');P('|---|---|---|---|---|---|');
for(const d of eq)P(`| ${d.name} | ${d.slot}${d.weaponType?'/'+d.weaponType:''} | ${d.jobs==='all'?'全':d.jobs.map(j=>jobs[j].name).join('、')} | ${d.reqLv} | ${gearStats(d)} | ${sources(d.id)} |`);
P();P(`- 另有 ${Object.values(items).filter(d=>d.kind==='equip'&&d.id.startsWith('exp_')).length} 件「擴充裝備」（exp_ 開頭，Lv.1～40 的路線裝，由各地亞種掉落）。`);P();
P('**打造與料理**（工匠 蘇菲／諾亞，材料含試煉徽記與 MVP 素材）：');
for(const r of recipes)P(`- ${items[r.out].name}${r.count>1?`×${r.count}`:''}：${Object.entries(r.mats).map(([k,v])=>`${items[k]?.name}×${v}`).join('、')}、${r.zeny.toLocaleString()} z`);P();

P('## 7. 其他系統');
P(`- **主線委託** ${quests.length} 個（含 MVP 挑戰：${challengeIds.map(id=>monsters[id].name).join('、')}），由嚮導發放，最終「星光的傳說」Lv.80。`);
P(`- **探索**：每張野外圖同時 4 個寶箱（12% 稀有、6% 寶箱怪），開過的格子 3 分鐘重生並存檔；營地補給箱；地標試煉（精英＋手下，必出裝備的試煉寶箱，冷卻 10 分）：${Object.entries(TRIALS).map(([k,t])=>`${t.title}（${mapName(k.split(':')[0])}）`).join('、')}。`);
P(`- **懸賞**：晨光鎮／曙光前哨的懸賞官，依等級出 3 張可重複討伐委託。`);
P(`- **棲息地**：野外圖每種主要怪 75% 集中在自己的區域（弱的近入口、強的在深處，避開 MVP 巢穴）；🎯 狩獵目標（小地圖金圈、自動戰鬥優先、一鍵導航）。已設定棲息地的地圖：${Object.keys(HABITATS).map(mapName).join('、')}。`);
P(`- **星光異變（世界事件）**：野外每 3～6 分鐘隨機：🌠 流星雨（${WORLD_EVENT.meteor}s，經驗+20%、星屑）、✨ 黃金魔物（${WORLD_EVENT.golden}s，EXP×5、噴錢＋稀有寶箱）、⚔ 魔物大進攻（三波）。`);
P(`- **寵物** ${Object.keys(pets).length} 種（星光誘捕器捕捉、親密度加成）；**坐騎** ${Object.values(mounts).map(m=>m.name).join('、')}；**外觀** ${Object.keys(costumes).length} 套；**表情** 8 種。`);
P(`- **傭兵**：${Object.values(companions).map(c=>`${c.title}・${c.name}`).join('、')}；指令 ${Object.values(COMPANION_MODES).map(m=>`${m.icon}${m.name}`).join('／')}，低血量撤退。`);
P('- **食物**：持續回復（同時一種）；**技能預約**、單體技能滑鼠瞄準、範圍技能手動瞄準；卡片可直接從其他裝備移過來；裝備比較只列變化。');
P(`- **經濟參考**（每分鐘打怪收入約）：草原 150、森林 800、洞窟 1,060、神殿 3,360、霧語沼澤 2,350、熔岩裂谷 2,070、天空花園 2,470、星界城塞 1,890 z；懸賞另加 +200～+3,000/分。`);P();

P('## 8. 技術與設計限制（請務必遵守）');
P('- 單機瀏覽器遊戲；戰鬥是 60Hz 確定性模擬（同種子結果相同）；舊存檔必須能讀，資料 id 只能新增不能改。');
P('- 魔物外觀只能用現有 12 種模型骨架換色／縮放：jelly、worm、shroom、chick、wolf、bee、sapling、bat、bunny、golem、wisp、fox。地圖地形只有 5 種生成器（town/meadow/forest/cave/ruins），可加外觀變體（天空、霧、光、地面、水色）。');
P('- 特效用現有粒子、光環、光柱、投射物、閃電、流星；不能大量加光源或重型後處理（使用者電腦會卡）。');
P('- 技能實作在 sim.ts 的 switch 裡，可用的機制：單體／範圍／地面、詠唱、延遲、冷卻、DoT、緩速、冰凍、暈眩、定身、擊退、護盾、增益、召喚手下、連鎖、元素狀態（灼燒／寒氣／感電）、衍生傷害、卡片模組觸發。');
P('- 法師目前的平衡：同裝備下三系清怪約 11～14 隻/分、零詠唱 17～19 隻/分；Lv.72 星界城塞約 13 隻/分、每 4 分鐘約 7 瓶白水。');P();

P('## 9. 給設計者的下一步');
P('二轉與星燈航路第一章（夜航港、貝露灣、黑曜鍛爐、逆風鐘塔）已完成，見 二轉最終設計_v6.md。可以接著設計：星燈航路後續區域（Lv.90+）、配裝預設、訓練場與傷害統計、裝備調律、遠征工程等。');
P('請用繁體中文回答，數值要具體（可以標註為初版數值）。');

writeFileSync('給AI_星光冒險世界設定.md',L.join('\n'));
console.log('written',L.length,'lines');
