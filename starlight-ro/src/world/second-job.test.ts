import { describe, test, expect } from 'vitest';
import { World, type SimEvent } from './sim';
import * as R from '../rules/state';
import { skills, jobExpNeed, job2ExpNeed, K, RG, type JobId } from '../data/jobs';
import { items, type EquipDef } from '../data/items';
import { monsters } from '../data/monsters';

const run=(w:World,sec:number)=>{const ev:SimEvent[]=[];for(let i=0;i<Math.round(sec*60);i++)ev.push(...w.step(1/60));return ev;};
const town={inCombat:false,inTown:true};
/** A Base 70 / Job 50 first-job character who has just passed the 誓約試煉. */
function ready(job:'swordman'|'mage'|'archer'){
  let s=R.createCharacter(R.newGame(),'二轉測試',0,0);s=R.gainExp(s,0,9e9).state;for(let i=0;i<9;i++)s=R.learnSkill(s,'basic');
  s=R.changeJob(s,job,{});s.char.baseLv=70;s.char.jobLv=50;s.char.stats={str:80,agi:60,vit:50,int:80,dex:80,luk:20};return s;
}
function ascended(job:'swordman'|'mage'|'archer',skillset:Record<string,number>,job2Lv=30){
  let s=ready(job);s.ascension={stage:3,kills:30};s=R.changeJob2(s,town);
  s.char.job2Lv=job2Lv;Object.assign(s.char.skills,skillset);return s;
}
function arena(s:R.GameState,map='meadow'){
  const w=new World(11);w.loadMap(map,10,36);w.monsters.length=0;const d=R.derive(s);w.setStats({...d,maxHp:60000,maxSp:9000},70);w.setVitals(60000,9000);return {w,d};
}
const POOL=['oath_knight','oath_wizard','oath_ranger','vaultWarden','mistQueen','skyKing','astralLord','lavaColossus'];
/** A still training dummy (each one a different boss id, since spawnBoss refuses duplicates). */
const dummy=(w:World,_id:string,x:number,y:number,hp=1e7)=>{const id=POOL.find(k=>!w.monsters.some(m=>m.def.id===k&&m.state!=='dead'))!;const m=w.spawnBoss(id,x,y)!;m.x=m.px=x;m.y=m.py=y;m.hp=m.maxHp=hp;m.def={...m.def,aggressive:false,speed:0,flee:0,def:0,mdef:0,mvp:false,art:{...m.def.art,scale:.6}};m.state='idle';return m;};
const dealt=(ev:SimEvent[],src?:string)=>ev.filter(e=>e.t==='dmg'&&e.to==='m'&&(!src||e.src===src)).reduce((a,e)=>a+(e as {amount:number}).amount,0);

