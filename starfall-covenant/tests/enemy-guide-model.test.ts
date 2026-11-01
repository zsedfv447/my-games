import { expect, it } from 'vitest';
import { enemyGuide } from '../src/ui/enemy-info';
import { abilityText, stageIntel } from '../src/ui/stage-intel';
import { defeatAdvice } from '../src/ui/defeat-advice';
import { gameData } from '../src/data/load';
import { startBattle } from '../src/battle/battle-state';
import { createRng } from '../src/core/rng';
import type { ActiveSkillDef, StatusId } from '../src/core/types';
const stage=gameData.stages.find(s=>s.id==='st-2-6')!;
const skills=Object.fromEntries(gameData.skills.map(s=>[s.id,s]));
const state=()=>startBattle({...stage,waves:[{enemies:['e0008']}]},[{cardId:'c307',level:1}],null,createRng(26),gameData).getState();
const text=(s=state(), map=skills)=>enemyGuide(s,0,map).sections.flatMap(x=>[x.title,...x.lines]).join('\n');
it('actual permanent absorption uses20000 per-enemy cumulative post-defense rule and explicit no budget/no guaranteed kill',()=>{
 const s=state(),before=structuredClone(s),copy=structuredClone(skills),t=text(s);
 expect(t).toContain('20,000'); expect(t).toContain('永久'); expect(t).toContain('每個敵人'); expect(t).toContain('本回合累積'); expect(t).toContain('防禦'); expect(t).toContain('超過'); expect(t).toContain('回復'); expect(t).toContain('不是復活');
 expect(t).toContain('固定'); expect(t).toContain('百分比'); expect(t).toContain('無視護盾'); expect(t).toContain('無視防禦'); expect(t).toContain('不保證擊殺'); expect(t).toContain('剩餘額度'); expect(t).not.toContain('單次超過');
 expect(s).toEqual(before); expect(skills).toEqual(copy);
});
it('trigger history does not imply active blocker: expired/absent absorb hides methods and retains safe explanation',()=>{
 const s=state();s.enemies[0].statuses=[];s.enemies[0].triggered=[0];
 expect(text(s)).not.toContain('20,000'); expect(text(s)).not.toContain(skills.s307.description);
 expect(enemyGuide(s,999,skills)).toEqual({sections:[]}); expect(enemyGuide(s,-1,skills)).toEqual({sections:[]});
 s.enemies[0].statuses=[{id:'damageAbsorb',value:20000,turns:0}]; expect(text(s)).not.toContain('20,000');
});
it('current active defense values/durations, rotating attribute and ring state are factual',()=>{
 const s=state();s.enemies[0].turnsOnField=1;s.enemies[0].statuses=[{id:'comboShield',value:6,turns:2},{id:'shield',value:80,turns:1},{id:'attributeShield',value:50,turns:null,params:{attribute:'rotate'}},{id:'ringShield',value:75,turns:null,params:{slots:'fire,heart',broken:'fire',vulnerable:2}}];
 const t=text(s);for(const v of ['6 Combo','剩餘 2 回合','80%','剩餘 1 回合','50%','潮','75%','心','固定與百分比傷害不能破環'])expect(t).toContain(v);
});
it('only direct fixed/percent/ignoreShield damage methods appear with original descriptions, cooldowns and actual seals',()=>{
 const s=state();const base=s.team[0];s.team=Array.from({length:4},(_,i)=>({...structuredClone(base),index:i,card:{...structuredClone(base.card),id:`test${i}`,name:`成員${i}`,activeSkill:`test${i}`},skillCooldown:i===0?0:3}));
 const make=(id:string,e:ActiveSkillDef['effects'][number]):ActiveSkillDef=>({id,name:id,description:`原文${id}`,cooldown:{max:8,min:5},effects:[e]});
 const map={test0:make('test0',{type:'damage',target:'single',mode:'fixed',value:15000}),test1:make('test1',{type:'damage',target:'single',mode:'percentMaxHp',value:10}),test2:make('test2',{type:'damage',target:'single',mode:'multiplier',value:2,ignoreShield:true}),test3:make('test3',{type:'damage',target:'single',mode:'multiplier',value:2,ignoreDefense:true})};
 const t=text(s,map); for(const id of ['test0','test1','test2'])expect(t).toContain(`原文${id}`);expect(t).not.toContain('原文test3');expect(t).toContain('CD 0');expect(t).toContain('CD 3');
 s.teamStatuses=[{id:'skillSeal',turns:1},{id:'attributeSeal',turns:1,params:{attribute:'leader'}}];expect(text(s,map)).toContain('技能封印');expect(text(s,map)).toContain('星紋封印');
});
it('missing/nonfinite thresholds and unknown statuses remain explicitly unknown; no invented source method',()=>{
 const s=state();s.enemies[0].statuses=[{id:'damageAbsorb',turns:null},{id:'alien' as StatusId,value:NaN,turns:2}];
 const t=text(s,{});expect(t).toContain('未知'); expect(t).not.toContain('NaN');expect(t).not.toContain('Infinity');expect(t).not.toContain('20,000');
});
it('stage and defeat copy describe cumulative turn absorption, not single-hit safe damage',()=>{
 const ability=gameData.enemies.find(e=>e.id==='e0008')!.abilities[0];expect(abilityText(ability)).toContain('本回合累積');expect(abilityText(ability)).not.toContain('單次');
 const intel=stageIntel(stage,gameData.enemies,gameData.config.battle);
 const tips=defeatAdvice({stage,intel,members:[],hasHelper:true,helperAllowed:true,primaryArchetype:null,archetypeName:id=>id}).map(a=>a.text).join('\n');
 expect(tips).toContain('本回合累積');expect(tips).not.toContain('單次傷害');expect(tips).not.toContain('上限附近');
});
it('bounded ordinary counterplay and permanent duration do not promise safe combos or waiting expiry',()=>{
 const t=text();for(const part of ['避免增傷爆發','分回合削血','希臘天降與追打','少 Combo 不保證安全','CD 與封印','不會隨回合自然消失'])expect(t).toContain(part);
});
it('known omitted shield value follows actual100 default and ring heart advice discloses heart seal',()=>{
 const s=state();s.enemies[0].statuses=[{id:'shield',turns:2},{id:'ringShield',value:75,turns:null,params:{slots:'fire,heart',broken:'fire',vulnerable:2}}];
 s.teamStatuses=[{id:'heartSeal',turns:1}];const t=text(s);expect(t).toContain('目前護盾減傷：100%');expect(t).toContain('心珠封印會阻止破除心格');
});
