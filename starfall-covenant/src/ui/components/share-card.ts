// 「契約回憶」分享圖：用 Canvas 畫出隊伍、戰績、星章與章節星座，輸出 PNG（第 20 項）
import { gameData } from '../../data/load';
import { cardIconSvg } from '../art/card-face';
import { chapterStarMask } from '../art/constellation';
import { h } from '../dom';
import { getSave } from '../state';
import { SHARE_H, SHARE_W, sharePlan, type ShareInput, type SharePlan } from '../share-plan';
import { button } from './basic';
import { cardIconUrl, cardPortraitUrl } from './card-thumb';
import { chapterLayout } from './constellation-view';
import { overlayRoot, toast } from './overlay';
import { endOnRouteChange } from '../route-scope';
import '../constellation.css';
import { LABEL } from '../wording';

const cardById = new Map(gameData.cards.map((c) => [c.id, c]));
const RARITY_COLOR = ['#8a8f9e', '#8a8f9e', '#8a8f9e', '#b9c4d8', '#f2c45a', '#c792ff', '#ff9fd6'];

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** 卡片頭像：使用者素材優先，沒有就用程式產生的卡面 */
async function cardImage(cardId: string): Promise<HTMLImageElement | null> {
  const card = cardById.get(cardId);
  if (!card) return null;
  const url = cardIconUrl(card) ?? cardPortraitUrl(card);
  if (url) {
    const img = await loadImage(url);
    if (img) return img;
  }
  return loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(cardIconSvg(card))}`);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const TITLE_FONT = '"Noto Serif TC", serif';
const BODY_FONT = '"Noto Sans TC", sans-serif';

/** 背景的章節星座：全部畫淡，已點亮的星發光 */
function drawConstellation(ctx: CanvasRenderingContext2D, chapter: number): void {
  const { layout, slots } = chapterLayout(chapter);
  if (!slots.length) return;
  const lit = chapterStarMask(slots, getSave().progress.stars);
  // 星座放在標題與隊伍之間的帶狀區域（y 140～390），不壓到隊伍頭像
  const sx = Math.min((SHARE_W - 60) / layout.width, 250 / layout.height);
  const ox = (SHARE_W - layout.width * sx) / 2;
  const oy = 140;
  const p = (i: number) => [ox + layout.stars[i].x * sx, oy + layout.stars[i].y * sx] as const;
  ctx.save();
  ctx.globalAlpha = 0.7;
  ctx.lineWidth = 1.6;
  for (const [a, b] of layout.edges) {
    const on = lit[a] && lit[b];
    ctx.strokeStyle = on ? 'rgba(247, 220, 152, 0.55)' : 'rgba(154, 164, 214, 0.14)';
    ctx.setLineDash(on ? [] : [4, 6]);
    ctx.beginPath();
    ctx.moveTo(...p(a));
    ctx.lineTo(...p(b));
    ctx.stroke();
  }
  ctx.setLineDash([]);
  layout.stars.forEach((s, i) => {
    const [x, y] = p(i);
    if (lit[i]) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, s.r * 7);
      g.addColorStop(0, 'rgba(255, 246, 216, 0.9)');
      g.addColorStop(1, 'rgba(242, 196, 90, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, s.r * 7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = lit[i] ? '#fff6d8' : 'rgba(154, 164, 214, 0.35)';
    ctx.beginPath();
    ctx.arc(x, y, lit[i] ? s.r * 1.6 : s.r, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

/** 畫出分享圖並回傳 PNG */
export async function renderShareCard(plan: SharePlan, chapter?: number): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = SHARE_W;
  canvas.height = SHARE_H;
  const ctx = canvas.getContext('2d')!;
  await document.fonts?.ready;

  // 背景
  const bg = ctx.createLinearGradient(0, 0, 0, SHARE_H);
  bg.addColorStop(0, '#16204a');
  bg.addColorStop(0.55, '#0b1230');
  bg.addColorStop(1, '#060a1f');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, SHARE_W, SHARE_H);
  if (chapter !== undefined) drawConstellation(ctx, chapter);

  // 外框
  ctx.strokeStyle = '#b98a2a';
  ctx.lineWidth = 3;
  roundRect(ctx, 16, 16, SHARE_W - 32, SHARE_H - 32, 22);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(242, 196, 90, 0.35)';
  ctx.lineWidth = 1;
  roundRect(ctx, 26, 26, SHARE_W - 52, SHARE_H - 52, 16);
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#f7dc98';
  ctx.font = `700 30px ${TITLE_FONT}`;
  ctx.fillText(`《星骸契約》${plan.title}`, SHARE_W / 2, 84);
  ctx.fillStyle = '#9aa4d6';
  ctx.font = `500 22px ${BODY_FONT}`;
  ctx.fillText(plan.place, SHARE_W / 2, 122);

  // 關卡名
  ctx.shadowColor = 'rgba(242, 196, 90, 0.7)';
  ctx.shadowBlur = 18;
  ctx.fillStyle = '#fff6d8';
  ctx.font = `700 58px ${TITLE_FONT}`;
  ctx.fillText(plan.stageName, SHARE_W / 2, 330);
  ctx.shadowBlur = 0;
  if (plan.badge) {
    ctx.font = `700 20px ${BODY_FONT}`;
    const w = ctx.measureText(plan.badge).width + 28;
    ctx.fillStyle = 'rgba(242, 196, 90, 0.2)';
    roundRect(ctx, SHARE_W / 2 - w / 2, 348, w, 34, 17);
    ctx.fill();
    ctx.strokeStyle = '#b98a2a';
    ctx.stroke();
    ctx.fillStyle = '#f7dc98';
    ctx.fillText(plan.badge, SHARE_W / 2, 372);
  }

  // 隊伍
  const images = await Promise.all(plan.slots.map((s) => cardImage(s.member.cardId)));
  plan.slots.forEach((s, i) => {
    const img = images[i];
    const card = cardById.get(s.member.cardId);
    ctx.save();
    roundRect(ctx, s.x, s.y, s.size, s.size, 12);
    ctx.clip();
    ctx.fillStyle = '#1f2c62';
    ctx.fillRect(s.x, s.y, s.size, s.size);
    if (img) ctx.drawImage(img, s.x, s.y, s.size, s.size);
    ctx.restore();
    ctx.strokeStyle = RARITY_COLOR[card?.rarity ?? 1];
    ctx.lineWidth = 3;
    roundRect(ctx, s.x, s.y, s.size, s.size, 12);
    ctx.stroke();
    ctx.fillStyle = '#eef1ff';
    ctx.font = `600 18px ${BODY_FONT}`;
    if (s.member.level !== undefined) ctx.fillText(`Lv.${s.member.level}`, s.x + s.size / 2, s.y + s.size + 26);
    if (s.member.isHelper) {
      ctx.fillStyle = '#9aa4d6';
      ctx.font = `500 15px ${BODY_FONT}`;
      ctx.fillText('助戰', s.x + s.size / 2, s.y + s.size + (s.member.level !== undefined ? 48 : 26));
    }
  });

  // 戰績
  const statY = 640;
  const colW = (SHARE_W - 120) / plan.stats.length;
  plan.stats.forEach((st, i) => {
    const cx = 60 + colW * i + colW / 2;
    ctx.fillStyle = 'rgba(6, 10, 31, 0.55)';
    roundRect(ctx, cx - colW / 2 + 8, statY - 58, colW - 16, 100, 14);
    ctx.fill();
    ctx.fillStyle = '#9aa4d6';
    ctx.font = `500 20px ${BODY_FONT}`;
    ctx.fillText(st.label, cx, statY - 24);
    ctx.fillStyle = '#f7dc98';
    ctx.font = `700 40px ${BODY_FONT}`;
    ctx.fillText(st.value, cx, statY + 24);
  });

  // 星章
  ctx.textAlign = 'left';
  plan.starRows.forEach((row, i) => {
    const y = 730 + i * 38;
    ctx.fillStyle = row.got ? '#f2c45a' : 'rgba(154, 164, 214, 0.4)';
    ctx.font = `700 26px ${BODY_FONT}`;
    ctx.fillText(row.got ? '★' : '☆', 90, y);
    ctx.fillStyle = row.got ? '#eef1ff' : '#6570a8';
    ctx.font = `500 21px ${BODY_FONT}`;
    ctx.fillText(row.text, 128, y);
  });

  ctx.textAlign = 'center';
  ctx.fillStyle = '#6570a8';
  ctx.font = `500 18px ${BODY_FONT}`;
  ctx.fillText(plan.footer, SHARE_W / 2, SHARE_H - 52);

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob'))), 'image/png'));
}

/** 產生分享圖並顯示預覽，可儲存或用系統分享 */
export async function openShareCard(input: ShareInput, chapter?: number): Promise<void> {
  return openSharePreview(sharePlan(input), chapter);
}

/** 依版面畫出分享圖並顯示預覽（結算的契約回憶、契約週報共用） */
export async function openSharePreview(plan: SharePlan, chapter?: number): Promise<void> {
  let blob: Blob;
  try {
    blob = await renderShareCard(plan, chapter);
  } catch {
    toast('分享圖產生失敗');
    return;
  }
  const url = URL.createObjectURL(blob);
  const file = new File([blob], plan.fileName, { type: 'image/png' });
  const canShare = typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
  const layer = h('div', { class: 'overlay rv-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': plan.title });
  // 換畫面時自動關閉（route-scope）
  const close = endOnRouteChange(() => {
    layer.classList.add('closing');
    setTimeout(() => { layer.remove(); URL.revokeObjectURL(url); }, 140);
  });
  const save = () => {
    const a = h('a', { href: url, download: plan.fileName });
    document.body.appendChild(a);
    a.click();
    a.remove();
  };
  const share = () => void navigator.share({ files: [file], title: `星骸契約・${plan.title}`, text: `${plan.stageName}　${plan.stats.map((s) => `${s.label} ${s.value}`).join('・')}` }).catch(() => {});
  layer.appendChild(h('section', { class: 'panel gold rv-panel share-preview' },
    h('h2', { class: 'rv-title' }, plan.title),
    h('img', { src: url, alt: `${plan.stageName} 的${plan.title}` }),
    h('div', { class: 'rv-actions' },
      button(LABEL.close, { variant: 'ghost', sound: 'back', onClick: close }),
      button('儲存圖片', { variant: canShare ? undefined : 'primary', onClick: save }),
      canShare && button('分享', { variant: 'primary', onClick: share }))));
  layer.addEventListener('click', (e) => { if (e.target === layer) close(); });
  overlayRoot().appendChild(layer);
}
