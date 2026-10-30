// 劇情對話框：點一下顯示完整句子，再點一下換下一句
import { h } from '../dom';
import { audio } from '../audio';

export interface StoryLine {
  speaker?: string;
  text: string;
}

export function storyBox(lines: StoryLine[], onDone: () => void): HTMLElement {
  let index = 0;
  let shown = 0;
  let timer: number | undefined;
  const speaker = h('div', { class: 'speaker' });
  const text = h('p', { style: { margin: '0', minHeight: '66px', whiteSpace: 'pre-wrap' } });
  const next = h('div', { class: 'next', 'aria-hidden': 'true' }, '▼');
  const box = h('div', { class: 'story-box', role: 'button', tabindex: '0', 'aria-live': 'polite' }, speaker, text, next);

  const show = () => {
    const line = lines[index];
    speaker.hidden = !line.speaker;
    speaker.textContent = line.speaker ?? '';
    shown = 0;
    next.hidden = true;
    window.clearInterval(timer);
    const chars = [...line.text];
    timer = window.setInterval(() => {
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
  };
  const advance = () => {
    if (shown !== Infinity) return finish();
    audio.play('tap');
    index++;
    if (index >= lines.length) {
      window.clearInterval(timer);
      onDone();
    } else {
      show();
    }
  };
  box.addEventListener('click', advance);
  box.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') advance(); });
  if (lines.length) show();
  return box;
}
