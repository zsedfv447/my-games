// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { gameData } from '../src/data/load';
import { startBattle } from '../src/battle/battle-state';
import { createRng } from '../src/core/rng';
import { countOrbs } from '../src/battle/board';
import { applyActiveSkill } from '../src/battle/skills/active';
import type { ActiveSkillDef, OrbType } from '../src/core/types';
import { conversionPreview, conversionPreviewView } from '../src/ui/skill-conversion-preview';

function fixture() {
  const stage = gameData.stages[0];
  const battle = startBattle(stage, [{ cardId: 'c710', level: 1 }], null, createRng(123), gameData);
  const state = battle.getState(); state.team[0].skillCooldown = 0;
  const types: OrbType[] = [...Array(6).fill('light'), ...Array(5).fill('wood'), ...Array(4).fill('fire'), ...Array(6).fill('heart'), ...Array(9).fill('water')];
  state.board.cells = types.map(type => ({ type, enhanced: false, locked: false, poison: false, hidden: false }));
  const skill = gameData.skills.find(s => s.id === state.team[0].card.activeSkill)!;
  return { state, skill, battle };
}
const custom = (effects: ActiveSkillDef['effects']): ActiveSkillDef => ({ id: 'test', name: '轉珠', description: '說明', cooldown: {min: 1, max: 1}, effects });
describe('E02 conservative conversion-only preview', () => {
  it('c710 sequential counts match real apply and never mutate source state/RNG', () => {
    const { state, skill } = fixture(); const before = JSON.stringify(state);
    const p = conversionPreview(state, 0, skill)!;
    expect(p?.after.light).toBe(11); expect(p.after.dark).toBe(4); expect(p.after.heart).toBe(6);
    expect(JSON.stringify(state)).toBe(before);
    const actual = structuredClone(state); const rng = createRng(456); const rngBefore = rng.state!();
    applyActiveSkill(actual, 0, skill, rng);
    expect(p.after).toEqual(countOrbs(actual.board)); expect(rng.state!()).toBe(rngBefore);
  });
  it('heart zero warning, no-source no-change, and overlapping sequential sources', () => {
    const { state } = fixture();
    const heart = conversionPreviewView(state, 0, custom([{type:'convertOrbs',from:'heart',to:'dark'}]))!;
    expect(heart).not.toBeNull(); expect(heart?.textContent).toContain('心珠將變為 0');
    const noSource = conversionPreview(state, 0, custom([{type:'convertOrbs',from:'dark',to:'fire'}]))!;
    expect(noSource?.changed).toBe(false);
    const seq = conversionPreview(state, 0, custom([{type:'convertOrbs',from:'wood',to:'light'},{type:'convertOrbs',from:'light',to:'dark'}]))!;
    expect(seq?.after.dark).toBe(11); expect(seq.after.light).toBe(0);
  });
  it('does not claim no source when sequential conversions return the original colors', () => {
    const {state}=fixture(); state.board.cells.forEach(o=>{o.type='wood';});
    const skill=custom([{type:'convertOrbs',from:'wood',to:'light'},{type:'convertOrbs',from:'light',to:'wood'}]);
    const view=conversionPreviewView(state,0,skill)!;
    expect(view.textContent).not.toContain('沒有可轉換的來源珠');
    expect(view.textContent).toContain('數量不變');
  });
  it('same-color conversions do not claim absent sources or mutate interference flags', () => {
    const {state}=fixture(); state.board.cells[0].poison=true; state.board.cells[0].locked=true; state.board.cells[0].enhanced=true;
    const before=JSON.stringify(state);
    const skill=custom([{type:'convertOrbs',from:'light',to:'light'}]);
    const view=conversionPreviewView(state,0,skill)!;
    expect(view.textContent).not.toContain('沒有可轉換的來源珠');
    expect(view.textContent).toContain('數量不變');
    expect(JSON.stringify(state)).toBe(before);
  });
  it('suppresses every uncertain/unavailable case without leaking hidden colors', () => {
    for (const mode of ['hidden','cooldown','teamSeal','memberSeal','phase','empty','mixed','chain','chainZero']) {
      const { state, skill } = fixture(); let testSkill = skill;
      if(mode==='hidden') state.board.cells[0].hidden=true;
      if(mode==='cooldown') state.team[0].skillCooldown=1;
      if(mode==='teamSeal') state.teamStatuses.push({id:'skillSeal',turns:2});
      if(mode==='memberSeal') state.teamStatuses.push({id:'attributeSeal',turns:2,params:{attribute:'light'}});
      if(mode==='phase') state.phase='won';
      if(mode==='empty') testSkill=custom([]);
      if(mode==='mixed') testSkill=gameData.skills.find(s=>s.id==='s105')!;
      if(mode.startsWith('chain')) state.buffs.push({kind:'chainOnSkill',member:0,multiplier:999999,turns:mode==='chainZero'?0:3});
      expect(conversionPreview(state,0,testSkill),mode).toBeNull();
      expect(conversionPreviewView(state,0,testSkill),mode).toBeNull();
    }
  });
  it('all current conversion-only skills agree with real apply; any chain blocks preview regardless of enemy kill/HP triggers', () => {
    const supported=gameData.skills.filter(s=>s.effects.length && s.effects.every(e=>e.type==='convertOrbs'));
    expect(supported.length).toBeGreaterThan(0);
    for(const skill of supported) {
      const {state}=fixture(); const before=JSON.stringify(state);
      const preview=conversionPreview(state,0,skill)!;
      expect(preview, skill.id).not.toBeNull();
      const actual=structuredClone(state); applyActiveSkill(actual,0,skill,createRng(3));
      expect(preview.after, skill.id).toEqual(countOrbs(actual.board));
      expect(JSON.stringify(state)).toBe(before);
    }
    for(const hp of [1, 100000]) {
      const {state,skill}=fixture(); state.enemies[0].hp=hp;
      state.enemies[0].def={...state.enemies[0].def,abilities:[{status:'darkOrbs',trigger:'hpBelow',value:6,params:{percent:50}}]};
      state.buffs.push({kind:'chainOnSkill',member:0,multiplier:1000,turns:1});
      expect(conversionPreview(state,0,skill)).toBeNull();
    }
  });
  it('render/reopen uses current counts and cooldown, no ownership or snapshot write', () => {
    const {state,skill,battle}=fixture(); const snapshot=JSON.stringify(battle.snapshot()); const before=JSON.stringify(state);
    const view=conversionPreviewView(state,0,skill)!; expect(view).not.toBeNull(); document.body.append(view);
    expect(view.textContent).toContain('本次轉珠效果'); expect(view.textContent).toContain('光：6 → 11'); view.remove();
    expect(JSON.stringify(state)).toBe(before); expect(JSON.stringify(battle.snapshot())).toBe(snapshot);
    applyActiveSkill(state,0,skill,createRng(7));
    expect(conversionPreviewView(state,0,skill)?.textContent).toContain('數量不變');
    state.team[0].skillCooldown=5; expect(conversionPreviewView(state,0,skill)).toBeNull();
  });
});
