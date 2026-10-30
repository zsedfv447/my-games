import { describe, expect, it } from 'vitest';
import type { SaveData } from '../src/core/types';
import { gameData } from '../src/data/load';
import { createNewSave } from '../src/save/save';
import {
  addStamina, msUntilFullStamina, msUntilNextStamina, refillStaminaWithGems, regenStamina, spendStamina,
} from '../src/progression/stamina';
import { addPlayerExp, expToNext, maxStamina, MAX_PLAYER_LEVEL, teamCostLimit } from '../src/progression/player';

const config = gameData.config;
const MIN = 60_000;
const T0 = Date.UTC(2026, 9, 30);
const tick = config.stamina.regenMinutes * MIN;

function withStamina(current: number, lastUpdate = T0): SaveData {
  const s = createNewSave(config, T0);
  return { ...s, stamina: { current, lastUpdate } };
}

describe('體力', () => {
  it('每個回復週期回 1 點，零頭時間保留', () => {
    const s = regenStamina(withStamina(10), config, T0 + 3 * tick + 2 * MIN);
    expect(s.stamina).toEqual({ current: 13, lastUpdate: T0 + 3 * tick });
    expect(msUntilNextStamina(s, config, T0 + 3 * tick + 2 * MIN)).toBe(tick - 2 * MIN);
  });

  it('離線很久最多回到上限', () => {
    const later = T0 + 1000 * tick;
    const s = regenStamina(withStamina(0), config, later);
    expect(s.stamina).toEqual({ current: config.stamina.baseMax, lastUpdate: later });
  });

  it('時鐘倒退不扣體力', () => {
    const s = regenStamina(withStamina(10), config, T0 - 10 * tick);
    expect(s.stamina).toEqual({ current: 10, lastUpdate: T0 - 10 * tick });
  });

  it('扣體力：不足時失敗；從滿的狀態扣時計時從現在開始', () => {
    expect(spendStamina(withStamina(2), 3, config, T0)).toEqual({ ok: false, reason: 'notEnoughStamina' });
    const full = withStamina(config.stamina.baseMax, T0 - 999 * tick);
    const r = spendStamina(full, 5, config, T0);
    expect(r.ok && r.save.stamina).toEqual({ current: config.stamina.baseMax - 5, lastUpdate: T0 });
  });

  it('扣體力前先結算回復', () => {
    const r = spendStamina(withStamina(1), 3, config, T0 + 2 * tick);
    expect(r.ok && r.save.stamina.current).toBe(0);
  });

  it('獎勵可以超過上限，超過時不再自然回復', () => {
    const over = addStamina(withStamina(config.stamina.baseMax), 30, config, T0);
    expect(over.stamina.current).toBe(config.stamina.baseMax + 30);
    expect(regenStamina(over, config, T0 + 50 * tick).stamina.current).toBe(config.stamina.baseMax + 30);
  });

  it('回滿所需時間', () => {
    expect(msUntilFullStamina(withStamina(config.stamina.baseMax - 3), config, T0)).toBe(3 * tick);
    expect(msUntilFullStamina(withStamina(config.stamina.baseMax), config, T0)).toBe(0);
  });

  it('星晶補滿', () => {
    expect(refillStaminaWithGems(withStamina(config.stamina.baseMax), config, T0)).toEqual({ ok: false, reason: 'alreadyFull' });
    const poor = { ...withStamina(0), player: { ...withStamina(0).player, gems: 0 } };
    expect(refillStaminaWithGems(poor, config, T0)).toEqual({ ok: false, reason: 'notEnoughGems' });
    const r = refillStaminaWithGems(withStamina(0), config, T0);
    expect(r.ok && r.save.stamina.current).toBe(config.stamina.baseMax);
    expect(r.ok && r.save.player.gems).toBe(config.newPlayer.gems - 1);
  });
});

describe('玩家等級', () => {
  it('經驗曲線遞增，滿級後無法再升', () => {
    for (let l = 1; l < MAX_PLAYER_LEVEL - 1; l++) expect(expToNext(l + 1)).toBeGreaterThanOrEqual(expToNext(l));
    expect(expToNext(MAX_PLAYER_LEVEL)).toBe(Infinity);
  });

  it('升級：連升多級、補滿體力、發星晶', () => {
    const s = withStamina(2);
    const amount = expToNext(1) + expToNext(2) + 5;
    const { save, levelUp } = addPlayerExp(s, amount, config, T0 + 1);
    expect(levelUp).toEqual({ from: 1, to: 3, gems: 2 });
    expect(save.player).toMatchObject({ level: 3, exp: 5, gems: s.player.gems + 2 });
    expect(save.stamina).toEqual({ current: maxStamina(3, config), lastUpdate: T0 + 1 });
  });

  it('沒升級時只加經驗', () => {
    const { save, levelUp } = addPlayerExp(withStamina(2), 3, config, T0);
    expect(levelUp).toBeUndefined();
    expect(save.player.exp).toBe(3);
    expect(save.stamina.current).toBe(2);
  });

  it('升級時溢出的體力保留', () => {
    const { save } = addPlayerExp(withStamina(200), expToNext(1), config, T0);
    expect(save.stamina.current).toBe(200);
  });

  it('隊伍空間上限隨等級成長', () => {
    expect(teamCostLimit(1)).toBe(30);
    expect(teamCostLimit(4)).toBe(36);
    expect(teamCostLimit(50)).toBe(128);
    expect(teamCostLimit(60)).toBe(138);
  });
});
