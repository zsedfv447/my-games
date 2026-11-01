import {expect,it} from 'vitest';
import {gameData} from '../src/data/load';
import {startBattle,resumeBattle,type Battle} from '../src/battle/battle-state';
import {createRng} from '../src/core/rng';
import {boardFromStrings} from '../src/battle/board';
import {computeAttacks} from '../src/battle/damage';
import {evaluateLeaderTurn} from '../src/battle/leader';
import {buffAttackMultipliers} from '../src/battle/skills/buffs';
const stage=gameData.stages.find(s=>s.id==='trial-berserk')!;
const roster=stage.fixedTeam!;
const input=(m:{card:string;level:number})=>({cardId:m.card,level:m.level});
const leaderOf=(id:string)=>gameData.leaderSkills.find(l=>l.id===gameData.cards.find(c=>c.id===id)!.leaderSkill)!;
const leaders=[leaderOf(roster.members[0].card),leaderOf(roster.helper!.card)];
function fixture(low=false){
 const base=startBattle(stage,roster.members.map(input),input(roster.helper!),createRng(42),gameData);const snapshot=base.snapshot();
 // Explicit valid snapshot fixture: ready CD, chosen HP and fixed ordinary board.
 // Not naturally drawn/charged gameplay; real engine handles all subsequent actions.
 snapshot.state.team.forEach(m=>{m.skillCooldown=0;});if(low)snapshot.state.hp=Math.floor(snapshot.state.maxHp*.6);
 snapshot.state.board=boardFromStrings(['fffhhh','wdlgwd','lgwdlg','wdlgwd','lgwdlg']);
 return resumeBattle(stage,snapshot,gameData);
}
function leaderMultipliers(battle:Battle,hpPercent:number){return evaluateLeaderTurn(leaders,{team:battle.getState().team,groups:[],combo:0,hpPercent,skillUsedThisTurn:false}).atkMultipliers;}
function moveWithExpected(battle:Battle,multiplier:number){
 const team=structuredClone(battle.getState().team);let resolvedHp=0;battle.events.on('turnResolved',()=>{resolvedHp=battle.getState().hp;});
 const result=battle.submitMove([{row:0,col:0}]);expect(result.ok).toBe(true);if(!result.ok)throw new Error(result.reason);
 const summary=result.summary;const expected=computeAttacks({team,groups:summary.groups,combo:summary.combo,config:gameData.config.battle,atkMultipliers:team.map(()=>multiplier)});
 expect(expected.length).toBeGreaterThan(0);expect(summary.hits.map(h=>h.hit.amount)).toEqual(expected.map(h=>h.amount));
 return {summary,resolvedHp};
}
it('actual l109 is strictly below70; trial true leader/helper supply discrete 4x rather than a continuous HP scale',()=>{
 expect([roster.members[0].card,roster.helper!.card]).toEqual(['c109','c109']);const b=fixture();
 const one=(hpPercent:number)=>evaluateLeaderTurn([leaderOf('c109')],{team:b.getState().team,groups:[],combo:0,hpPercent,skillUsedThisTurn:false}).atkMultipliers;
 expect(one(70)).toEqual(b.getState().team.map(()=>1));expect(one(69.99)).toEqual(b.getState().team.map(()=>2));
 for(const hp of [100,70])expect(leaderMultipliers(b,hp)).toEqual(b.getState().team.map(()=>1));
 for(const hp of [69.99,60,10])expect(leaderMultipliers(b,hp)).toEqual(b.getState().team.map(()=>4));
});
it('fullHP actual s109 floors30percent of currentHP: not below70, but independent1.5 attack buff applies to this move',()=>{
 const b=fixture(),before=b.getState().hp,max=b.getState().maxHp;expect(before).toBe(max);expect(b.useSkill(0).ok).toBe(true);
 expect(b.getState().hp).toBe(before-Math.floor(before*.3));const percent=b.getState().hp/max*100;expect(percent).toBeGreaterThanOrEqual(70);
 expect(leaderMultipliers(b,percent)).toEqual(b.getState().team.map(()=>1));expect(buffAttackMultipliers(b.getState())).toEqual(b.getState().team.map(()=>1.5));
 moveWithExpected(b,1.5);
});
it('s109 at60percent also spends currentHP not maxHP, combining active1.5 and threshold leader4 independently',()=>{
 const b=fixture(true),before=b.getState().hp,max=b.getState().maxHp;expect(b.useSkill(0).ok).toBe(true);
 expect(b.getState().hp).toBe(before-Math.floor(before*.3));expect(b.getState().hp).not.toBe(before-Math.floor(max*.3));
 expect(leaderMultipliers(b,b.getState().hp/max*100)).toEqual(b.getState().team.map(()=>4));expect(buffAttackMultipliers(b.getState())).toEqual(b.getState().team.map(()=>1.5));
 moveWithExpected(b,6);
});
it('matched-heart recovery crosses70 after pre-heal attack calculation, so this turn still uses leader4',()=>{
 const b=fixture(true),before=b.getState().hp,max=b.getState().maxHp;expect(before/max*100).toBeLessThan(70);
 const {summary,resolvedHp}=moveWithExpected(b,4);expect(summary.groups.some(g=>g.orb==='heart')).toBe(true);expect(summary.heal).toBeGreaterThan(0);expect(resolvedHp).toBe(Math.min(max,before+summary.heal));expect(resolvedHp/max*100).toBeGreaterThan(70);
 // First-wave shields exist: hit.amount is pre-defense calculation, not actual enemy HP loss.
 expect(gameData.enemies.find(e=>e.id===stage.waves[0].enemies[0])!.abilities.some(a=>a.status==='shield')).toBe(true);
});
it('actual c208 healing happens before move and disables below70 leader boost for this attack',()=>{
 const b=fixture(true),before=b.getState().hp,max=b.getState().maxHp;const healer=b.getState().team.findIndex(m=>m.cardId==='c208');expect(healer).toBe(4);expect(b.useSkill(healer).ok).toBe(true);
 expect(b.getState().hp).toBe(Math.min(max,before+Math.floor(max*.25)));expect(b.getState().hp/max*100).toBeGreaterThan(70);expect(leaderMultipliers(b,b.getState().hp/max*100)).toEqual(b.getState().team.map(()=>1));
 moveWithExpected(b,1); // Uses actual resolved groups, including c208's changed heart-skyfall rate.
});
