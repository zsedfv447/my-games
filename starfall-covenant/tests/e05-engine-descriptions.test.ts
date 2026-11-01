import { describe, expect, it } from 'vitest';
import { gameData } from '../src/data/load';
import { startBattle, resumeBattle } from '../src/battle/battle-state';
import { applyActiveSkill } from '../src/battle/skills/active';
import { buffAttackMultipliers } from '../src/battle/skills/buffs';
import { evaluateLeaderStatic, evaluateLeaderTurn } from '../src/battle/leader';
import { boardFromStrings, type MatchGroup } from '../src/battle/board';
import { damageAgainst } from '../src/battle/damage';
import { createRng } from '../src/core/rng';
import type { EnemyAbility, OrbType } from '../src/core/types';

function fixture(ids: string[], abilities: EnemyAbility[] = [], atk = 1, cd = 99, enemyCount = 2) {
  const stage={...gameData.stages[0],id:'e05-fixture',waves:[{enemies:Array(enemyCount).fill('e05-enemy')}]};
  const data={...gameData,enemies:[{...gameData.enemies[0],id:'e05-enemy',hp:1000000,atk,def:999999,cd,abilities}]};
  const initial=startBattle(stage,ids.map(cardId=>({cardId,level:1})),null,createRng(55),data);
  const snap=initial.snapshot(); snap.state.team.forEach(m=>{if(m.skillCooldown!==null)m.skillCooldown=0;});
  snap.state.board=boardFromStrings(['FWLDHF','WLDHFW','LDHFWL','DHFWLD','HFWLDH']);
  return { battle:resumeBattle(stage,snap,data),stage,data };
}
const skill=(id:string)=>gameData.skills.find(s=>s.id===id)!;
const leader=(id:string)=>gameData.leaderSkills.find(l=>l.id===id)!;
const group=(orb:OrbType):MatchGroup=>({orb,cells:[0,1,2],enhancedCount:0,poisonCount:0,cascade:0});

describe('E05 actual standalone active-skill descriptions',()=>{
  it.each([['s103',50,2],['s110',30,1.5]] as const)('%s costs CURRENT HP and has one-turn team multiplier, never self-kills', (id,percent,multiplier)=>{
    for(const hp of [1,2,1000]) {
      const state=fixture(['c103','c110','c205']).battle.getState(); state.maxHp=10000; state.hp=hp;
      const beforeWater=state.board.cells.filter(o=>o.type==='water').length;
      const result=applyActiveSkill(state,id==='s103'?0:1,skill(id),createRng(2));
      const loss=Math.min(Math.floor(hp*percent/100),hp-1);
      expect(result.selfDamage).toBe(loss); expect(state.hp).toBe(hp-loss); expect(state.hp).toBeGreaterThanOrEqual(1);
      expect(buffAttackMultipliers(state)).toEqual([multiplier,multiplier,multiplier]);
      expect(state.buffs.find(b=>b.kind==='attack')).toMatchObject({turns:1,multiplier});
      if(id==='s103') { expect(beforeWater).toBeGreaterThan(0); expect(state.board.cells.some(o=>o.type==='water')).toBe(false); }
      else expect(state.buffs.find(b=>b.kind==='surviveOnce')).toMatchObject({turns:1});
    }
  });
  it('s110 protection expires after one turn if unused, alongside attack buff',()=>{
    const {battle}=fixture(['c110']); expect(battle.useSkill(0).ok).toBe(true);
    expect(battle.getState().buffs.some(b=>b.kind==='surviveOnce')).toBe(true);
    expect(battle.submitMove([]).ok).toBe(true);
    expect(battle.getState().buffs.some(b=>b.kind==='surviveOnce'||b.kind==='attack')).toBe(false);
  });
  it('actual s110 survives one lethal hit, but not the rest of a multi-hit attack',()=>{
    const single=fixture(['c110'],[],2000000,1,1).battle;
    expect(single.useSkill(0).ok).toBe(true);
    const r=single.submitMove([]); expect(r.ok).toBe(true);
    if(r.ok) expect(r.enemyAttacks[0].survived).toBe(true);
    expect(single.getState().phase).toBe('player'); expect(single.getState().hp).toBe(1);
    const multi=fixture(['c110'],[{status:'multiHit',trigger:'onStart',value:2}],2000000,1).battle;
    expect(multi.useSkill(0).ok).toBe(true); const m=multi.submitMove([]);
    expect(m.ok).toBe(true); if(m.ok) expect(m.enemyAttacks[0].survived).toBe(true);
    expect(multi.getState().phase).toBe('lost');
    expect(multi.getState().buffs.some(b=>b.kind==='surviveOnce')).toBe(false);
  });
  it('s205 converts fire→water and dark→light BEFORE enhancing all both colors',()=>{
    const state=fixture(['c205']).battle.getState(); state.board.cells.forEach(o=>{o.enhanced=false;}); const before=state.board.cells.map(o=>o.type);
    applyActiveSkill(state,0,skill('s205'),createRng(2));
    state.board.cells.forEach((o,i)=>{
      expect(o.type).toBe(before[i]==='fire'?'water':before[i]==='dark'?'light':before[i]);
      expect(o.enhanced).toBe(o.type==='water'||o.type==='light');
    });
  });
  it('actual s305 deals50000 to ALL shielded/high-defense enemies, heals15% maxHP, dark→heart',()=>{
    const {battle,stage,data}=fixture(['c305'],[{status:'shield',trigger:'onStart',value:100}]);
    const snap=battle.snapshot();snap.state.maxHp=10000;snap.state.hp=1000;
    const ready=resumeBattle(stage,snap,data); const before=ready.getState();
    expect(before.board.cells.some(o=>o.type==='dark')).toBe(true);
    expect(ready.useSkill(0).ok).toBe(true);const after=ready.getState();
    expect(after.enemies.map((e,i)=>before.enemies[i].hp-e.hp)).toEqual([50000,50000]);
    expect(after.hp).toBe(2500);expect(after.board.cells.some(o=>o.type==='dark')).toBe(false);
    const emitted=applyActiveSkill(structuredClone(before),0,skill('s305'),createRng(2));
    expect(emitted.hits[0]).toMatchObject({target:'all',fixed:true,amount:50000,ignoreShield:true});
    expect(damageAgainst(emitted.hits[0],{attribute:'fire',def:999999,ringReduction:100,shieldPercent:100},{combo:0,config:gameData.config.battle})).toBe(50000);
  });
  it('s410 reduces only other members by1, caster begins its own normal cooldown',()=>{
    const {battle,stage,data}=fixture(['c410','c103','c205']);const snap=battle.snapshot();
    snap.state.team[1].skillCooldown=3;snap.state.team[2].skillCooldown=0;
    const ready=resumeBattle(stage,snap,data);expect(ready.useSkill(0).ok).toBe(true);
    expect(ready.getState().team.map(m=>m.skillCooldown)).toEqual([skill('s410').cooldown.max,2,0]);
  });
});

