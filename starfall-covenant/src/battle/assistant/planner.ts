/** Visible first-clear only: never reads RNG or predicts unknown skyfall. */
import { findMatches, type Board, type Pos } from '../board';
import { applyHits, computeAttacks, computeHeal, incomingDamage, poisonOrbDamage } from '../damage';
import { evaluateLeaderTurn, matchesFilter } from '../leader';
import { buffAttackMultipliers, buffDamageReductions, teamWithRcvToAtk } from '../skills/buffs';
import { attributeSealMultipliers, defenseProfile, enemyAtkMultiplier, enemyHitCount, isHeartSealed, poisonPercent, sealedOrbs } from '../skills/status';
import { breakRingSlots, ringOf } from '../skills/ring';
import type { AssistantForecast, AssistantInput, AssistantPlan, PlannerOptions } from './types';
export type { AssistantInput, AssistantPlan, AssistantForecast, PlannerOptions } from './types';
const ATTRS = ['fire', 'water', 'wood', 'light', 'dark'] as const;
const DIRS = [-1, 0, 1].flatMap(r => [-1, 0, 1].filter(c => r || c).map(c => [r, c]));

export function evaluateAssistantBoard(board: Board, input: AssistantInput): AssistantForecast {
  const { state: s, config, request } = input;
  const groups = findMatches(board, 0, sealedOrbs(s));
  const combo = groups.length, colors = [...new Set(groups.map(g => g.orb))];
  const heartSealed = isHeartSealed(s), team = teamWithRcvToAtk(s, s.team);
  const turn = evaluateLeaderTurn(input.leaders, { team, groups: heartSealed ? groups.filter(g => g.orb !== 'heart') : groups, combo, hpPercent: s.hp / Math.max(1,s.maxHp) * 100, skillUsedThisTurn: input.skillUsedThisTurn ?? false });
  const buffs = buffAttackMultipliers(s), seals = attributeSealMultipliers(s);
  const hits = [...computeAttacks({ team, groups, combo, config, atkMultipliers: turn.atkMultipliers.map((m,i) => m * buffs[i] * seals[i]), ignoreDefense: turn.ignoreDefense }), ...turn.followUps];
  const enemies = s.enemies.map(e => ({ ...e, statuses: e.statuses.map(x => ({ ...x, params: { ...x.params } })) }));
  const targets = () => enemies.map((e,i) => ({ ...defenseProfile(e), hp:e.hp, maxHp:e.maxHp, takenThisTurn: input.takenThisTurn?.[i] }));
  const applied = applyHits(hits, targets(), request.targetEnemy ?? s.target, { combo, config });
  let taken = applied.taken;
  const ringBroken = enemies.map((e,i) => {
    e.hp = applied.hp[i];
    if (e.hp <= 0) return [];
    const attrs = applied.results.filter(r => r.enemy === i && r.damage > 0 && r.hit.attribute && !r.hit.fixed && r.hit.percentMaxHp === undefined).map(r => r.hit.attribute!);
    return breakRingSlots(e, attrs, !heartSealed && colors.includes('heart')).broken;
  });
  // Ring breaking takes effect after the attack batch; subsequent DOT uses the updated defense.
  enemies.forEach((e,i) => {
    if (e.hp <= 0 || !e.dots.length) return;
    const result = applyHits(e.dots.map(d => ({ member:-1, attribute:d.attribute, target:'single' as const, amount:d.amount })), targets().map((t,j) => ({ ...t, takenThisTurn: taken[j] })), i, {combo,config});
    taken = result.taken;
    enemies.forEach((other,j) => {
      other.hp = result.hp[j];
      if(other.hp<=0)return;
      const attrs=result.results.filter(r=>r.enemy===j&&r.damage>0&&r.hit.attribute&&!r.hit.fixed&&r.hit.percentMaxHp===undefined).map(r=>r.hit.attribute!);
      ringBroken[j].push(...breakRingSlots(other,attrs,false).broken);
    });
  });
  const heal = heartSealed ? 0 : computeHeal({ team, groups, combo, config, rcvMultipliers:turn.rcvMultipliers });
  let poisonDamage = poisonOrbDamage(groups,s.maxHp,5);
  const reductions = [...turn.damageReductions,...buffDamageReductions(s)];
  let hp = Math.min(s.maxHp,s.hp+heal), incoming = 0, saves = s.buffs.filter(b => b.kind === 'surviveOnce').length;
  const hurt = (n:number) => { if (hp <= 0) return; hp = Math.max(0,hp-n); if (!hp && saves>0) { hp=1; saves--; } };
  hurt(poisonOrbDamage(groups,s.maxHp,5));
  enemies.forEach(e => { if(e.hp > 0 && e.lockedTurns <= 0 && e.cooldown <= 1) {
    const count = enemyHitCount(e), n = incomingDamage(e.def.atk*enemyAtkMultiplier(e)/count,reductions);
    for(let i=0;i<count && hp>0;i++) { incoming+=n; hurt(n); }
  } });
  if(hp>0){ const tick=Math.floor(s.maxHp*poisonPercent(s)/100); poisonDamage+=tick; hurt(tick); }
  const c = request.constraints ?? {}, warnings = ['僅估算首消；天降與後續連鎖可能改變結果。'];
  if(['damage','auto','maxcombo','combo','heal','chain','enhance','heartgroups'].includes(request.goal))warnings.push('這是搜尋範圍內找到的最佳方案，未保證全域最優。');
  if(board.cells.some(o=>o.hidden)) warnings.push('盤面有隱藏珠，實際顏色不可見；建議先解除隱藏再規劃。');
  if(enemies.some(e=>e.def.abilities.some(a=>a.trigger==='onAttack'||a.trigger==='hpBelow'||a.trigger==='everyNTurns'))) warnings.push('敵人觸發技可能改變傷害或狀態；生存估算不含尚未觸發的技能。');
  if(input.leaders.some(l=>l?.rules.some(r=>r.effects.some(e=>e.type==='matchedOrbSkyfall'))))warnings.push('同色消除生成的額外強化天降珠不計入首消預測；實際連鎖可能增加傷害與 Combo。');
  const heartGroups = groups.filter(g=>g.orb==='heart').length;
  const enhanced = groups.reduce((n,g)=>n+g.enhancedCount,0);
  const colorCount = c.minColorOrbs ? groups.filter(g=>g.orb===c.minColorOrbs!.color).reduce((n,g)=>n+g.cells.length,0) : 0;
  const cleared = (orb:string) => groups.filter(g=>g.orb===orb).reduce((n,g)=>n+g.cells.length,0);
  const allCleared = (orb:string) => cleared(orb)===board.cells.filter(o=>o.type===orb).length;
  const absorbedDamage = enemies.reduce((n,e,i)=>{const limit=defenseProfile(e).damageAbsorb;return n+(limit===undefined?0:Math.max(0,taken[i]-limit)-Math.max(0,(input.takenThisTurn?.[i]??0)-limit));},0);
  const constraintsMet = (c.minCombo===undefined || combo>=c.minCombo) && (c.exactCombo===undefined || combo===c.exactCombo) && (c.requiredColors??[]).every(o=>colors.includes(o)) && !(c.avoidColors??[]).some(o=>colors.includes(o)) && (c.minGroup===undefined || groups.some(g=>(!c.groupColor||g.orb===c.groupColor)&&g.cells.length>=c.minGroup!)) && (!c.enhanced || enhanced>0) && (c.minHeartGroups===undefined || heartGroups>=c.minHeartGroups) && (c.minEnhanced===undefined || enhanced>=c.minEnhanced) && (!c.minColorOrbs || colorCount>=c.minColorOrbs.count) && (c.clearColors??[]).every(allCleared) && (c.minRingBreaks===undefined || ringBroken.flat().length>=c.minRingBreaks) && (!c.avoidAbsorb || absorbedDamage===0);
  if(c.exactCombo!==undefined && c.minCombo!==undefined && c.exactCombo<c.minCombo || (c.requiredColors??[]).some(o=>c.avoidColors?.includes(o))) warnings.push('附加條件互相衝突，無法同時達成。');
  const f:AssistantForecast = {combo,damage:s.enemies.reduce((n,e,i)=>n+e.hp-enemies[i].hp,0),heal,incomingDamage:incoming,poisonDamage,hpAfter:hp,enemyHp:enemies.map(e=>e.hp),colors,goalAchieved:false,constraintsMet,warnings,groups,ringBroken,absorbedDamage};
  f.goalAchieved = constraintsMet && goalProgress(f,input).achieved && !board.cells.some(o=>o.hidden);
  if(request.goal==='star') {
    const star=input.stage?.stars?.[request.starIndex??0];
    if(!star)warnings.push('未指定有效的關卡星章。');
    else if(star.type==='noActiveSkill'&&(s.usedActiveSkill||input.skillUsedThisTurn)||star.type==='noContinue'&&s.continues>0||star.type==='teamAll'&&!team.every(m=>matchesFilter(m,star.filter)))warnings.push('這個星章的既有條件已不符合，轉珠無法補救。');
    else if(star.type==='clearWithinTurns'&&s.turns+1>star.turns)warnings.push('已超過星章回合限制，轉珠無法補救。');
    else if(!(s.wave===s.waveCount-1&&f.enemyHp.length>0&&f.enemyHp.every(h=>h<=0)&&f.hpAfter>0))warnings.push('星章須待整場通關才會正式判定；這裡僅評估目前條件。');
  }
  if(['race','control','skillcycle','fixed','classicbeast'].includes(request.goal))warnings.push('流派效果依目前隊伍、隊長技與狀態結算；轉珠本身不會改變種族、施放技能或賦予追打。');
  if(request.goal==='greek')warnings.push('希臘策略只最佳化首消主屬珠；後續同色強化天降與連鎖不作保證。');
  if(request.goal==='exactcombo'&&c.exactCombo===undefined)warnings.push('請先設定指定 Combo 數。');
  if(!f.goalAchieved) warnings.push('這條路徑尚未達成所有目標；不代表其他路徑一定不可行。');
  if(enemies.some(e=>ringOf(e)?.shattered)) warnings.push('已按攻擊批次後破環，再計算持續傷害。');
  return f;
}