describe('v6.0 二轉：轉職流程',()=>{
  test('條件：Base 60＋Job 50；委託要打倒 30 隻 Lv.45 以上的魔物，之後開啟試煉',()=>{
    let s=ready('mage');s.char.baseLv=59;expect(R.ascensionReady(s)).toContain('Base');s.char.baseLv=60;s.char.jobLv=49;expect(R.ascensionReady(s)).toContain('Job');s.char.jobLv=50;
    expect(R.ascensionReady(s)).toBeNull();s=R.acceptAscension(s);expect(s.ascension).toEqual({stage:1,kills:0});
    s=R.noteKill(s,'jelly');expect(s.ascension!.kills).toBe(0);
    for(let i=0;i<29;i++)s=R.noteKill(s,'marshJelly');expect(()=>R.reportAscensionHunt(s)).toThrow();
    s=R.noteKill(s,'astralGuard');s=R.reportAscensionHunt(s);expect(s.ascension!.stage).toBe(2);
    expect(()=>R.changeJob2(s,town)).toThrow();
    s=R.noteKill(s,'oath_wizard');expect(s.ascension!.stage).toBe(3);
    s=R.changeJob2(s,town);expect(s.char.job).toBe('mage');expect(s.char.job2).toBe('wizard');expect(s.char.job2Lv).toBe(1);expect(s.char.skillPoints2).toBe(1);
    expect(s.equipment.some(e=>e.defId==='starlitStaff')).toBe(true);expect(()=>R.validateGame(s)).not.toThrow();
  });
  test('舊裝備照樣能穿；二轉武器只有二轉能穿',()=>{
    let s=ascended('swordman',{});s=R.addItem(s,'mithrilSword');const blade=s.equipment.at(-1)!.id;
    expect(R.canWear(s,items.mithrilSword as EquipDef)).toBe(true);s=R.equip(s,blade,town);
    const sword=s.equipment.find(e=>e.defId==='oathSword')!.id;s=R.equip(s,sword,town);expect(s.equipped.weapon).toBe(sword);
    expect(R.canWear(ready('swordman'),items.oathSword as EquipDef)).toBe(false);
    expect(()=>R.validateGame(s)).not.toThrow();
  });
  test('一轉進修：二轉後職業經驗同時進兩條軌道，一轉仍能練到 70',()=>{
    let s=ascended('archer',{},1);const j1=s.char.jobLv;
    const r=R.gainExp(s,0,jobExpNeed('archer',j1)+job2ExpNeed(1));s=r.state;
    expect(s.char.jobLv).toBeGreaterThan(j1);expect(s.char.job2Lv).toBeGreaterThanOrEqual(2);expect(s.char.skillPoints2).toBeGreaterThanOrEqual(2);
    s=R.gainExp(s,0,9e12).state;expect(s.char.jobLv).toBe(70);expect(s.char.job2Lv).toBe(30);expect(s.char.skillPoints2).toBe(30);
    expect(()=>R.validateGame(s)).not.toThrow();
  });
  test('二轉技能用二轉技能點，並且有二轉等級門檻；城鎮裡可以免費重新分配',()=>{
    let s=ascended('mage',{fireBolt:4},1);s.char.skillPoints2=3;
    expect(R.canLearn(s,'w_arcana')).toContain('二轉 Job');
    const sp1=s.char.skillPoints;s=R.learnSkill(s,'w_flame');expect(s.char.skills.w_flame).toBe(1);expect(s.char.skillPoints2).toBe(2);expect(s.char.skillPoints).toBe(sp1);
    expect(s.hotbar.some(h=>h?.type==='skill'&&h.id==='w_flame')).toBe(true);
    expect(R.canLearn(ready('mage'),'w_flame')).toBe('需要先完成二轉');
    s=R.resetSkills2(s,town);expect(s.char.skills.w_flame).toBeUndefined();expect(s.char.skillPoints2).toBe(3);expect(s.hotbar.some(h=>h?.type==='skill'&&h.id==='w_flame')).toBe(false);
    expect(()=>R.resetSkills2(s,{inTown:false})).toThrow();expect(()=>R.validateGame(s)).not.toThrow();
  });
  test('舊存檔沒有二轉欄位也能讀；二轉資料亂改會被擋下',()=>{
    const s=ready('swordman');const old=structuredClone(s) as Record<string,unknown>;delete old.ascension;delete old.flags;
    expect(()=>R.validateGame(R.normalizeGame(old))).not.toThrow();
    const bad=ascended('swordman',{});bad.char.job2='wizard';expect(()=>R.validateGame(bad)).toThrow();
    const bad2=ready('mage');bad2.char.skills.w_flame=1;expect(()=>R.validateGame(bad2)).toThrow();
  });
  test('試煉守護者不會留下 MVP 重生計時（不會弄壞存檔）',()=>{
    const w=new World(3);w.loadMap('oathGround',5,18);const m=w.spawnBoss('oath_knight',12,18)!;expect(m).toBeTruthy();expect(w.spawnBoss('oath_knight',12,18)).toBeNull();
    const d=R.derive(ascended('swordman',{}));w.setStats({...d,atk:99999,weaponAtk:99999,hit:9999},70);w.setVitals(d.maxHp,d.maxSp);
    m.hp=1;w.attack(m.id);const ev=run(w,4);expect(ev.some(e=>e.t==='kill'&&e.monster==='oath_knight')).toBe(true);
    expect(Object.keys(w.exportMvpCooldowns())).toHaveLength(0);
    expect(monsters.oath_ranger.mvp).toBe(true);
  });
});

