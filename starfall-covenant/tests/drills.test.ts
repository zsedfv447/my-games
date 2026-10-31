import { describe, expect, it } from 'vitest';
import { boardFromStrings, findMatches } from '../src/battle/board';
import { startBattle } from '../src/battle/battle-state';
import { createRng } from '../src/core/rng';
import { gameData } from '../src/data/load';
import { createNewSave } from '../src/save/save';
import { DRILLS, DRILL_IDS, drillById, drillRewardClaimed, emptyDrillLog, settleDrill, type DrillLog } from '../src/progression/drills';
import { DEMO_HELPER, DEMO_TEAM, DRILL_BOARDS, PRACTICE_MODES, practiceSetup } from '../src/ui/demo';
import { trackDrill } from '../src/ui/drill-tracker';

const log = (over: Partial<DrillLog>): DrillLog => ({ ...emptyDrillLog(), won: true, ...over });
const passed = (id: string, l: DrillLog) => drillById(id)!.passed(l);

describe('戰術課：過關判定', () => {
  it('留敵存技能：Boss 出場的第一回合施放焰擊才算', () => {
    const skill = (turn: number, wave = 1) => ({ skillId: DRILL_IDS.fireStrike, wave, turn });
    expect(passed('drill-reserve', log({ waveStartTurns: [0, 3], skills: [skill(3)] }))).toBe(true);
    expect(passed('drill-reserve', log({ waveStartTurns: [0, 3], skills: [skill(4)] }))).toBe(false);
    expect(passed('drill-reserve', log({ waveStartTurns: [0, 3], skills: [skill(0, 0)] }))).toBe(false);
    expect(passed('drill-reserve', log({ won: false, waveStartTurns: [0, 3], skills: [skill(3)] }))).toBe(false);
  });

  it('留心珠撐大招：吃過大招、沒續戰、獲勝', () => {
    const hit = { enemyId: DRILL_IDS.charger, wave: 0, damage: 6800 };
    expect(passed('drill-hearts', log({ attacks: [hit] }))).toBe(true);
    expect(passed('drill-hearts', log({ attacks: [hit], continues: 1 }))).toBe(false);
    // 大招前就打倒了：沒有練到
    expect(passed('drill-hearts', log({ attacks: [] }))).toBe(false);
  });

  it('先轉色再強化：同一回合、引火在淬火前面', () => {
    const s = (skillId: string, turn = 0) => ({ skillId, wave: 0, turn });
    expect(passed('drill-convert', log({ skills: [s(DRILL_IDS.convert), s(DRILL_IDS.enhance)] }))).toBe(true);
    expect(passed('drill-convert', log({ skills: [s(DRILL_IDS.enhance), s(DRILL_IDS.convert)] }))).toBe(false);
    expect(passed('drill-convert', log({ skills: [s(DRILL_IDS.convert, 0), s(DRILL_IDS.enhance, 1)] }))).toBe(false);
  });

  it('先打快出手的敵人：刺客一次都沒出手', () => {
    expect(passed('drill-threat', log({ attacks: [{ enemyId: 'drill-tank', wave: 0, damage: 500 }] }))).toBe(true);
    expect(passed('drill-threat', log({ attacks: [{ enemyId: DRILL_IDS.assassin, wave: 0, damage: 4500 }] }))).toBe(false);
  });
});

describe('戰術課：一次性獎勵', () => {
  it('第一次過關給金幣，之後不再給；沒過關不給也不記錄', () => {
    const save = createNewSave(gameData.config, new Date(2026, 10, 2, 12).getTime());
    const fail = settleDrill(save, 'drill-threat', log({ attacks: [{ enemyId: DRILL_IDS.assassin, wave: 0, damage: 1 }] }));
    expect(fail).toEqual({ save, passed: false, coin: 0 });
    const first = settleDrill(save, 'drill-threat', log({}));
    expect(first.coin).toBe(drillById('drill-threat')!.coin);
    expect(first.save.player.coin).toBe(save.player.coin + first.coin);
    expect(drillRewardClaimed(first.save, 'drill-threat')).toBe(true);
    const again = settleDrill(first.save, 'drill-threat', log({}));
    expect(again).toMatchObject({ passed: true, coin: 0 });
    expect(again.save).toBe(first.save);
  });
});

describe('戰術課：練習場設定', () => {
  const start = (id: (typeof DRILLS)[number]['id']) => {
    const { stage, data, rng } = practiceSetup(id);
    return startBattle(stage, DEMO_TEAM, DEMO_HELPER, rng!(createRng(1)), data);
  };

  it('每課都在練習模式列表裡，開場盤面固定且不會直接消除', () => {
    for (const d of DRILLS) {
      expect(PRACTICE_MODES.some((m) => m.id === d.id)).toBe(true);
      const expected = boardFromStrings(DRILL_BOARDS[d.id]);
      expect(findMatches(expected)).toEqual([]);
      expect(start(d.id).getState().board.cells.map((o) => o.type)).toEqual(expected.cells.map((o) => o.type));
    }
  });

  it('大招：生命不滿撐不住，補滿就撐得住', () => {
    const battle = start('drill-hearts');
    const charger = battle.getState().enemies.find((e) => e.def.id === DRILL_IDS.charger)!;
    const maxHp = battle.getState().maxHp;
    expect(charger.def.atk).toBeLessThan(maxHp);
    expect(charger.def.atk / maxHp).toBeGreaterThan(0.7);
  });

  it('先轉色再強化：開場兩個技能都能放，順序對了焰珠全部強化', () => {
    const battle = start('drill-convert');
    const tracker = trackDrill(battle);
    const team = battle.getState().team;
    const convert = team.findIndex((m) => m.card.activeSkill === DRILL_IDS.convert);
    const enhance = team.findIndex((m) => m.card.activeSkill === DRILL_IDS.enhance);
    expect(battle.useSkill(convert).ok).toBe(true);
    expect(battle.useSkill(enhance).ok).toBe(true);
    const fire = battle.getState().board.cells.filter((o) => o.type === 'fire');
    expect(fire.length).toBeGreaterThan(10);
    expect(fire.every((o) => o.enhanced)).toBe(true);
    expect(tracker.log().skills.map((s) => s.skillId)).toEqual([DRILL_IDS.convert, DRILL_IDS.enhance]);
    tracker.dispose();
  });

  it('刺客 2 回合後出手、預設目標不是刺客', () => {
    const battle = start('drill-threat');
    const s = battle.getState();
    const assassin = s.enemies.findIndex((e) => e.def.id === DRILL_IDS.assassin);
    expect(s.enemies[assassin].cooldown).toBe(2);
    expect(s.target).not.toBe(assassin);
  });
});
