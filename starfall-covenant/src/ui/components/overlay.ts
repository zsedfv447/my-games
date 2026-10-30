// 彈出視窗與提示訊息
import { h, type Child } from '../dom';
import { button } from './basic';
import { bindToRoute } from '../route-scope';

let host: HTMLElement | undefined;
let toastHost: HTMLElement | undefined;

/** 由 shell 呼叫一次，決定彈窗掛在哪（舞台內，才會跟著縮放） */
export function setOverlayHost(stage: HTMLElement): void {
  host = stage;
  toastHost = h('div', { class: 'toast-host', 'aria-live': 'polite' });
  stage.appendChild(toastHost);
}

/** 彈窗掛載點（全螢幕演出層也掛這裡） */
export function overlayRoot(): HTMLElement {
  return host ?? document.body;
}

export interface DialogHandle {
  close(): void;
}

export interface DialogOptions {
  dismissible?: boolean;
  onClose?: () => void;
  /** route：畫面自動跳出的彈窗，換畫面時自動關閉（需要玩家明確選擇的對話框不要用） */
  scope?: 'route';
}

export function openDialog(title: string, body: Child, actions: HTMLElement[] = [], opts: DialogOptions = {}): DialogHandle {
  const overlay = h('div', { class: 'overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': title });
  let closed = false;
  let unbind: (() => void) | undefined;
  // 不論按鈕、點背景或換畫面關閉，onClose 都只會呼叫一次
  const close = () => {
    if (closed) return;
    closed = true;
    unbind?.();
    opts.onClose?.();
    overlay.classList.add('closing');
    setTimeout(() => overlay.remove(), 140);
  };
  const dlg = h('section', { class: 'panel gold dialog' }, h('h2', null, title), body, actions.length > 0 && h('div', { class: 'actions' }, actions));
  overlay.appendChild(dlg);
  if (opts.dismissible !== false) {
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  }
  (host ?? document.body).appendChild(overlay);
  if (opts.scope === 'route') unbind = bindToRoute(close);
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

/**
 * 綁定目前畫面的確認框：玩家選了回傳 true／false；還沒選就換了畫面，自動關閉並回傳 null（什麼都不做）。
 */
export function confirmOnScreen(title: string, message: Child, okLabel = '確定', cancelLabel = '取消'): Promise<boolean | null> {
  return new Promise((resolve) => {
    let answered = false;
    const answer = (v: boolean) => { answered = true; dlg.close(); resolve(v); };
    const dlg = openDialog(title, h('p', null, message), [
      button(cancelLabel, { variant: 'ghost', sound: 'back', onClick: () => answer(false) }),
      button(okLabel, { variant: 'primary', onClick: () => answer(true) }),
    ], { dismissible: false, scope: 'route', onClose: () => { if (!answered) resolve(null); } });
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