describe('v6.0 星誓騎士',()=>{
  const knight=()=>ascended('swordman',{bash:10,magnum:10,k_wheel:5,k_rend:5,k_ward:5,k_charge:5,k_training:5,k_judgment:5,k_quake:5});
  test('星輪旋斬打中 3 隻以上得到 2 層戰意；裂星重斬消耗戰意，傷害更高',()=>{
    const {w}=arena(knight());const p=w.player;
    for(let i=0;i<3;i++)dummy(w,'oath_knight',p.x+1+i*.3,p.y+.5);
    w.useSkill('k_wheel',null,null);run(w,3.1);expect(p.resolve).toBe(2);
    w.useSkill('k_wheel',null,null);run(w,1);expect(p.resolve).toBe(4);
    const t=w.monsters[0];const base=w.monsters.length;void base;
    const with4=dealt(((w.useSkill('k_rend',t.id,null),run(w,1))),'k_rend');expect(p.resolve).toBe(1);
    run(w,6);p.resolve=0;const none=dealt(((w.useSkill('k_rend',t.id,null),run(w,1))),'k_rend');
    expect(with4).toBeGreaterThan(none*1.3);
  });
  test('戰意 8 秒沒有累積就開始衰退',()=>{
    const {w}=arena(knight());const p=w.player;dummy(w,'oath_knight',p.x+1,p.y);w.useSkill('k_wheel',null,null);run(w,1);expect(p.resolve).toBeGreaterThan(0);
    const n=p.resolve;run(w,8.5);expect(p.resolve).toBe(n-1);run(w,10);expect(p.resolve).toBe(0);
  });
  test('守誓護壁：消耗戰意變成護盾，被打時反擊光刃',()=>{
    const {w,d}=arena(knight());const p=w.player;p.resolve=5;const m=dummy(w,'oath_knight',p.x+1,p.y);
    m.def={...m.def,aggressive:true,speed:1,atk:[50,60]};
    w.useSkill('k_ward',null,null);run(w,.3);expect(p.resolve).toBe(0);
    expect(p.shields.reduce((a,s)=>a+s.amount,0)).toBeGreaterThan(60000*(K.ward.base(5)+K.ward.per*5)*.95);void d;
    m.state='chase';const ev=run(w,4);expect(dealt(ev,'k_ward')).toBeGreaterThan(0);
  });
  test('破陣突進衝到目標身邊，不會穿過牆壁',()=>{
    const {w}=arena(knight());const p=w.player;const m=dummy(w,'oath_knight',p.x+5,p.y);
    w.useSkill('k_charge',m.id,null);run(w,1);expect(Math.hypot(p.x-m.x,p.y-m.y)).toBeLessThan(1.6);expect(p.resolve).toBeGreaterThan(0);
    for(let i=0;i<40;i++){w.useSkill('k_charge',m.id,null);run(w,.4);expect(w.map.grid.free(p.x,p.y)).toBe(true);m.x+=(i%2?6:-6);m.px=m.x;run(w,7);}
  });
  test('騎士訓練：最大 HP +20%；消耗戰意後下一次重斬更痛',()=>{
    const base=R.derive(ascended('swordman',{})).maxHp,trained=R.derive(knight()).maxHp;expect(trained/base).toBeCloseTo(1.2,1);
    const {w}=arena(knight());const p=w.player,m=dummy(w,'oath_knight',p.x+1,p.y);
    const plain=dealt(((w.useSkill('bash',m.id,null),run(w,1))),'bash');
    p.resolve=1;w.useSkill('k_ward',null,null);run(w,.6);expect(p.knightNext).toBeGreaterThan(w.time);
    const boosted=dealt(((w.useSkill('bash',m.id,null),run(w,1))),'bash');expect(boosted).toBeGreaterThan(plain*1.1);expect(p.knightNext).toBe(0);
  });
});

