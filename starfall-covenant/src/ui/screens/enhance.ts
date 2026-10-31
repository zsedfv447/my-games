// 卡片養成：強化（經驗）、技能升級、突破、星紋覺醒四個頁籤共用一個畫面
import { h, type Child } from '../dom';
import type { CardDef, OwnedCard } from '../../core/types';
import {
  awaken, computeStats, enhance, enhanceRiskyMaterials, expToNextLevel, limitBreak, maxSkillLevel, nextAwakening, previewEnhance,
  skillCooldown, skillUp, type GrowthResult,
} from '../../growth';
import { userAsset } from '../assets';
import { audio } from '../audio';
import { badge, bar, button, emptyState, panel, stars, tabs } from '../components/basic';
import { cardPortrait, cardThumb } from '../components/card-thumb';
import { confirmDialog, openDialog, toast } from '../components/overlay';
import { commit, getSave, growth } from '../state';
import type { ScreenDef } from '../router';
import {
  autoPickCount, autoPickEnhance, GROWTH_MODES, levelProgress, materialLimit, materialOptions, parseMode,
  passiveText, statLines, type GrowthMode, type StatLine,
} from './growth-view';
import '../growth.css';

export function growthBackdrop(): Record<string, string> | undefined {
  const bg = userAsset('backgrounds', 'growth');
  return bg ? { '--growth-bg': `url("${bg}")` } : undefined;
}

export function statTable(lines: StatLine[]): HTMLElement {
  return h('div', { class: 'growth-stats' }, lines.map((l) => {
    const diff = l.after - l.before;
    return h('div', null,
      h('span', { class: 'dim' }, l.label),
      h('strong', null, l.before.toLocaleString()),
      h('span', { class: 'arrow' }, '→'),
      h('strong', { class: diff > 0 ? 'up' : '' }, l.after.toLocaleString()),
      h('span', { class: ['diff', diff > 0 && 'up'] }, diff > 0 ? `+${diff.toLocaleString()}` : ''));
  }));
}

type CelebrateSound = 'win' | 'skill' | 'summon-release';

/** 成功演出：立繪閃光＋大字；按確定或點背景關閉，關閉後才呼叫 onClose（例如更新畫面） */
export function celebrate(def: CardDef, headline: string, detail: Child, sound: CelebrateSound = 'win', onClose?: () => void): void {
  audio.play(sound);
  const dlg = openDialog(headline, h('div', { class: 'growth-celebrate' },
    h('div', { class: 'burst' }),
    cardPortrait(def),
    h('div', { class: 'headline' }, headline),
    h('div', { class: 'detail' }, detail),
  ), [button('確定', { variant: 'primary', block: true, onClick: () => dlg.close() })], { onClose });
}

interface Celebration { headline: string; detail: Child; sound?: CelebrateSound }

interface ModeView {
  /** 上方說明（等級與經驗、技能冷卻…） */
  info: Child;
  /** 選好素材後的預覽 */
  preview: Child;
  /** 不能操作時的原因（顯示在素材區） */
  blocked?: string;
  coin: number;
  canRun: boolean;
  /** confirmed：玩家已在確認框同意吃掉高星角色卡 */
  run: (confirmed: boolean) => GrowthResult<object>;
  /** 需要先確認的素材（強化吃 4★ 以上角色卡） */
  risky?: string[];
  /** 成功後的演出內容；畫面等演出關閉後才更新，避免先看到結果 */
  onSuccess: (before: OwnedCard, after: OwnedCard) => Celebration;
  autoPick: () => string[];
}