describe('E05 actual leader conditions and static effects',()=>{
  const team=()=>fixture(['c205','c403','c103']).battle.getState().team;
  it('l205 needs BOTH water/light and applies4x to whole team; HP1.3 only water/light',()=>{
    const members=team();
    expect(evaluateLeaderStatic([leader('l205')],members).hpMultipliers).toEqual([1.3,1.3,1]);
    for(const colors of [[],['water'],['light'],['water','fire'],['water','light']] as OrbType[][]) {
      const result=evaluateLeaderTurn([leader('l205')],{team:members,groups:colors.map(group),combo:colors.length,hpPercent:100,skillUsedThisTurn:false});
      expect(result.atkMultipliers).toEqual(Array(3).fill(colors.includes('water')&&colors.includes('light')?4:1));
    }
  });
  it('l403 charges all at start, applies3.5x only in skill-used turns, and grants extra1 cooldown per turn',()=>{
    const members=team();const ls=leader('l403'); const stat=evaluateLeaderStatic([ls],members);
    expect(stat.skillsStartCharged).toBe(true);expect(stat.allyCooldownPerTurn).toBe(1);
    for(const used of [false,true]) expect(evaluateLeaderTurn([ls],{team:members,groups:[],combo:0,hpPercent:100,skillUsedThisTurn:used}).atkMultipliers).toEqual(Array(3).fill(used?3.5:1));
    const {stage,data}=fixture(['c403','c103','c205']);
    const start=startBattle(stage,[{cardId:'c403',level:1},{cardId:'c103',level:1},{cardId:'c205',level:1}],null,createRng(4),data);
    expect(start.getState().team.map(m=>m.skillCooldown)).toEqual([0,0,0]);
    const snap=start.snapshot();snap.state.team.forEach(m=>{m.skillCooldown=5;});
    const ready=resumeBattle(stage,snap,data);expect(ready.submitMove([]).ok).toBe(true);
    expect(ready.getState().team.map(m=>m.skillCooldown)).toEqual([3,3,3]); // natural1 + extra1
  });
  it('l403 zero cooldown does not override team skill sealing',()=>{
    const {stage,data}=fixture(['c403'],[{status:'skillSeal',trigger:'onStart',turns:3}]);
    const battle=startBattle(stage,[{cardId:'c403',level:1}],null,createRng(4),data);
    expect(battle.getState().team[0].skillCooldown).toBe(0);
    expect(battle.useSkill(0).ok).toBe(false);
  });
});
