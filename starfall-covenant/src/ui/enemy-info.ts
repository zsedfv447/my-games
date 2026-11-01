// 敵人情報的數值列（點敵人打開的視窗用）：生命、防禦、攻擊間隔、攻擊對象。純函式，方便測試
import type { ActiveSkillDef } from '../core/types';
import { ringOf } from '../battle/skills/ring';
import { ATTRIBUTE_NAMES, ORB_NAMES } from './art/palette';
import { statusDetail, statusName } from './status-labels';
import type { BattleState, EnemyState } from '../battle/battle-state';
import { defenseProfile, enemyHitCount, isMemberSealed, isSkillSealed } from '../battle/skills/status';

export interface InfoRow {
  label: string;
  value: string;
}

export function enemyStatRows(e: EnemyState): InfoRow[] {
  const def = defenseProfile(e).def;
  const hits = enemyHitCount(e);
  return [
    { label: '生命', value: `${Math.max(0, e.hp).toLocaleString()} / ${e.maxHp.toLocaleString()}` },
    // 防禦降低時顯示目前值與原本的值
    { label: '防禦', value: def === e.def.def ? def.toLocaleString() : `${def.toLocaleString()}（原本 ${e.def.def.toLocaleString()}）` },
    { label: '攻擊間隔', value: `每 ${e.maxCooldown} 回合` },
    // 我方共用一條生命，敵人的攻擊都是打全隊；連擊會拆成好幾段（總傷害不變）
    { label: '攻擊對象', value: hits > 1 ? `我方全隊（共用生命）・${hits} 段` : '我方全隊（共用生命）' },
  ];
}

/** Live facts only: no current-turn budget, simulation, global catalog or skill execution. */
export function enemyGuide(state: BattleState, enemyIndex: number, skills: Record<string, ActiveSkillDef>): { sections: { title: string; lines: string[] }[] } {
  const enemy = state.enemies[enemyIndex];
  if (!enemy) return { sections: [] };
  const number = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString() : '未知';
  const active = enemy.statuses.filter(status => status.turns === null || !Number.isFinite(status.turns) || status.turns > 0);
  const sections = [{ title: '目前敵人狀態', lines: [
    ...enemyStatRows(enemy).map(row => `${row.label}：${row.value}`),
    enemy.lockedTurns > 0 ? `定身剩餘 ${number(enemy.lockedTurns)} 回合；攻擊倒數暫停於 ${number(enemy.cooldown)} 回合。` : `下次攻擊倒數：${number(enemy.cooldown)} 回合。`,
    '能力曾經「已觸發」不代表已失效；是否仍生效以目前狀態為準。',
  ] }];
  for (const status of active) {
    const duration = status.turns === null ? '永久（直到被解除，不會隨回合自然消失）' : Number.isFinite(status.turns) ? `剩餘 ${number(status.turns)} 回合` : '持續時間未知';
    const lines: string[] = [`${statusName(status.id, status.params)}・${duration}`];
    switch (status.id) {
      case 'damageAbsorb':
        lines.push(`門檻：${number(status.value)}。每個敵人分別計算本回合累積的適用傷害（防禦與其他減傷結算後）；門檻內扣血，超過的部分改為回復該敵人，不是復活。`,
          '固定傷害、最大生命百分比傷害，以及明確無視護盾的傷害不走這個吸收分支；只有無視防禦並不能避開吸收。',
          '固定傷害仍可能受一般護盾、屬性減傷或七曜環影響；避開吸收不等於穿透所有防禦，也不保證擊殺。',
          '一般隊伍可避免增傷爆發，減少本回合攻擊來源，嘗試分回合削血；希臘天降與追打仍可能追加傷害，少 Combo 不保證安全。選擇固定傷害等方法時，先確認 CD 與封印。',
          '此畫面沒有本回合吸收剩餘額度，不能由這些資訊推算安全傷害或保證安全的 Combo 數。');
        break;
      case 'comboShield':
        lines.push(`門檻：${number(status.value)} Combo；未達門檻的屬性傷害無效。固定與最大生命百分比傷害不受此 Combo 盾門檻影響；其他護盾另判。`);
        break;
      case 'shield':
        lines.push(`目前護盾減傷：${number(status.value ?? 100)}%。可檢查技能是否明確標示無視護盾；只有固定或無視防禦不代表能穿透此盾。`);
        break;
      case 'attributeShield': {
        const attributes = defenseProfile({ ...enemy, statuses: [status] }).attributeShield?.attributes ?? [];
        lines.push(`目前減傷屬性：${attributes.map(attribute => ATTRIBUTE_NAMES[attribute]).join('、') || '未知'}；減傷 ${number(status.value)}%。其他屬性仍須處理該敵人的其他防禦。`);
        break;
      }
      case 'ringShield': {
        const ring = ringOf({ statuses: [status] });
        if (!ring) lines.push('七曜環資料未知。');
        else if (ring.shattered) lines.push(`七曜環已碎裂，屬性傷害易傷 ×${number(ring.vulnerable)}；固定與百分比傷害不享此易傷。`);
        else lines.push(`尚未破除：${ring.slots.filter(orb => !ring.broken.includes(orb)).map(orb => ORB_NAMES[orb]).join('、')}；減傷 ${number(ring.reduction)}%。`,
          '對應屬性的攻擊須實際造成傷害才破該屬性格；心格要消除心珠，但我方心珠封印會阻止破除心格。固定與百分比傷害不能破環，且仍會被環減傷。');
        break;
      }
      default:
        lines.push(statusDetail(status.id) || '未知狀態；目前沒有可靠的專屬對策。');
        if (status.value !== undefined) lines.push(`目前數值：${number(status.value)}`);
    }
    sections.push({ title: '目前狀態與對策', lines });
  }
  if (!active.length) sections.push({ title: '目前狀態與對策', lines: ['目前沒有列出的生效狀態；曾觸發的能力不作為仍有護盾的依據。'] });
  if (active.some(status => status.id === 'damageAbsorb')) {
    const methods: string[] = [];
    state.team.forEach((member, index) => {
      const skill = member.card.activeSkill ? skills[member.card.activeSkill] : undefined;
      if (!skill || !skill.effects.some(effect => effect.type === 'damage' && (effect.mode === 'fixed' || effect.mode === 'percentMaxHp' || effect.ignoreShield === true))) return;
      const seals = [isSkillSealed(state) && '技能封印中', isMemberSealed(state, index) && '星紋封印中'].filter(Boolean);
      methods.push(`位置 ${index + 1}・${member.card.name}：${skill.name}・CD ${number(member.skillCooldown)}${seals.length ? `・${seals.join('、')}` : '・目前未被技能／星紋封印'}`, skill.description || '技能原文未知。');
    });
    sections.push({ title: '可參考的隊伍技能（只針對吸收）', lines: [
      '以下只列含可避開吸收之直接傷害段的技能；同一技能的其他傷害段另判。CD、封印與其他防禦仍須確認，不保證現在可施放或擊殺。',
      ...(methods.length ? methods : ['目前已知隊員技能中沒有列出這類直接傷害方法；缺失的技能資料不作推測。']),
    ] });
  }
  return { sections };
}
