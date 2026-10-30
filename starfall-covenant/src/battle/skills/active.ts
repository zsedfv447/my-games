// 主動技：SkillEffect 的 24 種效果積木。
//
// 約定：
// - 施放當回合算持續效果的第 1 回合；在我方回合結束時（敵人行動之後）回合數 −1。
// - damage 的 multiplier 模式＝施放者攻擊 × value，屬性預設為施放者屬性；fixed 模式不吃剋制與防禦。
// - damageOverTime 每回合在我方攻擊之後結算，傷害＝施放者攻擊 × multiplier，屬性為施放者屬性。
// - reduceAllyCooldown 只減其他隊友，不含施放者自己。
// - chainOnSkill：效果持續期間，之後每施放 1 次主動技，追加施放者攻擊 × multiplier 的單體傷害（不含觸發它的那一次）。
// - delayEnemy／lockEnemy 對帶 delayImmune 的敵人無效。
// - cleanse 解除我方全部異常狀態，並清除盤面上的封鎖珠、毒珠、暗珠。

import type { ActiveSkillDef, SkillEffect } from '../../core/types';
import type { Rng } from '../../core/rng';
import {
  balanceBoard,
  clearInterference,
  convertOrbs,
  enhanceOrbs,
  fillMissingOrbs,
  refreshBoard,
} from '../board';
import type { Hit } from '../damage';
import type { BattleState } from '../runtime';
import { buffsOf, skyfallOptions } from './buffs';
import { rowToOrb, twoColorBoard } from './board-ops';
import { isDelayImmune } from './status';

export interface SkillOutcome {
  /** 要打到敵人身上的傷害（含技能連鎖追加） */
  hits: Hit[];
  /** 對敵人施加的持續傷害（索引） */
  dotTargets: number[];
  heal: number;
  selfDamage: number;
  boardChanged: boolean;
  /** 被延遲或鎖定的敵人 */
  delayed: number[];
  cleansed: boolean;
}

/** 依技能等級算冷卻：每升 1 級 −1，最低到 cooldown.min（與養成模組一致） */
export function cooldownAtLevel(skill: ActiveSkillDef, skillLevel = 1): number {
  return Math.max(skill.cooldown.min, skill.cooldown.max - (skillLevel - 1));
}

