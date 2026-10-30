// 資料檔驗證：檢查欄位與交叉引用，錯誤的資料在測試（CI）階段就擋下
import {
  ARCHETYPE_IDS, ATTRIBUTES, ORB_TYPES, RACES,
  type ActiveSkillDef, type ArchetypeDef, type CardDef, type ChapterDef, type EnemyDef, type GachaPoolDef,
  type GameConfig, type LeaderSkillDef, type QuestDef, type ShopItemDef, type StageDef, type StoryData,
  type Reward,
} from '../core/types';
import { checkLeaderEvolution, checkLeaderTier, lintLeaderSkill } from '../battle/leader';
import { isKnownCounter } from '../progression/quests';
import type { EventDef } from '../progression/events';

export interface GameData {
  config: GameConfig;
  archetypes: ArchetypeDef[];
  cards: CardDef[];
  skills: ActiveSkillDef[];
  leaderSkills: LeaderSkillDef[];
  enemies: EnemyDef[];
  stages: StageDef[];
  chapters: ChapterDef[];
  gachaPools: GachaPoolDef[];
  shop: ShopItemDef[];
  quests: QuestDef[];
  story: StoryData;
  events: EventDef[];
}

/** 卡片勝利台詞（lines.victory）的字數上限 */
export const VICTORY_LINE_MAX = 30;

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
    if (c.race !== 'material' && !c.leaderSkill) err(w, '戰鬥卡要有隊長技');
    if (c.evolution) {
      if (!cardIds.has(c.evolution.to)) err(w, `進化目標 ${c.evolution.to} 不存在`);
      for (const m of c.evolution.materials) if (!cardIds.has(m)) err(w, `進化素材 ${m} 不存在`);
    }
    for (const a of c.archetypes) if (!archetypeIds.has(a.id)) err(w, `未知流派 ${a.id}`);
    if (c.race !== 'material' && c.archetypes.length === 0) err(w, '戰鬥卡至少要屬於一個流派');
    const victory = c.lines?.victory;
    if (victory !== undefined && (!victory.trim() || [...victory].length > VICTORY_LINE_MAX)) err(w, `勝利台詞要 1–${VICTORY_LINE_MAX} 字（目前 ${[...victory].length} 字）`);
  }

  // 隊長技：寫了不會生效的組合、超出星數分級、進化後不是同主題加強版
  const leaderById = new Map(d.leaderSkills.map((l) => [l.id, l]));
  for (const l of d.leaderSkills) for (const issue of lintLeaderSkill(l)) err(`leader-skills/${l.id}`, issue);
  const cardById = new Map(d.cards.map((c) => [c.id, c]));
  for (const c of d.cards) {
    const leader = c.leaderSkill ? leaderById.get(c.leaderSkill) : undefined;
    if (!leader) continue;
    for (const issue of checkLeaderTier(leader, c.rarity)) err(`cards/${c.id}`, `隊長技 ${leader.id}：${issue}`);
    const evolved = c.evolution ? cardById.get(c.evolution.to) : undefined;
    const next = evolved?.leaderSkill ? leaderById.get(evolved.leaderSkill) : undefined;
    if (next) for (const issue of checkLeaderEvolution(leader, next)) err(`cards/${c.id}`, `進化到 ${evolved!.id}：${issue}`);
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
    for (const [slot, id] of Object.entries(s.story ?? {})) {
      if (id && !(id in d.story)) err(w, `劇情 ${slot} 引用的 ${id} 不存在`);
    }
    if (s.kind === 'trial' && (!s.archetype || !s.fixedTeam)) err(w, '流派試煉要指定 archetype 與 fixedTeam');
    for (const drop of s.drops) {
      if (!cardIds.has(drop.card)) err(w, `掉落卡 ${drop.card} 不存在`);
      if (drop.rate <= 0 || drop.rate > 1) err(w, `掉落率 ${drop.rate} 需介於 0–1`);
    }
  }

  const chapterNums = new Set(d.chapters.map((c) => c.chapter));
  d.chapters.forEach((c, i) => {
    const w = `chapters/${c.chapter}`;
    if (c.chapter !== i + 1) err(w, `章節編號要從 1 連續排列，第 ${i + 1} 筆是 ${c.chapter}`);
    if (!RACES.includes(c.race)) err(w, `未知種族 ${c.race}`);
    for (const r of c.starReward.cards ?? []) if (!cardIds.has(r.card)) err(w, `星章獎勵卡 ${r.card} 不存在`);
    if (!d.stages.some((s) => s.kind === 'main' && s.chapter === c.chapter)) err(w, '這一章沒有任何主線關卡');
  });
  for (const s of d.stages) {
    if (s.kind === 'main' && s.chapter !== undefined && !chapterNums.has(s.chapter)) err(`stages/${s.id}`, `章節 ${s.chapter} 不在 chapters.json`);
    for (const r of s.rewards.firstClear?.cards ?? []) if (!cardIds.has(r.card)) err(`stages/${s.id}`, `首通獎勵卡 ${r.card} 不存在`);
    for (const day of s.weekdays ?? []) if (day < 0 || day > 6) err(`stages/${s.id}`, `星期 ${day} 需介於 0–6`);
  }

  for (const [id, lines] of Object.entries(d.story)) {
    if (lines.length === 0) err(`story/${id}`, '劇情至少要有一句');
    for (const [i, line] of lines.entries()) if (!line.text) err(`story/${id}`, `第 ${i + 1} 句沒有內容`);
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

  const checkReward = (w: string, r: Reward) => {
    for (const c of r.cards ?? []) if (!cardIds.has(c.card)) err(w, `獎勵卡 ${c.card} 不存在`);
    if (!r.coin && !r.gems && !r.stamina && !r.cards?.length && !Object.keys(r.tokens ?? {}).length) err(w, '獎勵是空的');
  };

  const eventIds = uniqueIds('events', d.events);
  for (const e of d.events) {
    if (e.period && !(Date.parse(e.period.end) > Date.parse(e.period.start))) err(`events/${e.id}`, '結束時間要晚於開始時間');
    if (e.period?.repeatDays !== undefined && e.period.repeatDays * 86_400_000 < Date.parse(e.period.end) - Date.parse(e.period.start)) {
      err(`events/${e.id}`, 'repeatDays 比一檔活動還短');
    }
  }
  for (const s of d.stages) if (s.kind === 'event' && (!s.event || !eventIds.has(s.event))) err(`stages/${s.id}`, `活動 ${s.event} 不在 events.json`);

  for (const item of d.shop) {
    const w = `shop/${item.id}`;
    const { gems = 0, coin = 0, tokens = {} } = item.price;
    const amounts = [gems, coin, ...Object.values(tokens)];
    if (amounts.some((n) => n < 0) || !amounts.some((n) => n > 0)) err(w, '價格要大於 0');
    if (item.limit && item.limit.count < 1) err(w, '限購次數至少 1');
    if (!('type' in item.reward)) checkReward(w, item.reward);
  }

  for (const q of d.quests) {
    const w = `quests/${q.id}`;
    if (!isKnownCounter(q.counter, q.kind)) err(w, `未知的計數器 ${q.counter}`);
    if (!(q.target >= 1)) err(w, `目標 ${q.target} 至少要 1`);
    checkReward(w, q.reward);
  }

  return errors;
}
