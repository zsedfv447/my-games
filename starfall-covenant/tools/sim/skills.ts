// 模擬器的主動技施放策略：依技能效果與戰況決定這回合要不要放、先放哪個。
//
// 原則（模仿一般玩家）：
// - 進攻類（轉珠、強化、盤面整理、攻擊 buff、傷害、持續傷害、技能連鎖、天降、延長轉珠時間）：好了就放。
// - 防守類（減傷、瀕死保命、延遲、鎖定敵人）：有敵人這回合會出手，或血量低於一半時才放。
// - 回復：血量低於 65% 才放；背水隊只在預測這回合會被打死時才放；解除異常：身上有異常、盤面干擾珠夠多或血量偏低時才放。
// - 自損：放完後血量要在一半以上；背水隊只要放完後撐得過這回合就放（低血量正是它要的）。
// - 冷卻縮減：有其他隊友在冷卻中才放，而且最先放，放完再看有沒有新的技能好了。
// - 技能循環流派：任何技能好了就放（隊長技要「本回合施放過主動技」）。
import type { ActiveSkillDef, ArchetypeId, SkillEffect } from '../../src/core/types';
import type { Battle, BattleState } from '../../src/battle/battle-state';
import { incomingDamage } from '../../src/battle/damage';
import { buffDamageReductions, buffsOf } from '../../src/battle/skills/buffs';
import { enemyAtkMultiplier, enemyHitCount, poisonPercent } from '../../src/battle/skills/status';

type Need = 'always' | 'defense' | 'heal' | 'cleanse' | 'cooldown' | 'never';

const OFFENSIVE = new Set<SkillEffect['type']>([
  'convertOrbs', 'refreshBoard', 'balanceBoard', 'enhanceOrbs', 'fillMissingOrbs', 'twoColorBoard', 'rowToOrb', 'setSkyfallRate',
  'setEnhancedSkyfallRate', 'damage', 'damageOverTime', 'buffAttack', 'rcvToAtk', 'extendMoveTime',
  'noSkyfallCombo', 'chainOnSkill',
]);
const DEFENSIVE = new Set<SkillEffect['type']>(['reduceDamage', 'surviveOnce', 'delayEnemy', 'lockEnemy']);

function needOf(e: SkillEffect): Need {
  if (OFFENSIVE.has(e.type)) return 'always';
  if (DEFENSIVE.has(e.type)) return 'defense';
  if (e.type === 'heal') return 'heal';
  if (e.type === 'cleanse') return 'cleanse';
  if (e.type === 'reduceAllyCooldown') return 'cooldown';
  return 'never';
}

const hpPercent = (s: BattleState) => (s.hp / s.maxHp) * 100;

/**
 * 預估這回合結束前我方會受到的傷害：會出手的敵人攻擊（含狂暴、主動技減傷）加上中毒。
 * 不計隊長技減傷，所以估得偏高、偏保守。
 */
export function predictedDamage(s: BattleState): number {
  const reductions = buffDamageReductions(s);
  const attacks = s.enemies
    .filter((e) => e.hp > 0 && e.lockedTurns === 0 && e.cooldown <= 1)
    .reduce((sum, e) => sum + enemyHitCount(e) * incomingDamage((e.def.atk * enemyAtkMultiplier(e)) / enemyHitCount(e), reductions), 0);
  return attacks + Math.floor((s.maxHp * poisonPercent(s)) / 100);
}

/** 以 hp 的血量撐不撐得過這回合（有瀕死保命且敵人不是連擊時算撐得過） */
function survives(s: BattleState, hp: number): boolean {
  if (hp > predictedDamage(s)) return true;
  const multiHit = s.enemies.some((e) => e.hp > 0 && enemyHitCount(e) > 1);
  return buffsOf(s, 'surviveOnce').length > 0 && !multiHit;
}

/** 這回合是否有敵人會出手（倒數到 1 且沒被鎖定） */
const enemyAttacksSoon = (s: BattleState) => s.enemies.some((e) => e.hp > 0 && e.lockedTurns === 0 && e.cooldown <= 1);

function isUseful(need: Need, s: BattleState, caster: number, archetype: ArchetypeId): boolean {
  switch (need) {
    case 'always':
      return true;
    case 'defense':
      return enemyAttacksSoon(s) || hpPercent(s) < 50;
    case 'heal':
      // 背水隊要維持低血量吃倍率，只在預測下一次敵人攻擊會致死時才補
      return archetype === 'berserk' ? !survives(s, s.hp) : hpPercent(s) < 65;
    case 'cleanse': {
      const interference = s.board.cells.filter((o) => o.locked || o.poison || o.hidden).length;
      return s.teamStatuses.length > 0 || interference >= 3 || hpPercent(s) < 50;
    }
    case 'cooldown':
      return s.team.some((m, i) => i !== caster && (m.skillCooldown ?? 0) > 0);
    case 'never':
      return false;
  }
}

/** 自損技能放完後的血量是否還安全 */
function selfDamageSafe(skill: ActiveSkillDef, s: BattleState, archetype: ArchetypeId): boolean {
  const loss = skill.effects.reduce((p, e) => (e.type === 'selfDamage' ? p + e.percentCurrentHp : p), 0);
  if (loss === 0) return true;
  const after = s.hp * (1 - loss / 100);
  // 背水隊：自損後仍撐得過這回合就放；其他隊：自損後血量要在一半以上
  return archetype === 'berserk' ? survives(s, after) : (after / s.maxHp) * 100 >= 50;
}

/** 施放順序：冷卻縮減 → 盤面變化 → 其他 */
function priority(skill: ActiveSkillDef): number {
  if (skill.effects.some((e) => e.type === 'reduceAllyCooldown')) return 0;
  if (skill.effects.some((e) => ['convertOrbs', 'refreshBoard', 'balanceBoard', 'fillMissingOrbs', 'twoColorBoard', 'rowToOrb'].includes(e.type))) return 1;
  return 2;
}

/** 決定此刻要放的技能（隊員索引，依施放順序） */
export function chooseSkills(
  s: BattleState,
  skillOf: (member: number) => ActiveSkillDef | undefined,
  archetype: ArchetypeId,
): number[] {
  if (s.teamStatuses.some((x) => x.id === 'skillSeal')) return [];
  const ready = s.team
    .map((m, i) => ({ i, skill: skillOf(i), cd: m.skillCooldown }))
    .filter((x): x is { i: number; skill: ActiveSkillDef; cd: 0 } => x.cd === 0 && !!x.skill);
  return ready
    .filter(({ i, skill }) => {
      if (!selfDamageSafe(skill, s, archetype)) return false;
      if (archetype === 'skillcycle') return true;
      return skill.effects.some((e) => isUseful(needOf(e), s, i, archetype));
    })
    .sort((a, b) => priority(a.skill) - priority(b.skill))
    .map((x) => x.i);
}

/**
 * 轉珠前施放技能：放完一個就重新判斷（冷卻縮減可能讓其他技能好了，轉珠也會改變盤面）。
 * 回傳本回合是否施放過主動技。
 */
export function castSkills(
  battle: Battle,
  skillOf: (member: number) => ActiveSkillDef | undefined,
  archetype: ArchetypeId,
): boolean {
  let used = false;
  const tried = new Set<number>();
  for (let guard = 0; guard < 20; guard++) {
    const s = battle.getState();
    if (s.phase !== 'player') break;
    const next = chooseSkills(s, skillOf, archetype).find((i) => !tried.has(i));
    if (next === undefined) break;
    tried.add(next);
    if (battle.useSkill(next).ok) used = true;
  }
  return used;
}
