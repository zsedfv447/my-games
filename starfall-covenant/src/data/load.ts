// 打包時直接引入 data/*.json；之後若資料變大可改成動態載入
import config from '../../data/config.json';
import archetypes from '../../data/archetypes.json';
import cards from '../../data/cards.json';
import skills from '../../data/skills.json';
import leaderSkills from '../../data/leader-skills.json';
import enemies from '../../data/enemies.json';
import stages from '../../data/stages.json';
import chapters from '../../data/chapters.json';
import gachaPools from '../../data/gacha-pools.json';
import shop from '../../data/shop.json';
import quests from '../../data/quests.json';
import story from '../../data/story.json';
import events from '../../data/events.json';
import type { GameData } from './validate';

export const gameData = {
  config, archetypes, cards, skills, leaderSkills, enemies, stages, chapters, gachaPools, shop, quests, story, events,
} as unknown as GameData;
