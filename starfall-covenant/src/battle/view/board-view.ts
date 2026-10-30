// 盤面繪製與拖曳轉珠（Canvas 2D＋Pointer Events，觸控與滑鼠共用）
// 規則都在 board.ts：拖曳時用 swapOrbs 即時顯示，放手後把路徑交給 Battle.submitMove。
import { swapOrbs, toIndex, type Board, type MatchGroup, type Orb, type Pos, type ResolveStep } from '../board';
import { orbDataUrl, type OrbKind } from '../../ui/art/orbs';
import { cellAt, remainingMs, stepsBetween } from './drag';

export interface BoardViewOptions {
  cellSize: number;
  /** 本回合轉珠秒數（每次拿起珠子時讀取，主動技延長時間會即時反映） */
  moveSeconds: () => number;
  showTimer: () => boolean;
  onMove: (path: Pos[]) => void;
  /** 每交換一格（播放音效用） */
  onStep?: () => void;
}

const orbImages = new Map<string, HTMLImageElement>();

function orbKey(o: Orb): { key: string; kind: OrbKind; enhanced: boolean; locked: boolean } {
  const kind: OrbKind = o.hidden ? 'hidden' : o.poison ? 'poison' : o.type;
  return { key: `${kind}|${o.enhanced}|${o.locked}`, kind, enhanced: o.enhanced, locked: o.locked };
}

export class BoardView {
  readonly element: HTMLDivElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private timerFill: HTMLDivElement;
  private board: Board | null = null;
  private enabled = false;

  // 拖曳狀態
  private pointerId: number | null = null;
  private path: Pos[] = [];
  private held: { x: number; y: number } | null = null;
  private startedAt: number | null = null;
  private limitMs = 5000;

  // 動畫狀態
  private fading = new Map<number, number>();
  private dropOffset = 0;
  /** 逐段落下時：格子索引 → 起始列（負數代表從盤面上方掉進來） */
  private drops = new Map<number, number>();
  private dropT = 1;
  private raf = 0;

  constructor(private opts: BoardViewOptions) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'board-canvas';
    this.canvas.style.touchAction = 'none';
    this.ctx = this.canvas.getContext('2d')!;
    this.timerFill = document.createElement('div');
    this.timerFill.className = 'fill';
    const timer = document.createElement('div');
    timer.className = 'bar move-timer';
    timer.appendChild(this.timerFill);
    this.element = document.createElement('div');
    this.element.className = 'board-view';
    this.element.append(timer, this.canvas);

