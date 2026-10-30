import { describe, expect, it } from 'vitest';
import { ARCHETYPE_IDS, type SaveData, type StageDef } from '../src/core/types';
import { gameData } from '../src/data/load';
import { createNewSave } from '../src/save/save';
import {
  dailyOffset, HELPER_NPCS, helperCardId, helperLevel, helperProblem, helperRoster, helperSkillLevel, stageAllowsHelper,
} from '../src/progression/helpers';
import { buildSortieTeam, chooseHelper, sortieProblem } from '../src/ui/sortie';

const cardById = (id: string) => gameData.cards.find((c) => c.id === id);
const main = gameData.stages.filter((s) => s.kind === 'main');
const NOW = new Date(2026, 10, 2, 12).getTime();

const withCleared = (n: number): SaveData => {
  const s = createNewSave(gameData.config, 0);
  return { ...s, progress: { ...s.progress, clearedStages: main.slice(0, n).map((st) => st.id) } };
};
const stage = (over: Partial<StageDef> = {}): StageDef => ({ ...main[0], id: 'x', ...over });
const roster = (save: SaveData, st: StageDef = stage()) => helperRoster(save, st, HELPER_NPCS, gameData.stages, cardById, NOW);

describe('助戰資料', () => {
  it('每個流派都有一位 NPC，卡片存在且帶有隊長技與該流派', () => {
    expect(new Set(HELPER_NPCS.map((n) => n.archetype))).toEqual(new Set(ARCHETYPE_IDS));
    expect(new Set(HELPER_NPCS.map((n) => n.id)).size).toBe(HELPER_NPCS.length);
    const stageIds = new Set(gameData.stages.map((s) => s.id));
    for (const npc of HELPER_NPCS) {
      if (npc.unlockAfter) expect(stageIds.has(npc.unlockAfter), npc.id).toBe(true);
      expect(npc.tiers[0].after).toBeNull();
      for (const t of npc.tiers) {
        const card = cardById(t.card);
        expect(card, `${npc.id} ${t.card}`).toBeDefined();
        expect(card!.leaderSkill, t.card).toBeTruthy();
        expect(card!.archetypes.some((a) => a.id === npc.archetype), t.card).toBe(true);
        if (t.after) expect(stageIds.has(t.after), t.after).toBe(true);
      }
    }
  });
});

describe('助戰強度', () => {
  it('6★ 助戰只在主線通關（st-5-9）後出現', () => {
    for (const npc of HELPER_NPCS) {
      for (const t of npc.tiers) if (cardById(t.card)!.rarity >= 6) expect(t.after, `${npc.id} ${t.card}`).toBe('st-5-9');
    }
  });
});

describe('助戰名單', () => {
  it('新玩家只有一開始就有的 NPC，通關後解鎖更多', () => {
    const early = roster(withCleared(0)).map((o) => o.npc.id);
    expect(early.length).toBe(HELPER_NPCS.filter((n) => !n.unlockAfter).length);
    expect(early.length).toBeGreaterThanOrEqual(3);
    expect(roster(withCleared(main.length)).length).toBe(HELPER_NPCS.length);
  });

  it('進度越多，帶的卡越強、等級越高', () => {
    const npc = HELPER_NPCS.find((n) => n.id === 'npc-enhance')!;
    expect(helperCardId(withCleared(0), npc)).toBe('c309');
    expect(helperCardId(withCleared(9), npc)).toBe('c310');
    expect(helperCardId(withCleared(main.length), npc)).toBe('c303');
    const card = cardById('c106')!;
    expect(helperLevel(card, 0)).toBe(10);
    expect(helperLevel(card, 5)).toBe(20);
    expect(helperLevel(card, 45)).toBe(card.maxLevel);
    expect(helperSkillLevel(0)).toBe(1);
    expect(helperSkillLevel(45)).toBe(5);
  });

  it('推薦流派排前面，不符合限制的排最後', () => {
    const save = withCleared(main.length);
    const list = roster(save, stage({ recommendedArchetypes: ['control'], teamRule: { filter: { attribute: 'water' } } }));
    expect(list[0].npc.archetype).toBe('control');
    expect(list[0].recommended).toBe(true);
    const firstBad = list.findIndex((o) => o.problem);
    expect(firstBad).toBeGreaterThan(0);
    expect(list.slice(firstBad).every((o) => o.problem === 'teamFilter')).toBe(true);
    expect(list.slice(0, firstBad).every((o) => o.card.attribute === 'water')).toBe(true);
  });

  it('流派限制只允許同流派助戰', () => {
    expect(helperProblem(stage({ teamRule: { archetype: 'mono' } }), cardById('c106')!)).toBeNull();
    expect(helperProblem(stage({ teamRule: { archetype: 'mono' } }), cardById('c109')!)).toBe('teamArchetype');
  });

  it('借用隊伍（流派試煉）與禁止助戰的關卡沒有名單', () => {
    const trial = gameData.stages.find((s) => s.kind === 'trial' && s.fixedTeam)!;
    expect(stageAllowsHelper(trial)).toBe(false);
    expect(roster(withCleared(main.length), trial)).toEqual([]);
    expect(roster(withCleared(main.length), stage({ teamRule: { noHelper: true } }))).toEqual([]);
  });

  it('同一天順序固定，換天會輪替', () => {
    expect(dailyOffset(NOW, 12)).toBe(dailyOffset(NOW + 3600_000, 12));
    const offsets = new Set([0, 1, 2, 3, 4, 5, 6].map((d) => dailyOffset(NOW + d * 86400_000, 12)));
    expect(offsets.size).toBeGreaterThan(1);
    expect(dailyOffset(NOW, 0)).toBe(0);
  });
});

describe('選好的助戰接進出戰隊伍', () => {
  const save = () => {
    const s = createNewSave(gameData.config, 0);
    expect(s.inventory.cards.length).toBeGreaterThan(0);
    return s;
  };

  it('一般關卡帶上選好的助戰，並檢查限制', () => {
    const st = stage({ id: 'helper-test' });
    const offer = roster(save(), st)[0];
    chooseHelper(st.id, { npcId: offer.npc.id, card: offer.card, input: { cardId: offer.card.id, level: offer.level, skillLevel: offer.skillLevel } });
    const team = buildSortieTeam(st, save(), cardById);
    expect(team.helper?.cardId).toBe(offer.card.id);
    expect(team.helperCard?.id).toBe(offer.card.id);
    expect(sortieProblem(st, team)).toBeNull();
    expect(sortieProblem({ ...st, teamRule: { noHelper: true } }, team)).toBe('helperNotAllowed');
  });

  it('選「不帶助戰」或流派試煉時沒有玩家助戰', () => {
    const st = stage({ id: 'helper-none' });
    chooseHelper(st.id, null);
    expect(buildSortieTeam(st, save(), cardById).helper).toBeNull();
    const trial = gameData.stages.find((s) => s.kind === 'trial' && s.fixedTeam)!;
    const offer = roster(save())[0];
    chooseHelper(trial.id, { npcId: offer.npc.id, card: offer.card, input: { cardId: offer.card.id, level: 1 } });
    const borrowed = buildSortieTeam(trial, save(), cardById);
    expect(borrowed.borrowed).toBe(true);
    expect(borrowed.helper?.cardId ?? null).toBe(trial.fixedTeam!.helper?.card ?? null);
  });
});
