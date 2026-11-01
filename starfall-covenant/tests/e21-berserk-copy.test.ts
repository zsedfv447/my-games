import { expect, it } from 'vitest';
import { gameData } from '../src/data/load';
it('berserk centrally explains discrete leader thresholds and pre-heart-heal attack timing exactly', () => {
  const berserk = gameData.archetypes.find(archetype => archetype.id === 'berserk')!;
  expect(berserk.summary).toBe('依隊長技的低血量門檻取得加成，不是每少一點生命都會增加倍率。');
  expect(berserk.howToPlay).toBe('主動技補血或自損會先改變血線；轉珠攻擊按本回合心珠回復前的生命判定隊長門檻，因此同回合消心回復不會取消已算出的這次攻擊加成。仍須評估敵人下一次攻擊，低血量不等於安全。');
});
it('all other berserk fields and uniqueness remain unchanged', () => {
  const entries = gameData.archetypes.filter(archetype => archetype.id === 'berserk');
  expect(entries).toHaveLength(1);
  const {summary, howToPlay, ...other} = entries[0];
  expect(other).toEqual({id:'berserk',name:'背水一戰',weakness:'中毒、多段攻擊的敵人。',starterPath:'焰屬性 3★→4★ 隊長，主線掉落。'});
});
