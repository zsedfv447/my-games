// 盤面繪製與拖曳轉珠（Canvas 2D＋Pointer Events，觸控與滑鼠共用）
// 規則都在 board.ts：拖曳時用 swapOrbs 即時顯示，放手後把路徑交給 Battle.submitMove。
import { applyPath, swapOrbs, toIndex, type Board, type MatchGroup, type Orb, type Pos, type ResolveStep } from '../board';
import { orbDataUrl, type OrbKind } from '../../ui/art/orbs';
import { cellAt, nextStep, remainingMs, samplePoints } from './drag';
import { userAsset } from '../../ui/assets';

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
  private preview: Pos[] = [];
  private playback?: AbortController;
  private destroyed = false;
  private boardRevision = 0;

  get canInteract(): boolean { return this.enabled && this.pointerId === null && !this.playback && !this.destroyed; }

  previewPath(path: Pos[] | null): void {
    this.preview = path?.map(p => ({ ...p })) ?? [];
    this.draw();
  }

  /** 只播放合法交換；呼叫者確認成功後才交給正式回合引擎。 */
  async playPath(path: Pos[], signal?: AbortSignal): Promise<boolean> {
    if (!this.board || this.destroyed || this.playback || this.pointerId !== null || signal?.aborted || path.length < 2) return false;
    if (path.some(p => !Number.isInteger(p.col) || !Number.isInteger(p.row)) || !applyPath(this.board, path).completed) return false;
    const original = this.board;
    const revision = this.boardRevision;
    const controller = new AbortController();
    this.playback = controller;
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    this.setEnabled(false);
    this.preview = [];
    this.path = [{ ...path[0] }];
    this.touch = false;
    const s = this.opts.cellSize;
    this.held = { x: (path[0].col + .5) * s, y: (path[0].row + .5) * s };
    let complete = false;
    try {
      for (let i = 1; i < path.length; i++) {
        if (controller.signal.aborted || this.destroyed) return false;
        this.swap(path[i - 1], path[i]);
        this.held = { x: (path[i].col + .5) * s, y: (path[i].row + .5) * s };
        this.draw();
        await abortableWait(125, controller.signal);
      }
      complete = !controller.signal.aborted && !this.destroyed;
      return complete;
    } finally {
      signal?.removeEventListener('abort', abort);
      if (!complete && this.boardRevision === revision) this.board = original;
      this.playback = undefined;
      this.cancelDrag();
    }
  }


  // 拖曳狀態
  private pointerId: number | null = null;
  private path: Pos[] = [];
  private held: { x: number; y: number } | null = null;
  /** 上一個已判定的指標位置（線段取樣的起點） */
  private lastPoint: { x: number; y: number } | null = null;
  private touch = false;
  private startedAt: number | null = null;
  private limitMs = 5000;
  private lastStepSound = 0;
  /** 拖曳期間舞台不會動，拿起時量一次換算比例，避免每個事件都量版面 */
  private origin = { left: 0, top: 0, sx: 1, sy: 1 };
  /** 被擠開的珠：格子索引 → 從哪裡滑過來（格座標）與開始時間 */
  private slides = new Map<number, { col: number; row: number; t0: number }>();

  // 動畫狀態
  private fading = new Map<number, number>();
  private dropOffset = 0;
  /** 逐段落下時：格子索引 → 起始列（負數代表從盤面上方掉進來） */
  private drops = new Map<number, number>();
  /** 主動技轉珠：格子 → 開始翻面的時間與原本的珠 */
  private flips = new Map<number, { t0: number; from: Orb }>();
  private dropT = 1;
  private raf = 0;
  private flipSpeed = 1;
  private boardTexture?: HTMLImageElement;

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
    const texture = userAsset('ui', 'board');
    if (texture) {
      this.boardTexture = new Image();
      this.boardTexture.onload = () => this.draw();
      this.boardTexture.src = texture;
    }

    // 視窗大小或舞台縮放改變時重新量畫布縮放
    window.addEventListener('resize', this.invalidateScale);
    this.canvas.addEventListener('pointerdown', this.onDown);
    this.canvas.addEventListener('pointermove', this.onMovePointer);
    this.canvas.addEventListener('pointerup', this.onUp);
    this.canvas.addEventListener('pointercancel', this.onUp);
    this.canvas.addEventListener('lostpointercapture', this.onUp);
  }

  setBoard(board: Board): void {
    this.boardRevision++;
    this.playback?.abort();
    this.preview = [];
    const resized = !this.board || this.board.cols !== board.cols || this.board.rows !== board.rows;
    this.board = board;
    if (resized) {
      this.scaleCache = null;
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
    this.destroyed = true;
    this.playback?.abort();
    window.removeEventListener('resize', this.invalidateScale);
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

  /** 主動技改變盤面：變了的珠逐顆翻面換色；盤面大小不同時改用整盤落下 */
  async playTransform(board: Board, speed = 1): Promise<void> {
    const prev = this.board;
    if (!prev || prev.cols !== board.cols || prev.rows !== board.rows) return this.playRefill(board, speed);
    this.fading.clear();
    const changed = board.cells.map((_, i) => i).filter((i) => !sameOrb(prev.cells[i], board.cells[i]));
    this.board = board;
    if (!changed.length) return this.draw();
    // 由左上往右下依序翻，整段控制在 0.5 秒內
    const stagger = Math.min(40, 360 / changed.length) / speed;
    const t0 = performance.now();
    changed.forEach((i, k) => this.flips.set(i, { t0: t0 + k * stagger, from: prev.cells[i] }));
    const total = stagger * changed.length + FLIP_MS / speed;
    this.flipSpeed = speed;
    await new Promise<void>((resolve) => {
      const tick = () => {
        this.draw();
        if (performance.now() - t0 < total) requestAnimationFrame(tick);
        else {
          this.flips.clear();
          this.draw();
          resolve();
        }
      };
      requestAnimationFrame(tick);
    });
  }

  // ---------- 輸入 ----------

  private measure(): void {
    // 舞台有 CSS 縮放，用實際顯示大小換算回設計座標
    const rect = this.canvas.getBoundingClientRect();
    this.origin = { left: rect.left, top: rect.top, sx: this.canvas.offsetWidth / rect.width, sy: this.canvas.offsetHeight / rect.height };
  }

  private local(e: { clientX: number; clientY: number }): { x: number; y: number } {
    const o = this.origin;
    return { x: (e.clientX - o.left) * o.sx, y: (e.clientY - o.top) * o.sy };
  }

  private onDown = (e: PointerEvent): void => {
    if (!this.enabled || !this.board || this.pointerId !== null) return;
    this.preview = [];
    this.measure();
    const p = this.local(e);
    const pos = cellAt(p.x, p.y, this.opts.cellSize, this.board, 0);
    if (!pos || this.board.cells[toIndex(this.board, pos)].locked) return;
    e.preventDefault();
    this.canvas.setPointerCapture(e.pointerId);
    this.pointerId = e.pointerId;
    this.path = [pos];
    this.held = p;
    this.lastPoint = p;
    this.touch = e.pointerType === 'touch';
    this.slides.clear();
    this.startedAt = null;
    this.limitMs = this.opts.moveSeconds() * 1000;
    this.loop();
  };

  private onMovePointer = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId || !this.board) return;
    // 快速滑動時瀏覽器會把一幀內的多個點合併成一個事件，要把每個原始點都拿出來判定
    const events = e.getCoalescedEvents?.() ?? [];
    for (const ev of events.length ? events : [e]) this.track(this.local(ev));
  };

  /** 從上一個點到 p 逐段取樣，每個取樣點都檢查要不要換格 */
  private track(p: { x: number; y: number }): void {
    const s = this.opts.cellSize;
    const board = this.board!;
    // 手指拖出盤面時珠子停在邊上
    const clamped = { x: clamp(p.x, 0, board.cols * s - 0.01), y: clamp(p.y, 0, board.rows * s - 0.01) };
    this.held = clamped;
    for (const q of samplePoints(this.lastPoint ?? clamped, clamped, s * 0.05)) {
      for (let guard = 0; guard < 2; guard++) {
        const from = this.path[this.path.length - 1];
        const step = nextStep(from, q.x, q.y, s, this.board!);
        if (!step || this.board!.cells[toIndex(this.board!, step)].locked) break;
        this.swap(from, step);
      }
    }
    this.lastPoint = clamped;
  }

  private swap(from: Pos, to: Pos): void {
    const board = this.board!;
    const now = performance.now();
    // 被擠開的珠從 to 滑到 from；若它本來還在滑，從目前畫面上的位置接著滑
    const prev = this.slidePos(toIndex(board, to), now);
    this.slides.delete(toIndex(board, to));
    this.slides.set(toIndex(board, from), { col: prev?.col ?? to.col, row: prev?.row ?? to.row, t0: now });
    this.board = swapOrbs(board, from, to);
    this.path.push(to);
    if (this.startedAt === null) this.startedAt = now;
    // 一幀換好幾格時音效只播一次，避免手機上同時開太多音效卡頓
    if (now - this.lastStepSound > 40) {
      this.lastStepSound = now;
      this.opts.onStep?.();
    }
  }

  /** 正在滑動的珠目前畫在哪（格座標）；沒有在滑則回傳 null */
  private slidePos(index: number, now: number): { col: number; row: number } | null {
    const slide = this.slides.get(index);
    if (!this.board || !slide) return null;
    const t = Math.min(1, (now - slide.t0) / SLIDE_MS);
    if (t >= 1) {
      this.slides.delete(index);
      return null;
    }
    const k = easeOutCubic(t);
    const col = index % this.board.cols;
    const row = Math.floor(index / this.board.cols);
    return { col: slide.col + (col - slide.col) * k, row: slide.row + (row - slide.row) * k };
  }

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
    this.lastPoint = null;
    this.slides.clear();
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

  /** 畫布的實際縮放（舞台縮放 × 裝置像素比）；每幀量版面在低階手機上很貴，只在尺寸可能改變時重算 */
  private scaleCache: number | null = null;
  private invalidateScale = (): void => {
    this.scaleCache = null;
  };

  private ensureResolution(): number {
    if (this.scaleCache === null) {
      const cssW = this.canvas.offsetWidth || this.board!.cols * this.opts.cellSize;
      const rect = this.canvas.getBoundingClientRect();
      // 還沒排進畫面（寬度 0）時不快取，下一次再量
      if (rect.width) this.scaleCache = (rect.width / cssW) * (window.devicePixelRatio || 1);
      else return window.devicePixelRatio || 1;
    }
    const scale = this.scaleCache;
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
        ctx.fillStyle = (r + c) % 2 ? '#392b24' : '#66513f';
        ctx.fillRect(c * s, r * s, s, s);
      }
    }
    if (this.boardTexture?.complete && this.boardTexture.naturalWidth) {
      ctx.drawImage(this.boardTexture, 0, 0, board.cols * s, board.rows * s);
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
      // 翻面：前半段縮成一條線顯示原本的珠，後半段展開成新珠
      const flip = this.flips.get(i);
      const ft = flip ? clamp(((now - flip.t0) * this.flipSpeed) / FLIP_MS, 0, 1) : 1;
      const img = this.image(flip && ft < 0.5 ? flip.from : orb);
      if (!img) return;
      const squeeze = flip ? Math.abs(1 - ft * 2) : 1;
      const slid = this.slidePos(i, now);
      const col = slid ? slid.col : i % board.cols;
      const fromRow = this.drops.get(i);
      const row = slid ? slid.row : fromRow === undefined ? Math.floor(i / board.cols) : fromRow + (Math.floor(i / board.cols) - fromRow) * easeOutBounce(this.dropT);
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
      const w = (s - pad * 2 + grow * 2) * squeeze;
      ctx.drawImage(img, (col + 0.5) * s - w / 2, row * s + pad - grow + this.dropOffset, w, s - pad * 2 + grow * 2);
      if (flip && ft > 0 && ft < 1) {
        ctx.fillStyle = `rgba(255, 246, 216, ${0.5 * Math.sin(ft * Math.PI)})`;
        ctx.beginPath();
        ctx.arc((col + 0.5) * s, (row + 0.5) * s + this.dropOffset, s * 0.42, 0, Math.PI * 2);
        ctx.fill();
      }
      if (fadeStart !== undefined) {
        ctx.fillStyle = `rgba(255, 246, 216, ${0.6 * (1 - alpha)})`;
        ctx.beginPath();
        ctx.arc((col + 0.5) * s, (row + 0.5) * s + this.dropOffset, s * 0.45, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    ctx.globalAlpha = 1;

    if (this.preview.length) {
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      this.preview.forEach((p, i) => {
        const x = (p.col + .5) * s, y = (p.row + .5) * s;
        if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      });
      ctx.strokeStyle = '#102238'; ctx.lineWidth = 8; ctx.stroke();
      ctx.strokeStyle = '#80f4ff'; ctx.lineWidth = 4; ctx.stroke();
      [this.preview[0], this.preview[this.preview.length - 1]].forEach((p, i) => {
        const x = (p.col + .5) * s, y = (p.row + .5) * s;
        ctx.fillStyle = i ? '#f6d578' : '#80f4ff';
        ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#102238'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(i ? '終' : '起', x, y);
      });
      ctx.restore();
    }

    // 手上的珠跟著指標，放大一點；觸控時往上偏移，避免被手指擋住
    if (this.held && heldIndex >= 0) {
      const img = this.image(board.cells[heldIndex]);
      if (img) {
        const size = s * 1.1;
        const lift = this.touch ? s * 0.25 : 0;
        ctx.globalAlpha = 0.95;
        ctx.drawImage(img, this.held.x - size / 2, this.held.y - size / 2 - lift, size, size);
        ctx.globalAlpha = 1;
      }
    }
  }
}

/** 主動技轉珠時每顆珠翻面的時間 */
const FLIP_MS = 220;
const sameOrb = (a: Orb | undefined, b: Orb | undefined) =>
  !!a && !!b && a.type === b.type && a.enhanced === b.enhanced && a.locked === b.locked && !!a.poison === !!b.poison && !!a.hidden === !!b.hidden;

/** 被擠開的珠滑到新位置的時間 */
const SLIDE_MS = 80;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;
/** 落地時輕輕彈一下 */
const easeOutBounce = (t: number) => (t < 0.8 ? (t / 0.8) ** 2 : 1 - 0.06 * Math.sin(((t - 0.8) / 0.2) * Math.PI));

function abortableWait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise(resolve => {
    const finish = () => { clearTimeout(timer); signal.removeEventListener('abort', finish); resolve(); };
    const timer = setTimeout(finish, ms);
    if (signal.aborted) finish(); else signal.addEventListener('abort', finish, { once: true });
  });
}
