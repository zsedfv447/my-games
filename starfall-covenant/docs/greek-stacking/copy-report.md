# Greek stacking Task B — exact descriptions and real screen reading

Completed/frozen. Sole product edit: data/leader-skills.json, exactly five authorized substring replacements, l806–l810. Binary replace preserves original formatting, rules and all other bytes. No private, guide, engine, card definitions, old fixtures or other products touched.

Original SHA256 `17d8e5d08454a3280d876116ce43e871487afdb7e7c347033b5f412cdf21a9eb`; updated SHA256 `b4bec0a6bf9d15711a986e8332a03b76691dd455b361f5166ecb66b6fda61456`. Reverse substitution reproduces full original bytes exactly. All other data files compare byte-identical to the base formal-helper workspace; only leader-skills.json differs.

## l806
- Before: 水屬性成員攻擊力 2.5 倍；每段消除每 3 顆水珠，該段補珠產生 1 顆水強化珠（以可補空格為上限；相同連動不疊加）。
- After: 水屬性成員攻擊力 2.5 倍；每段消除每 3 顆水珠，該段補珠產生 1 顆水強化珠（以可補空格為上限；隊長與助戰的連動產量相加）。
## l807
- Before: 火屬性成員攻擊力 2.5 倍；每段消除每 3 顆火珠，該段補珠產生 1 顆火強化珠（以可補空格為上限；相同連動不疊加）。
- After: 火屬性成員攻擊力 2.5 倍；每段消除每 3 顆火珠，該段補珠產生 1 顆火強化珠（以可補空格為上限；隊長與助戰的連動產量相加）。
## l808
- Before: 木屬性成員攻擊力 2.5 倍；每段消除每 3 顆木珠，該段補珠產生 1 顆木強化珠（以可補空格為上限；相同連動不疊加）。
- After: 木屬性成員攻擊力 2.5 倍；每段消除每 3 顆木珠，該段補珠產生 1 顆木強化珠（以可補空格為上限；隊長與助戰的連動產量相加）。
## l809
- Before: 光屬性成員攻擊力 2.5 倍；每段消除每 3 顆光珠，該段補珠產生 1 顆光強化珠（以可補空格為上限；相同連動不疊加）。
- After: 光屬性成員攻擊力 2.5 倍；每段消除每 3 顆光珠，該段補珠產生 1 顆光強化珠（以可補空格為上限；隊長與助戰的連動產量相加）。
## l810
- Before: 暗屬性成員攻擊力 2.5 倍；每段消除每 3 顆暗珠，該段補珠產生 1 顆暗強化珠（以可補空格為上限；相同連動不疊加）。
- After: 暗屬性成員攻擊力 2.5 倍；每段消除每 3 顆暗珠，該段補珠產生 1 顆暗強化珠（以可補空格為上限；隊長與助戰的連動產量相加）。

## Verification
- `node node_modules/vitest/vitest.mjs run --no-cache tests/greek-stacking-copy.test.ts` before data edit: **6 RED**, exact new phrases absent; `copy-red.log`.
- Final `node node_modules/vitest/vitest.mjs run --no-cache tests/greek-stacking-copy.test.ts tests/e05-display.test.ts tests/helper-support-view.test.ts`: **3 files/21 passed**, `copy-green.log`.
- `node node_modules/typescript/bin/tsc --noEmit`: exit0, `copy-typecheck.log`.

New source contract pins original full-file SHA after reverse substitution, verifies exact five IDs/descriptions; this protects all leader rules and formatting. Five real collection-card/helper-screen DOM cases find corrected original descriptions including searched support row. Isolated fixture explicitly pre-marks all cards seen (helper browsing legitimately discovers visible cards), while inventory/owned/claimed are empty. Full save/storage bytes and Storage.setItem calls remain unchanged while reading; no card/reward granted. This is actual screen rendering with navigation spies, not a claimed trueRouter/full phone journey. Existing helper view suite separately preserves actual visible-only seen behavior.

No full/build/Git mutation/network/install/publication, no mobile visual/performance or guaranteed combo/damage claim. Runtime stacking is independently owned and tested by A/C/D; these copy tests do not prove mechanics by themselves. All owned writes frozen for director integration.
