// 介面圖示（原創線條圖示，24×24，跟著 currentColor 變色）
const wrap = (body: string, extra = '') =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${extra}>${body}</svg>`;

export const ICONS = {
  home: wrap('<path d="M3 11 12 4l9 7"/><path d="M5 10v10h5v-6h4v6h5V10"/><path d="M12 1.5v1.5"/>'),
  adventure: wrap('<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/><circle cx="12" cy="11" r="1.4" fill="currentColor"/>'),
  team: wrap('<circle cx="8" cy="8" r="3"/><circle cx="16.5" cy="9" r="2.5"/><path d="M2.5 20c.6-3.6 2.8-5.5 5.5-5.5s4.9 1.9 5.5 5.5"/><path d="M14 14.6c.8-.4 1.6-.6 2.5-.6 2.4 0 4.2 1.6 4.8 4.8"/>'),
  cards: wrap('<rect x="4" y="5" width="11" height="15" rx="2"/><path d="M8 3.5h9a2 2 0 0 1 2 2V17"/><path d="M9.5 10.5l1.2-2.4 1.2 2.4 2.4.3-1.8 1.6.5 2.5-2.3-1.2-2.3 1.2.5-2.5-1.8-1.6z"/>'),
  summon: wrap('<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17M3.5 12h17"/><path d="M12 7l1.5 3.5L17 12l-3.5 1.5L12 17l-1.5-3.5L7 12l3.5-1.5z" fill="currentColor" stroke="none"/>'),
  shop: wrap('<path d="M4 9h16l-1.2 11H5.2z"/><path d="M8.5 9V7a3.5 3.5 0 0 1 7 0v2"/>'),
  gear: wrap('<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>'),
  back: wrap('<path d="M15 5l-7 7 7 7"/>'),
  chevron: wrap('<path d="M9 5l7 7-7 7"/>'),
  close: wrap('<path d="M6 6l12 12M18 6 6 18"/>'),
  lock: wrap('<rect x="5" y="10.5" width="14" height="10" rx="2" fill="currentColor" fill-opacity=".25"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>'),
  quest: wrap('<path d="M6 3h12v18l-6-4-6 4z"/><path d="M9 8h6M9 11.5h4"/>'),
  trophy: wrap('<path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4v1.5A3.5 3.5 0 0 0 7.5 11M17 6h3v1.5a3.5 3.5 0 0 1-3.5 3.5"/><path d="M12 14v3M8 20.5h8M9.5 17h5v3.5h-5z"/>'),
  book: wrap('<path d="M4 5.5C6.5 4 9.5 4 12 6c2.5-2 5.5-2 8-.5V19c-2.5-1.5-5.5-1.5-8 .5-2.5-2-5.5-2-8-.5z"/><path d="M12 6v13.5"/>'),
  constellation: wrap('<circle cx="5" cy="17" r="1.6" fill="currentColor"/><circle cx="10" cy="8" r="1.6" fill="currentColor"/><circle cx="16" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="5" r="1.6" fill="currentColor"/><path d="M5 17l5-9 6 4 3-7"/>'),
  tower: wrap('<path d="M8 21V9l4-6 4 6v12z"/><path d="M5 21h14M10.5 12h3M10.5 16h3"/>'),
  event: wrap('<path d="M12 3l2.4 5 5.6.6-4.2 3.8 1.2 5.6L12 15.2 7 18l1.2-5.6L4 8.6 9.6 8z"/>'),
  gift: wrap('<rect x="4" y="9" width="16" height="11" rx="1.5"/><path d="M3 9h18M12 9v11"/><path d="M12 9c-1.5-3-5-4-5-1.5S11 9 12 9zm0 0c1.5-3 5-4 5-1.5S13 9 12 9z"/>'),
  scroll: wrap('<path d="M7 4h11a2 2 0 0 1 2 2v1h-4"/><path d="M16 7v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-1h10"/><path d="M7 4a2 2 0 0 0-2 2v11"/><path d="M9 9h4M9 12h4"/>'),
  history: wrap('<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4h4"/><path d="M12 8v4.5l3 2"/>'),
  sword: wrap('<path d="M14.5 3.5H20v5.5L9 20l-5-5z"/><path d="M6 13l5 5M3 21l2.5-2.5"/>'),
  pause: wrap('<path d="M8 5v14M16 5v14" stroke-width="3"/>'),
  play: wrap('<path d="M7 4.5v15l12-7.5z" fill="currentColor"/>'),
  sound: wrap('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>'),
  save: wrap('<path d="M5 3.5h11l3.5 3.5v13.5H5z"/><path d="M8 3.5v5h7v-5M8 20.5v-6h8v6"/>'),
  // 星紋謎題：四顆紋珠排成方陣，和流派試煉的星座圖示區分
  puzzle: wrap('<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><circle cx="8.6" cy="8.6" r="2.1"/><circle cx="15.4" cy="8.6" r="2.1"/><circle cx="8.6" cy="15.4" r="2.1"/><path d="M14.2 14.3a1.4 1.4 0 1 1 1.9 1.3c-.5.2-.7.5-.7 1"/><circle cx="15.4" cy="18.1" r=".4" fill="currentColor"/>'),
  construction: wrap('<path d="M3 20h18M5 20l3-12h8l3 12"/><path d="M6.5 14h11M9 8l1-4h4l1 4"/>'),
} as const;
export type IconName = keyof typeof ICONS;

/** 資源圖示（填色，有自己的配色） */
export const RESOURCE_ICONS = {
  coin: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="#b98a2a"/><circle cx="12" cy="12" r="8" fill="#f2c45a"/><circle cx="12" cy="12" r="5.2" fill="none" stroke="#b98a2a" stroke-width="1.4"/><path d="M12 8.5l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1z" fill="#fff6d8"/></svg>`,
  gem: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l7 7-7 12-7-12z" fill="#6fd6ff"/><path d="M12 2.5l7 7H5z" fill="#b6ecff"/><path d="M12 2.5 9 9.5h6z" fill="#e8f9ff"/><path d="M12 21.5 9 9.5h6z" fill="#3fa8e0"/></svg>`,
  stamina: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="#1b5e3c"/><path d="M13.5 3.5 6.5 13.5h5L10 20.5l7.5-10.5h-5z" fill="#7ff0b2"/></svg>`,
  token: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l8.2 4.75v9.5L12 21.5l-8.2-4.75v-9.5z" fill="#9b5de5"/><path d="M12 6.5l1.6 3.6 3.9.4-2.9 2.6.8 3.8-3.4-2-3.4 2 .8-3.8-2.9-2.6 3.9-.4z" fill="#ffe8a3"/></svg>`,
} as const;
export type ResourceIcon = keyof typeof RESOURCE_ICONS;
