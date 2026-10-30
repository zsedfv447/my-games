// 資料檔驗證：檢查欄位與交叉引用，錯誤的資料在測試（CI）階段就擋下
import {
  ARCHETYPE_IDS, ATTRIBUTES, ORB_TYPES, RACES,
  type ActiveSkillDef, type ArchetypeDef, type CardDef, type EnemyDef, type GachaPoolDef,
  type GameConfig, type LeaderSkillDef, type QuestDef, type ShopItemDef, type StageDef,
} from '../core/types';

export interface GameData {
  config: GameConfig;
  archetypes: ArchetypeDef[];
  cards: CardDef[];
  skills: ActiveSkillDef[];
  leaderSkills: LeaderSkillDef[];
  enemies: EnemyDef[];
  stages: StageDef[];
  gachaPools: GachaPoolDef[];
  shop: ShopItemDef[];
  quests: QuestDef[];
}

export function validateGameData(d: GameData): string[] {
  const errors: string[] = [];
  const err = (where: string, msg: string) => errors.push(`${where}: ${msg}`);

  const uniqueIds = (name: string, list: { id: string }[]) => {
    const seen = new Set<string>();
    for (const item of list) {
      if (seen.has(item.id)) err(name, `重複的 id ${item.id}`);
      seen.add(item.id);
    }
    return seen;
  };

  const cardIds = uniqueIds('cards', d.cards);
  const skillIds = uniqueIds('skills', d.skills);
  const leaderIds = uniqueIds('leader-skills', d.leaderSkills);
  const enemyIds = uniqueIds('enemies', d.enemies);
  const stageIds = uniqueIds('stages', d.stages);
  uniqueIds('gacha-pools', d.gachaPools);
  uniqueIds('shop', d.shop);
  uniqueIds('quests', d.quests);

  const archetypeIds = new Set(d.archetypes.map((a) => a.id));
  for (const id of ARCHETYPE_IDS) if (!archetypeIds.has(id)) err('archetypes', `缺少流派 ${id}`);

  const { cols, rows } = d.config.board;
  if (cols < 5 || rows < 4) err('config', `盤面太小 ${cols}×${rows}`);

  for (const c of d.cards) {
    const w = `cards/${c.id}`;
    if (!ATTRIBUTES.includes(c.attribute)) err(w, `未知屬性 ${c.attribute}`);
    if (!RACES.includes(c.race)) err(w, `未知種族 ${c.race}`);
    if (c.rarity < 1 || c.rarity > 6) err(w, `稀有度 ${c.rarity} 超出範圍`);
    if (c.activeSkill && !skillIds.has(c.activeSkill)) err(w, `找不到主動技 ${c.activeSkill}`);
    if (c.leaderSkill && !leaderIds.has(c.leaderSkill)) err(w, `找不到隊長技 ${c.leaderSkill}`);
    if (c.evolution) {
      if (!cardIds.has(c.evolution.to)) err(w, `進化目標 ${c.evolution.to} 不存在`);
      for (const m of c.evolution.materials) if (!cardIds.has(m)) err(w, `進化素材 ${m} 不存在`);
    }
    for (const a of c.archetypes) if (!archetypeIds.has(a.id)) err(w, `未知流派 ${a.id}`);
    if (c.race !== 'material' && c.archetypes.length === 0) err(w, '戰鬥卡至少要屬於一個流派');
  }

  for (const s of d.skills) {
    if (s.cooldown.min > s.cooldown.max) err(`skills/${s.id}`, '最短冷卻大於最長冷卻');
    for (const e of s.effects) {
      if (e.type === 'convertOrbs' && !ORB_TYPES.includes(e.to)) err(`skills/${s.id}`, `未知珠子 ${e.to}`);
    }
  }

  for (const e of d.enemies) if (!ATTRIBUTES.includes(e.attribute)) err(`enemies/${e.id}`, `未知屬性 ${e.attribute}`);

  for (const s of d.stages) {
    const w = `stages/${s.id}`;
    if (s.unlockAfter && !stageIds.has(s.unlockAfter)) err(w, `解鎖條件關卡 ${s.unlockAfter} 不存在`);
    if (s.waves.length === 0) err(w, '至少要有一波敵人');
    for (const wave of s.waves) for (const en of wave.enemies) if (!enemyIds.has(en)) err(w, `找不到敵人 ${en}`);
    for (const m of [...(s.fixedTeam?.members ?? []), ...(s.fixedTeam?.helper ? [s.fixedTeam.helper] : [])]) {
      if (!cardIds.has(m.card)) err(w, `借用隊伍的卡 ${m.card} 不存在`);
    }
    for (const id of s.teamRule?.requiredCards ?? []) if (!cardIds.has(id)) err(w, `隊伍限制的卡 ${id} 不存在`);
    if (s.kind === 'trial' && (!s.archetype || !s.fixedTeam)) err(w, '流派試煉要指定 archetype 與 fixedTeam');
    for (const drop of s.drops) {
      if (!cardIds.has(drop.card)) err(w, `掉落卡 ${drop.card} 不存在`);
      if (drop.rate <= 0 || drop.rate > 1) err(w, `掉落率 ${drop.rate} 需介於 0–1`);
    }
  }

  for (const p of d.gachaPools) {
    const w = `gacha-pools/${p.id}`;
    const total = Object.values(p.rates).reduce((a, b) => a + (b ?? 0), 0);
    if (Math.abs(total - 1) > 1e-6) err(w, `機率總和為 ${total}，應為 1`);
    for (const [rarity, list] of Object.entries(p.cards)) {
      if (!(Number(rarity) in p.rates)) err(w, `${rarity}★ 有卡片但沒有機率`);
      for (const id of list ?? []) if (!cardIds.has(id)) err(w, `卡池卡片 ${id} 不存在`);
    }
  }

  return errors;
}
