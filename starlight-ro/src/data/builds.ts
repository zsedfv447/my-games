import type {JobId,Stat} from './jobs';
/** Advice only: guides never grant stats, gear or bypass prerequisites. */
export type BuildGuide={id:string;job:JobId;name:string;summary:string;statPriority:Stat[];skillPriority:{id:string;level:number}[];cardTargets:{cardId:string;skillId:string;reason:string}[];playstyle:string;gearTargets?:string[]};
const route=(...entries:[string,number][])=>entries.map(([id,level])=>({id,level}));
const target=(cardId:string,skillId:string,reason:string)=>({cardId,skillId,reason});
export const buildGuides:BuildGuide[]=[
 {id:'novice-path',job:'novice',name:'踏實起步',summary:'先靠短劍與急救完成草原委託，再依目標職業分配素質。',statPriority:['dex','vit','str'],skillPriority:route(['basic',9]),cardTargets:[],playstyle:'劍士先 STR、法師保留點數給 INT、弓手先 DEX；過渡期不必把點數全花完。'},
 {id:'sword-burst',job:'swordman',name:'烈焰附刃',summary:'一轉 Job 10 起在技能視窗切換【烈焰之魂】：烈焰爆破變成 22 秒附刃，每 2 下普攻順劈並發動爆破上的範圍卡片；熾焰長劍（工匠蘇菲）再加 15% 連砍，後期換熔岩巨像的煉獄大劍。',statPriority:['str','dex','vit','agi'],skillPriority:route(['bash',5],['magnum',5],['swordMastery',5],['hpRecovery',3]),cardTargets:[target('shroomCard','magnum','範圍回響'),target('golemCard','magnum','機率暈眩'),target('jellyKingCard','magnum','擴散擊退')],playstyle:'附刃快熄才重放爆破；焰影追斬會小距離貼近，之後兩下普攻帶強火。'},
 {id:'sword-sustain',job:'swordman',name:'重斬續戰',summary:'以生命恢復、鐵壁與單體吸取延長出城時間。',statPriority:['str','vit','dex','agi'],skillPriority:route(['bash',5],['hpRecovery',5],['provoke',5],['endure',3],['swordMastery',5]),cardTargets:[target('jellyCard','bash','單體命中吸取'),target('chickCard','bash','施放護盾'),target('forestLordCard','endure','持續回復')],playstyle:'挑撥會提高敵人攻擊；鐵壁不能取代走出 MVP 預警。'},
 {id:'mage-fire',job:'mage',name:'火焰回響',summary:'火焰矢鋪灼燒，看準時機用爆炎球引爆，讓火勢擴散到整群。',statPriority:['int','dex','vit'],skillPriority:route(['fireBolt',4],['fireBall',5],['spRecovery',5],['fireBolt',7]),cardTargets:[target('shroomCard','fireBall','範圍回響'),target('saplingCard','fireBall','命中定身'),target('chickCard','fireBall','護盾防護')],playstyle:'先用火焰矢把主目標疊到 3～5 層灼燒，再丟爆炎球：每層追加 25% 並擴散 2 層給附近敵人，第二輪再引爆。打王時疊滿再引爆。'},
 {id:'mage-control',job:'mage',name:'冰霜控場',summary:'冰霜矢疊寒氣緩速，滿 5 層形成寒冰印記，再用冰封術碎冰爆發。',statPriority:['int','dex','vit'],skillPriority:route(['coldBolt',5],['frostDiver',3],['spRecovery',5],['lightningBolt',4]),cardTargets:[target('wormCard','coldBolt','命中緩速'),target('bunnyCard','coldBolt','機率冰凍'),target('chickCard','frostDiver','增加防護')],playstyle:'看到怪物頭上出現 ◆ 寒冰印記就接冰封術碎冰（+150% 與 2 枚冰片）。MVP 不會被凍，但印記照樣成立，碎冰對王一樣有效。'},
 {id:'mage-chain',job:'mage',name:'雷鳴連鎖',summary:'雷鳴矢高頻命中維持感電，每 4 下落雷；連鎖在怪群間彈跳，單王時改為回彈。',statPriority:['int','dex','vit'],skillPriority:route(['lightningBolt',4],['spRecovery',5],['thunderStorm',3],['lightningBolt',7]),cardTargets:[target('wolfCard','lightningBolt','單體命中連鎖'),target('batCard','lightningBolt','技能爆擊'),target('saplingCard','thunderStorm','雷暴定身')],playstyle:'詠唱越短、命中越頻繁，落雷與連鎖就越多。怪物聚集且都在感電中時放雷暴（感電目標 +20%）。'},
 {id:'archer-range',job:'archer',name:'遠射風箏',summary:'拉長射程，以二連矢與震退箭保持安全距離。',statPriority:['dex','agi','vit'],skillPriority:route(['owlEye',3],['vulture',5],['doubleStrafe',5],['arrowShower',5],['chargeArrow',1]),cardTargets:[target('wormCard','doubleStrafe','減速延長射擊時間'),target('wolfCard','doubleStrafe','附近敵人連鎖'),target('saplingCard','arrowShower','範圍定身')],playstyle:'手動移動會停止自動戰鬥；震退後重新站穩，避免被包圍。'},
 {id:'archer-crit',job:'archer',name:'銳眼連射',summary:'DEX 穩定輸出、AGI 加快普攻，再用銳眼卡提升二連矢爆擊。',statPriority:['dex','agi','luk','vit'],skillPriority:route(['doubleStrafe',5],['owlEye',3],['vulture',1],['concentrate',5],['doubleStrafe',10]),cardTargets:[target('batCard','doubleStrafe','技能爆擊'),target('jellyCard','doubleStrafe','吸取續戰'),target('chickCard','concentrate','補強護盾')],playstyle:'先把命中與射程站穩再補 LUK；技能爆擊由銳眼提供，LUK 主要幫助普攻。'},
 {id:'mage-zero',job:'mage',name:'零詠唱・瞬發元素',summary:'法師的終極目標：DEX 加上詠唱裝備讓詠唱歸零，元素矢連發不停。',statPriority:['dex','int','vit'],
  skillPriority:route(['fireBolt',5],['coldBolt',5],['lightningBolt',5],['spRecovery',5],['fireBolt',10]),
  cardTargets:[target('clockCard','fireBolt','詠唱再 −20%'),target('blueJellyCard','fireBolt','SP −20%，連發更久'),target('windCard','fireBolt','施放後延遲 −25%'),target('wispCard','lightningBolt','擊倒返還 SP'),target('templeCard','fireBolt','屬性傷害 +15%')],
  gearTargets:['mageEarring','hourglass','sageGlasses','timeCloak','sorcererRobe','starRod'],
  playstyle:'詠唱 = 1 − DEX÷150 − 裝備詠唱%。飾品只有一格，沙漏(15)＋眼鏡(6)＋斗篷(6)＋長袍(5)＋星辰杖(10)共 −42%，DEX 87 就能零詠唱；前期先買魔導耳環過渡。之後瓶頸變成 SP 與施放後延遲，所以魔力節約、迅捷收招、魔力湧現是下一步。'},
 {id:'sword-crit',job:'swordman',name:'連斬暴擊',summary:'一轉 Job 20 起切換【連斬之魂】：疾影連斬多一道殘影、返還 SP，斬勢爆破強化下一次終結刀；堆爆擊讓每一刀都能爆擊並觸發卡片，連斬護腕再多砍一刀。打王最強。',statPriority:['luk','str','dex','agi'],
  skillPriority:route(['bash',5],['swordMastery',5],['bash',10],['hpRecovery',5]),
  cardTargets:[target('batCard','bash','技能爆擊 +15%'),target('foxCard','bash','爆擊傷害 +30%'),target('iceFoxCard','bash','無視 30% 防禦'),target('starIdolCard','bash','機率星落')],
  gearTargets:['warBand','clover','meteorSword','guardRing'],
  playstyle:'LUK 每點 +0.3% 爆擊，加上戰士頭巾、幸運草、流星劍與銳眼卡，重斬爆擊率可破 50%。爆擊無視防禦，打神殿守衛這類硬怪特別有感。'},
 {id:'sword-tank',job:'swordman',name:'不倒鐵壁',summary:'一轉 Job 25 起切換【磐石之魂】：鐵壁意志變成磐石架勢，被打就每 0.5 秒反擊周圍；撼地斬累積守勢，震地爆破一次用完。拿磐岩大劍（Lv.40，工匠打造；Lv.62 換撼岳巨劍）就算沒被打也會一直反擊，再穿不屈鎧甲＋荊棘徽章反擊更痛。',statPriority:['vit','str','dex'],
  skillPriority:route(['hpRecovery',10],['endure',5],['provoke',5],['magnum',5],['bash',5]),
  cardTargets:[target('jellyCard','bash','吸取續戰'),target('forestLordCard','endure','持續回復'),target('blueJellyCard','magnum','爆破省 SP'),target('golemCard','magnum','機率暈眩')],
  gearTargets:['guardRing','chainMail','ironHelm','leatherBoots'],
  playstyle:'坦克靠回復與防禦取勝，不追求秒殺；MVP 預警仍要走出去，鐵壁不能抵銷範圍重擊。'},
 {id:'archer-gale',job:'archer',name:'疾風連射',summary:'堆攻速讓普攻像機關槍，再用分裂箭與二連矢補爆發。',statPriority:['agi','dex','luk'],
  skillPriority:route(['owlEye',5],['doubleStrafe',5],['vulture',5],['concentrate',5],['doubleStrafe',10]),
  cardTargets:[target('shadowBatCard','doubleStrafe','每箭追加分裂箭'),target('windCard','doubleStrafe','延遲 −25%'),target('foxCard','doubleStrafe','爆擊傷害 +30%'),target('iceFoxCard','chargeArrow','破甲')],
  gearTargets:['swiftBangle','hunterCap','galeCape','galeBow','featherBoots'],
  playstyle:'攻速裝備最多 +29%，加上 AGI 與專注凝神，普攻間隔可壓到 0.3 秒左右；技能延遲靠輕羽靴與迅捷收招，二連矢就能接得更緊。'},
];
export const buildsOf=(job:JobId)=>buildGuides.filter(g=>g.job===job);

