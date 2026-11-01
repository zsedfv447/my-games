import {describe,test,expect} from 'vitest';
import {World,type SimEvent} from './sim';
import * as R from '../rules/state';
const arena=(map='meadow')=>{const w=new World(77);w.loadMap(map,4,36);const s=R.createCharacter(R.newGame(),'測試',0,0);const d={...R.derive(s),maxHp:10000,maxSp:1000,atk:1,weaponAtk:1,matkMin:100,matkMax:100,hit:1000,flee:0,perfectDodge:0};w.setStats(d,60);w.setVitals(10000,1000);const m=w.monsters[0];if(m){w.monsters=[m];m.x=12.5;m.y=36.5;m.px=m.x;m.py=m.y;m.hp=m.maxHp=10000;m.def={...m.def,aggressive:false,speed:0,def:0,mdef:0,atk:[100,100],hit:1000};}w.player.x=10.5;w.player.y=36.5;return {w,m,d};};
const run=(w:World,sec:number)=>{const ev:SimEvent[]=[];for(let i=0;i<sec*60;i++)ev.push(...w.step(1/60));return ev;};
describe('戰鬥修正',()=>{
 test('高 INT 杖普攻在貼身及遠處皆使用 MATK',()=>{for(const distance of [1,3]){const {w,m,d}=arena();w.setStats({...d,weaponType:'staff',ranged:false,range:4},60);w.player.x=m.x-distance;w.attack(m.id);const e=run(w,.5).find(e=>e.t==='dmg'&&e.to==='m');expect(e&&e.t==='dmg'&&e.amount).toBe(100);}});
 test('單一傳送事件立刻中止本次幀內剩餘固定步進',()=>{const {w}=arena('town');const warp=w.map.def.warps[0];w.player.x=warp.x+.5;w.player.y=warp.y+.5;const before=w.time;expect(w.step(.1).filter(e=>e.t==='warp')).toHaveLength(1);expect(w.time-before).toBeCloseTo(1/60);expect(w.step(.1).filter(e=>e.t==='warp')).toHaveLength(0);});
 test('MVP 擊倒後換圖再回來不會刷新，地面物品保留',()=>{const {w,d}=arena();const boss=w.monsters[0];boss.def={...boss.def,id:'jellyKing',mvp:true,respawn:180,drops:[],cardRate:0};boss.hp=1;w.setStats({...d,atk:9999,range:4},60);w.attack(boss.id);run(w,.1);w.items.push({id:999,kind:'item',defId:'apple',count:1,x:15,y:35,expires:w.time+90,mine:true});w.loadMap('town',24,30);w.loadMap('meadow',4,36);expect(w.monsters.find(m=>m.def.id==='jellyKing')?.state).toBe('dead');expect(w.items.some(i=>i.id===999)).toBe(true);});
 test('MVP 冷卻可匯出並於重載後匯入',()=>{const {w}=arena();expect(typeof w.exportMvpCooldowns).toBe('function');w.importMvpCooldowns({'meadow:jellyKing':Date.now()+100000});w.loadMap('meadow',4,36);expect(w.monsters.find(m=>m.def.id==='jellyKing')?.state).toBe('dead');expect(w.exportMvpCooldowns()['meadow:jellyKing']).toBeGreaterThan(Date.now());});
 test('自動烈焰爆破有近敵才放；單體技能仍可施放',()=>{const {w,m,d}=arena();w.setStats({...d,skillLevels:{magnum:1,bash:1},range:1.6},60);w.autoSkills=['magnum','bash'];w.setAuto(true);m.x=w.player.x+4;expect(run(w,.1).some(e=>e.t==='skill'&&e.skill==='magnum')).toBe(false);m.x=w.player.x+1;expect(run(w,3).some(e=>e.t==='skill'&&e.skill==='magnum')).toBe(true);});
 test('自動元素選招不受熱鍵順序綁定，保留 SP',()=>{const {w,m,d}=arena();m.def={...m.def,element:'water'};w.setStats({...d,skillLevels:{fireBolt:1,lightningBolt:1}},60);w.autoSkills=['fireBolt','lightningBolt'];w.setAuto(true);const e=run(w,1).find(e=>e.t==='skill');expect(e&&e.t==='skill'&&e.skill).toBe('lightningBolt');w.setVitals(10000,255);w.player.cast=null;w.player.pending=null;w.player.afterCastUntil=0;expect(run(w,1).some(e=>e.t==='skill')).toBe(false);});
 test('MDEF 減少魔法普攻；同一 MDEF 不會減少物理普攻',()=>{const damage=(magic:boolean,mdef:number)=>{const {w,m,d}=arena();w.setStats({...d,mdef,def:0,vitDef:0},60);m.def={...m.def,attackType:magic?'magic':'physical',attackElement:magic?'water':'neutral'};m.x=w.player.x+1;m.state='chase';return run(w,.1).find(e=>e.t==='dmg'&&e.to==='p');};const amount=(e:SimEvent|undefined)=>e?.t==='dmg'?e.amount:0;expect(amount(damage(true,50))).toBe(50);expect(amount(damage(true,0))).toBe(100);expect(amount(damage(false,50))).toBe(amount(damage(false,0)));});
});
describe('MVP 可閃避的差異化預警',()=>{
 const boss=(id:string,map:string)=>{const {w,d}=arena(map);const m=w.monsters[0];m.def={...m.def,id,mvp:true,atk:[100,100]};m.state='chase';m.x=w.player.x+3;m.y=w.player.y;m.slamTimer=0;w.setStats(d,60);return {w,m};};
 test('古樹在不同位置形成三個地屬性魔法根區',()=>{const {w}=boss('forestLord','forest');const warns=run(w,.1).filter(e=>e.t==='fx'&&e.kind==='warn');expect(warns).toHaveLength(3);expect(warns.every(e=>e.t==='fx'&&e.element==='earth')).toBe(true);});
 test('冰霜巨像正面重擊有方向預警；側移可避開',()=>{const {w,m}=boss('iceColossus','cave');const warn=run(w,.1).find(e=>e.t==='fx'&&e.kind==='warn');expect(warn?.t==='fx'&&warn.shape).toBe('line');w.player.y+=4;m.state='idle';expect(run(w,1.5).filter(e=>e.t==='dmg'&&e.src==='iceColossus'&&e.amount>0)).toHaveLength(0);});
});
describe('自動選招與冷卻邊界',()=>{
 test('增益維持期間不重放；受控制目標不重複冰封，改用傷害技能',()=>{
  const {w,m,d}=arena();m.rootUntil=20;w.player.concentrate={until:60,pct:.03};w.setStats({...d,skillLevels:{concentrate:1,frostDiver:1,lightningBolt:1}},60);w.autoSkills=['concentrate','frostDiver','lightningBolt'];w.setAuto(true);
  expect(run(w,1).filter(e=>e.t==='skill').map(e=>e.t==='skill'?e.skill:'')).toEqual(['lightningBolt']);
 });
 test('同分單體技能輪替，最前熱鍵不會獨占',()=>{
  const {w,m,d}=arena();m.def={...m.def,element:'neutral'};w.setStats({...d,skillLevels:{fireBolt:1,coldBolt:1}},60);w.autoSkills=['fireBolt','coldBolt'];w.setAuto(true);
  const used=run(w,4).filter(e=>e.t==='skill').map(e=>e.t==='skill'?e.skill:'');expect(used).toContain('fireBolt');expect(used).toContain('coldBolt');
 });
 test('多目標時優先範圍技，冷卻時退回可用單體技',()=>{
  const {w,m,d}=arena();m.x=w.player.x+1;const n={...m,id:888,x:m.x+.2,home:{...m.home},dots:[],path:[]};w.monsters.push(n);w.setStats({...d,skillLevels:{magnum:1,bash:1}},60);w.autoSkills=['bash','magnum'];w.setAuto(true);
  expect(run(w,.2).some(e=>e.t==='skill'&&e.skill==='magnum')).toBe(true);
  m.x=w.player.x+1;m.knock=null;n.x=w.player.x+1;n.knock=null;expect(run(w,1.8).some(e=>e.t==='skill'&&e.skill==='bash')).toBe(true);
 });
 test('超大 dt 不會補算背景數小時；過期保存期限不會阻止 MVP 生成',()=>{const {w}=arena();const before=w.time;w.step(3600);expect(w.time-before).toBeLessThanOrEqual(.101);w.importMvpCooldowns({'meadow:jellyKing':Date.now()-1});w.loadMap('meadow',4,36);expect(w.monsters.find(m=>m.def.id==='jellyKing')?.state).toBe('idle');});
});