export const enhanceScreen: ScreenDef = {
  name: 'enhance',
  title: '卡片養成',
  chrome: 'sub',
  parent: 'cards',
  render({ route, nav }) {
    const uid = route.args[0];
    let mode: GrowthMode = parseMode(route.query.mode);
    // 從素材卡詳情「拿去強化…」過來時，先放好那張素材
    let selected: string[] = route.query.mat ? [route.query.mat] : [];
    // 防連點：確認框開著、或演出還沒關時不再執行
    let busy = false;
    const root = h('div', { class: 'growth-screen', style: growthBackdrop() });

    const runMode = async (btn: HTMLButtonElement, view: ModeView, owned: OwnedCard, def: CardDef) => {
      if (busy) return;
      busy = true;
      btn.disabled = true;
      let celebrating = false;
      try {
        const save = getSave();
        const risky = view.risky ?? [];
        if (risky.length) {
          const ok = await confirmDialog('確認素材', h('div', null,
            h('p', { style: { margin: '0 0 8px' } }, `素材裡有 ${risky.length} 張 ${growth.rules.enhanceConfirmRarity}★ 以上的角色卡，強化後會消失。確定要用嗎？`),
            h('div', { class: 'row wrap', style: { gap: '6px' } }, risky.map((m) => {
              const c = save.inventory.cards.find((x) => x.uid === m)!;
              return cardThumb(growth.card(c.cardId)!, { level: c.level, size: 44 });
            }))), '確定強化');
          if (!ok) return;
        }
        const r = view.run(risky.length > 0);
        if (!r.ok) return toast(r.error.message);
        commit(r.save);
        const after = r.save.inventory.cards.find((c) => c.uid === uid)!;
        selected = [];
        const show = view.onSuccess(owned, after);
        celebrating = true;
        // 演出關閉後才更新畫面，結果不會被提前看到
        celebrate(def, show.headline, show.detail, show.sound, () => { busy = false; draw(); });
      } finally {
        if (!celebrating) { busy = false; btn.disabled = false; }
      }
    };
    const body = h('div', { class: 'growth-body' });

    const draw = () => {
      const save = getSave();
      const owned = save.inventory.cards.find((c) => c.uid === uid);
      const def = owned && growth.card(owned.cardId);
      if (!owned || !def) {
        body.replaceChildren(emptyState('cards', '找不到這張卡片', '可能已經被當成素材或賣掉了'));
        return;
      }
      const options = materialOptions(save, growth, uid, mode);
      const limit = materialLimit(owned, def, growth, mode);
      selected = selected.filter((s) => options.some((o) => o.owned.uid === s)).slice(0, limit);
      const view = modeView(mode, owned, def, selected);

      const toggle = (m: string) => {
        if (selected.includes(m)) selected = selected.filter((x) => x !== m);
        else if (selected.length >= limit) return toast(limit ? `最多選 ${limit} 張` : view.blocked ?? '目前不能選素材');
        else selected = [...selected, m];
        draw();
      };

      const grid = h('div', { class: 'card-grid growth-materials' }, options.map((o) => {
        const el = cardThumb(o.def, { level: o.owned.level, size: 62, selected: selected.includes(o.owned.uid), onClick: () => toggle(o.owned.uid) });
        const order = selected.indexOf(o.owned.uid);
        return h('div', { class: 'growth-mat' }, el,
          order >= 0 && h('span', { class: 'pick-no' }, order + 1),
          mode === 'enhance' && h('span', { class: ['mat-exp', o.sameAttribute && 'same'] }, `${o.sameAttribute ? '同屬 ' : ''}+${o.exp.toLocaleString()}`));
      }));

      const coinShort = view.coin > save.player.coin;
      body.replaceChildren(
        h('div', { class: 'growth-hero' },
          h('div', { class: 'growth-thumb' }, cardThumb(def, { level: owned.level, size: 78, onClick: () => nav.go('card', [uid]) })),
          h('div', { class: 'grow' },
            h('div', { class: 'row between' }, h('strong', { class: 'growth-name' }, def.name), stars(def.rarity)),
            h('div', { class: 'row wrap', style: { gap: '4px', marginTop: '4px' } },
              badge(`Lv ${owned.level}/${def.maxLevel}`), badge(`技能 ${owned.skillLevel}/${maxSkillLevel(def, growth)}`),
              badge(`突破 +${owned.limitBreak}`, owned.limitBreak ? 'gold' : undefined), badge(`覺醒 ${owned.awakened}/${def.awakenings?.length ?? 0}`)),
          )),
        tabs(GROWTH_MODES, mode, (m) => { mode = m; selected = []; history.replaceState(null, '', `#/enhance/${encodeURIComponent(uid)}?mode=${m}`); draw(); }),
        panel(null, view.info),
        panel({ title: '預覽' }, view.preview),
        panel(
          { title: `選擇素材（${selected.length}/${limit}）` },
          view.blocked ? h('p', { class: 'small-text dim' }, view.blocked)
            : options.length ? grid
              : h('p', { class: 'small-text dim' }, '背包裡沒有可用的素材（上鎖或隊伍中的卡不會列出）'),
          !view.blocked && h('div', { class: 'row', style: { marginTop: '8px' } },
            button('自動選擇', { small: true, onClick: () => { selected = view.autoPick(); if (!selected.length) toast('沒有適合自動選擇的素材'); draw(); } }),
            button('清除', { small: true, variant: 'ghost', disabled: !selected.length, onClick: () => { selected = []; draw(); } })),
        ),
        h('div', { class: 'growth-action' },
          h('span', { class: ['small-text', coinShort && 'danger-text'] }, view.coin ? `持有金幣 ${save.player.coin.toLocaleString()}` : ''),
          button(GROWTH_MODES.find((m) => m.id === mode)!.label, {
            variant: 'primary', block: true, disabled: !view.canRun || coinShort,
            cost: view.coin ? { kind: 'coin', amount: view.coin } : undefined,
            onClick: (e) => void runMode(e.currentTarget as HTMLButtonElement, view, owned, def),
          })),
        def.evolution ? button(owned.level >= def.maxLevel ? '可以進化了！前往進化' : `進化（需 Lv${def.maxLevel}）`, {
          block: true, variant: owned.level >= def.maxLevel ? undefined : 'ghost', onClick: () => nav.go('evolve', [uid]),
        }) : '',
      );
    };
    draw();
    root.append(body);
    return root;
  },
};

