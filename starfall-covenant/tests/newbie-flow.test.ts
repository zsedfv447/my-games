// 新手頭 10 分鐘：第一關剋制、編隊台詞和流派分析一致、教學第一抽、每日登入自動跳出
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/data/load';
import { createRng } from '../src/core/rng';
import { createNewSave } from '../src/save/save';
import { analyzeTeam, createGrowthContext } from '../src/growth';
import { firstPullCandidates, pullGacha } from '../src/progression/gacha';
import { claimLoginReward } from '../src/progression/login';
import { dateKey } from '../src/progression/time';
import { FIRST_STAGE, guideFor, setTutorialStep, skipTutorial, tutorialFirstPull } from '../src/ui/tutorial/flow';
import { shouldAutoShowLogin } from '../src/ui/screens/login-bonus';
import { loginRewards } from '../src/ui/economy';
import { newbieTeams, gameStageData } from '../tools/sim/fixtures';
import { simulateMatrix } from '../tools/sim/simulate';
import type { SaveData } from '../src/core/types';

const config = gameData.config;
const NOW = Date.UTC(2026, 9, 31, 6, 0, 0);
const DAY = 86_400_000;
const fresh = () => createNewSave(config, NOW);
const growth = createGrowthContext(gameData);
const card = (id: string) => gameData.cards.find((c) => c.id === id)!;
const enemy = (id: string) => gameData.enemies.find((e) => e.id === id)!;
const stage = (id: string) => gameData.stages.find((s) => s.id === id)!;
const leaderOf = (save: SaveData) => card(save.inventory.cards.find((c) => c.uid === save.teams[save.activeTeam].members[0])!.cardId);

describe('第一章前兩關：入門隊長的屬性剋制第一波', () => {
  it('入門隊長是焰屬性，st-1-1、st-1-2 第一波全是被焰剋制的森屬性敵人', () => {
    expect(leaderOf(fresh()).attribute).toBe('fire');
    for (const id of [FIRST_STAGE, 'st-1-2']) {
      expect(stage(id).waves[0].enemies.map((e) => enemy(e).attribute)).toEqual(stage(id).waves[0].enemies.map(() => 'wood'));
    }
  });

  it('入門隊（Lv1）不論帶哪位助戰，st-1-1 都在 5 回合左右通關', () => {
    for (const team of newbieTeams(stage(FIRST_STAGE), NOW)) {
      const [r] = simulateMatrix([stage(FIRST_STAGE)], [team], gameStageData, 5);
      expect(r.winRate, team.label).toBe(1);
      expect(r.avgTurns!, team.label).toBeLessThanOrEqual(6);
    }
  });
});

describe('教學編隊台詞和流派分析一致', () => {
  it('入門隊有紅框隊員時，台詞說明原因，不說隊伍已經很好用', () => {
    const save = fresh();
    const misfits = analyzeTeam(save, growth, save.teams[0].members).members.filter((m) => !m.fits);
    expect(misfits.length).toBeGreaterThan(0);
    const spec = guideFor('team', { name: 'team', args: [] }, { misfits: misfits.length, reason: misfits[0].reasons[0] })!;
    const text = spec.lines.join('');
    expect(text).toContain('紅框');
    expect(text).toContain(misfits[0].reasons[0]);
    expect(text).not.toContain('很好用');
  });

  it('沒有紅框時說隊伍很搭', () => {
    const spec = guideFor('team', { name: 'team', args: [] }, { misfits: 0 })!;
    expect(spec.lines.join('')).not.toContain('紅框');
  });
});

describe('教學第一抽', () => {
  const pool = gameData.gachaPools[0];

  it('候選是卡池裡入門隊沒有、和隊長同屬性或同流派的卡', () => {
    const save = fresh();
    const leader = leaderOf(save);
    const list = firstPullCandidates(pool, gameData.cards, save.collection.owned, leader);
    expect(list.length).toBeGreaterThan(0);
    for (const id of list) {
      const c = card(id);
      expect(save.collection.owned).not.toContain(id);
      expect(c.attribute === leader.attribute || c.archetypes.some((a) => leader.archetypes.some((b) => b.id === a.id))).toBe(true);
    }
  });

  it('firstFrom：第一抽一定落在名單內，十連只限定第一張', () => {
    const list = firstPullCandidates(pool, gameData.cards, [], card('c106'));
    const save = { ...fresh(), player: { ...fresh().player, gems: 10_000 } };
    const rest = new Set<string>();
    for (let seed = 1; seed <= 200; seed++) {
      const one = pullGacha(save, pool, 1, createRng(seed), NOW, { firstFrom: list });
      expect(one.ok && list).toContain(one.ok && one.results[0].cardId);
      const ten = pullGacha(save, pool, 10, createRng(seed), NOW, { firstFrom: list });
      if (!ten.ok) throw new Error(ten.reason);
      expect(list).toContain(ten.results[0].cardId);
      ten.results.slice(1).forEach((r) => rest.add(r.cardId));
    }
    expect([...rest].some((id) => !list.includes(id))).toBe(true);
  });

  it('沒有給 firstFrom 時和原本完全一樣', () => {
    const save = { ...fresh(), player: { ...fresh().player, gems: 100 } };
    const a = pullGacha(save, pool, 10, createRng(9), NOW);
    const b = pullGacha(save, pool, 10, createRng(9), NOW, { firstFrom: [] });
    expect(a.ok && a.results.map((r) => r.cardId)).toEqual(b.ok && b.results.map((r) => r.cardId));
  });

  it('只在教學召喚這一步、而且從沒抽過卡時才限定', () => {
    const atSummon = setTutorialStep(fresh(), 'summon');
    expect(tutorialFirstPull(atSummon, pool, gameData.cards)?.length).toBeGreaterThan(0);
    expect(tutorialFirstPull(fresh(), pool, gameData.cards)).toBeUndefined();
    expect(tutorialFirstPull(skipTutorial(fresh()), pool, gameData.cards)).toBeUndefined();
    const pulled = { ...atSummon, gacha: { ...atSummon.gacha, history: [{ pool: pool.id, card: 'c107', at: NOW }] } };
    expect(tutorialFirstPull(pulled, pool, gameData.cards)).toBeUndefined();
  });
});

describe('每日登入自動跳出', () => {
  it('新存檔在教學中不跳；略過或完成教學後，還沒通關也會跳', () => {
    expect(shouldAutoShowLogin(fresh(), NOW, '')).toBe(false);
    const done = skipTutorial(fresh());
    expect(done.progress.clearedStages).toEqual([]);
    expect(shouldAutoShowLogin(done, NOW, '')).toBe(true);
  });

  it('今天領過或今天已經跳過就不再跳，隔天又會跳', () => {
    const done = skipTutorial(fresh());
    expect(shouldAutoShowLogin(done, NOW, dateKey(NOW))).toBe(false);
    const claimed = claimLoginReward(done, loginRewards, config, NOW);
    if (!claimed.ok) throw new Error(claimed.reason);
    expect(shouldAutoShowLogin(claimed.save, NOW, '')).toBe(false);
    expect(shouldAutoShowLogin(claimed.save, NOW + DAY, dateKey(NOW))).toBe(true);
  });
});
