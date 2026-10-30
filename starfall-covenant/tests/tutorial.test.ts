import { describe, expect, it } from 'vitest';
import { gameData } from '../src/data/load';
import { createRng } from '../src/core/rng';
import { boardToStrings, findMatches } from '../src/battle/board';
import { CURRENT_SAVE_VERSION, createNewSave, exportSaveCode, importSaveCode, migrate, parseSave, serializeSave } from '../src/save/save';
import type { SaveData } from '../src/core/types';
import {
  FIRST_STAGE, TUTORIAL_BOARD, TUTORIAL_COMBO, TUTORIAL_PATH, advanceTutorial, comboOfPath, grantSummonGift, guideFor,
  isTutorialActive, restartTutorial, setTutorialStep, skipTutorial, tutorialBoard, tutorialStep,
} from '../src/ui/tutorial/flow';
import { TUTORIAL_ENEMY_HP, createTutorialBattle } from '../src/ui/tutorial/battle-setup';
import { TutorialBattleGuide, texts } from '../src/ui/tutorial/battle-guide';

const config = gameData.config;
const NOW = Date.UTC(2026, 9, 31, 6, 0, 0);
const fresh = () => createNewSave(config, NOW);

describe('教學進度', () => {
  it('新存檔從教學戰鬥開始', () => {
    expect(tutorialStep(fresh())).toBe('battle');
    expect(isTutorialActive(fresh())).toBe(true);
  });

  it('依序前進：戰鬥 → 編隊 → 召喚 → 第一關 → 完成，完成時同步 tutorialDone', () => {
    let s = fresh();
    for (const step of ['battle', 'team', 'summon', 'stage'] as const) {
      expect(s.progress.tutorialDone).toBe(false);
      s = advanceTutorial(s, step);
    }
    expect(tutorialStep(s)).toBe('done');
    expect(s.progress.tutorialDone).toBe(true);
  });

  it('不是目前這一步的事件不會推進（例如重複的抽卡事件）', () => {
    const s = setTutorialStep(fresh(), 'team');
    expect(advanceTutorial(s, 'summon')).toBe(s);
  });

  it('略過與重看', () => {
    const skipped = skipTutorial(fresh());
    expect(isTutorialActive(skipped)).toBe(false);
    const again = restartTutorial(skipped);
    expect(tutorialStep(again)).toBe('battle');
    expect(again.progress.tutorialDone).toBe(false);
  });

  it('召喚贈禮只送一次，重看教學也不會再送', () => {
    const first = grantSummonGift(setTutorialStep(fresh(), 'summon'), 5);
    expect(first.granted).toBe(5);
    expect(first.save.player.gems).toBe(fresh().player.gems + 5);
    expect(tutorialStep(first.save)).toBe('summon');
    expect(grantSummonGift(first.save, 5).granted).toBe(0);
    expect(grantSummonGift(restartTutorial(first.save), 5).granted).toBe(0);
  });

  it('存檔裡的步驟壞掉時視為完成，不會卡住', () => {
    const s = { ...fresh(), tutorial: { step: 'oops' as never, giftGiven: false } };
    expect(tutorialStep(s)).toBe('done');
    const { tutorial: _drop, ...noField } = fresh();
    expect(tutorialStep(noField)).toBe('done');
  });
});