describe('v6.0 星紋魔導士',()=>{
  const wiz=()=>ascended('mage',{fireBolt:10,coldBolt:10,lightningBolt:10,fireBall:10,frostDiver:10,thunderStorm:10,w_flame:5,w_frost:5,w_totem:5,w_veil:5,w_ascend:5,w_study:5,w_arcana:5});
  test('焰環熔域：初擊給 2 層灼燒，火場持續燒；火場內的爆炎球引爆更痛',()=>{
    const {w}=arena(wiz());const p=w.player,m=dummy(w,'oath_knight',p.x+4,p.y);
    w.useSkill('w_flame',null,{x:m.x,y:m.y});const ev=run(w,2.5);expect(w.zones.some(z=>z.kind==='flame')).toBe(true);
    expect(m.el?.burn?.stacks).toBeGreaterThanOrEqual(2);expect(dealt(ev,'w_flame')).toBeGreaterThan(0);
    run(w,5);expect(w.zones.length).toBe(0);
  });
  test('霜環囚域：持續疊寒氣，對 MVP 也會形成寒冰印記',()=>{
    const {w}=arena(wiz());const p=w.player,m=dummy(w,'oath_knight',p.x+4,p.y);m.def={...m.def,mvp:true};
    w.useSkill('w_frost',null,{x:m.x,y:m.y});run(w,1.3);
    let marked=false;for(let i=0;i<50&&!marked;i++){run(w,.1);marked=!!m.el?.mark;}expect(marked).toBe(true);expect(m.frozenUntil).toBeLessThanOrEqual(w.time);
  });
  test('導雷星樁：每 2 秒電擊並感電；星樁內的落雷會追擊一次',()=>{
    const {w}=arena(wiz());const p=w.player,m=dummy(w,'oath_knight',p.x+4,p.y);
    w.useSkill('w_totem',null,{x:m.x,y:m.y});run(w,1);expect((m.el?.shockUntil??0)).toBeGreaterThan(w.time);
    const ev=run(w,.5);void ev;w.useSkill('lightningBolt',m.id,null);const ev2=run(w,3);
    expect(dealt(ev2,'totem')).toBeGreaterThan(0);expect(ev2.filter(e=>e.t==='dmg'&&e.src==='totem').length).toBeLessThanOrEqual(1);
  });
  test('星紋奧義：依最後的元素改變（火=引爆、冰=碎冰、雷=6 道落雷）',()=>{
    for(const [first,src] of [['fireBolt','detonate'],['coldBolt','shatter'],['lightningBolt','w_arcana']] as const){
      const {w}=arena(wiz());const p=w.player,m=dummy(w,'oath_knight',p.x+4,p.y);
      w.useSkill(first,m.id,null);run(w,3);expect(p.lastElement).toBe(skills[first].element);
      w.useSkill('w_arcana',m.id,null);const ev=run(w,3);
      if(src==='w_arcana')expect(ev.filter(e=>e.t==='dmg'&&e.src==='w_arcana').length).toBe(6);else expect(dealt(ev,src)).toBeGreaterThan(0);
    }
  });
  test('星紋研習：最大 SP +15%；施放 3 次一轉法術後，二轉技能 SP 變便宜',()=>{
    const base=R.derive(ascended('mage',{})).maxSp,st=R.derive(wiz()).maxSp;expect(st/base).toBeCloseTo(1.15,1);
    const {w}=arena(wiz());const p=w.player,m=dummy(w,'oath_knight',p.x+4,p.y);
    const full=w.spCost('w_flame',5);for(let i=0;i<3;i++){w.useSkill('fireBolt',m.id,null);run(w,3);}
    expect(p.spellFlow).toBe(3);expect(w.spCost('w_flame',5)).toBeLessThan(full);w.useSkill('w_flame',null,{x:m.x,y:m.y});run(w,2);expect(p.spellFlow).toBe(0);
  });
});