    this.canvas.addEventListener('pointerdown', this.onDown);
    this.canvas.addEventListener('pointermove', this.onMovePointer);
    this.canvas.addEventListener('pointerup', this.onUp);
    this.canvas.addEventListener('pointercancel', this.onUp);
    this.canvas.addEventListener('lostpointercapture', this.onUp);
  }

  setBoard(board: Board): void {
    const resized = !this.board || this.board.cols !== board.cols || this.board.rows !== board.rows;
    this.board = board;
    if (resized) {
      this.canvas.style.width = `${board.cols * this.opts.cellSize}px`;
      this.canvas.style.height = `${board.rows * this.opts.cellSize}px`;
    }
    this.draw();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.element.classList.toggle('disabled', !enabled);
    if (!enabled) this.cancelDrag();
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.cancelDrag();
  }

  /** 依序閃爍消除的組；cascade>0 的組沒有中間盤面可畫，只回報 Combo 數 */
  async playClear(groups: MatchGroup[], onCombo: (combo: number, group: MatchGroup) => void, speed = 1): Promise<void> {
    const stepMs = 260 / speed;
    for (let i = 0; i < groups.length; i++) {
      const g = groups[i];
      if (g.cascade === 0) {
        const t0 = performance.now();
        for (const c of g.cells) this.fading.set(c, t0);
      }
      onCombo(i + 1, g);
      this.loop();
      await wait(stepMs);
    }
  }

  /**
   * 逐段播放結算：每一段先閃爍消除的組，再讓珠子從原本的列落到新位置（新珠從盤面上方掉進來）。
   * onCombo 每消一組呼叫一次，傳入累計 Combo 數。
   */
  async playSteps(steps: ResolveStep[], onCombo: (combo: number, group: MatchGroup) => void, speed = 1): Promise<void> {
    let combo = 0;
    for (const step of steps) {
      this.board = step.before;
      this.drops.clear();
      this.dropT = 1;
      const t0 = performance.now();
      for (const g of step.groups) for (const c of g.cells) this.fading.set(c, t0);
      for (const g of step.groups) {
        combo++;
        onCombo(combo, g);
        await wait(90 / speed);
      }
      this.loop();
      await wait(300 / speed);
      this.fading.clear();
      await this.animateDrops(step, speed);
    }
  }

  private animateDrops(step: ResolveStep, speed: number): Promise<void> {
    this.board = step.after;
    for (const d of step.drops) this.drops.set(d.to * step.after.cols + d.col, d.from);
    const maxFall = Math.max(1, ...step.drops.map((d) => d.to - d.from));
    const duration = (120 + 45 * maxFall) / speed;
    const t0 = performance.now();
    return new Promise<void>((resolve) => {
      const tick = () => {
        this.dropT = Math.min(1, (performance.now() - t0) / duration);
        this.draw();
        if (this.dropT < 1) requestAnimationFrame(tick);
        else {
          this.drops.clear();
          this.draw();
          resolve();
        }
      };
      requestAnimationFrame(tick);
    });
  }

  /** 換上結算後的盤面：新盤面由上往下落入 */
  async playRefill(board: Board, speed = 1): Promise<void> {
    this.fading.clear();
    this.board = board;
    const duration = 240 / speed;
    const t0 = performance.now();
    await new Promise<void>((resolve) => {
      const tick = () => {
        const t = Math.min(1, (performance.now() - t0) / duration);
        this.dropOffset = (1 - easeOutCubic(t)) * -this.opts.cellSize * 1.2;
        this.draw();
        if (t < 1) requestAnimationFrame(tick);
        else {
          this.dropOffset = 0;
          this.draw();
          resolve();
        }
      };
      requestAnimationFrame(tick);
    });
  }

  // ---------- 輸入 ----------

  private local(e: PointerEvent): { x: number; y: number } {
    // 舞台有 CSS 縮放，用實際顯示大小換算回設計座標
    const rect = this.canvas.getBoundingClientRect();
    const sx = this.canvas.offsetWidth / rect.width;
    const sy = this.canvas.offsetHeight / rect.height;
    return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy };
  }

  private onDown = (e: PointerEvent): void => {
    if (!this.enabled || !this.board || this.pointerId !== null) return;
    const p = this.local(e);
    const pos = cellAt(p.x, p.y, this.opts.cellSize, this.board, 0);
    if (!pos || this.board.cells[toIndex(this.board, pos)].locked) return;
    e.preventDefault();
    this.canvas.setPointerCapture(e.pointerId);
    this.pointerId = e.pointerId;
    this.path = [pos];
    this.held = p;
    this.startedAt = null;
    this.limitMs = this.opts.moveSeconds() * 1000;
    this.loop();
  };

  private onMovePointer = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId || !this.board) return;
    const p = this.local(e);
    this.held = p;
    const target = cellAt(p.x, p.y, this.opts.cellSize, this.board);
    const current = this.path[this.path.length - 1];
    if (target && (target.row !== current.row || target.col !== current.col)) {
      for (const step of stepsBetween(current, target)) {
        if (this.board.cells[toIndex(this.board, step)].locked) break;
        const from = this.path[this.path.length - 1];
        this.board = swapOrbs(this.board, from, step);
        this.path.push(step);
        if (this.startedAt === null) this.startedAt = performance.now();
        this.opts.onStep?.();
      }
    }
  };

  private onUp = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId) return;
    this.finishDrag();
  };

  private finishDrag(): void {
    const path = this.path;
    this.cancelDrag();
    if (path.length > 1) {
      this.enabled = false;
      this.opts.onMove(path);
    }
  }

  private cancelDrag(): void {
    if (this.pointerId !== null && this.canvas.hasPointerCapture(this.pointerId)) {
      this.canvas.releasePointerCapture(this.pointerId);
    }
    this.pointerId = null;
    this.held = null;
    this.path = [];
    this.startedAt = null;
    this.updateTimer(1);
    this.draw();
  }

  // ---------- 繪製 ----------

  private loop = (): void => {
    cancelAnimationFrame(this.raf);
    const frame = () => {
      if (this.pointerId !== null) {
        const left = remainingMs(this.startedAt, performance.now(), this.limitMs);
        this.updateTimer(left / this.limitMs);
        if (left <= 0) {
          this.finishDrag();
          return;
        }
      }
      this.draw();
      if (this.pointerId !== null || this.fading.size) this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  };

  private updateTimer(ratio: number): void {
    const show = this.opts.showTimer() && this.startedAt !== null;
    this.timerFill.parentElement!.style.visibility = show ? 'visible' : 'hidden';
    this.timerFill.style.width = `${Math.max(0, ratio) * 100}%`;
    this.timerFill.parentElement!.classList.toggle('critical', ratio < 0.3);
  }

  private ensureResolution(): number {
    const cssW = this.canvas.offsetWidth || this.board!.cols * this.opts.cellSize;
    const rect = this.canvas.getBoundingClientRect();
    const scale = (rect.width ? rect.width / cssW : 1) * (window.devicePixelRatio || 1);
    const w = Math.round(this.board!.cols * this.opts.cellSize * scale);
    const h = Math.round(this.board!.rows * this.opts.cellSize * scale);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    return scale;
  }

  private image(o: Orb): HTMLImageElement | null {
    const k = orbKey(o);
    let img = orbImages.get(k.key);
    if (!img) {
      img = new Image();
      img.onload = () => this.draw();
      img.src = orbDataUrl(k.kind, { enhanced: k.enhanced, locked: k.locked });
      orbImages.set(k.key, img);
    }
    return img.complete && img.naturalWidth ? img : null;
  }

  private draw(): void {
    const board = this.board;
    if (!board) return;
    const scale = this.ensureResolution();
    const ctx = this.ctx;
    const s = this.opts.cellSize;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, board.cols * s, board.rows * s);

    for (let r = 0; r < board.rows; r++) {
      for (let c = 0; c < board.cols; c++) {
        ctx.fillStyle = (r + c) % 2 ? '#16204a' : '#1c2858';
        ctx.fillRect(c * s, r * s, s, s);
      }
    }

    const heldPos = this.held ? this.path[this.path.length - 1] : null;
    const heldIndex = heldPos ? toIndex(board, heldPos) : -1;
    const now = performance.now();

    // 拖曳軌跡
    if (this.path.length > 1) {
      ctx.save();
      ctx.strokeStyle = 'rgba(242, 196, 90, 0.55)';
      ctx.lineWidth = s * 0.14;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      this.path.forEach((p, i) => {
        const x = (p.col + 0.5) * s;
        const y = (p.row + 0.5) * s;
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      });
      ctx.stroke();
      ctx.restore();
    }

    const pad = s * 0.05;
    board.cells.forEach((orb, i) => {
      const img = this.image(orb);
      if (!img) return;
      const col = i % board.cols;
      const fromRow = this.drops.get(i);
      const row = fromRow === undefined ? Math.floor(i / board.cols) : fromRow + (Math.floor(i / board.cols) - fromRow) * easeOutBounce(this.dropT);
      if (row < -0.95) return;
      let alpha = i === heldIndex ? 0.25 : 1;
      let grow = 0;
      const fadeStart = this.fading.get(i);
      if (fadeStart !== undefined) {
        const t = Math.min(1, (now - fadeStart) / 300);
        alpha = 1 - t;
        grow = t * s * 0.15;
        if (t >= 1) this.fading.delete(i);
      }
      if (alpha <= 0) return;
      ctx.globalAlpha = alpha;
      ctx.drawImage(img, col * s + pad - grow, row * s + pad - grow + this.dropOffset, s - pad * 2 + grow * 2, s - pad * 2 + grow * 2);
      if (fadeStart !== undefined) {
        ctx.fillStyle = `rgba(255, 246, 216, ${0.6 * (1 - alpha)})`;
        ctx.beginPath();
        ctx.arc((col + 0.5) * s, (row + 0.5) * s + this.dropOffset, s * 0.45, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    ctx.globalAlpha = 1;

    // 手上的珠跟著手指，放大一點並往上偏移，避免被手指擋住
    if (this.held && heldIndex >= 0) {
      const img = this.image(board.cells[heldIndex]);
      if (img) {
        const size = s * 1.1;
        ctx.globalAlpha = 0.95;
        ctx.drawImage(img, this.held.x - size / 2, this.held.y - size / 2 - s * 0.25, size, size);
        ctx.globalAlpha = 1;
      }
    }
  }
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;
/** 落地時輕輕彈一下 */
const easeOutBounce = (t: number) => (t < 0.8 ? (t / 0.8) ** 2 : 1 - 0.06 * Math.sin(((t - 0.8) / 0.2) * Math.PI));
