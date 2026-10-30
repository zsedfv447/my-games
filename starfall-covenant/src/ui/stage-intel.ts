// 關卡情報（出戰確認用）：每一波的敵人、屬性、能力說明，以及建議帶的屬性。純邏輯，不碰 DOM。
import { ATTRIBUTES, type Attribute, type EnemyAbility, type EnemyDef, type StageDef } from '../core/types';
import { attributeMultiplier, type BattleConfig } from '../battle/damage';
import { ATTRIBUTE_NAMES } from './art/palette';
import { STATUS_NAMES } from './status-labels';

export interface EnemyIntel {
  def: EnemyDef;
  /** 能力的短說明，例如「開場：護盾」「生命低於 50%：狂怒」 */
  abilities: string[];
}

export interface WaveIntel {
  boss: boolean;
  enemies: EnemyIntel[];
}

export interface StageIntel {
  waves: WaveIntel[];
  /** 敵人出現的屬性（依出現順序、不重複） */
  enemyAttributes: Attribute[];
  /** 剋制最多敵人（Boss 加倍計算）的屬性，最多 2 個 */
  suggested: Attribute[];
}

const attrName = (a: unknown) => (typeof a === 'string' && a in ATTRIBUTE_NAMES ? ATTRIBUTE_NAMES[a as Attribute] : '');

function abilityName(a: EnemyAbility): string {
  switch (a.status) {
    case 'comboShield': return a.value ? `Combo 盾（${a.value} Combo 以上才有效）` : STATUS_NAMES.comboShield;
    case 'attributeShield': {
      if (a.params?.attribute === 'rotate') return `屬性減傷（輪替）${a.value ? ` ${a.value}%` : ''}`;
      return `${attrName(a.params?.attribute) || ''}屬性減傷${a.value ? ` ${a.value}%` : ''}`;
    }
    case 'multiHit': return a.value ? `${a.value} 連擊` : STATUS_NAMES.multiHit;
    case 'damageAbsorb': return a.value ? `傷害吸收（單次超過 ${a.value.toLocaleString()}）` : STATUS_NAMES.damageAbsorb;
    case 'enrage': return a.value ? `狂怒（攻擊 ×${a.value}）` : STATUS_NAMES.enrage;
    case 'lockedOrbs': return `${attrName(a.params?.orb) ? `${attrName(a.params?.orb)}珠` : ''}${STATUS_NAMES.lockedOrbs}`;
    default: return STATUS_NAMES[a.status] ?? a.status;
  }
}

function triggerText(a: EnemyAbility): string {
  switch (a.trigger) {
    case 'onStart': return '開場';
    case 'onAttack': return '攻擊時';
    case 'hpBelow': return `生命低於 ${a.params?.percent ?? 50}%`;
    case 'everyNTurns': return `每 ${a.params?.n ?? 1} 回合`;
  }
}

export function abilityText(a: EnemyAbility): string {
  return `${triggerText(a)}：${abilityName(a)}`;
}

export function stageIntel(stage: Pick<StageDef, 'waves'>, enemies: EnemyDef[], config: BattleConfig): StageIntel {
  const byId = new Map(enemies.map((e) => [e.id, e]));
  const waves = stage.waves.map((w) => ({
    boss: !!w.boss,
    enemies: w.enemies.map((id) => byId.get(id)).filter((e): e is EnemyDef => !!e).map((def) => ({ def, abilities: def.abilities.map(abilityText) })),
  }));
  const enemyAttributes: Attribute[] = [];
  for (const w of waves) for (const e of w.enemies) if (!enemyAttributes.includes(e.def.attribute)) enemyAttributes.push(e.def.attribute);

  const score = new Map<Attribute, number>();
  for (const w of waves) {
    for (const e of w.enemies) {
      for (const a of ATTRIBUTES) {
        if (attributeMultiplier(a, e.def.attribute, config) > 1) score.set(a, (score.get(a) ?? 0) + (w.boss ? 2 : 1));
      }
    }
  }
  const suggested = [...score.entries()].sort((x, y) => y[1] - x[1] || ATTRIBUTES.indexOf(x[0]) - ATTRIBUTES.indexOf(y[0])).slice(0, 2).map(([a]) => a);
  return { waves, enemyAttributes, suggested };
}
