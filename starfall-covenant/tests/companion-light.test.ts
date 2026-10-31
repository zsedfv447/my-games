import { describe, expect, it } from 'vitest';
import { COMPANION_CARD_BOND, COMPANION_HELPER_BOND, COMPANION_MAX_MEMBERS, companionLightLines } from '../src/ui/companion-light';
import { gameData } from '../src/data/load';

describe('並肩之光（第 7 章終 Boss 前）', () => {
  it('羈絆達到門檻的隊員與情誼達到門檻的助戰各一句，最後一句數有幾道光', () => {
    const lines = companionLightLines({
      members: [{ name: '蘿希', bond: COMPANION_CARD_BOND }, { name: '珊', bond: COMPANION_CARD_BOND - 1 }],
      helper: { name: '米洛', bond: COMPANION_HELPER_BOND },
    });
    expect(lines).toEqual([
      { text: '蘿希的星紋，在燈座的光裡亮了起來。' },
      { speaker: '米洛', text: '這一仗，我也站在你旁邊。' },
      { text: '2 道光連成一圈。瑟隆身上的環，輕輕晃了一下。' },
    ]);
  });
  it('沒有任何羈絆時只有一句收尾，不會讓劇情斷掉', () => {
    const lines = companionLightLines({ members: [{ name: '蘿希', bond: 0 }] });
    expect(lines).toHaveLength(1);
    expect(lines[0].text).toContain('每一個人的臉');
    expect(companionLightLines({ members: [], helper: { name: '米洛', bond: COMPANION_HELPER_BOND - 1 } })).toHaveLength(1);
  });
  it('隊員最多列 4 位', () => {
    const many = Array.from({ length: 6 }, (_, i) => ({ name: `卡${i}`, bond: 99 }));
    const lines = companionLightLines({ members: many });
    expect(lines).toHaveLength(COMPANION_MAX_MEMBERS + 1);
    expect(lines.at(-1)!.text).toContain(`${COMPANION_MAX_MEMBERS} 道光`);
  });
  it('門檻沿用羈絆與情誼的第一個門檻，劇情 ch7-boss 存在；文字不用「誓約」以免跟誓約碑混淆', () => {
    const all = companionLightLines({ members: [{ name: 'a', bond: 99 }], helper: { name: 'b', bond: 99 } }).map((l) => l.text).join('');
    expect(all).not.toContain('誓約');
    expect(COMPANION_CARD_BOND).toBe(10);
    expect(COMPANION_HELPER_BOND).toBe(5);
    expect(gameData.story['ch7-boss']?.length).toBeGreaterThan(0);
  });
});
