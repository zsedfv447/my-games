import type { CardDef, StageDef } from '../core/types';
import type { GameData } from '../data/validate';

export interface FixedTacticsMember {
  card: CardDef;
  level: number;
  helper: boolean;
  /** 真正隊長位置或助戰，不能由卡片 ID 推斷。 */
  leader: boolean;
  role: string;
  activeDescription: string;
  leaderDescription?: string;
}

export interface FixedTactics {
  trial: StageDef;
  members: FixedTacticsMember[];
  steps: readonly string[];
  defenses: readonly { label: string; detail: string }[];
}

/** 靜態借隊教材：不讀取持有卡片、存檔或解鎖狀態，也不推算即時傷害。 */
export function buildFixedTactics(data: GameData): FixedTactics | null {
  const trial = data.stages.find(stage => stage.id === 'trial-fixed' && stage.kind === 'trial' && stage.archetype === 'fixed' && stage.fixedTeam);
  if (!trial?.fixedTeam) return null;

  const members: FixedTacticsMember[] = [];
  const roster = [
    ...trial.fixedTeam.members.map((member, index) => ({ ...member, helper: false, leader: index === 0 })),
    ...(trial.fixedTeam.helper ? [{ ...trial.fixedTeam.helper, helper: true, leader: true }] : []),
  ];
  for (const member of roster) {
    const card = data.cards.find(candidate => candidate.id === member.card);
    if (!card) continue;
    const active = data.skills.find(skill => skill.id === card.activeSkill);
    const activeDescription = active?.description ?? '暫無主動技說明。';
    const leaderDescription = member.leader ? data.leaderSkills.find(skill => skill.id === card.leaderSkill)?.description : undefined;
    const roles: Record<string, string> = {
      c307: member.leader && leaderDescription
        ? '隊長／助戰：消除心珠觸發固定傷害與有傷害上限的比例追打；主動技提供單體固定傷害。'
        : '主動技提供單體固定傷害；在隊員位置不會啟動隊長追打。',
      c306: '轉心支援：把蝕珠轉為心珠，施放前先確認盤面有蝕珠。',
      c208: '回復支援：直接回復生命，並提高心珠天降機率；不保證一定落下心珠。',
      c308: '減傷支援：在技能持續回合內降低受到的傷害，配合敵人倒數使用。',
      c408: '解除異常與回復支援：依技能說明解除異常狀態並回復生命。',
    };
    members.push({ card, level: member.level, helper: member.helper, leader: member.leader, role: (active ? roles[card.id] : undefined) ?? '依下方可用的技能說明安排支援；缺少說明時不推測效果。', activeDescription, ...(leaderDescription ? { leaderDescription } : {}) });
  }

  return {
    trial,
    members,
    steps: [
      '先看敵人行動倒數與防禦機制，再決定本回合保命或進攻。',
      '盤面允許時保留心珠，並嘗試拆成多組；不要為追打犧牲必要的回復。',
      '轉珠前確認盤面存在技能需要的來源珠；沒有來源就無法靠該轉換補心。',
      '依生命與異常狀態使用回復、減傷或解除異常技能；天降有變數，並非保證解法。',
    ],
    defenses: [
      { label: '防禦與 Combo 盾', detail: '固定傷害可無視敵人防禦與 Combo 盾；一般攻擊仍依各自規則結算。' },
      { label: '減傷盾與七曜環', detail: '固定傷害仍受一般減傷盾與七曜環減傷影響，不能把固定傷害當成無視所有護盾。' },
      { label: '明確無視護盾', detail: '技能明確標示「無視護盾」的效果是另一項條件，不等於固定傷害或無視防禦。以上是機制說明，不是即時傷害預測。' },
    ],
  };
}