describe('各畫面的引導', () => {
  const at = (name: string, ...args: string[]) => ({ name, args });

  it('全螢幕演出、戰鬥與設定不顯示引導', () => {
    for (const name of ['title', 'story', 'summon-ritual', 'battle', 'settings']) expect(guideFor('battle', at(name))).toBeNull();
    expect(guideFor('done', at('home'))).toBeNull();
  });

  it('還沒到對應畫面時，給一個前往的按鈕', () => {
    expect(guideFor('battle', at('home'))?.action?.go).toEqual(['battle', ['tutorial']]);
    expect(guideFor('team', at('home'))?.action?.go).toEqual(['team', []]);
    expect(guideFor('summon', at('team'))?.action?.go).toEqual(['summon', []]);
    expect(guideFor('stage', at('summon'))?.action?.go).toEqual(['prepare', [FIRST_STAGE]]);
  });

  it('到了對應畫面，指向要按的元素', () => {
    expect(guideFor('team', at('team'))).toMatchObject({ target: '.team-slot', action: { advance: true } });
    expect(guideFor('summon', at('summon'))).toMatchObject({ target: '.seal-pull-actions .btn', placement: 'top', secondary: { advance: true } });
    expect(guideFor('stage', at('prepare', FIRST_STAGE))).toMatchObject({ target: '[data-tut="sortie"] .btn', placement: 'top' });
    expect(guideFor('stage', at('prepare', 'st-1-2'))?.action?.go).toEqual(['prepare', [FIRST_STAGE]]);
  });

  it('第一關確實存在', () => {
    expect(gameData.stages.some((s) => s.id === FIRST_STAGE)).toBe(true);
  });
});

describe('存檔 v1 → v2 遷移', () => {
  const v1 = (cleared: string[]) => {
    const { tutorial: _drop, ...rest } = fresh();
    return { ...rest, version: 1, progress: { ...rest.progress, clearedStages: cleared } };
  };

  it('還沒打過關的舊存檔要走教學', () => {
    const out = migrate(v1([]) as unknown as Record<string, unknown>);
    expect(out.version).toBe(CURRENT_SAVE_VERSION);
    expect(out.tutorial).toEqual({ step: 'battle', giftGiven: false });
  });

  const load = (save: unknown): SaveData => {
    const r = parseSave(serializeSave(save as SaveData), config, NOW);
    if (!r.ok) throw new Error(r.reason);
    return r.save;
  };

  it('新存檔第一次走教學才有召喚贈禮；完成教學的舊存檔遷移後不再送', () => {
    const newbie = load(v1([]));
    expect(newbie.tutorial).toEqual({ step: 'battle', giftGiven: false });
    const veteran = load(v1(['st-1-1']));
    expect(veteran.tutorial).toEqual({ step: 'done', giftGiven: true });
    expect(grantSummonGift(setTutorialStep(restartTutorial(veteran), 'summon'), 5).granted).toBe(0);
  });

  it('v1 存檔 tutorialDone=true 但沒有通關紀錄，也視為完成', () => {
    const old = v1([]);
    const s = load({ ...old, progress: { ...old.progress, tutorialDone: true } });
    expect(tutorialStep(s)).toBe('done');
    expect(s.progress.tutorialDone).toBe(true);
    expect(s.tutorial?.giftGiven).toBe(true);
  });

  it('冪等：v2 存檔再存讀一次，教學進度不變', () => {
    for (const s of [load(v1([])), load(v1(['st-1-1'])), setTutorialStep(fresh(), 'summon'), skipTutorial(fresh())]) {
      const again = parseSave(serializeSave(s), config, NOW);
      expect(again.ok && again.migratedFrom).toBeUndefined();
      expect(again.ok && again.save.tutorial).toEqual(s.tutorial);
      expect(again.ok && again.save.progress.tutorialDone).toBe(s.progress.tutorialDone);
    }
  });

  it('v1 匯出的存檔碼匯入後通過校驗碼並遷移成 v2', () => {
    for (const [cleared, step] of [[[], 'battle'], [['st-1-1'], 'done']] as const) {
      const code = exportSaveCode(v1([...cleared]) as unknown as SaveData);
      const r = importSaveCode(code, config, NOW);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.migratedFrom).toBe(1);
      expect(r.save.version).toBe(CURRENT_SAVE_VERSION);
      expect(tutorialStep(r.save)).toBe(step);
    }
  });

  it('已經打過關的舊存檔視為完成教學', () => {
    const text = serializeSave(v1(['st-1-1']) as never);
    const loaded = parseSave(text, config, NOW);
    expect(loaded.ok && loaded.migratedFrom).toBe(1);
    expect(loaded.ok && tutorialStep(loaded.save)).toBe('done');
    expect(loaded.ok && loaded.save.progress.tutorialDone).toBe(true);
  });

  it('教學進度會存檔讀回（中途關掉可以接續）', () => {
    const s = setTutorialStep(fresh(), 'summon');
    const loaded = parseSave(serializeSave(s), config, NOW);
    expect(loaded.ok && tutorialStep(loaded.save)).toBe('summon');
  });
});

