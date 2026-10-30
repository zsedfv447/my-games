import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../src/ui/assets', () => ({ userAsset: (kind: string, name: string) => name === 'missing' ? undefined : `/${kind}/${name}.m4a` }));
import { AudioManager } from '../src/ui/audio';
class Clip {
  static all: Clip[] = [];
  paused = true; volume = 1; loop = false; currentTime = 0; playbackRate = 1; preload = ''; onended: (() => void) | null = null;
  constructor(public src: string) { Clip.all.push(this); }
  play = vi.fn(async () => { this.paused = false; });
  pause = vi.fn(() => { this.paused = true; });
  cloneNode() { return new Clip(this.src); }
}
let win: EventTarget; let doc: EventTarget & { hidden: boolean };
beforeEach(() => { Clip.all = []; win = new EventTarget(); doc = Object.assign(new EventTarget(), { hidden: false }); vi.stubGlobal('window', win); vi.stubGlobal('document', doc); vi.stubGlobal('Audio', Clip); });
afterEach(() => vi.unstubAllGlobals());
describe('音訊播放狀態', () => {
  it('首次互動解鎖並播放目前曲目，切歌停止舊曲，重選不重建', () => {
    const a = new AudioManager(); a.playBgm('title'); const title = Clip.all[0]; expect(title.play).not.toHaveBeenCalled();
    a.unlock(); expect(title.play).toHaveBeenCalledOnce(); a.playBgm('battle'); expect(title.paused).toBe(true); expect(Clip.all[1].paused).toBe(false);
    a.playBgm('battle'); expect(Clip.all).toHaveLength(2); a.stopBgm(); expect(Clip.all[1].paused).toBe(true);
  });
  it('音量限制範圍，靜音後恢復播放，執行中音效也跟隨音量', () => {
    const a = new AudioManager(); a.unlock(); a.playBgm('home'); a.play('summon'); const bgm = Clip.all[0]; const sfx = Clip.all.at(-1)!;
    a.setVolumes(0, 0); expect(bgm.paused).toBe(true); expect(sfx.volume).toBe(0);
    a.setVolumes(2, -1); expect(bgm.volume).toBe(1); expect(bgm.paused).toBe(false); expect(a.sfxVolume).toBe(0);
    a.setVolumes(Number.NaN, Number.NaN); expect(a.bgmVolume).toBe(0); expect(a.sfxVolume).toBe(0);
  });
  it('背景與失焦時暫停音訊，回到前景恢復目前曲目', () => {
    const a = new AudioManager(); a.unlock(); a.playBgm('home'); a.play('summon'); const bgm = Clip.all[0]; const sfx = Clip.all.at(-1)!;
    win.dispatchEvent(new Event('blur')); expect(bgm.paused).toBe(true); expect(sfx.paused).toBe(true);
    a.playBgm('battle'); expect(Clip.all.at(-1)!.paused).toBe(true); win.dispatchEvent(new Event('focus')); expect(Clip.all.at(-1)!.paused).toBe(false);
    doc.hidden = true; doc.dispatchEvent(new Event('visibilitychange')); expect(Clip.all.at(-1)!.paused).toBe(true);
    doc.hidden = false; doc.dispatchEvent(new Event('visibilitychange')); expect(Clip.all.at(-1)!.paused).toBe(false);
  });
  it('Combo 優先使用實際對應音效，沒有 BGM 則保持靜音', () => {
    const a = new AudioManager(); a.unlock(); a.play('match', 5); expect(Clip.all.at(-1)!.src).toBe('/sfx/match-5.m4a'); expect(Clip.all.at(-1)!.playbackRate).toBe(1);
    a.playBgm('missing'); expect(Clip.all.every(c => !c.loop)).toBe(true);
  });
});

describe('音效播放限制', () => {
  it('未互動時不播放音效，過量音效停止最舊的播放', () => {
    const a = new AudioManager(); a.play('tap'); expect(Clip.all).toHaveLength(0);
    a.unlock(); a.play('tap'); const first = Clip.all.at(-1)!;
    for (let i = 0; i < 24; i++) a.play('tap');
    expect(first.paused).toBe(true);
    expect(Clip.all.filter(c => !c.paused)).toHaveLength(24);
  });
  it('音效播放結束會移除追蹤，後續調音量不再更動已結束音效', () => {
    const a = new AudioManager(); a.unlock(); a.play('tap'); const clip = Clip.all.at(-1)!;
    clip.onended?.(); a.setVolumes(0.5, 0.1); expect(clip.volume).toBe(0.8);
  });
});
