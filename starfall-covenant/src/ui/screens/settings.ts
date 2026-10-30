import { h } from '../dom';
import { APP_VERSION } from '../version';
import { audio } from '../audio';
import { button, panel, slider, toggle } from '../components/basic';
import { confirmDialog, openDialog, toast } from '../components/overlay';
import { exportCode, getSettings, importCode, resetAll, updateSettings } from '../state';
import type { ScreenDef } from '../router';

function showExport(): void {
  const code = exportCode();
  const area = h('textarea', { readonly: true, rows: '6', class: 'code-box' }, code);
  const dlg = openDialog('匯出存檔碼', h('div', null, h('p', { class: 'small-text dim' }, '把這段文字保存好，換手機時貼到「匯入存檔碼」。'), area), [
    button('複製', {
      variant: 'primary',
      onClick: () => {
        area.select();
        void navigator.clipboard?.writeText(code).then(() => toast('已複製'), () => toast('請長按文字手動複製'));
      },
    }),
    button('關閉', { variant: 'ghost', sound: 'back', onClick: () => dlg.close() }),
  ]);
}

function showImport(): void {
  const area = h('textarea', { rows: '6', class: 'code-box', placeholder: '貼上存檔碼' });
  const dlg = openDialog('匯入存檔碼', h('div', null, h('p', { class: 'small-text dim' }, '匯入後會取代目前的進度。'), area), [
    button('取消', { variant: 'ghost', sound: 'back', onClick: () => dlg.close() }),
    button('匯入', {
      variant: 'primary',
      onClick: () => {
        const error = importCode(area.value);
        if (error) return toast(error);
        dlg.close();
        toast('匯入完成');
      },
    }),
  ]);
}

async function askReset(): Promise<void> {
  if (!(await confirmDialog('重置存檔', '所有進度都會消失，而且無法復原。確定要重置嗎？', '重置'))) return;
  resetAll();
  toast('已重置存檔');
}

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
          button('匯出存檔碼', { small: true, icon: 'save', onClick: showExport }),
          button('匯入存檔碼', { small: true, onClick: showImport }),
          button('重置', { small: true, variant: 'danger', onClick: () => void askReset() }),
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
