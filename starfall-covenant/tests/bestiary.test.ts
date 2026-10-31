import { describe, expect, it } from 'vitest';
import { gameData } from '../src/data/load';
import { createNewSave } from '../src/save/save';
import { bestiaryEntries, codexEnemies, echoOrigin, enemyStages, isBossEnemy, markEnemiesSeen, seenEnemyIds } from '../src/progression/bestiary';
import { eclipseStage } from '../src/progression/eclipse';
import { SCREENS } from '../src/ui/screens';
import { abilityLines } from '../src/ui/screens/bestiary';

const { enemies, stages } = gameData;
const codex = codexEnemies(enemies, stages);
const codexIds = new Set(codex.map((e) => e.id));
const stage = (id: string) => stages.find((s) => s.id === id)!;
const now = new Date(2026, 9, 31, 12).getTime();

describe('星骸觀測錄：收錄範圍', () => {
  it('只列 enemies.json 的原始敵人，而且至少出現在一關；只在示範畫面用到的不列', () => {
    expect(codex.length).toBeGreaterThan(40);
    for (const e of codex) expect(enemyStages(e.id, stages).length).toBeGreaterThan(0);
    expect(codexIds.has('e0046')).toBe(false); // 幕紗星蛾：只在示範畫面
    expect(codexIds.has('e0047')).toBe(false); // 封紋司祭：只在示範畫面
  });

  it('星蝕產生的敵人（eXXXX@eclipse）不會被記錄', () => {
    const ec = eclipseStage(stage('st-1-1'), stages, enemies, new Set(gameData.cards.map((c) => c.id)));
    expect(ec.waves.flatMap((w) => w.enemies).every((id) => !codexIds.has(id))).toBe(true);
    const save = createNewSave(gameData.config, now);
    expect(markEnemiesSeen(save, ec, codexIds)).toBe(save);
  });

  it('Boss：每次出現都在 Boss 波才算（Boss 波裡的小怪不算）', () => {
    expect(isBossEnemy('e0057', stages)).toBe(false); // 回聲在 st-7-1 是一般波的關底
    const boss = codex.filter((e) => isBossEnemy(e.id, stages));
    expect(boss.length).toBeGreaterThan(5);
    expect(boss.length).toBeLessThan(codex.length / 2);
    for (const e of boss) for (const s of enemyStages(e.id, stages)) for (const w of s.waves) if (w.enemies.includes(e.id)) expect(w.boss).toBe(true);
  });

  it('第 7 章的回聲連到原 Boss（依沿用的圖）', () => {
    const byId = (id: string) => enemies.find((e) => e.id === id)!;
    expect(echoOrigin(byId('e0057'), enemies)?.id).toBe('e0032');
    expect(echoOrigin(byId('e0062'), enemies)?.id).toBe('e0040');
    expect(echoOrigin(byId('e0001'), enemies)).toBeUndefined();
  });
});

describe('星骸觀測錄：記錄', () => {
  it('開戰時寫入這一關的敵人，不重複；沒有新敵人時回傳原存檔', () => {
    const save = createNewSave(gameData.config, now);
    const once = markEnemiesSeen(save, stage('st-1-1'), codexIds);
    const ids = [...new Set(stage('st-1-1').waves.flatMap((w) => w.enemies))];
    expect(once.seenEnemies).toEqual(ids);
    expect(markEnemiesSeen(once, stage('st-1-1'), codexIds)).toBe(once);
    expect(save.seenEnemies).toBeUndefined();
  });

  it('老玩家：沒有 seenEnemies 時，用已通關的關卡推算', () => {
    const save = createNewSave(gameData.config, now);
    save.progress.clearedStages = ['st-1-1', 'st-1-2'];
    const seen = seenEnemyIds(save, stages);
    for (const id of [...stage('st-1-1').waves, ...stage('st-1-2').waves].flatMap((w) => w.enemies)) expect(seen.has(id)).toBe(true);
    const entries = bestiaryEntries(save, enemies, stages);
    expect(entries.filter((e) => e.seen).length).toBe([...seen].filter((id) => codexIds.has(id)).length);
    expect(entries.some((e) => !e.seen)).toBe(true);
  });
});

describe('星骸觀測錄：畫面', () => {
  it('有註冊圖鑑的敵人分頁與詳情頁', () => {
    const names = new Set(SCREENS.map((s) => s.name));
    expect(names.has('bestiary')).toBe(true);
    expect(names.has('bestiary-enemy')).toBe(true);
  });

  it('能力說明含觸發時機、狀態名稱與說明', () => {
    const lines = abilityLines(enemies.find((e) => e.id === 'e0057')!);
    expect(lines[0].title).toContain('登場時');
    expect(lines[0].title).toContain('潮'); // 屬性減傷帶上屬性
    expect(lines.every((l) => l.detail.length > 0)).toBe(true);
  });
});
