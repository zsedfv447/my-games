import { describe, test, expect } from 'vitest';
import { World, type SimEvent } from './sim';
import * as R from '../rules/state';

const run=(w:World,sec:number)=>{const ev:SimEvent[]=[];for(let i=0;i<Math.round(sec*60);i++)ev.push(...w.step(1/60));return ev;};
function field(role:'guard'|'priest'|'hunter',mode?:'guard'|'assist'|'support'){
  const w=new World(4);w.loadMap('meadow',4,36);const s=R.createCharacter(R.newGame(),'隊長',0,0);
  w.setStats({...R.derive(s),maxHp:9999,atk:5,weaponAtk:5},20);w.setVitals(9999,100);w.setAlly(role,20,mode);
  const m=w.monsters.find(x=>!x.def.mvp)!;w.monsters=[m];Object.assign(m,{x:w.player.x+3,y:w.player.y,hp:1e6,maxHp:1e6});m.def={...m.def,hp:1e6};return {w,m};
}
describe('v4.9 傭兵指令',()=>{
  test('預設：祭司是支援、劍士是守護、獵人是協助',()=>{
    expect(field('priest').w.ally!.mode).toBe('support');expect(field('guard').w.ally!.mode).toBe('guard');expect(field('hunter').w.ally!.mode).toBe('assist');
  });
  test('支援模式的祭司不會攻擊，所以怪不會轉去打她',()=>{
    const {w,m}=field('priest','support');w.attack(m.id);const ev=run(w,6);
    expect(ev.some(e=>e.t==='swing'&&e.who==='a')).toBe(false);expect((m.aggroAlly??0)>w.time).toBe(false);
  });
  test('協助模式的祭司會攻擊你的目標',()=>{
    const {w,m}=field('priest','assist');w.attack(m.id);const ev=run(w,6);expect(ev.some(e=>e.t==='swing'&&e.who==='a')).toBe(true);
  });
  test('血量低於 35% 會撤退並讓怪失去興趣，回到 60% 再參戰',()=>{
    const {w,m}=field('guard','guard');const a=w.ally!;m.aggroAlly=w.time+10;a.hp=a.maxHp*.3;a.hurtAt=w.time;
    const ev=run(w,.2);expect(a.retreating).toBe(true);expect(ev.some(e=>e.t==='ally'&&e.kind==='retreat')).toBe(true);expect((m.aggroAlly??0)>w.time).toBe(false);
    a.hp=a.maxHp*.65;run(w,.2);expect(a.retreating).toBe(false);
  });
  test('指令會存檔，未雇用的傭兵不能下指令',()=>{
    let s=R.createCharacter(R.newGame(),'隊長',0,0);expect(()=>R.setCompanionMode(s,'priest','assist')).toThrow();
    s={...s,mercs:{hired:['priest'],active:'priest'}};s=R.setCompanionMode(s,'priest','assist');expect(s.mercs!.modes!.priest).toBe('assist');expect(()=>R.validateGame(s)).not.toThrow();
  });
});
