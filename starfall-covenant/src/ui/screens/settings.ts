import { h } from '../dom';
import { APP_VERSION } from '../version';
import { audio } from '../audio';
import { button, panel, slider, toggle } from '../components/basic';
import { toast } from '../components/overlay';
import { getSettings, updateSettings } from '../state';
import type { ScreenDef } from '../router';

export const settingsScreen: ScreenDef = {
  name: 'settings',
  title: '設定',
  chrome: 'sub',
  parent: 'home',
  render({ nav }) {
    const s = getSettings();
    return h(
      'div',
      null,
      panel(
        { title: '音量' },
        slider({ label: '背景音樂', value: s.bgm, onInput: (v) => updateSettings({ bgm: v }) }),
        slider({ label: '音效', value: s.sfx, onInput: (v) => updateSettings({ sfx: v }) }),
        button('試聽音效', { small: true, icon: 'sound', sound: false, onClick: () => { audio.unlock(); audio.play('summon'); } }),
      ),
      panel(
        { title: '戰鬥' },
        toggle('顯示轉珠倒數', s.showMoveTimer, (v) => updateSettings({ showMoveTimer: v })),
        toggle('戰鬥加速 ×2', s.battleSpeed === 2, (v) => updateSettings({ battleSpeed: v ? 2 : 1 })),
      ),
      panel(
        { title: '存檔' },
        h('p', { class: 'small-text dim' }, '匯出存檔碼可以在換手機時搬家。'),
        h(
          'div',
          { class: 'row' },
          button('匯出存檔碼', { small: true, icon: 'save', onClick: () => toast('存檔功能開發中') }),
          button('匯入存檔碼', { small: true, onClick: () => toast('存檔功能開發中') }),
        ),
      ),
      panel(
        { title: '開發者' },
        button('介面元件展示', { small: true, block: true, onClick: () => nav.go('gallery') }),
      ),
      h('p', { class: 'faint small-text', style: { textAlign: 'center' } }, `星骸契約 v${APP_VERSION}・全部角色、名稱與美術皆為原創`),
    );
  },
};
