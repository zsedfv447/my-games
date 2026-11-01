import type { CardDef, StageDef } from '../core/types';
import type { GameData } from '../data/validate';
export interface ChainTactics {
  trial: StageDef;
  members: { card: CardDef; level: number; helper: boolean; leader: boolean; role: string; activeDescription: string; leaderDescription?: string }[];
  mechanics: readonly string[];
  comparisons: CardDef[];
  orderExample: { intro: string; rows: readonly { label: string; dark: number; fire: number }[]; note: string };
}
/** 純借隊教材，不讀存檔、不模擬傷害，也不變更盤面。 */
export function buildChainTactics(data: GameData): ChainTactics | null {
  const trial = data.stages.find(stage => stage.id === 'trial-chain' && stage.kind === 'trial' && stage.archetype === 'chain');
  if (!trial?.fixedTeam) return null;
  const roster = [
    ...trial.fixedTeam.members.map((member, index) => ({ ...member, helper: false, leader: index === 0 })),
    ...(trial.fixedTeam.helper ? [{ ...trial.fixedTeam.helper, helper: true, leader: true }] : []),
  ];
  const roles: Record<string, string> = {
    s509: '轉蝕支援：心珠轉為蝕珠，會消耗原本可用來回復的心珠。',
    s107: '轉焰與操作時間支援：蝕珠轉為焰珠，轉珠時間延長 1 秒（1 回合）；留意是否把隊友需要的蝕珠轉走。',
    s506: '補蝕支援：輝珠轉為蝕珠，先確認盤面有來源珠。',
    s511: '技能周轉支援：其他隊員技能冷卻減少 1 回合，不包含施放者。',
    s508: '延遲支援：可延遲時使敵人行動延遲 2 回合；仍需依敵人實際狀態判斷。',
  };
  const members: ChainTactics['members'] = [];
  for (const member of roster) {
    const card = data.cards.find(card => card.id === member.card);
    if (!card) continue;
    const active = data.skills.find(skill => skill.id === card.activeSkill);
    const leaderDescription = member.leader ? data.leaderSkills.find(skill => skill.id === card.leaderSkill)?.description : undefined;
    members.push({ card, level: member.level, helper: member.helper, leader: member.leader,
      role: (active?.description ? roles[active.id] : undefined) ?? '依下方可用的技能說明安排支援；缺少說明時不推測效果。',
      activeDescription: active?.description || '暫無主動技說明。',
      ...(leaderDescription ? { leaderDescription } : {}),
    });
  }
  const leaders = members.filter(member => member.leader);
  const dual509 = leaders.length === 2 && leaders.some(member => !member.helper) && leaders.some(member => member.helper)
    && leaders.every(member => member.card.id === 'c509' && member.card.leaderSkill === 'l509' && member.leaderDescription);
  const hasConverter = (cardId: string, skillId: string) => members.some(member => member.card.id === cardId && member.card.activeSkill === skillId)
    && data.skills.some(skill => skill.id === skillId && !!skill.description);
  const hasOrder = hasConverter('c509', 's509') && hasConverter('c107', 's107');
  return {
    trial, members,
    mechanics: [
      dual509 ? '本借隊的隊長與助戰都是蝕晶幼龍：任一顏色一組消除 5 顆以上，各自觸發攻擊 2 倍，合計 4 倍；這項隊長加成不附帶無視防禦。'
        : '隊長加成依真正隊長與助戰的技能說明判斷；資料不完整時不推測倍率，也不把普通隊員當隊長。',
      `全體攻擊按每位成員本色的每一組判定：一組 ${data.config.battle.fullAttackOrbCount} 顆以上該組傷害打全體；其他組仍依各自珠數判定。蝕 3 顆與焰 5 顆不是所有成員一起打全體。`,
      '無視防禦是另一種隊長效果，不能從長串或全體攻擊直接推斷；可點開下方比較卡片的實際隊長技查看門檻。',
    ],
    comparisons: ['c510', 'c501'].flatMap(id => { const card = data.cards.find(card => card.id === id); return card ? [card] : []; }),
    orderExample: {
      intro: hasOrder ? '普通示例盤（不是目前戰鬥盤面）：蝕、心、焰、潮、森各 6 顆。只比較兩次轉珠後的顏色數量，不假設自然消除或天降。' : '缺少本借隊的轉珠技能說明，暫不提供施放順序示例。',
      rows: hasOrder ? [
        { label: '先心→蝕，再蝕→焰', dark: 0, fire: 18 },
        { label: '先蝕→焰，再心→蝕', dark: 6, fire: 12 },
      ] : [],
      note: hasOrder ? '兩種順序都包含長長的火提供的轉珠時間 +1 秒（1 回合）。保留哪種顏色要看盤面、隊伍與敵人，不能直接說哪種傷害較高；這不是即時傷害預測，也不保證通關。'
        : '依可用的原始技能說明安排；缺失資料不猜效果。這不是即時傷害預測。',
    },
  };
}
