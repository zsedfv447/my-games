import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { gameData } from '../src/data/load';
import { startBattle, resumeBattle } from '../src/battle/battle-state';
import { createRng } from '../src/core/rng';
import { boardFromStrings } from '../src/battle/board';
import { defenseProfile } from '../src/battle/skills/status';
import { RACES, type OrbType } from '../src/core/types';
import { RACE_NAMES } from '../src/ui/art/palette';
import sources from '../assets/user/classic-card-sources.json';

const identities = [
  [202, '勝利海神費雷'], [204, '獨臂戰神提爾'], [206, '妙曼愛神費蕾雅'],
  [208, '轟天雷神索爾'], [210, '黃昏號角洛基'], [192, '海神波塞頓'],
  [194, '奧林火神赫淮斯托斯'], [196, '智慧女神雅典娜'], [198, '光明之神阿波羅'],
  [200, '月之狩獵女神阿提密斯'], [40, '饕餮渾沌魔君'], [190, '惡魔巴風特'],
  [28, '朱雀陵光神君'], [32, '玄武執明神君'], [36, '白虎監兵神君'],
] as const;
const classicIds = identities.map((_, i) => `c${801 + i}`);
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

describe('經典角色跨系統整合', () => {
  it('十五位本體身分與雙用途原圖可追溯，沒有錯放其他角色', () => {
    identities.forEach(([sourceId, name], index) => {
      const id = classicIds[index];
      const card = gameData.cards.find(c => c.id === id);
      expect(card, id).toBeDefined();
      expect(card!.name, id).toContain(name);
      expect(card!.rarity).toBe(index < 10 ? 6 : 5);
      expect(card!.race).toBe(index < 10 ? 'god' : 'beast');
      const entries = sources.assets.filter(a => a.card_id === id);
      expect(entries.map(a => a.usage).sort()).toEqual(['icon', 'portrait']);
      for (const asset of entries) {
        expect(asset.source_card_id).toBe(sourceId);
        expect(asset.source_card_name).toBe(name);
        expect(existsSync(asset.output_path)).toBe(true);
        expect(createHash('sha256').update(readFileSync(asset.output_path)).digest('hex')).toBe(asset.output_sha256);
      }
      expect(gameData.skills.some(s => s.id === card!.activeSkill), `${id} 主動技`).toBe(true);
      expect(gameData.leaderSkills.some(s => s.id === card!.leaderSkill), `${id} 隊長技`).toBe(true);
    });
  });

  it('每位角色能由經典封印與商店取得，三流派隊長有試煉首通來源', () => {
    const pool = gameData.gachaPools.find(p => p.id === 'classic-seal')!;
    expect(pool).toBeDefined();
    const summonable = Object.values(pool.cards).flat();
    for (const id of classicIds) {
      expect(summonable, `${id} 封印`).toContain(id);
      expect(gameData.shop.some(s => 'cards' in s.reward && s.reward.cards?.some(c => c.card === id)), `${id} 商店`).toBe(true);

    }
    for (const id of ['c801', 'c806', 'c811']) expect(gameData.stages.some(s => s.kind === 'trial' && s.rewards.firstClear?.cards?.some(c => c.card === id)), `${id} 試煉首通`).toBe(true);
  });

  it.each(['norse', 'greek', 'classicbeast'])('%s 試煉借用隊伍能真正開戰並結算一回合', archetype => {
    const stage = gameData.stages.find(s => s.kind === 'trial' && s.archetype === archetype)!;
    expect(stage?.fixedTeam).toBeDefined();
    const input = (m: { card: string; level: number; skillLevel?: number }) => ({ cardId: m.card, level: m.level, skillLevel: m.skillLevel });
    const battle = startBattle(stage, stage.fixedTeam!.members.map(input), stage.fixedTeam!.helper ? input(stage.fixedTeam!.helper) : null, createRng(812), gameData);
    expect(battle.getState().team).toHaveLength(6);
    expect(battle.submitMove([{ row: 0, col: 0 }]).ok).toBe(true);
    expect(battle.getState().turns).toBe(1);
    expect(Number.isFinite(battle.getState().hp)).toBe(true);
  });

  it.each(classicIds)('%s 正式卡片主動技可施放並結算，不只資料可讀', id => {
    const card = gameData.cards.find(c => c.id === id)!;
    const enemy = { ...gameData.enemies[0], hp: 1e9, atk: 0, def: 1000, cd: 99, abilities: [] };
    const stage = { ...gameData.stages[0], waves: [{ enemies: [enemy.id] }] };
    const data = { ...gameData, enemies: [enemy] };
    const snap = startBattle(stage, [{ cardId: id, level: 50 }], null, createRng(806), data).snapshot();
    snap.state.team[0].skillCooldown = 0;
    snap.state.board = { cols: 3, rows: 2, cells: ([card.attribute, card.attribute, card.attribute, 'heart', 'heart', 'heart'] as OrbType[]).map(type => ({ type, enhanced: false, locked: false, poison: false, hidden: false })) };
    const battle = resumeBattle(stage, snap, data);
    expect(battle.useSkill(0).ok).toBe(true);
    expect(battle.submitMove([{ row: 0, col: 0 }]).ok).toBe(true);
    expect(battle.getState().turns).toBe(1);
    expect(Number.isFinite(battle.getState().hp)).toBe(true);
  });

  it('原有三卡池的機率、費用與名單完整保留', () => {
    const old = {
      'covenant-seal': '931831a88f084eaccd0539b8aaa5e673d4a80b1474b560a5d002e48b27a8dd49',
      'twilight-seal': 'c24a0c00cadf7a0a45ac1c325e9052649ef6de2ae814b562bd07b0ecd963ba34',
      'pool-standard': 'b4f91dabdcca1307d0a06e1bb5ac9c69910e5dceba1bc69e4642750b7fed0e1f',
    };
    for (const [id, hash] of Object.entries(old)) expect(digest(gameData.gachaPools.find(p => p.id === id)), id).toBe(hash);
  });

  it('神族列入共用種族篩選並有台灣中文標籤', () => {
    expect(RACES).toContain('god');
    expect(RACE_NAMES.god).toBe('神族');
  });
});


