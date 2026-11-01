import {expect,it} from 'vitest';
import {gameData} from '../src/data/load';
import {startBattle,resumeBattle} from '../src/battle/battle-state';
import {createRng} from '../src/core/rng';
import {evaluateLeaderTurn} from '../src/battle/leader';
import {teamWithRcvToAtk,tickBuffs} from '../src/battle/skills/buffs';
import type {MatchGroup} from '../src/battle/board';
const input=(m:{card:string;level:number})=>({cardId:m.card,level:m.level});
const trial=(id:string)=>{const stage=gameData.stages.find(s=>s.id===`trial-${id}`)!,roster=stage.fixedTeam!;return startBattle(stage,roster.members.map(input),input(roster.helper!),createRng(22),gameData);};
const leader=(id:string)=>gameData.leaderSkills.find(l=>l.id===id)!;
function ready(ids:string[]){
 const stage=gameData.stages.find(s=>s.id==='st-1-1')!;const initial=startBattle(stage,ids.map(cardId=>({cardId,level:1})),null,createRng(123),gameData);const snapshot=initial.snapshot();
 // Explicit ready-CD fixture for effect existence, not naturally charged gameplay.
 snapshot.state.team.forEach(m=>{m.skillCooldown=0;});return resumeBattle(stage,snapshot,gameData);
}
it('actual race trial l311 targets each sylph at2x for one or six members; different race receives1x',()=>{
 const state=trial('race').getState();expect(state.team).toHaveLength(6);expect(state.team.every(m=>m.race==='sylph')).toBe(true);
 const calc=(team:typeof state.team)=>evaluateLeaderTurn([leader('l311')],{team,groups:[],combo:0,hpPercent:100,skillUsedThisTurn:false}).atkMultipliers;
 expect(calc(state.team.slice(0,1))).toEqual([2]);expect(calc(state.team)).toEqual([2,2,2,2,2,2]);
 const mixed=ready(['c311','c206']).getState();expect(calc(mixed.team)).toEqual([2,1]);
});
it('actual heart borrowed team has no innate rcvToAtk; its actual dual leader scales by heart groups',()=>{
 const state=trial('heart').getState();expect([state.team[0].cardId,state.team.at(-1)!.cardId]).toEqual(['c306','c306']);expect(teamWithRcvToAtk(state,state.team)).toBe(state.team);
 for(const m of state.team){const skill=gameData.skills.find(s=>s.id===m.card.activeSkill)!;expect(skill.effects.some(e=>e.type==='rcvToAtk')).toBe(false);}
 const multipliers=[0,1,2].map(n=>{const groups:MatchGroup[]=Array.from({length:n},(_,i)=>({orb:'heart',cells:[i*6,i*6+1,i*6+2],enhancedCount:0,poisonCount:0,cascade:0}));expect(new Set(groups.flatMap(g=>g.cells)).size).toBe(n*3);return evaluateLeaderTurn([leader('l306'),leader('l306')],{team:state.team,groups,combo:n,hpPercent:100,skillUsedThisTurn:false}).atkMultipliers;});
 expect(multipliers).toEqual([1,4,6.25].map(n=>state.team.map(()=>n)));
});
it('actual skillcycle borrowed roster has six zero-hit ready casts, no chain buff, and nonzero cooldowns afterwards',()=>{
 const battle=trial('skillcycle');expect(battle.getState().team.every(m=>m.skillCooldown===0)).toBe(true);const hits:number[]=[];
 for(let i=0;i<6;i++){const result=battle.useSkill(i);expect(result.ok).toBe(true);if(!result.ok)throw new Error(result.reason);hits.push(result.skill.hits.length);}
 expect(hits).toEqual([0,0,0,0,0,0]);expect(battle.getState().buffs.some(b=>b.kind==='chainOnSkill')).toBe(false);expect(battle.getState().team.map(m=>m.skillCooldown)).toEqual([7,7,8,9,7,9]);
 const repeat=battle.useSkill(0);expect(repeat.ok).toBe(false);if(!repeat.ok)expect(repeat.reason).toContain('冷卻');
});
it('positive actual s301 buff adds2x recovery to derived attack only while its two-turn buff remains',()=>{
 const battle=ready(['c301','c106']);const before=battle.getState();expect(teamWithRcvToAtk(before,before.team)).toBe(before.team);
 const result=battle.useSkill(0);expect(result.ok).toBe(true);if(!result.ok)throw new Error(result.reason);expect(result.skill.skillId).toBe('s301');expect(result.skill.hits).toEqual([]);
 const active=battle.getState();expect(active.buffs).toContainEqual({kind:'rcvToAtk',ratio:2,turns:2});
 expect(teamWithRcvToAtk(active,active.team).map(m=>m.atk)).toEqual(active.team.map(m=>m.atk+m.rcv*2));expect(active.team.map(m=>m.atk)).toEqual(before.team.map(m=>m.atk));
 // Direct real buff ticking is isolated expiry evidence, not a claimed full battle turn.
 const expired=structuredClone(active);expired.buffs=tickBuffs(tickBuffs(expired.buffs));expect(teamWithRcvToAtk(expired,expired.team)).toBe(expired.team);
});
it.each([['c403','s403',5],['c505','s505',3],['c512','s512',3]] as const)('positive actual %s starts chain without chasing itself; later converter triggers it', (id,skillId,multiplier)=>{
 const battle=ready([id,'c106']);const atk=battle.getState().team[0].atk;const activated=battle.useSkill(0);expect(activated.ok).toBe(true);if(!activated.ok)throw new Error(activated.reason);
 expect(activated.skill.skillId).toBe(skillId);expect(activated.skill.hits).toEqual([]);expect(battle.getState().buffs.some(b=>b.kind==='chainOnSkill')).toBe(true);
 const subsequent=battle.useSkill(1);expect(subsequent.ok).toBe(true);if(!subsequent.ok)throw new Error(subsequent.reason);
 expect(subsequent.skill.hits).toHaveLength(1);expect(subsequent.skill.hits[0].hit).toMatchObject({member:0,target:'single',amount:atk*multiplier});
 // Above is pre-defense hit.amount, not promised actual HP loss (first wave shields exist).
});
