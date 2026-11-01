import {describe,expect,test} from 'vitest';
import {World} from './sim';
import * as R from '../rules/state';
import {MASTERY_TIERS,masteryTier} from '../data/mastery';

const archer=(xp:number)=>{
  let s=R.createCharacter(R.newGame(),'測試',0,0);
  s=R.gainExp(s,0,9e9).state;for(let i=0;i<9;i++)s=R.learnSkill(s,'basic');s=R.changeJob(s,'archer',{});s=R.gainExp(s,5e5,9e9).state;
  for(let i=0;i<5;i++)s=R.learnSkill(s,'doubleStrafe');
  s={...s,mastery:{doubleStrafe:xp}};
  const w=new World(42);w.loadMap('meadow',4,36);const d=R.derive(s);w.setStats(d,s.char.baseLv);w.setVitals(d.maxHp,d.maxSp);
  return {s,w};
};
const run=(w:World,sec:number)=>{const ev=[];for(let i=0;i<sec*60;i++)ev.push(...w.step(1/60));return ev;};

describe('技能熟練度與覺醒',()=>{
  test('施放累積熟練度，跨過門檻時回報升階',()=>{
    let s=R.createCharacter(R.newGame(),'測試',0,0);
    let ups:number[]=[];for(let i=0;i<MASTERY_TIERS[3];i++){const g=R.gainMastery(s,'fireBolt');s=g.state;if(g.tierUp)ups.push(g.tierUp);}
    expect(ups).toEqual([1,2,3]);expect(masteryTier(s.mastery!.fireBolt)).toBe(3);
    expect(R.gainMastery(s,'basic').tierUp).toBeNull();
    expect(()=>R.validateGame({...s,mastery:{nope:3}})).toThrow();
    expect(R.derive(s).mastery.fireBolt).toBe(3);
  });
  test('熟練度降低 SP 消耗',()=>{
    const a=archer(0).w,b=archer(MASTERY_TIERS[3]).w;
    expect(b.spCost('doubleStrafe',5)).toBeLessThan(a.spCost('doubleStrafe',5));
  });
  test('覺醒二連矢射出第三支箭',()=>{
    for(const [xp,arrows] of [[0,2],[MASTERY_TIERS[3],3]] as const){
      const {w}=archer(xp);const m=w.monsters.find(m=>m.def.id==='jelly')!;m.hp=m.maxHp=1e6;
      w.player.x=m.x-3;w.player.y=m.y;if(!w.map.grid.free(w.player.x,w.player.y)){w.player.x=m.x;w.player.y=m.y;}
      expect(w.useSkill('doubleStrafe',m.id,null)).toBe(true);
      const ev=run(w,2);
      expect(ev.filter(e=>e.t==='dmg'&&e.to==='m'&&e.src==='doubleStrafe').length).toBe(arrows);
    }
  });
});