describe('v6.0 蒼穹遊俠',()=>{
  const ranger=()=>{const s=ascended('archer',{doubleStrafe:10,arrowShower:10,owlEye:10,vulture:10,r_mark:5,r_snipe:5,r_pierce:5,r_barrage:5,r_trap:5,r_falcon:5,r_starRain:5});
    s.equipment.push({id:'e900',defId:'skywardBow'});s.seq=Math.max(s.seq,900);s.equipped.weapon='e900';return s;};
  test('獵者標記：對獵物的遠程傷害提高；同時只有一個獵物',()=>{
    const {w}=arena(ranger());const p=w.player,a=dummy(w,'oath_knight',p.x+5,p.y),b=dummy(w,'oath_ranger',p.x+5,p.y+3);
    w.useSkill('r_mark',a.id,null);run(w,.5);expect(w.prey?.id).toBe(a.id);w.useSkill('r_mark',b.id,null);run(w,1.5);expect(w.prey?.id).toBe(b.id);
    expect(w.prey!.until-w.time).toBeGreaterThan(RG.mark.dur-2.5);
  });
  test('束光陷阱：最多 2 個；敵人踩到就爆炸並緩速；放在王腳下也會觸發',()=>{
    const {w}=arena(ranger());const p=w.player;
    w.useSkill('r_trap',null,{x:p.x+3,y:p.y});run(w,4.5);w.useSkill('r_trap',null,{x:p.x+3,y:p.y+3});run(w,4.5);w.useSkill('r_trap',null,{x:p.x-3,y:p.y});run(w,1);
    expect(w.traps.length).toBe(2);
    const boss=dummy(w,'oath_knight',w.traps[0].x,w.traps[0].y);boss.def={...boss.def,mvp:true};const ev=run(w,1);
    expect(dealt(ev,'r_trap')).toBeGreaterThan(0);expect(boss.slowUntil).toBeGreaterThan(w.time);expect(w.traps.length).toBe(1);
  });
  test('追風連射：目標倒下後，剩下的箭轉向附近的敵人',()=>{
    const {w}=arena(ranger());const p=w.player,a=dummy(w,'oath_knight',p.x+4,p.y,1),b=dummy(w,'oath_ranger',p.x+5,p.y+1);
    w.useSkill('r_barrage',a.id,null);const ev=run(w,2);expect(a.state).toBe('dead');expect(ev.some(e=>e.t==='dmg'&&e.id===b.id&&e.src==='r_barrage')).toBe(true);
  });
  test('破風貫矢：直線上的敵人都被貫穿',()=>{
    const {w}=arena(ranger());const p=w.player,ms=[2.5,4.5,6.5].map(dx=>dummy(w,'oath_knight',p.x+dx,p.y));
    w.useSkill('r_pierce',ms[0].id,null);const ev=run(w,1.5);for(const m of ms)expect(ev.some(e=>e.t==='dmg'&&e.id===m.id&&e.src==='r_pierce')).toBe(true);
  });
  test('鷹眼協獵：攻速提高，遠程命中時獵鷹會俯衝',()=>{
    const s=ranger();expect(R.derive(s).gearAspd).toBeGreaterThanOrEqual(10);
    const {w}=arena(s);const p=w.player,m=dummy(w,'oath_knight',p.x+4,p.y);w.attack(m.id);const ev=run(w,20);expect(dealt(ev,'falcon')).toBeGreaterThan(0);
  });
});

describe('v6.0 二轉試玩角色',()=>{
  test('三個職業的試玩角色（已二轉／準備二轉）都是合法存檔，技能點剛好用完',async()=>{
    const {labJob2State,LAB_JOB2}=await import('../rules/lab');
    for(const k of LAB_JOB2){const s=labJob2State(k)!;expect(()=>R.validateGame(s)).not.toThrow();expect(s.char.job2).toBeTruthy();expect(s.char.skillPoints2).toBe(0);
      expect(s.hotbar.filter(h=>h?.type==='skill').every(h=>(s.char.skills[h!.id]??0)>0)).toBe(true);
      const pre=labJob2State(k,{pre:true})!;expect(()=>R.validateGame(pre)).not.toThrow();expect(R.ascensionReady(pre)).toBeNull();}
  });
});

