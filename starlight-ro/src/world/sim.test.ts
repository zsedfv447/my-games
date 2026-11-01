import {describe,expect,test} from 'vitest';
import {World} from './sim';
import * as R from '../rules/state';

const setup=(job:'novice'|'mage'|'archer'|'swordman'='novice',map='meadow')=>{
  let s=R.createCharacter(R.newGame(),'測試',0,0);
  if(job!=='novice'){s=R.gainExp(s,0,9e9).state;for(let i=0;i<9;i++)s=R.learnSkill(s,'basic');s=R.changeJob(s,job,{});s=R.gainExp(s,0,9e9).state;}
  s=R.gainExp(s,5e5,0).state;
  const w=new World(42);w.loadMap(map,map==='town'?24:4,map==='town'?30:36);const d=R.derive(s);w.setStats(d,s.char.baseLv);w.setVitals(d.maxHp,d.maxSp);
  return {s,w};
};
const run=(w:World,sec:number)=>{const ev=[];for(let i=0;i<sec*60;i++)ev.push(...w.step(1/60));return ev;};

describe('世界模擬',()=>{
  test('點地走路沿著可走的格子移動，到達後停止',()=>{
    const {w}=setup();const goal={x:20.5,y:36.5};w.moveTo(goal.x,goal.y);
    for(let i=0;i<600;i++){w.step(1/60);expect(w.map.grid.free(w.player.x,w.player.y)).toBe(true);}
    expect(Math.hypot(w.player.x-goal.x,w.player.y-goal.y)).toBeLessThan(1);
    expect(w.player.vx).toBe(0);
  });
  test('點怪會走過去並持續普攻直到打倒',()=>{
    const {w}=setup();const m=w.monsters.find(m=>m.def.id==='jelly')!;
    w.attack(m.id);const ev=run(w,40);
    expect(ev.some(e=>e.t==='kill'&&e.id===m.id)).toBe(true);
    expect(ev.filter(e=>e.t==='swing'&&e.who==='p').length).toBeGreaterThan(1);
  });
  test('法師火焰矢有詠唱時間，依等級落下多支',()=>{
    let {s,w}=setup('mage');for(let i=0;i<3;i++)s=R.learnSkill(s,'fireBolt');w.setStats(R.derive(s),s.char.baseLv);
    const m=w.monsters.find(m=>m.def.id==='chick')!;w.player.x=m.x-3;w.player.y=m.y;
    if(!w.map.grid.free(w.player.x,w.player.y)){w.player.x=m.x;w.player.y=m.y;}
    expect(w.useSkill('fireBolt',m.id,null)).toBe(true);
    const ev=run(w,6);
    expect(ev.some(e=>e.t==='castStart'&&e.skill==='fireBolt')).toBe(true);
    expect(ev.filter(e=>e.t==='dmg'&&e.to==='m'&&e.src==='fireBolt').length).toBeGreaterThanOrEqual(3);
  });
  test('技能 SP 不足時失敗並提示',()=>{
    let {s,w}=setup('swordman');s=R.learnSkill(s,'bash');w.setStats(R.derive(s),s.char.baseLv);w.setVitals(100,0);
    const m=w.monsters[0];w.useSkill('bash',m.id,null);const ev=run(w,8);
    expect(ev.some(e=>e.t==='fail'&&/SP/.test(e.reason))).toBe(true);
  });
  test('主動怪會主動追擊；城鎮內不會被攻擊',()=>{
    const {w}=setup('novice','forest');const wolf=w.monsters.find(m=>m.def.id==='wolf')!;
    w.player.x=wolf.x+3;w.player.y=wolf.y;if(!w.map.grid.free(w.player.x,w.player.y)){w.player.x=wolf.x;w.player.y=wolf.y+1;}
    run(w,1);expect(wolf.state).toBe('chase');
    const t=setup('novice','town');expect(t.w.monsters).toHaveLength(0);expect(t.w.inCombat()).toBe(false);
  });
  test('手動移動會關閉自動戰鬥',()=>{
    const {w}=setup();w.setAuto(true);expect(w.player.auto).toBe(true);
    w.moveTo(10.5,36.5);expect(w.player.auto).toBe(false);
  });
  test('自動戰鬥會找怪打',()=>{
    const {w}=setup();w.setAuto(true);const ev=run(w,40);
    expect(ev.some(e=>e.t==='kill')).toBe(true);
  });
  test('走到傳送點發出換地圖事件',()=>{
    const {w}=setup('novice','town');const warp=w.map.def.warps[0];w.moveTo(warp.x+.5,warp.y+.5);
    const ev=run(w,20);expect(ev.some(e=>e.t==='warp'&&e.to==='meadow')).toBe(true);
  });
  test('同種子同操作結果一致（確定性）',()=>{
    const a=setup(),b=setup();
    for(const w of [a.w,b.w]){w.setAuto(true);}
    const ea=run(a.w,20).filter(e=>e.t==='dmg'||e.t==='kill').map(e=>JSON.stringify(e));
    const eb=run(b.w,20).filter(e=>e.t==='dmg'||e.t==='kill').map(e=>JSON.stringify(e));
    expect(ea).toEqual(eb);
  });
  test('卡片模組：回響只回響一次，不會無限連鎖',()=>{
    let {s,w}=setup('mage');for(let i=0;i<4;i++)s=R.learnSkill(s,'fireBolt');s=R.learnSkill(s,'fireBall');
    const r=R.addCard(s,'shroomCard');s=R.insertCard(r.state,r.cardId,s.equipped.weapon!,{});s=R.configureModule(s,'fireBall',0,'echo',{});
    w.setStats(R.derive(s),s.char.baseLv);w.setVitals(999,999);
    const m=w.monsters.find(m=>m.def.id==='chick')!;w.player.x=m.x-2;w.player.y=m.y;if(!w.map.grid.free(w.player.x,w.player.y)){w.player.x=m.x;w.player.y=m.y;}
    w.useSkill('fireBall',m.id,null);const ev=run(w,5);
    expect(ev.filter(e=>e.t==='fx'&&e.kind==='echo').length).toBe(1);
  });
});

