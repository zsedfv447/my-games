import { describe, expect, it } from 'vitest';
import { gameData } from '../src/data/load';
import { chapterStarStoryToPlay, stageStoryToPlay } from '../src/progression/stage-story';
import { createNewSave } from '../src/save/save';
import { chapterProgress, stageContext } from '../src/ui/stage-nav';

const stage = (id: string) => gameData.stages.find((s) => s.id === id)!;
/** 所有關卡引用到的劇情 id */
const referenced = new Set(gameData.stages.flatMap((s) => Object.values(s.story ?? {}).filter((id): id is string => !!id)));

describe('主線劇情接到關卡上', () => {
  it('每章的 open、boss、end 都有被某一關引用', () => {
    const missing: string[] = [];
    for (const c of gameData.chapters) {
      for (const part of ['open', 'boss', 'end']) {
        const id = `ch${c.chapter}-${part}`;
        if (id in gameData.story && !referenced.has(id)) missing.push(id);
      }
    }
    expect(missing).toEqual([]);
    // 至少前 5 章都有寫劇情
    for (let c = 1; c <= 5; c++) expect(referenced.has(`ch${c}-open`), `ch${c}-open`).toBe(true);
  });

  it('有寫 mid 的章節也接上了', () => {
    const mids = Object.keys(gameData.story).filter((id) => /^ch\d+-mid$/.test(id));
    expect(mids.filter((id) => !referenced.has(id))).toEqual([]);
  });

  it('關卡引用的劇情都存在；beforeBoss 只放在有 Boss 波的關卡', () => {
    for (const s of gameData.stages) {
      for (const id of Object.values(s.story ?? {})) if (id) expect(gameData.story[id], `${s.id} → ${id}`).toBeDefined();
      if (s.story?.beforeBoss) expect(s.waves.some((w) => w.boss), s.id).toBe(true);
    }
  });

  it('接的位置：open 在第 1 關開場、mid 在第 4 關 Boss 波、boss 在第 9 關 Boss 波、end 在第 9 關通關後', () => {
    expect(stage('st-1-1').story).toEqual({ before: 'ch1-open' });
    expect(stage('st-1-4').story).toEqual({ beforeBoss: 'ch1-mid' });
    expect(stage('st-1-9').story).toEqual({ beforeBoss: 'ch1-boss', after: 'ch1-end' });
  });
});

describe('什麼時候自動播放', () => {
  const s9 = stage('st-1-9');

  it('第一次挑戰、沒看過才播', () => {
    expect(stageStoryToPlay(s9, 'beforeBoss', gameData.story, [], true)).toBe('ch1-boss');
    expect(stageStoryToPlay(s9, 'after', gameData.story, [], true)).toBe('ch1-end');
    expect(stageStoryToPlay(stage('st-1-1'), 'before', gameData.story, [], true)).toBe('ch1-open');
  });

  it('看過的不重播', () => {
    expect(stageStoryToPlay(s9, 'beforeBoss', gameData.story, ['ch1-boss'], true)).toBeUndefined();
  });

  it('重打、或老玩家早就通關的關卡不補播', () => {
    expect(stageStoryToPlay(s9, 'beforeBoss', gameData.story, [], false)).toBeUndefined();
    expect(stageStoryToPlay(s9, 'after', gameData.story, [], false)).toBeUndefined();
  });

  it('沒有劇情或劇情 id 不存在時不播', () => {
    expect(stageStoryToPlay(stage('st-1-2'), 'before', gameData.story, [], true)).toBeUndefined();
    expect(stageStoryToPlay({ story: { before: 'nope' } }, 'before', gameData.story, [], true)).toBeUndefined();
  });
});

describe('章節星章劇情', () => {
  it('ch4-stars 在領取第 4 章星章獎勵後播一次，看過不重播；沒寫星章劇情的章節不播', () => {
    expect(gameData.chapters.find((c) => c.chapter === 4)?.starReward.cards?.[0]?.card).toBe('c604');
    expect(chapterStarStoryToPlay(4, gameData.story, [])).toBe('ch4-stars');
    expect(chapterStarStoryToPlay(4, gameData.story, ['ch4-stars'])).toBeUndefined();
    expect(chapterStarStoryToPlay(1, gameData.story, [])).toBeUndefined();
  });
});

describe('冒險頁章節卡的進度', () => {
  const ctx = stageContext(gameData.stages);
  const now = new Date(2026, 9, 30, 12).getTime();
  const save = createNewSave(gameData.config, now);

  it('分批上線的章節用 ChapterDef.stageCount 算總關數與星章總數', () => {
    const ch6 = gameData.chapters.find((c) => c.chapter === 6)!;
    const live = gameData.stages.filter((s) => s.kind === 'main' && s.chapter === 6);
    expect(ch6.stageCount).toBeGreaterThan(live.length);
    const p = chapterProgress(save, 6, ctx, now, ch6.stageCount);
    expect(p.total).toBe(ch6.stageCount);
    expect(p.maxStars).toBe(live.reduce((n, s) => n + (s.stars?.length ?? 0), 0) + (ch6.stageCount! - live.length) * 3);
    // 不傳 stageCount 時維持原本的算法
    expect(chapterProgress(save, 6, ctx, now).total).toBe(live.length);
  });

  it('已全部上線的章節不受影響', () => {
    expect(chapterProgress(save, 1, ctx, now, gameData.chapters[0].stageCount).total).toBe(9);
  });
});
