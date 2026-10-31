// 星骸觀測錄（敵人圖鑑）：開戰時記下遇過的敵人。只列 enemies.json 裡、真的出現在某一關的原始敵人，
// 星淵回廊與星蝕產生的關卡、只在示範畫面用到的敵人都不列。全部是純函式。
import type { EnemyDef, SaveData, StageDef } from '../core/types';

/** 不寫在 stages.json、執行時才產生的關卡種類（不記錄、不列入） */
const GENERATED_KINDS = new Set<StageDef['kind']>(['abyss']);

const stageEnemyIds = (s: StageDef) => s.waves.flatMap((w) => w.enemies);

/** 圖鑑收錄的敵人：enemies.json 的原始敵人，且至少出現在一關（依 id 排序） */
export function codexEnemies(enemies: EnemyDef[], stages: StageDef[]): EnemyDef[] {
  const used = new Set(stages.filter((s) => !GENERATED_KINDS.has(s.kind)).flatMap(stageEnemyIds));
  return enemies.filter((e) => used.has(e.id)).sort((a, b) => a.id.localeCompare(b.id));
}

/** 這隻敵人出現在哪些關卡（stages.json 的順序） */
export function enemyStages(enemyId: string, stages: StageDef[]): StageDef[] {
  return stages.filter((s) => !GENERATED_KINDS.has(s.kind) && stageEnemyIds(s).includes(enemyId));
}

/**
 * 「回聲」對應的原 Boss：回聲沿用原 Boss 的圖（art.sprite 指到 assets/user/enemies/<原 Boss id>.webp）。
 * 不是回聲、或找不到原 Boss 時回傳 undefined。
 */
export function echoOrigin(enemy: EnemyDef, enemies: EnemyDef[]): EnemyDef | undefined {
  if (!enemy.name.includes('回聲')) return undefined;
  const id = /\/(e\d+)\.\w+$/.exec(enemy.art.sprite ?? '')?.[1];
  return id && id !== enemy.id ? enemies.find((e) => e.id === id) : undefined;
}

/**
 * 遇過的敵人 id：存檔的 seenEnemies，加上已通關關卡裡的敵人
 * （這個功能之前的存檔沒有 seenEnemies，通關過就代表遇過）。
 */
export function seenEnemyIds(save: SaveData, stages: StageDef[]): Set<string> {
  const seen = new Set(save.seenEnemies ?? []);
  const cleared = new Set(save.progress.clearedStages);
  for (const s of stages) if (cleared.has(s.id) && !GENERATED_KINDS.has(s.kind)) for (const id of stageEnemyIds(s)) seen.add(id);
  return seen;
}

/** 開戰時記下這一關的敵人；產生的關卡、沒有新敵人時回傳原存檔 */
export function markEnemiesSeen(save: SaveData, stage: StageDef, codexIds: Set<string>): SaveData {
  if (GENERATED_KINDS.has(stage.kind)) return save;
  const prev = save.seenEnemies ?? [];
  const known = new Set(prev);
  const add = [...new Set(stageEnemyIds(stage))].filter((id) => codexIds.has(id) && !known.has(id));
  return add.length ? { ...save, seenEnemies: [...prev, ...add] } : save;
}

/** Boss：每次出現都在 Boss 波（Boss 波裡也會有小怪，所以只要在一般波出現過就不算） */
export function isBossEnemy(enemyId: string, stages: StageDef[]): boolean {
  const waves = stages.filter((s) => !GENERATED_KINDS.has(s.kind)).flatMap((s) => s.waves).filter((w) => w.enemies.includes(enemyId));
  return waves.length > 0 && waves.every((w) => w.boss);
}

export interface BestiaryEntry {
  enemy: EnemyDef;
  seen: boolean;
  boss: boolean;
  stages: StageDef[];
  /** 回聲對應的原 Boss */
  echoOf?: EnemyDef;
}

export function bestiaryEntries(save: SaveData, enemies: EnemyDef[], stages: StageDef[]): BestiaryEntry[] {
  const seen = seenEnemyIds(save, stages);
  return codexEnemies(enemies, stages).map((enemy) => ({
    enemy,
    seen: seen.has(enemy.id),
    boss: isBossEnemy(enemy.id, stages),
    stages: enemyStages(enemy.id, stages),
    echoOf: echoOrigin(enemy, enemies),
  }));
}
