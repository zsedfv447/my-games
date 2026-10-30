// 彈出視窗與提示訊息
import { h, type Child } from '../dom';
import { button } from './basic';

let host: HTMLElement | undefined;
let toastHost: HTMLElement | undefined;

/** 由 shell 呼叫一次，決定彈窗掛在哪（舞台內，才會跟著縮放） */
export function setOverlayHost(stage: HTMLElement): void {
  host = stage;
  toastHost = h('div', { class: 'toast-host', 'aria-live': 'polite' });
  stage.appendChild(toastHost);
}

export interface DialogHandle {
  close(): void;
}

export function openDialog(title: string, body: Child, actions: HTMLElement[] = [], opts: { dismissible?: boolean } = {}): DialogHandle {
  const overlay = h('div', { class: 'overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': title });
  const close = () => {
    overlay.classList.add('closing');
    setTimeout(() => overlay.remove(), 140);
  };
  const dlg = h('section', { class: 'panel gold dialog' }, h('h2', null, title), body, actions.length > 0 && h('div', { class: 'actions' }, actions));
  overlay.appendChild(dlg);
  if (opts.dismissible !== false) {
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  }
  (host ?? document.body).appendChild(overlay);
  return { close };
}

export function confirmDialog(title: string, message: Child, okLabel = '確定', cancelLabel = '取消'): Promise<boolean> {
  return new Promise((resolve) => {
    const dlg = openDialog(title, h('p', null, message), [
      button(cancelLabel, { variant: 'ghost', sound: 'back', onClick: () => { dlg.close(); resolve(false); } }),
      button(okLabel, { variant: 'primary', onClick: () => { dlg.close(); resolve(true); } }),
    ], { dismissible: false });
  });
}

export function toast(message: string, ms = 2000): void {
  if (!toastHost) return;
  const el = h('div', { class: 'toast' }, message);
  toastHost.appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 200);
  }, ms);
}
