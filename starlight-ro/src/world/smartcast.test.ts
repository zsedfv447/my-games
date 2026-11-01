import { describe, test, expect } from 'vitest';
import { World, type SimEvent } from './sim';
import * as R from '../rules/state';

const run=(w:World,sec:number)=>{const ev:SimEvent[]=[];for(let i=0;i<Math.round(sec*60);i++)ev.push(...w.step(1/60));return ev;};
function mage(){
  const w=new World(3);w.loadMap('meadow',4,36);const s=R.createCharacter(R.newGame(),'法師',0,0);
  w.setStats({...R.derive(s),maxHp:50000,maxSp:5000,matkMin:5,matkMax:5,skillLevels:{fireBolt:3,thunderStorm:2,lightningBolt:4}},40);w.setVitals(50000,5000);
  const m=w.monsters.find(x=>!x.def.mvp)!;w.monsters=[m];Object.assign(m,{x:w.player.x+4,y:w.player.y,hp:1e6,maxHp:1e6});m.def={...m.def,hp:1e6,aggressive:false};return {w,m};
}
describe('v4.9 技能預約與智慧目標',()=>{
  test('詠唱中再按技能會預約，詠唱完自動放出（不會失敗、不用重點目標）',()=>{
    const {w,m}=mage();expect(w.useSkill('fireBolt',m.id,null)).toBe(true);run(w,.2);expect(w.player.cast).toBeTruthy();
    expect(w.useSkill('fireBolt',m.id,null)).toBe(true);expect(w.player.queued?.skill).toBe('fireBolt');
    const ev=run(w,6);expect(ev.filter(e=>e.t==='skill'&&e.skill==='fireBolt').length).toBe(2);expect(ev.some(e=>e.t==='fail')).toBe(false);
  });
  test('預約只記最新一招；移動會取消預約',()=>{
    const {w,m}=mage();w.useSkill('fireBolt',m.id,null);run(w,.2);w.useSkill('fireBolt',m.id,null);w.useSkill('lightningBolt',m.id,null);
    expect(w.player.queued?.skill).toBe('lightningBolt');w.moveTo(w.player.x-2,w.player.y);expect(w.player.queued).toBeNull();
  });
  test('記住最後打的目標：普攻目標清掉後，技能仍對準牠；沒有目標時選射程內最近的',()=>{
    const {w,m}=mage();w.attack(m.id);w.player.target=null;expect(w.skillTarget(9)?.id).toBe(m.id);
    w.focusId=null;expect(w.skillTarget(9)?.id).toBe(m.id);m.x=w.player.x+30;expect(w.skillTarget(9)).toBeNull();
  });

  test('被追著跑時（沒有目標），技能自動對準正在追你的怪，而不是旁邊閒晃的怪',()=>{
    const {w,m}=mage();const other=w.monsters[0]===m?undefined:w.monsters[0];void other;
    const w2=new World(3);w2.loadMap('meadow',4,36);w2.setStats(w.derived,40);w2.setVitals(50000,5000);
    const [idle,chaser]=w2.monsters.filter(x=>!x.def.mvp).slice(0,2);w2.monsters=[idle,chaser];
    Object.assign(idle,{x:w2.player.x+2,y:w2.player.y,state:'idle'});Object.assign(chaser,{x:w2.player.x-4,y:w2.player.y,state:'chase'});
    w2.focusId=null;w2.player.target=null;expect(w2.skillTarget(9)?.id).toBe(chaser.id);
  });

  test('自動選的目標一定在射程內：遠處的舊目標或追擊者都不會讓角色跑過去',()=>{
    const {w,m}=mage();w.attack(m.id);Object.assign(m,{x:w.player.x+14,y:w.player.y});expect(w.skillTarget(9)).toBeNull();
    m.state='chase';expect(w.skillTarget(9)).toBeNull();Object.assign(m,{x:w.player.x+8});expect(w.skillTarget(9)?.id).toBe(m.id);
  });
});

