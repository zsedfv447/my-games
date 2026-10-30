// 素材解析：使用者提供的檔案（assets/user/）優先，沒有才用程式產生的圖（GDD 2.7）
//
// 命名慣例（放進 assets/user/ 對應資料夾即自動生效，不必改程式）：
//   cards/<卡號>.webp            卡片立繪，例如 cards/c0102.webp
//   cards/<卡號>_i.webp          卡片頭像（沒有時用立繪裁切）
//   enemies/<敵人id>.webp        敵人
//   backgrounds/<場景>.webp      title、home、battle、battle-boss、chapter-1…
//   ui/<名稱>.webp               logo 等介面圖
//   bgm/<曲名>.ogg|mp3           title、home、battle、boss、victory
//   sfx/<音效>.ogg|mp3|wav       tap、match、combo、skill、win、lose、summon
const files = import.meta.glob('../../assets/user/**/*.{png,jpg,jpeg,webp,avif,svg,gif,ogg,mp3,m4a,wav}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

export type AssetKind = 'cards' | 'enemies' | 'backgrounds' | 'ui' | 'bgm' | 'sfx';

const PREFIX = '../../assets/user/';

/** kind → 檔名（不含副檔名）→ 網址 */
export function indexAssets(entries: Record<string, string>): Map<string, Map<string, string>> {
  const index = new Map<string, Map<string, string>>();
  for (const [path, url] of Object.entries(entries)) {
    const rel = path.startsWith(PREFIX) ? path.slice(PREFIX.length) : path;
    const slash = rel.indexOf('/');
    if (slash < 0) continue;
    const kind = rel.slice(0, slash);
    const file = rel.slice(slash + 1);
    const base = file.replace(/\.[^.]+$/, '');
    if (!index.has(kind)) index.set(kind, new Map());
    const bucket = index.get(kind)!;
    // 同名多格式時，先出現的優先（glob 依字母排序：mp3 早於 ogg、png 早於 webp）
    if (!bucket.has(base)) bucket.set(base, url);
  }
  return index;
}

const index = indexAssets(files);

export function userAsset(kind: AssetKind, name: string): string | undefined {
  return index.get(kind)?.get(name);
}

export function listUserAssets(kind: AssetKind): string[] {
  return [...(index.get(kind)?.keys() ?? [])];
}

/**
 * 資料檔 art 欄位的路徑（例如 "assets/user/cards/c0101.png"）轉成打包後網址。
 * 找不到檔案時回傳 undefined，呼叫端改用程式產生的圖。
 */
export function resolveArtPath(path: string | undefined): string | undefined {
  if (!path) return undefined;
  const key = `../../${path.replace(/^\.?\//, '')}`;
  return files[key];
}
