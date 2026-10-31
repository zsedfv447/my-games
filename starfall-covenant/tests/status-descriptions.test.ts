// 狀態說明和實際行為一致：每一條說明的關鍵字，都配一個用戰鬥規則驗證的例子
import { describe, expect, it } from 'vitest';
import gameConfig from '../data/config.json';
import { applyHits, damageAgainst, type DefenseProfile, type Hit } from '../src/battle/damage';
import { boardFromStrings, resolveBoard } from '../src/battle/board';
import { enemyHitCount } from '../src/battle/skills/status';
import { createRng } from '../src/core/rng';
import { STATUS_IDS, type EnemyDef, type GameConfig } from '../src/core/types';
import type { EnemyState } from '../src/battle/battle-state';
import { statusDetail } from '../src/ui/status-labels';
import { enemyStatRows } from '../src/ui/enemy-info';

const config = (gameConfig as GameConfig).battle;
const ctx = (combo = 1) => ({ combo, config });
const water = (amount: number, extra: Partial<Hit> = {}): Hit => ({ member: 0, attribute: 'water', target: 'single', amount, ...extra });
// 潮打輝：沒有剋制關係，傷害照原數字
const target = (extra: Partial<DefenseProfile> = {}): DefenseProfile => ({ attribute: 'light', def: 0, ...extra });

describe('每個狀態都有說明', () => {
  it('STATUS_IDS 全部有非空的說明', () => {
    for (const id of STATUS_IDS) expect(statusDetail(id), id).not.toBe('');
  });
});

describe('說明與戰鬥規則一致', () => {
  it('傷害吸收：一回合累積超過上限的部分回復敵人，固定傷害不受影響', () => {
    expect(statusDetail('damageAbsorb')).toContain('一回合累積');
    expect(statusDetail('damageAbsorb')).toContain('固定傷害不受影響');
    // 兩下各 600，門檻 1000：第一下照扣，第二下只有 400 扣血、超過的 200 回復（累積計算，不是單次）
    const enemy = { ...target({ damageAbsorb: 1000 }), hp: 10000, maxHp: 10000 };
    const r = applyHits([water(600), water(600)], [enemy], 0, ctx());
    expect(r.results.map((x) => x.damage)).toEqual([600, 200]);
    // 固定傷害不吸收
    const fixed = applyHits([water(5000, { fixed: true })], [enemy], 0, ctx());
    expect(fixed.results[0].damage).toBe(5000);
  });

  it('Combo 盾：Combo 不夠時屬性攻擊無效，固定傷害照樣打得到', () => {
    expect(statusDetail('comboShield')).toContain('屬性攻擊無效');
    expect(statusDetail('comboShield')).toContain('固定傷害不受影響');
    const e = target({ comboShield: 5 });
    expect(damageAgainst(water(1000), e, ctx(3))).toBe(0);
    expect(damageAgainst(water(1000), e, ctx(5))).toBeGreaterThan(0);
    expect(damageAgainst(water(1000, { fixed: true }), e, ctx(3))).toBe(1000);
  });

  it('護盾：沒有標數值時完全免疫，只有無視護盾的攻擊能穿透（固定傷害也會被擋）', () => {
    expect(statusDetail('shield')).toContain('完全免疫');
    expect(statusDetail('shield')).toContain('無視護盾');
    const e = target({ shieldPercent: 100 });
    expect(damageAgainst(water(1000), e, ctx())).toBe(0);
    expect(damageAgainst(water(1000, { fixed: true }), e, ctx())).toBe(0);
    expect(damageAgainst(water(1000, { fixed: true, ignoreShield: true }), e, ctx())).toBe(1000);
  });

  it('封鎖珠：指定種類的珠子無法消除', () => {
    expect(statusDetail('lockedOrbs')).toContain('無法消除');
    const board = boardFromStrings(['fffwgl', 'wgldhw', 'gldhwg', 'ldhwgl', 'dhwgld']);
    const free = resolveBoard(board, createRng(1), { skyfallCombo: false });
    const sealed = resolveBoard(board, createRng(1), { skyfallCombo: false, sealedOrbs: ['fire'] });
    expect(free.groups.some((g) => g.orb === 'fire')).toBe(true);
    expect(sealed.groups.some((g) => g.orb === 'fire')).toBe(false);
  });

  it('連擊：拆成好幾段，說明寫明總傷害不變', () => {
    expect(statusDetail('multiHit')).toContain('總傷害不變');
    const e = { statuses: [{ id: 'multiHit', turns: null, value: 3 }] } as unknown as EnemyState;
    expect(enemyHitCount(e)).toBe(3);
  });
});

describe('敵人情報的數值列', () => {
  const def: EnemyDef = { id: 'e', name: '測試', attribute: 'fire', hp: 50000, atk: 3000, def: 800, cd: 3, abilities: [], art: {} };
  const enemy = (extra: Partial<EnemyState> = {}): EnemyState => ({
    def, hp: 32000, maxHp: 50000, cooldown: 2, maxCooldown: 3, statuses: [], dots: [], lockedTurns: 0, turnsOnField: 0, triggered: [], ...extra,
  } as EnemyState);

  it('生命、防禦、攻擊間隔與攻擊對象', () => {
    const rows = Object.fromEntries(enemyStatRows(enemy()).map((r) => [r.label, r.value]));
    expect(rows).toEqual({ 生命: '32,000 / 50,000', 防禦: '800', 攻擊間隔: '每 3 回合', 攻擊對象: '我方全隊（共用生命）' });
  });

  it('防禦降低時顯示目前值與原本的值；連擊顯示段數', () => {
    const rows = Object.fromEntries(enemyStatRows(enemy({
      statuses: [{ id: 'defenseDown', turns: 2, value: 50 }, { id: 'multiHit', turns: null, value: 2 }],
    } as Partial<EnemyState>)).map((r) => [r.label, r.value]));
    expect(rows.防禦).toBe('400（原本 800）');
    expect(rows.攻擊對象).toBe('我方全隊（共用生命）・2 段');
  });
});