function modeView(mode: GrowthMode, owned: OwnedCard, def: CardDef, selected: string[]): ModeView {
  const save = getSave();
  const stats = computeStats(def, owned, growth.rules);
  const noPick = h('p', { class: 'small-text dim' }, '選擇素材後顯示結果');

  if (mode === 'enhance') {
    const maxed = owned.level >= def.maxLevel;
    const p = selected.length ? previewEnhance(save, growth, owned.uid, selected) : undefined;
    const sameCount = selected.filter((s) => {
      const c = save.inventory.cards.find((x) => x.uid === s);
      return c && growth.card(c.cardId)?.attribute === def.attribute;
    }).length;
    return {
      info: h('div', null,
        h('div', { class: 'row between small-text' }, h('span', null, `Lv ${owned.level}`), h('span', { class: 'dim' }, maxed ? '已滿級' : `距下一級 ${expToNextLevel(def, owned, growth.rules).toLocaleString()} 經驗`)),
        bar({ value: Math.round(levelProgress(def, owned, growth) * 100), max: 100, variant: 'exp' }),
        h('p', { class: 'small-text dim', style: { margin: '6px 0 0' } }, `同屬性素材經驗 ×${growth.rules.sameAttributeExpBonus}・一次最多 ${growth.rules.maxMaterialsPerEnhance} 張`)),
      preview: !p ? noPick : !p.ok ? h('p', { class: 'small-text' }, p.error.message) : h('div', null,
        h('div', { class: 'growth-level-jump' },
          h('span', null, `Lv ${p.levelBefore}`), h('span', { class: 'arrow' }, '→'), h('strong', { class: p.levelAfter > p.levelBefore ? 'up' : '' }, `Lv ${p.levelAfter}`)),
        bar({ value: Math.round(levelProgress(def, { level: p.levelAfter, exp: owned.exp + p.expGained }, growth) * 100), max: 100, variant: 'exp', label: `+${p.expGained.toLocaleString()} 經驗` }),
        h('div', { class: 'row wrap small-text', style: { gap: '6px', marginTop: '6px' } },
          sameCount > 0 && badge(`同屬加成 ×${sameCount}`, 'gold'),
          p.expWasted > 0 && badge(`溢出 ${p.expWasted.toLocaleString()} 經驗`, 'danger')),
        statTable(statLines(stats, computeStats(def, { ...owned, level: p.levelAfter }, growth.rules)))),
      blocked: maxed ? '已經是最高等級，不需要再強化' : undefined,
      coin: p?.ok ? p.coin : 0,
      canRun: !!p?.ok,
      run: (confirmed) => enhance(getSave(), growth, owned.uid, selected, { confirmRisky: confirmed }),
      risky: enhanceRiskyMaterials(save, growth, selected),
      onSuccess: (before, after) => ({
        headline: after.level > before.level ? '等級提升！' : '強化完成',
        detail: h('div', null,
          h('div', { class: 'growth-level-jump big' }, h('span', null, `Lv ${before.level}`), h('span', { class: 'arrow' }, '→'), h('strong', { class: 'up' }, `Lv ${after.level}`)),
          statTable(statLines(computeStats(def, before, growth.rules), computeStats(def, after, growth.rules)))),
      }),
      autoPick: () => autoPickEnhance(getSave(), growth, owned.uid),
    };
  }

  if (mode === 'skill') {
    const skill = def.activeSkill ? growth.skill(def.activeSkill) : undefined;
    const max = maxSkillLevel(def, growth);
    const nextLv = Math.min(max, owned.skillLevel + selected.length);
    return {
      info: skill
        ? h('div', null, h('strong', null, `主動技・${skill.name}`), h('p', { class: 'small-text', style: { margin: '4px 0' } }, skill.description),
          h('p', { class: 'small-text dim', style: { margin: '0' } }, `技能等級 ${owned.skillLevel} / ${max}・冷卻 ${skillCooldown(def, owned.skillLevel, growth)} 回合。放入同名卡（含同一進化鏈）每張技能 +1 級，必定成功。`))
        : h('p', { class: 'small-text dim' }, '這張卡沒有主動技'),
      preview: !skill || !selected.length ? noPick : h('div', { class: 'growth-level-jump' },
        h('span', null, `冷卻 ${skillCooldown(def, owned.skillLevel, growth)}`), h('span', { class: 'arrow' }, '→'), h('strong', { class: 'up' }, `冷卻 ${skillCooldown(def, nextLv, growth)} 回合（技能 Lv${nextLv}）`)),
      blocked: !skill ? '這張卡沒有主動技' : owned.skillLevel >= max ? '技能已經是最高等級' : undefined,
      coin: 0,
      canRun: !!skill && selected.length > 0,
      run: () => skillUp(getSave(), growth, owned.uid, selected),
      onSuccess: (before, after) => ({
        headline: '技能升級！', sound: 'skill',
        detail: h('div', { class: 'growth-level-jump big' },
          h('span', null, `Lv ${before.skillLevel}`), h('span', { class: 'arrow' }, '→'), h('strong', { class: 'up' }, `Lv ${after.skillLevel}`)),
      }),
      autoPick: () => autoPickCount(materialOptions(getSave(), growth, owned.uid, 'skill'), max - owned.skillLevel),
    };
  }

  if (mode === 'limit') {
    const max = growth.rules.maxLimitBreak;
    const next = Math.min(max, owned.limitBreak + selected.length);
    return {
      info: h('div', null,
        h('div', { class: 'limit-pips' }, Array.from({ length: max }, (_, i) => h('span', { class: ['pip', i < owned.limitBreak && 'on', i >= owned.limitBreak && i < next && 'next'] }))),
        h('p', { class: 'small-text dim', style: { margin: '6px 0 0' } }, `放入同名卡或星輝結晶突破（可以混用），每階基礎數值 +${Math.round(growth.rules.limitBreakStatBonus * 100)}%，最多 +${max}。突破也是星紋覺醒的條件。`)),
      preview: !selected.length ? noPick : h('div', null,
        h('div', { class: 'growth-level-jump' }, h('span', null, `+${owned.limitBreak}`), h('span', { class: 'arrow' }, '→'), h('strong', { class: 'up' }, `+${next}`)),
        statTable(statLines(stats, computeStats(def, { ...owned, limitBreak: next }, growth.rules)))),
      blocked: owned.limitBreak >= max ? `已經突破到 +${max}` : undefined,
      coin: 0,
      canRun: selected.length > 0,
      run: () => limitBreak(getSave(), growth, owned.uid, selected),
      onSuccess: (before, after) => ({
        headline: '突破成功！',
        detail: h('div', null,
          h('div', { class: 'growth-level-jump big' }, h('span', null, `+${before.limitBreak}`), h('span', { class: 'arrow' }, '→'), h('strong', { class: 'up' }, `+${after.limitBreak}`)),
          statTable(statLines(computeStats(def, before, growth.rules), computeStats(def, after, growth.rules)))),
      }),
      autoPick: () => autoPickCount(materialOptions(getSave(), growth, owned.uid, 'limit'), max - owned.limitBreak),
    };
  }

  // 星紋覺醒
  const list = def.awakenings ?? [];
  const req = nextAwakening(def, owned, growth);
  const gateOk = !req || owned.limitBreak >= req.limitBreak;
  const matName = req ? growth.card(req.material)?.name ?? req.material : '';
  return {
    info: list.length ? h('div', { class: 'awaken-list' }, list.map((p, i) => {
      const r = i === owned.awakened ? req : undefined;
      return h('div', { class: ['awaken-slot', i < owned.awakened ? 'on' : i === owned.awakened ? 'next' : 'off'] },
        h('span', { class: 'glyph' }, i < owned.awakened ? '✦' : '✧'),
        h('div', { class: 'grow' }, h('strong', null, passiveText(p)),
          h('div', { class: 'small-text dim' }, i < owned.awakened ? '已解鎖' : r ? `需要突破 +${r.limitBreak}・${matName} ×${r.materials}` : '依序解鎖')));
    })) : h('p', { class: 'small-text dim' }, '這張卡沒有星紋覺醒'),
    preview: !req ? h('p', { class: 'small-text dim' }, list.length ? '星紋覺醒已全部解鎖' : '—')
      : h('div', null,
        h('p', { style: { margin: '0 0 4px' } }, `解鎖第 ${req.slot + 1} 個星紋：`, h('strong', { class: 'up' }, passiveText(req.passive))),
        h('div', { class: 'row wrap', style: { gap: '6px' } },
          badge(`突破 +${owned.limitBreak} / +${req.limitBreak}`, gateOk ? 'gold' : 'danger'),
          badge(`${matName} ${selected.length} / ${req.materials}`, selected.length === req.materials ? 'gold' : undefined))),
    blocked: !list.length ? '這張卡沒有星紋覺醒' : !req ? '星紋覺醒已全部解鎖' : !gateOk ? `先把突破提升到 +${req.limitBreak}（目前 +${owned.limitBreak}）` : undefined,
    coin: req?.coin ?? 0,
    canRun: !!req && gateOk && selected.length === req.materials,
    run: () => awaken(getSave(), growth, owned.uid, selected),
    onSuccess: () => ({ headline: '星紋覺醒！', sound: 'summon-release', detail: h('strong', { class: 'up' }, req ? passiveText(req.passive) : '') }),
    autoPick: () => autoPickCount(materialOptions(getSave(), growth, owned.uid, 'awaken'), req?.materials ?? 0),
  };
}