describe('新積木的正式回合邊界', () => {
  it('三回合破防含施放當回合，第三回合傷害仍有增益、第四回合恢復防禦', () => {
    const card = { ...gameData.cards[0], activeSkill: 'defense-test', leaderSkill: undefined };
    const skill = { id: 'defense-test', name: '測試破防', description: '', cooldown: { max: 1, min: 1 }, effects: [{ type: 'reduceEnemyDefense' as const, percent: 90, turns: 3 }] };
    const enemy = { ...gameData.enemies[0], hp: 1e9, atk: 0, def: 1000, cd: 99, abilities: [] };
    const stage = { ...gameData.stages[0], waves: [{ enemies: [enemy.id] }] };
    const data = { ...gameData, cards: [card], skills: [skill], enemies: [enemy] };
    const snap = startBattle(stage, [{ cardId: card.id, level: 1 }], null, createRng(31), data).snapshot();
    snap.state.team[0].skillCooldown = 0;
    snap.state.team[0].attribute = 'fire';
    snap.state.team[0].atk = 10000;
    snap.state.buffs = [{ kind: 'noSkyfallCombo', turns: 20 }];
    let battle = resumeBattle(stage, snap, data);
    expect(battle.useSkill(0).ok).toBe(true);
    const damage: number[] = [];
    for (let turn = 0; turn < 4; turn++) {
      const next = battle.snapshot();
      next.state.board = boardFromStrings(['fff', 'whd']);
      battle = resumeBattle(stage, next, data);
      expect(defenseProfile(battle.getState().enemies[0]).def).toBe(turn < 3 ? 100 : 1000);
      const result = battle.submitMove([{ row: 0, col: 0 }]);
      expect(result.ok).toBe(true);
      if (result.ok) damage.push(result.summary.hits.reduce((sum, h) => sum + h.damage, 0));
    }
    expect(damage[0]).toBe(damage[2]);
    expect(damage[2]).toBeGreaterThan(damage[3]);
  });
});
