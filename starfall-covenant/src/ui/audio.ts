// BGM 與音效：有使用者提供的檔案就播檔案，沒有就用 Web Audio 合成簡單音效（GDD 2.6）
import { userAsset } from './assets';

export type SfxName = 'tap' | 'confirm' | 'back' | 'match' | 'skill' | 'win' | 'lose' | 'summon' | 'summon-pull' | 'summon-release';

/** 消除音隨 Combo 升高：以五聲音階往上爬，避免刺耳 */
export function comboFrequency(combo: number): number {
  const pentatonic = [0, 2, 4, 7, 9];
  const step = Math.max(0, combo - 1);
  const semis = pentatonic[step % 5] + 12 * Math.floor(step / 5);
  return 523.25 * Math.pow(2, Math.min(semis, 36) / 12);
}

export class AudioManager {
  private ctx?: AudioContext;
  private bgmEl?: HTMLAudioElement;
  private bgmName?: string;
  private sfxCache = new Map<string, HTMLAudioElement>();
  private unlocked = false;
  private listening = false;
  private focused = true;
  private activeSfx = new Set<HTMLAudioElement>();
  /** 已解碼的短音效；null 代表解碼中或失敗 */
  private buffers = new Map<string, AudioBuffer | null>();
  bgmVolume = 0.8;
  sfxVolume = 0.8;

  /** 延後綁定，讓模組可在非瀏覽器環境載入。 */
  private listen(): void {
    if (this.listening || typeof window === 'undefined') return;
    this.listening = true;
    window.addEventListener('blur', () => { this.focused = false; this.syncPlayback(); });
    window.addEventListener('focus', () => { this.focused = true; this.syncPlayback(); });
    document.addEventListener('visibilitychange', () => this.syncPlayback());
  }

  private get foreground(): boolean {
    return this.focused && (typeof document === 'undefined' || !document.hidden);
  }

  private syncPlayback(): void {
    if (this.unlocked && this.foreground && this.bgmVolume > 0) {
      if (this.bgmEl?.paused) void this.bgmEl.play().catch(() => {});
    } else this.bgmEl?.pause();
    if (!this.foreground) {
      for (const el of this.activeSfx) el.pause();
      this.activeSfx.clear();
      void this.ctx?.suspend().catch(() => {});
    } else if (this.unlocked) void this.ctx?.resume().catch(() => {});
  }

  /** 必須直接在使用者互動事件裡呼叫，解鎖當下也嘗試播放目前曲目。 */
  unlock(): void {
    this.listen();
    this.unlocked = true;
    this.focused = true;
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctor) this.ctx = new Ctor();
    }
    this.syncPlayback();
  }

  setVolumes(bgm: number, sfx: number): void {
    const clamp = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
    this.bgmVolume = clamp(bgm);
    this.sfxVolume = clamp(sfx);
    if (this.bgmEl) this.bgmEl.volume = this.bgmVolume;
    for (const el of this.activeSfx) el.volume = this.sfxVolume;
    this.syncPlayback();
  }

  /** 換曲先停止舊曲，未解鎖時只記住待播曲目。 */
  playBgm(name: string): void {
    this.listen();
    if (this.bgmName === name) { this.syncPlayback(); return; }
    this.bgmName = name;
    this.bgmEl?.pause();
    const url = userAsset('bgm', name);
    this.bgmEl = undefined;
    if (!url) return;
    const el = new Audio(url);
    el.loop = true;
    el.preload = 'auto';
    el.volume = this.bgmVolume;
    this.bgmEl = el;
    this.syncPlayback();
  }

  stopBgm(): void {
    this.bgmEl?.pause();
    this.bgmEl = undefined;
    this.bgmName = undefined;
  }

  play(name: SfxName, combo = 1): void {
    if (!this.unlocked || !this.foreground || this.sfxVolume <= 0) return;
    const comboStep = Math.max(1, Math.min(9, Math.floor(Number.isFinite(combo) ? combo : 1)));
    const variant = name === 'match' && comboStep > 1 ? `match-${comboStep}` : name;
    const variantUrl = userAsset('sfx', variant);
    const url = variantUrl ?? userAsset('sfx', name);
    // 轉珠音一秒會響很多次，用 Web Audio 播已解碼的音效，不必每次建立 <audio>
    if (url && name === 'tap' && this.playBuffer(url)) return;
    if (url) {
      let base = this.sfxCache.get(url);
      if (!base) {
        base = new Audio(url);
        base.preload = 'auto';
        this.sfxCache.set(url, base);
      }
      const el = base.cloneNode() as HTMLAudioElement;
      el.volume = this.sfxVolume;
      if (name === 'match' && !variantUrl) el.playbackRate = Math.min(2, 1 + (comboStep - 1) * 0.06);
      // 保留短音效重疊，但連續點擊也不會無限制堆積播放中的元素。
      if (this.activeSfx.size >= 24) {
        const oldest = this.activeSfx.values().next().value!;
        oldest.pause();
        this.activeSfx.delete(oldest);
      }
      this.activeSfx.add(el);
      el.onended = () => this.activeSfx.delete(el);
      void el.play().catch(() => { this.activeSfx.delete(el); });
      return;
    }
    // 來源專屬抽卡音效缺檔時保持安靜，避免以合成音冒充原素材。
    if (name === 'summon-pull' || name === 'summon-release') return;
    this.synth(name, comboStep);
  }

  /** 用已解碼的音效播放；還沒解碼好就開始解碼並回傳 false，這次改用 <audio> 播 */
  private playBuffer(url: string): boolean {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running' || typeof fetch === 'undefined') return false;
    const buffer = this.buffers.get(url);
    if (buffer === undefined) {
      this.buffers.set(url, null);
      void fetch(url)
        .then((r) => r.arrayBuffer())
        .then((data) => ctx.decodeAudioData(data))
        .then((decoded) => this.buffers.set(url, decoded))
        .catch(() => {});
    }
    if (!buffer) return false;
    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    src.buffer = buffer;
    gain.gain.value = this.sfxVolume;
    src.connect(gain).connect(ctx.destination);
    src.start();
    return true;
  }

  private synth(name: SfxName, combo: number): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const notes: [number, number, number][] = // [頻率, 開始秒, 長度秒]
      name === 'tap' ? [[880, 0, 0.05]]
      : name === 'confirm' ? [[660, 0, 0.07], [990, 0.06, 0.1]]
      : name === 'back' ? [[660, 0, 0.06], [440, 0.05, 0.08]]
      : name === 'match' ? [[comboFrequency(combo), 0, 0.12]]
      : name === 'skill' ? [[523, 0, 0.1], [784, 0.08, 0.1], [1047, 0.16, 0.18]]
      : name === 'win' ? [[523, 0, 0.15], [659, 0.15, 0.15], [784, 0.3, 0.15], [1047, 0.45, 0.4]]
      : name === 'lose' ? [[392, 0, 0.25], [330, 0.25, 0.25], [262, 0.5, 0.5]]
      : [[784, 0, 0.1], [988, 0.1, 0.1], [1175, 0.2, 0.1], [1568, 0.3, 0.35]];
    const t0 = ctx.currentTime;
    for (const [freq, start, len] of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = name === 'lose' ? 'triangle' : 'sine';
      osc.frequency.value = freq;
      const peak = 0.18 * this.sfxVolume;
      gain.gain.setValueAtTime(0, t0 + start);
      gain.gain.linearRampToValueAtTime(peak, t0 + start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + start + len);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0 + start);
      osc.stop(t0 + start + len + 0.02);
    }
  }
}

export const audio = new AudioManager();