/** 施放主動技，直接修改 state（盤面、buff、敵人倒數），傷害與回復交給呼叫端結算 */
export function applyActiveSkill(state: BattleState, caster: number, skill: ActiveSkillDef, rng: Rng): SkillOutcome {
  const me = state.team[caster];
  const out: SkillOutcome = { hits: [], dotTargets: [], heal: 0, selfDamage: 0, boardChanged: false, delayed: [], cleansed: false };

  // 先結算已經存在的技能連鎖，再套用這次的效果（避免觸發自己）
  for (const chain of buffsOf(state, 'chainOnSkill')) {
    const owner = state.team[chain.member];
    out.hits.push({ member: chain.member, attribute: owner.attribute, target: 'single', amount: owner.atk * chain.multiplier });
  }

  for (const effect of skill.effects) applyEffect(effect);
  return out;

  function applyEffect(e: SkillEffect): void {
    switch (e.type) {
      case 'convertOrbs':
        state.board = convertOrbs(state.board, e.from, e.to);
        out.boardChanged = true;
        break;
      case 'refreshBoard':
        state.board = refreshBoard(state.board, rng, skyfallOptions(state));
        out.boardChanged = true;
        break;
      case 'balanceBoard':
        state.board = balanceBoard(state.board, rng);
        out.boardChanged = true;
        break;
      case 'enhanceOrbs':
        state.board = enhanceOrbs(state.board, e.orbs);
        out.boardChanged = true;
        break;
      case 'fillMissingOrbs':
        state.board = fillMissingOrbs(state.board, rng, e.count);
        out.boardChanged = true;
        break;
      case 'twoColorBoard':
        state.board = twoColorBoard(state.board, e.colors, e.keep);
        out.boardChanged = true;
        break;
      case 'rowToOrb':
        state.board = rowToOrb(state.board, e.row, e.to);
        out.boardChanged = true;
        break;
      case 'setSkyfallRate':
        state.buffs.push({ kind: 'skyfallRate', orb: e.orb, rate: e.rate, turns: e.turns });
        break;
      case 'setEnhancedSkyfallRate':
        state.buffs.push({ kind: 'enhancedSkyfall', rate: e.rate, turns: e.turns });
        break;
      case 'damage':
        out.hits.push(
          e.mode === 'fixed'
            ? { member: caster, target: e.target, amount: e.value, fixed: true, ignoreShield: e.ignoreShield }
            : {
                member: caster,
                attribute: e.attribute ?? me.attribute,
                target: e.target,
                amount: me.atk * e.value,
                ignoreDefense: e.ignoreDefense,
                ignoreShield: e.ignoreShield,
              },
        );
        break;
      case 'damageOverTime': {
        const targets = e.target === 'all'
          ? state.enemies.map((_, i) => i).filter((i) => state.enemies[i].hp > 0)
          : [state.target];
        for (const i of targets) {
          state.enemies[i].dots.push({ amount: me.atk * e.multiplier, attribute: me.attribute, turns: e.turns });
          out.dotTargets.push(i);
        }
        break;
      }
      case 'heal':
        out.heal += Math.floor(e.mode === 'rcvMultiplier' ? me.rcv * e.value : (state.maxHp * e.value) / 100);
        break;
      case 'selfDamage': {
        // 自損不會致死：最少留 1 點
        const loss = Math.min(Math.floor((state.hp * e.percentCurrentHp) / 100), state.hp - 1);
        out.selfDamage += Math.max(0, loss);
        state.hp -= Math.max(0, loss);
        break;
      }
      case 'surviveOnce':
        state.buffs.push({ kind: 'surviveOnce', turns: e.turns });
        break;
      case 'buffAttack':
        state.buffs.push({ kind: 'attack', target: e.target, multiplier: e.multiplier, turns: e.turns });
        break;
      case 'rcvToAtk':
        state.buffs.push({ kind: 'rcvToAtk', ratio: e.ratio, turns: e.turns });
        break;
      case 'reduceDamage':
        state.buffs.push({ kind: 'reduceDamage', percent: e.percent, turns: e.turns });
        break;
      case 'delayEnemy':
        state.enemies.forEach((enemy, i) => {
          if (enemy.hp <= 0 || isDelayImmune(enemy)) return;
          enemy.cooldown += e.turns;
          out.delayed.push(i);
        });
        break;
      case 'lockEnemy':
        state.enemies.forEach((enemy, i) => {
          if (enemy.hp <= 0 || isDelayImmune(enemy)) return;
          enemy.lockedTurns = Math.max(enemy.lockedTurns, e.turns);
          out.delayed.push(i);
        });
        break;
      case 'extendMoveTime':
        state.buffs.push({ kind: 'moveTime', seconds: e.seconds, turns: e.turns });
        break;
      case 'noSkyfallCombo':
        state.buffs.push({ kind: 'noSkyfallCombo', turns: e.turns });
        break;
      case 'reduceAllyCooldown':
        state.team.forEach((m, i) => {
          if (i !== caster && m.skillCooldown !== null) m.skillCooldown = Math.max(0, m.skillCooldown - e.turns);
        });
        break;
      case 'chainOnSkill':
        state.buffs.push({ kind: 'chainOnSkill', member: caster, multiplier: e.multiplier, turns: e.turns });
        break;
      case 'cleanse':
        state.teamStatuses = [];
        state.board = clearInterference(state.board);
        out.boardChanged = true;
        out.cleansed = true;
        break;
    }
  }
}
