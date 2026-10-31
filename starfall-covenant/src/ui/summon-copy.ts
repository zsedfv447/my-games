// 召喚頁橫幅文案：每個卡池各自的標籤、英文副標、說明，讓玩家看得出卡池差異（純資料，不碰 DOM）
import type { GachaPoolDef } from '../core/types';

export interface BannerCopy {
  tag: string;
  en: string;
  flavor: string;
  /** 由卡池資料算出的事實：收錄稀有度與最高稀有度機率 */
  facts: string;
  /** 橫幅上展示的卡號 */
  featured: string[];
}

const COPY: Record<string, Omit<BannerCopy, 'facts'>> = {
  'covenant-seal': {
    tag: '常駐封印',
    en: 'COVENANT SEAL',
    flavor: '契約之門最古老的刻印　只回應 4★ 以上的星靈',
    featured: ['c101', 'c201'],
  },
  'pool-standard': {
    tag: '全星靈收錄',
    en: 'STARSEA SUMMON',
    flavor: '星海漂流著剛墜落的新星靈　3★ 夥伴也在這裡等你',
    featured: ['c706', 'c705'],
  },
};

const pct = (rate: number) => `${+(rate * 100).toFixed(2)}%`;

export function bannerCopy(pool: GachaPoolDef): BannerCopy {
  const rarities = Object.keys(pool.rates).map(Number).sort((a, b) => a - b);
  const min = rarities[0];
  const max = rarities[rarities.length - 1];
  const facts = `收錄 ${min}★～${max}★・${max}★ 機率 ${pct(pool.rates[max as keyof typeof pool.rates] ?? 0)}`;
  if (pool.rateUp?.length) {
    return { tag: '光闇角色機率提升', en: 'TWILIGHT PACT', flavor: '聖詠與深淵　交織命運的刻印', facts, featured: pool.rateUp.map((u) => u.card) };
  }
  const copy = COPY[pool.id] ?? { tag: '常駐封印', en: 'ANCIENT COVENANT', flavor: '沉睡於星海的力量　聆聽你的呼喚', featured: ['c101', 'c201'] };
  return { ...copy, facts };
}
