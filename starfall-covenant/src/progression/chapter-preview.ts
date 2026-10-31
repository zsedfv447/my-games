// 章節先展示獎勵：這一章首通會給的卡、通過後會開放的關卡與系統。全部由既有資料推算。純邏輯。
import type { ChapterDef, StageDef } from '../core/types';
import { ABYSS_UNLOCK_STAGE } from './abyss';

export interface ChapterPreview {
  /** 首通獎勵的卡（依關卡順序，不重複） */
  cards: { cardId: string; stageId: string; stageName: string }[];
  /** 會開放的關卡與系統（短句） */
  unlocks: string[];
}

const KIND_TEXT: Partial<Record<StageDef['kind'], string>> = { side: '外傳', trial: '流派試煉', event: '活動', tower: '挑戰之塔', daily: '每日關卡' };

export function chapterPreview(chapter: number, stages: StageDef[], chapters: ChapterDef[]): ChapterPreview {
  const list = stages.filter((s) => s.kind === 'main' && s.chapter === chapter);
  const ids = new Set(list.map((s) => s.id));
  const cards: ChapterPreview['cards'] = [];
  for (const s of list) {
    for (const c of s.rewards.firstClear?.cards ?? []) {
      if (!cards.some((x) => x.cardId === c.card)) cards.push({ cardId: c.card, stageId: s.id, stageName: s.name });
    }
  }
  const unlocks: string[] = [];
  const push = (text: string) => { if (!unlocks.includes(text)) unlocks.push(text); };
  // 由本章關卡解鎖、但不屬於本章主線的關卡：下一章、外傳、流派試煉…
  for (const s of stages) {
    if (!s.unlockAfter || !ids.has(s.unlockAfter) || ids.has(s.id)) continue;
    if (s.kind === 'main') {
      const next = chapters.find((c) => c.chapter === s.chapter);
      push(next ? `第 ${next.chapter} 章「${next.name}」` : s.name);
    } else {
      // 同一種類只列第一關（外傳、試煉通常一關接一關）
      const label = KIND_TEXT[s.kind];
      if (label && !unlocks.some((u) => u.startsWith(label))) push(`${label}「${s.name}」`);
      else if (!label) push(s.name);
    }
  }
  if (ids.has(ABYSS_UNLOCK_STAGE)) push('星淵回廊');
  if (list.length) {
    push('星靈遠行：通過本章後可以派隊員來這一章');
    push('星蝕：集滿本章星章後開放');
  }
  return { cards, unlocks };
}