function goalProgress(f:AssistantForecast,input:AssistantInput): {value:number;achieved:boolean} {
  const {state:s,request:r}=input, main=s.team[0]?.attribute ?? 'fire', attrs=[...new Set(s.team.map(m=>m.attribute))];
  const count=(orb:string)=>f.groups.filter(g=>g.orb===orb).reduce((n,g)=>n+g.cells.length,0);
  const hearts=f.groups.filter(g=>g.orb==='heart').length;
  const max=(orb?:string)=>Math.max(0,...f.groups.filter(g=>!orb||g.orb===orb).map(g=>g.cells.length));
  const result=(value:number,achieved=value>0)=>({value,achieved});
  const damageRatio=f.damage*100/Math.max(1,s.enemies.reduce((n,e)=>n+e.hp,0));
  const stageCleared=s.wave===s.waveCount-1&&f.enemyHp.length>0&&f.enemyHp.every(h=>h<=0)&&f.hpAfter>0;
  switch(r.goal){
    case 'norse': {const enhanced=f.groups.filter(g=>g.orb===main).reduce((n,g)=>n+g.enhancedCount,0);return result(count(main)*5+enhanced*20,count(main)>0&&enhanced>0);}
    case 'greek': return result(f.groups.filter(g=>g.orb===main).length*30+count(main)*6,count(main)>=3);
    case 'classicbeast': {const beastAttrs=[...new Set(s.team.filter(m=>m.race==='beast').map(m=>m.attribute))];return result(beastAttrs.filter(a=>f.colors.includes(a)).length*30+f.hpAfter*100/Math.max(1,s.maxHp),beastAttrs.length>0&&beastAttrs.every(a=>f.colors.includes(a))&&f.hpAfter>0);}
    case 'puzzle': { const g=input.puzzle?.goal; if(!g)return result(-1000,false);
      if(g.kind==='combo')return result(f.combo*20,f.combo>=g.combo);
      if(g.kind==='rainbow')return result(f.colors.length*30,f.colors.length>=g.colors);
      if(g.kind==='colorCount')return result(count(g.orb)*10,count(g.orb)>=g.count);
      const left=s.board.cells.filter(o=>o.type===g.orb).length-count(g.orb);return result(-left*30,left===0);
    }
    case 'clearcolor': {const color=r.color??main;const left=s.board.cells.filter(o=>o.type===color).length-count(color);return result(-left*30,left===0);}
    case 'ring': return result(f.ringBroken.flat().length*40);
    case 'absorb': return result(-f.absorbedDamage*100/Math.max(1,s.enemies.reduce((n,e)=>n+e.hp,0)),f.absorbedDamage===0);
    case 'maxcombo': case 'combo': case 'skillcycle': return result(f.combo*20);
    case 'exactcombo': { const n=r.constraints?.exactCombo; return result(n===undefined?-1000:-Math.abs(f.combo-n)*100, n!==undefined&&f.combo===n); }
    case 'color': case 'mono': return result(count(r.color??main)*5);
    case 'rainbow': return result(ATTRS.filter(a=>f.colors.includes(a)).length*30,ATTRS.every(a=>f.colors.includes(a)));
    case 'dual': {const a=attrs.slice(0,2); return result(a.filter(x=>f.colors.includes(x)).length*35,a.length===2&&a.every(x=>f.colors.includes(x)));}
    case 'allattack': return result(f.groups.filter(g=>s.team.some((m,i)=>m.attribute===g.orb&&m.atk>0&&attributeSealMultipliers(s)[i]>0)&&g.cells.length>=input.config.fullAttackOrbCount).length*40);
    case 'chain': return result(max(main)*8,max(main)>=(r.constraints?.minGroup??6));
    case 'enhance': return result(f.groups.reduce((n,g)=>n+g.enhancedCount,0)*20);
    case 'heartgroups': case 'heart': case 'fixed': return result(hearts*40);
    case 'race': return result(attrs.filter(a=>f.colors.includes(a)).length*25,attrs.every(a=>f.colors.includes(a)));
    case 'avoidcolor': {const a=r.constraints?.avoidColors??(r.color?[r.color]:[]); return result(-a.reduce((n,o)=>n+count(o),0)*100,a.length>0&&a.every(o=>!f.colors.includes(o)));}
    case 'poison': return result(-f.poisonDamage*100/Math.max(1,s.maxHp),f.poisonDamage===0);
    case 'heal': return result(Math.min(f.heal,s.maxHp-s.hp)*200/Math.max(1,s.maxHp),Math.min(f.heal,s.maxHp-s.hp)>0);
    case 'survive': case 'control': return result(f.hpAfter*200/Math.max(1,s.maxHp),f.hpAfter>0);
    case 'stall': return result(f.hpAfter*150/Math.max(1,s.maxHp)-f.damage*100/Math.max(1,s.enemies.reduce((n,e)=>n+e.hp,0)),f.hpAfter>0&&f.enemyHp.some(h=>h>0));
    case 'target': {const i=r.targetEnemy??s.target; return result(((s.enemies[i]?.hp??0)-(f.enemyHp[i]??0))*100/Math.max(1,s.enemies[i]?.hp??1),!!s.enemies[i]&&f.enemyHp[i]<=0);}
    case 'star': {const star=input.stage?.stars?.[r.starIndex??0]; if(!star)return result(-1000,false); switch(star.type){
      case 'maxCombo': return result(f.combo*20,stageCleared&&Math.max(s.maxCombo,f.combo)>=star.combo);
      case 'noActiveSkill': return result(damageRatio,stageCleared&&!s.usedActiveSkill&&!input.skillUsedThisTurn);
      case 'noContinue': return result(damageRatio,stageCleared&&s.continues===0);
      case 'teamAll': return result(damageRatio,stageCleared&&s.team.every(m=>matchesFilter(m,star.filter)));
      case 'clearWithinTurns': return result(damageRatio,stageCleared&&s.turns+1<=star.turns);
    }}
    case 'berserk': return result(f.damage/Math.max(1,s.maxHp)-(f.heal/Math.max(1,s.maxHp))*30,f.damage>0&&f.hpAfter>0);
    default:return result(f.damage*100/Math.max(1,s.enemies.reduce((n,e)=>n+e.hp,0)),f.damage>0);
  }
}
function score(f:AssistantForecast,input:AssistantInput):number {
  const c=input.request.constraints??{};
  const deficit = Math.max(0,(c.minCombo??0)-f.combo)*30 + (c.exactCombo===undefined?0:Math.abs(f.combo-c.exactCombo)*50) + (c.requiredColors??[]).filter(o=>!f.colors.includes(o)).length*40 + (c.avoidColors??[]).filter(o=>f.colors.includes(o)).length*80 + (c.minGroup===undefined?0:Math.max(0,c.minGroup-Math.max(0,...f.groups.filter(g=>!c.groupColor||g.orb===c.groupColor).map(g=>g.cells.length)))*10) + (c.enhanced&&!f.groups.some(g=>g.enhancedCount)?40:0);
  const extraDeficit = (c.clearColors??[]).reduce((n,o)=>n+Math.max(0,input.state.board.cells.filter(v=>v.type===o).length-f.groups.filter(g=>g.orb===o).reduce((a,g)=>a+g.cells.length,0))*20,0) + Math.max(0,(c.minRingBreaks??0)-f.ringBroken.flat().length)*40 + (c.avoidAbsorb?f.absorbedDamage/Math.max(1,input.state.maxHp)*100:0) + Math.max(0,(c.minHeartGroups??0)-f.groups.filter(g=>g.orb==='heart').length)*40 + Math.max(0,(c.minEnhanced??0)-f.groups.reduce((n,g)=>n+g.enhancedCount,0))*15 + (!c.minColorOrbs?0:Math.max(0,c.minColorOrbs.count-f.groups.filter(g=>g.orb===c.minColorOrbs!.color).reduce((n,g)=>n+g.cells.length,0))*10);
  return Math.max(-500,Math.min(500,goalProgress(f,input).value)) + (f.constraintsMet?10000:0) + (f.goalAchieved?1000:0) - deficit - extraDeficit + f.combo*.3 + (input.request.goal==='auto'?f.hpAfter/Math.max(1,input.state.maxHp)*60:0) - (f.hpAfter<=0?20000:0);
}
export function planAssistantMove(input:AssistantInput,options:PlannerOptions={}):AssistantPlan {
  const s=input.state, board=s.board, start=performance.now(), budget=Math.max(1,options.timeBudgetMs??1200);
  const maxSteps=Math.max(0,Math.min(60,Math.floor(options.maxSteps??24),input.puzzle?.maxSteps??Infinity,Math.floor(s.moveTimeSeconds*(options.stepsPerSecond??4))));
  type Node={cells:Board['cells'];path:Pos[];forecast:AssistantForecast;score:number};
  let examined=0,timedOut=false;
  const make=(cells:Board['cells'],path:Pos[]):Node=>{const forecast=evaluateAssistantBoard({...board,cells},input);examined++;return{cells,path,forecast,score:score(forecast,input)};};
  const original=make(board.cells,[]);
  let beam:Node[]=board.cells.flatMap((o,i)=>o.locked?[]:[{...original,path:[{row:Math.floor(i/board.cols),col:i%board.cols}]}]);
  let best:Node|undefined;
  for(let depth=0;depth<maxSteps;depth++){
    const next:Node[]=[],seen=new Set<string>();
    for(const node of beam){
      const p=node.path[node.path.length-1],prev=node.path[node.path.length-2];
      for(const [dr,dc] of DIRS){
        const to={row:p.row+dr,col:p.col+dc};
        if(to.row<0||to.row>=board.rows||to.col<0||to.col>=board.cols||prev&&to.row===prev.row&&to.col===prev.col)continue;
        const a=p.row*board.cols+p.col,b=to.row*board.cols+to.col;
        if(node.cells[b].locked)continue;
        const cells=node.cells.slice();[cells[a],cells[b]]=[cells[b],cells[a]];
        const key=b+':'+cells.map(o=>o.type+Number(o.enhanced)+Number(o.poison)).join(',');
        if(seen.has(key))continue;seen.add(key);
        const child=make(cells,[...node.path,to]);next.push(child);
        if(!best||child.score>best.score)best=child;
        if(performance.now()-start>=budget){timedOut=true;break;}
      }
      if(timedOut)break;
    }
    if(!next.length||timedOut)break;
    next.sort((a,b)=>b.score-a.score);beam=next.slice(0,Math.max(1,Math.min(128,options.beamWidth??36)));
  }
  const chosen=best??beam[0]??original;
  if(chosen.path.length<2)chosen.forecast.warnings.push('目前沒有可用的移動路徑，請檢查鎖珠與轉珠步數。');
  if(timedOut)chosen.forecast.warnings.push('已達搜尋時間上限，這是目前找到的最佳路徑。');
  return{path:chosen.path,forecast:chosen.forecast,score:chosen.score,examined,timedOut};
}