// Alternative acquisition routes use the same established module rules and never grant gear.
buildGuides.push(
 {id:'sword-fieldguard',job:'swordman',name:'巡林守備',summary:'利用草原亞種卡與商店守備裝起步，再換取荊棘護衛甲。',statPriority:['str','vit','dex'],
  skillPriority:route(['bash',5],['hpRecovery',5],['endure',3],['swordMastery',5]),
  cardTargets:[target('exp_dewJellyCard','bash','晨露果凍的吸取續戰'),target('exp_goldChickCard','endure','金羽雛雞的施放護盾'),target('exp_briarWolfCard','bash','荊棘狼的單體連鎖')],
  gearTargets:['exp_trail_guardSword','exp_thorn_plateArmor','exp_trail_sturdyBoots'],
  playstyle:'守備劍比鋒刃劍少些攻擊，換取生命與防禦；同模組來源不會疊加，不同名稱的卡也不能互當升級素材。'},
 {id:'mage-fieldstudy',job:'mage',name:'溪畔節魔',summary:'以薄荷果凍卡節省SP，再追尋溪畔精靈卡的擊倒返還。',statPriority:['int','dex','vit'],
  skillPriority:route(['fireBolt',5],['spRecovery',5],['lightningBolt',5],['fireBall',3]),
  cardTargets:[target('exp_mintJellyCard','fireBolt','草原可取得的魔力節約'),target('exp_brookWispCard','lightningBolt','森林的擊倒返還'),target('exp_bellShroomCard','fireBall','鈴傘菇的範圍回響')],
  gearTargets:['exp_trail_orbStaff','exp_thorn_focusRobe','exp_trail_castCharm'],
  playstyle:'魔珠杖偏魔力續航，晶簇杖偏詠唱速度；先顧 SP 續航與技能循環，再決定是否改用晶簇杖。卡片必須留在穿戴中的裝備才會提供模組。'},
 {id:'archer-fieldhunter',job:'archer',name:'暮影獵手',summary:'用長弓穩定命中，再以暮影狼與蕨尾狐卡挑戰高防禦目標。',statPriority:['dex','agi','vit','luk'],
  skillPriority:route(['owlEye',3],['vulture',5],['doubleStrafe',5],['chargeArrow',1],['concentrate',5]),
  cardTargets:[target('exp_duskWolfCard','doubleStrafe','森林可取得的技能銳眼'),target('exp_fernFoxCard','chargeArrow','蕨尾狐的破甲'),target('exp_reedWormCard','doubleStrafe','蘆葦幼蟲的命中緩速')],
  gearTargets:['exp_thorn_longBow','exp_thorn_hunterVest','exp_thorn_stepShoes'],
  playstyle:'長弓偏單箭威力與命中，反曲弓偏普攻速度；先用緩速拉開距離，銳眼與破甲依目標更換。免費拆裝仍須離開戰鬥。'},
);
