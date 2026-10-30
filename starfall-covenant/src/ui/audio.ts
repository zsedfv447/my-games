// BGM 與音效：有使用者提供的檔案就播檔案，沒有就用 Web Audio 合成簡單音效（GDD 2.6）
import { userAsset } from './assets';

export type SfxName = 'tap' | 'confirm' | 'back' | 'match' | 'skill' | 'win' | 'lose' | 'summon';

/** 消除音隨 Combo 升高：以五聲音階往上爬，避免刺耳 */
export function comboFrequency(combo: number): number {
  const pentatonic = [0, 2, 4, 7, 9];
  const step = Math.max(0, combo - 1);
  const semis = pentatonic[step % 5] + 12 * Math.floor(step / 5);
  return 523.25 * Math.pow(2, Math.min(semis, 36) / 12);
}

class AudioManager {
  private ctx?: AudioContext;
  private bgmEl?: HTMLAudioElement;
  private bgmName?: string;
  private sfxCache = new Map<string, HTMLAudioElement>();
  bgmVolume = 0.8;
  sfxVolume = 0.8;

  /** 瀏覽器規定要在使用者互動後才能出聲，第一次點擊時呼叫 */
  unlock(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctor) this.ctx = new Ctor();
    }
    void this.ctx?.resume();
    if (this.bgmEl?.paused && this.bgmVolume > 0) void this.bgmEl.play().catch(() => {});
  }

  setVolumes(bgm: number, sfx: number): void {
    this.bgmVolume = bgm;
    this.sfxVolume = sfx;
    if (this.bgmEl) this.bgmEl.volume = bgm;
  }

  /** 換 BGM；沒有對應檔案時保持安靜（BGM 不合成） */
  playBgm(name: string): void {
    if (this.bgmName === name) return;
    this.bgmName = name;
    this.bgmEl?.pause();
    const url = userAsset('bgm', name);
    if (!url) {
      this.bgmEl = undefined;
      return;
    }
    const el = new Audio(url);
    el.loop = true;
    el.volume = this.bgmVolume;
    this.bgmEl = el;
    if (this.bgmVolume > 0) void el.play().catch(() => {});
  }

  stopBgm(): void {
    this.bgmEl?.pause();
    this.bgmEl = undefined;
    this.bgmName = undefined;
  }

  play(name: SfxName, combo = 1): void {
    if (this.sfxVolume <= 0) return;
    const url = userAsset('sfx', name);
    if (url) {
      let base = this.sfxCache.get(name);
      if (!base) {
        base = new Audio(url);
        this.sfxCache.set(name, base);
      }
      const el = base.cloneNode() as HTMLAudioElement;
      el.volume = this.sfxVolume;
      if (name === 'match') el.playbackRate = Math.min(2, 1 + (combo - 1) * 0.06);
      void el.play().catch(() => {});
      return;
    }
    this.synth(name, combo);
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