describe('MVP 大招',()=>{
  const near=(id:string,map:string)=>{const {w,s}=setup('swordman',map);const m=w.monsters.find(m=>m.def.id===id)!;
    w.player.x=m.x+3;w.player.y=m.y;if(!w.map.grid.free(w.player.x,w.player.y)){w.player.x=m.x;w.player.y=m.y+3;}w.setVitals(99999,999);
    w.setStats({...R.derive(s),maxHp:99999},s.char.baseLv);w.setVitals(99999,999);m.state='chase';return {w,m};};
  test('重擊先預警，玩家走出範圍就閃得掉',()=>{
    const {w,m}=near('jellyKing','meadow');m.slamTimer=0;
    let ev=run(w,.2);const warn=ev.find(e=>e.t==='fx'&&e.kind==='warn');expect(warn).toBeTruthy();
    // Step far out of the circle before it lands.
    w.player.x+=4;m.state='idle';const hp=w.player.hp;ev=run(w,1.5);
    expect(ev.some(e=>e.t==='fx'&&e.kind==='slam')).toBe(true);
    expect(ev.filter(e=>e.t==='dmg'&&e.to==='p'&&e.amount>0&&e.src==='jellyKing'&&!e.miss).length).toBe(0);void hp;
  });
  test('半血時召喚一次小怪，小怪死後不會重生',()=>{
    const {w,m}=near('jellyKing','meadow');const n0=w.monsters.length;m.hp=m.maxHp*.4;run(w,.1);
    const minions=w.monsters.filter(x=>x.summoned);expect(minions.length).toBeGreaterThan(0);expect(w.monsters.length).toBeGreaterThan(n0);
    run(w,1);expect(w.monsters.filter(x=>x.summoned).length).toBe(minions.length);
    for(const x of minions){x.hp=0;x.state='dead';x.deadAt=w.time;}run(w,2);
    expect(w.monsters.filter(x=>x.summoned)).toHaveLength(0);
  });
});