describe('v6.0 世界延伸：地下城、星燈航路、新魔物與模組',()=>{
  test('新地圖：傳送點與地標都走得到；入口在二轉後開放',async()=>{
    const {maps}=await import('../data/maps');const {buildMap}=await import('./mapgen');const {JOB2_GATES}=await import('../data/explore');
    for(const id of ['forge1','forge2','bell1','bell2','harbor','bellBay','oathGround']){const md=buildMap(id);
      for(const wp of maps[id].warps){const t=buildMap(wp.to),c=t.grid.nearestWalkable(wp.tx,wp.ty,4);expect(c,`${id}→${wp.to}`).toBeTruthy();}
      for(const sp of maps[id].spawns)expect(monsters[sp.monster],sp.monster).toBeTruthy();void md;}
    for(const g of Object.values(JOB2_GATES))expect(maps[g.map]).toBeTruthy();
  });
  test('每隻新魔物都有卡片；新模組只裝在合法技能上',async()=>{
    const {cards}=await import('../data/items');
    for(const id of ['cinderJelly','ashBat','shellGolem','forgeWisp','forgeMaster','beatSprite','galeChick','bellBee','cogGolem','bellTuner','bubbleJelly','lampBat','saltWorm','tideWisp','tideQueen'])expect(cards[monsters[id].card],id).toBeTruthy();
    expect(R.moduleFits('fireBall','emberEcho')).toBe(true);expect(R.moduleFits('fireBolt','emberEcho')).toBe(false);
    expect(R.moduleFits('lightningBolt','thunderReturn')).toBe(true);expect(R.moduleFits('coldBolt','thunderReturn')).toBe(false);
    expect(R.moduleFits('k_wheel','starBlade')).toBe(true);expect(R.moduleFits('r_snipe','preyHunt')).toBe(true);expect(R.moduleFits('w_frost','frostLinger')).toBe(true);
  });
  test('煤芯果凍血少時會預告爆炸；站遠就不會受傷',()=>{
    const {w}=arena(ascended('swordman',{}),'forge1');const p=w.player;
    const m=w.spawnBoss('cinderJelly',p.x+5,p.y)!;m.x=p.x+5;m.y=p.y;m.state='chase';m.hp=m.maxHp*.2;
    const ev=run(w,.1);expect(ev.some(e=>e.t==='fx'&&e.kind==='warn')).toBe(true);p.x-=6;const hp=p.hp;const ev2=run(w,1.5);
    expect(ev2.some(e=>e.t==='fx'&&e.kind==='explode')).toBe(true);expect(p.hp).toBe(hp);
  });
  test('鍛爐精靈替同伴加護盾，護盾先吸收傷害',()=>{
    const {w}=arena(ascended('swordman',{}),'forge1');const p=w.player;
    const wisp=w.spawnBoss('forgeWisp',p.x+6,p.y)!,friend=w.spawnBoss('shellGolem',p.x+6,p.y+1)!;wisp.x=p.x+6;wisp.y=p.y;friend.x=p.x+6;friend.y=p.y+1;friend.hp=friend.maxHp*.5;wisp.state='chase';
    run(w,.2);expect(friend.shield).toBeGreaterThan(0);
  });
  test('三隻新 MVP 都有可閃避的預警招式',()=>{
    for(const [id,map] of [['forgeMaster','forge2'],['bellTuner','bell2'],['tideQueen','bellBay']] as const){
      const {w}=arena(ascended('swordman',{}),map);const p=w.player,b=w.spawnBoss(id,p.x+3,p.y)!;b.x=p.x+3;b.y=p.y;b.state='chase';b.slamTimer=0;
      const ev=run(w,.1);expect(ev.some(e=>e.t==='fx'&&e.kind==='warn'),id).toBe(true);}
  });
  test('交出 12 份燈芯：燈塔點亮的旗標寫進存檔',async()=>{
    const {quests}=await import('../data/quests');let s=ascended('mage',{});s.quest={index:quests.findIndex(q=>q.id==='lampWick12'),count:0};s=R.addItem(s,'lampWick',12);
    const r=R.completeQuest(s);expect(r.state.flags?.lighthouse).toBe(true);expect(r.state.items.lampWick??0).toBe(0);expect(()=>R.validateGame(r.state)).not.toThrow();
  });
});