describe('教學戰鬥', () => {
  it('固定盤面開場不會自動消除，照路徑轉珠剛好 2 Combo', () => {
    expect(findMatches(tutorialBoard())).toHaveLength(0);
    expect(comboOfPath(tutorialBoard(), TUTORIAL_PATH)).toBe(TUTORIAL_COMBO);
    // 不相鄰或太短的路徑不算
    expect(comboOfPath(tutorialBoard(), [TUTORIAL_PATH[0]])).toBe(0);
    expect(comboOfPath(tutorialBoard(), [{ row: 2, col: 3 }, { row: 0, col: 0 }])).toBe(0);
  });

  it('不論天降亂數，戰鬥開場都是固定盤面', () => {
    for (const seed of [1, 42, 9999]) {
      const t = createTutorialBattle(gameData, createRng(seed));
      expect(boardToStrings(t.battle.getState().board)).toEqual(TUTORIAL_BOARD);
    }
  });

  it('引導那一步剛好 2 Combo、打不死敵人；之後隊長主動技可以施放，森珠全部變焰珠', () => {
    const t = createTutorialBattle(gameData);
    const r = t.battle.submitMove(TUTORIAL_PATH);
    expect(r.ok && r.summary.combo).toBe(TUTORIAL_COMBO);
    const s = t.battle.getState();
    expect(s.phase).toBe('player');
    expect(s.enemies[0].hp).toBeGreaterThan(0);
    expect(s.enemies[0].hp).toBeLessThan(TUTORIAL_ENEMY_HP);
    expect(s.team[0].skillCooldown).toBe(0);
    expect(t.battle.useSkill(0).ok).toBe(true);
    expect(t.battle.getState().board.cells.some((o) => o.type === 'wood')).toBe(false);
  });

  it('敵人被焰屬性剋制，隊長有隊長技與主動技（教學台詞需要）', () => {
    const t = createTutorialBattle(gameData, createRng(1));
    const tx = texts(t.battle.getState(), t.data);
    expect(t.battle.getState().enemies[0].def.attribute).toBe('wood');
    expect(t.battle.getState().team[0].card.attribute).toBe('fire');
    expect(tx.leaderSkillName).not.toBe('');
    expect(tx.skillName).not.toBe('');
  });
});

describe('教學戰鬥的操作限制', () => {
  const guide = () => new TutorialBattleGuide({
    leaderName: '蘿希', leaderSkillName: '', leaderSkillText: '', skillName: '', skillText: '', enemyName: '', enemyAttribute: '',
  }, { onFinish: () => {}, onSkip: () => {} });
  const board = tutorialBoard();

  it('引導轉珠時，沒照路線轉出 2 Combo 會被擋下', () => {
    const g = guide();
    g.phase = 'drag';
    expect(g.checkMove([{ row: 0, col: 0 }, { row: 0, col: 1 }], board)).toBeTruthy();
    expect(g.checkMove(TUTORIAL_PATH, board)).toBeNull();
  });

  it('說明中不能轉珠；主動技那一步只能用隊長的技能', () => {
    const g = guide();
    g.phase = 'explain';
    expect(g.checkMove(TUTORIAL_PATH, board)).toBeTruthy();
    expect(g.checkSkill(0)).toBeTruthy();
    g.phase = 'skill';
    expect(g.checkMove(TUTORIAL_PATH, board)).toBeTruthy();
    expect(g.checkSkill(1)).toBeTruthy();
    expect(g.checkSkill(0)).toBeNull();
    g.phase = 'free';
    expect(g.checkMove([{ row: 0, col: 0 }, { row: 0, col: 1 }], board)).toBeNull();
    expect(g.checkSkill(3)).toBeNull();
  });
});
