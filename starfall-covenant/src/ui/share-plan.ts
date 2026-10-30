// 「契約回憶」分享圖的版面與文字（純資料，不碰 DOM／Canvas，方便測試）

export const SHARE_W = 720;
export const SHARE_H = 960;

export interface ShareMember {
  cardId: string;
  name: string;
  /** 助戰、借用隊伍不知道等級時省略 */
  level?: number;
  isHelper?: boolean;
}

export interface ShareInput {
  stageName: string;
  /** 例如「第 1 章・焦骨荒原」；非主線關卡為關卡類型 */
  place: string;
  constellation?: string;
  turns: number;
  maxCombo: number;
  /** 這次拿到的星章 */
  stars: boolean[];
  starTexts: string[];
  team: ShareMember[];
  playerName: string;
  playerLevel: number;
  /** 通關時間（毫秒） */
  at: number;
  firstClear: boolean;
}

export interface ShareStat {
  label: string;
  value: string;
}

export interface SharePlan {
  title: string;
  stageName: string;
  place: string;
  badge?: string;
  stats: ShareStat[];
  starLine: string;
  starRows: { text: string; got: boolean }[];
  slots: { x: number; y: number; size: number; member: ShareMember }[];
  footer: string;
  fileName: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** 日期顯示用本地時間：2026/10/31 */
export function shareDate(at: number): string {
  const d = new Date(at);
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
}

/** 隊伍頭像排成一列置中；6 人（含助戰）時縮小，保證不超出畫布 */
export function memberSlots(members: ShareMember[], y: number, width = SHARE_W): SharePlan['slots'] {
  const n = members.length;
  if (!n) return [];
  const gap = 14;
  const size = Math.min(112, Math.floor((width - 80 - gap * (n - 1)) / n));
  const total = size * n + gap * (n - 1);
  const left = (width - total) / 2;
  return members.map((member, i) => ({ x: Math.round(left + i * (size + gap)), y, size, member }));
}

export function sharePlan(input: ShareInput): SharePlan {
  const got = input.stars.filter(Boolean).length;
  const d = new Date(input.at);
  return {
    title: '契約回憶',
    stageName: input.stageName,
    place: input.constellation ? `${input.place}・${input.constellation}` : input.place,
    badge: input.firstClear ? '首次淨化' : undefined,
    stats: [
      { label: '回合數', value: `${input.turns}` },
      { label: '最高 Combo', value: `${input.maxCombo}` },
      { label: '星章', value: input.stars.length ? `${got}/${input.stars.length}` : '—' },
    ],
    starLine: input.stars.map((g) => (g ? '★' : '☆')).join(''),
    starRows: input.starTexts.map((text, i) => ({ text, got: !!input.stars[i] })),
    slots: memberSlots(input.team, 408),
    footer: `${input.playerName}・契印師 Lv.${input.playerLevel}・${shareDate(input.at)}`,
    fileName: `starfall-${input.stageName.replace(/[\\/:*?"<>|\s]/g, '')}-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.png`,
  };
}
