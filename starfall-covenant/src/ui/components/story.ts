// 劇情對話框：點一下顯示完整句子，再點一下換下一句；「自動」依句子長度自動翻頁，「紀錄」回看本段已播的對白
import { h } from '../dom';
import { audio } from '../audio';
import type { StoryLine } from '../../core/types';
import { autoDelayMs, storyLog } from '../story-auto';
import { button } from './basic';
import { openDialog } from './overlay';
import '../convenience.css';
import { LABEL } from '../wording';

export type { StoryLine };

/** 自動播放的開關在這次遊玩中記住（不寫進存檔） */
let autoMode = false;

export function storyBox(lines: StoryLine[], onDone: () => void): HTMLElement {
  let index = 0;
  let shown = 0;
  let timer: number | undefined;
  let autoTimer: number | undefined;
  let paused = false;
  const speaker = h('div', { class: 'speaker' });
  const text = h('p', { style: { margin: '0', minHeight: '66px', whiteSpace: 'pre-wrap' } });
  const next = h('div', { class: 'next', 'aria-hidden': 'true' }, '▼');
  const autoBtn = h('button', { type: 'button', class: 'story-tool', 'aria-pressed': String(autoMode) }, '自動');
  const logBtn = h('button', { type: 'button', class: 'story-tool' }, '紀錄');
  const tools = h('div', { class: 'story-tools' }, autoBtn, logBtn);
  const box = h('div', { class: 'story-box', role: 'button', tabindex: '0', 'aria-live': 'polite' }, speaker, tools, text, next);

  const scheduleAuto = () => {
    window.clearTimeout(autoTimer);
    if (autoMode && !paused && shown === Infinity) autoTimer = window.setTimeout(advance, autoDelayMs(lines[index].text));
  };
  const show = () => {
    const line = lines[index];
    speaker.hidden = !line.speaker;
    speaker.textContent = line.speaker ?? '';
    shown = 0;
    next.hidden = true;
    window.clearInterval(timer);
    window.clearTimeout(autoTimer);
    const chars = [...line.text];
    timer = window.setInterval(() => {
      if (!box.isConnected && shown > 0) return stop();
      shown++;
      text.textContent = chars.slice(0, shown).join('');
      if (shown >= chars.length) finish();
    }, 35);
  };
  const finish = () => {
    window.clearInterval(timer);
    text.textContent = lines[index].text;
    shown = Infinity;
    next.hidden = false;
    scheduleAuto();
  };
  const advance = () => {
    // 已經被「略過」或換頁移除：停掉計時，不要再呼叫 onDone
    if (!box.isConnected) return stop();
    if (shown !== Infinity) return finish();
    audio.play('tap');
    index++;
    if (index >= lines.length) {
      stop();
      onDone();
    } else {
      show();
    }
  };
  const stop = () => {
    window.clearInterval(timer);
    window.clearTimeout(autoTimer);
  };

  autoBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    autoMode = !autoMode;
    autoBtn.setAttribute('aria-pressed', String(autoMode));
    audio.play('tap');
    if (autoMode) scheduleAuto();
    else window.clearTimeout(autoTimer);
  });
  logBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    paused = true;
    window.clearTimeout(autoTimer);
    const log = storyLog(lines, index);
    const list = h('div', { class: 'story-log' }, log.map((l) => h('div', { class: 'story-log-line' },
      l.speaker && h('div', { class: 'story-log-speaker' }, l.speaker),
      h('p', null, l.text))));
    const dlg = openDialog('對話紀錄', list, [
      button(LABEL.close, { variant: 'primary', onClick: () => { dlg.close(); paused = false; scheduleAuto(); } }),
    ], { dismissible: false });
    requestAnimationFrame(() => { list.scrollTop = list.scrollHeight; });
  });

  box.addEventListener('click', advance);
  box.addEventListener('keydown', (e) => { if (e.target === box && (e.key === 'Enter' || e.key === ' ')) advance(); });
  if (lines.length) show();
  return box;
}
