import { expect, it } from 'vitest';
import { gameData } from '../src/data/load';
const changes = [
  ['heart','summary','依隊長條件消心取得攻擊加成並支援回復；回復力轉為攻擊力須有對應的主動技效果。'],
  ['heart','howToPlay','依隊長技要求的心珠組數安排消除，搭配轉心與回復支援；提高回復倍率不會自動提高攻擊倍率。'],
  ['race','summary','依隊長技強化指定種族的成員；同族人數不會自動提高每人的倍率，全隊同族的額外效果須另看隊長條件。'],
  ['skillcycle','summary','運用開場充能、冷卻縮減與隊員技能安排施技順序；能否連續施放仍須確認冷卻與封印等限制。'],
  ['skillcycle','howToPlay','部分隊長技會在施放主動技的回合提高攻擊；技能連鎖的追打須先啟動對應效果，再由後續施技觸發，不是每招都自帶傷害。'],
] as const;
it.each(changes)('%s.%s uses the exact approved source/condition wording', (id,field,expected) => {
  const entries = gameData.archetypes.filter(archetype => archetype.id === id);
  expect(entries).toHaveLength(1); expect(entries[0][field]).toBe(expected);
});
it('race howToPlay and the remaining fields on all three entries stay unchanged', () => {
  const remaining = ['heart','race','skillcycle'].map(id => {
    const {summary,howToPlay,...other} = gameData.archetypes.find(archetype => archetype.id === id)!;
    return id === 'race' ? {...other,howToPlay} : other;
  });
  expect(remaining).toEqual([
    {id:'heart',name:'心之守護',weakness:'回復封印、限回合 Boss。',starterPath:'森屬性 4★ 隊長，主線掉落。'},
    {id:'race',name:'種族羈絆',weakness:'依種族特性而定。',starterPath:'森屬性 3★ 靈仙隊長；其他種族由活動與挑戰之塔取得。',howToPlay:'依隊長種族組隊，跨屬性混搭。'},
    {id:'skillcycle',name:'技能循環',weakness:'封印主動技。',starterPath:'輝屬性 3★→4★ 隊長，主線掉落。'},
  ]);
});
