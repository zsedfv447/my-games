"""找出「圖片被共用」的敵人（同一張圖或只換色），輸出 assets/user/enemy-art-shared.json。

做法：比較每張敵人圖的輪廓（alpha 遮罩裁到內容範圍、縮成 64×64），
兩張輪廓重疊率（IoU）≥ THRESHOLD 就視為同一張圖。換色不會改變輪廓，所以換色圖也抓得到。
每組留一個「原主」保留圖片，其餘敵人在遊戲裡改用 enemySvg 程式產生的圖，等美術補專屬圖。

用法（需要 Pillow）：python3 tools/art/shared_enemy_art.py
"""
import itertools
import json
import os

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
ENEMY_DIR = os.path.join(ROOT, 'assets', 'user', 'enemies')
OUT = os.path.join(ROOT, 'assets', 'user', 'enemy-art-shared.json')
THRESHOLD = 0.95
SIZE = 64

# 預設由 id 最小的正式敵人保留圖片；外觀明顯更符合另一隻時在這裡指定
OWNER_OVERRIDES = {
    # 狼人圖：e0026 叛牙狼首比 e0012 枯羽鴞（貓頭鷹）更合適
    frozenset({'e0012', 'e0026'}): 'e0026',
}


def silhouette(path):
    from PIL import Image
    im = Image.open(path).convert('RGBA')
    alpha = im.getchannel('A').point(lambda a: 255 if a > 32 else 0)
    box = alpha.getbbox()
    small = alpha.crop(box).resize((SIZE, SIZE)).point(lambda a: 1 if a > 127 else 0)
    return list(small.getdata())


def iou(a, b):
    inter = sum(1 for x, y in zip(a, b) if x and y)
    union = sum(1 for x, y in zip(a, b) if x or y)
    return inter / union if union else 0.0


def main():
    files = sorted(f for f in os.listdir(ENEMY_DIR) if f.endswith('.webp'))
    masks = {f.rsplit('.', 1)[0]: silhouette(os.path.join(ENEMY_DIR, f)) for f in files}
    # 相似的兩兩連起來，取連通的群組
    parent = {k: k for k in masks}

    def find(k):
        while parent[k] != k:
            parent[k] = parent[parent[k]]
            k = parent[k]
        return k

    score = {}
    for a, b in itertools.combinations(masks, 2):
        s = iou(masks[a], masks[b])
        if s >= THRESHOLD:
            parent[find(a)] = find(b)
            score[(a, b)] = s

    groups = {}
    for k in masks:
        groups.setdefault(find(k), []).append(k)
    out = []
    for ids in groups.values():
        if len(ids) < 2:
            continue
        ids.sort(key=lambda i: (i.startswith('demo-'), i))
        owner = OWNER_OVERRIDES.get(frozenset(ids), ids[0])
        sims = [s for (a, b), s in score.items() if a in ids and b in ids]
        out.append({
            'owner': owner,
            'borrowers': [i for i in ids if i != owner],
            'minSimilarity': round(min(sims), 3),
        })
    out.sort(key=lambda g: g['owner'])
    data = {
        'note': '圖片被共用（同圖或換色）的敵人。borrowers 在遊戲裡改用程式產生的圖，等美術補專屬圖。由 tools/art/shared_enemy_art.py 產生。',
        'threshold': THRESHOLD,
        'groups': out,
    }
    with open(OUT, 'w', encoding='utf-8') as fp:
        json.dump(data, fp, ensure_ascii=False, indent=2)
        fp.write('\n')
    for g in out:
        print(g['owner'], '←', ', '.join(g['borrowers']), g['minSimilarity'])


if __name__ == '__main__':
    main()
