// 失敗引導：依關卡情報與目前隊伍，挑出最值得做的幾件事（強化、換隊、借助戰、注意敵人能力）。純邏輯。
import type { Attribute, CardDef, StageDef } from '../core/types';
import { ATTRIBUTE_NAMES } from './art/palette';
import type { StageIntel } from './stage-intel';

export type AdviceKind = 'enhance' | 'team' | 'helper' | 'tip';

export interface Advice {
  kind: AdviceKind;
  text: string;
  /** 捷徑要去的畫面（tip 沒有捷徑） */
  go?: { screen: string; args: string[]; label: string };
}

export interface DefeatInput {
  stage: Pick<StageDef, 'id' | 'waves' | 'recommendedArchetypes'> & { fixedTeam?: unknown };
  intel: StageIntel;
  /** 我方隊員（借用隊伍時給空陣列） */
  members: { uid?: string; card: CardDef; level: number }[];
  hasHelper: boolean;
  helperAllowed: boolean;
  /** 隊伍主流派（analyzeTeam 的 primary） */
  primaryArchetype: string | null;
  archetypeName: (id: string) => string;
}

const names = (attrs: Attribute[]) => attrs.map((a) => ATTRIBUTE_NAMES[a]).join('、');

/** 敵人能力 → 對策；同一種只提一次 */
const COUNTERS: { match: RegExp; text: string }[] = [
  { match: /Combo 盾/, text: '有敵人帶 Combo 盾，Combo 不夠時傷害無效，先練習湊多組再出手。' },
  { match: /傷害吸收/, text: '有敵人會吸收過高的單次傷害，打到上限附近就好，不要一次爆發太多。' },
  { match: /技能封印/, text: '有敵人會封印主動技，重要的技能在被封印前先放。' },
  { match: /心珠封印/, text: '有敵人會封印心珠回復，帶減傷或高生命的隊伍比較穩。' },
  { match: /屬性減傷/, text: '有敵人會減少特定屬性的傷害，多帶一種屬性的隊員分散輸出。' },
  { match: /狂怒/, text: '有敵人生命變低後會狂怒，最後一段要一口氣打完。' },
];

export function defeatAdvice(input: DefeatInput): Advice[] {
  const { stage, intel, members } = input;
  const out: Advice[] = [];
  const borrowed = !!stage.fixedTeam;

  if (!borrowed && members.length) {
    // 等級最落後的隊員（依等級比例）
    const weakest = [...members].sort((a, b) => a.level / a.card.maxLevel - b.level / b.card.maxLevel)[0];
    if (weakest.level < weakest.card.maxLevel && weakest.uid) {
      out.push({ kind: 'enhance', text: `${weakest.card.name} 還是 Lv.${weakest.level}（上限 ${weakest.card.maxLevel}），強化後生命與攻擊都會提升。`, go: { screen: 'enhance', args: [weakest.uid], label: '前往強化' } });
    }
    const teamAttrs = new Set(members.map((m) => m.card.attribute));
    const missing = intel.suggested.filter((a) => !teamAttrs.has(a));
    if (missing.length && missing.length === intel.suggested.length) {
      out.push({ kind: 'team', text: `敵人多為${names(intel.enemyAttributes)}屬性，換上${names(missing)}屬性的隊員能打出剋制傷害。`, go: { screen: 'team', args: [], label: '調整隊伍' } });
    } else if (stage.recommendedArchetypes?.length && (!input.primaryArchetype || !stage.recommendedArchetypes.includes(input.primaryArchetype as never))) {
      out.push({ kind: 'team', text: `這一關推薦${stage.recommendedArchetypes.map(input.archetypeName).join('、')}流派，可以照推薦重新編隊。`, go: { screen: 'team', args: [], label: '調整隊伍' } });
    }
  }
  if (input.helperAllowed && !input.hasHelper) {
    out.push({ kind: 'helper', text: '這次沒有帶助戰。助戰卡的隊長技會和你的隊長技相乘，效果很明顯。', go: { screen: 'helper', args: [stage.id], label: '借助戰' } });
  }

  const abilities = intel.waves.flatMap((w) => w.enemies.flatMap((e) => e.abilities));
  for (const c of COUNTERS) {
    if (out.filter((a) => a.kind === 'tip').length >= 2) break;
    if (abilities.some((a) => c.match.test(a))) out.push({ kind: 'tip', text: c.text });
  }
  if (!out.length) out.push({ kind: 'tip', text: '試著先把同色珠排成一列再一次消除，Combo 越多傷害越高。' });
  return out;
}

/** 「打到第 2 / 3 波」：wave 為 0 起算 */
export function waveProgressText(wave: number, waveCount: number): string {
  return `打到第 ${Math.min(wave + 1, waveCount)} / ${waveCount} 波`;
}
