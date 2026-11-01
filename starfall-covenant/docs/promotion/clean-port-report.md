# R18 clean selective port — Task A

Status: complete and frozen. After mixed owner confirmed all four product files ready, `npm run typecheck` passed (exit 0); evidence `/tmp/r18-clean-port-typecheck.log`. No tests/build/Git/publication performed by this worker.

Dedicated destination: `starfall-production-promotion/starfall-covenant`. Approved baseline f247c1ce4b81d00bb069c681703c808d6d588127; original baseline content compared read-only at `encyclopedia-work/starfall-covenant`. Immutable R18 source b2f926d0c5c838f7a0ffac14f4b2c70a4ec2f561 authenticated per selected file against `/tmp/experiment-r18-director-source.json`.

## Selection proof

Exactly 35 individually allowlisted UI paths, plus 3 data files; no directory overlay. Every existing destination file matched original baseline bytes before any write; new files were absent on both baseline and destination. All 38 source SHA256 hashes matched the immutable manifest before any write; all destination hashes matched after write. No unexpected differences found.

Data tuple authority: immutable-manifest-verified `tools/verify-experiment-release.mjs` (read-only; not copied). Original three data hashes authenticated against its frozen baseline hashes. Exactly 18 unique JSON string literals replaced within their verified id/field; resulting full bytes match immutable R18, and reversing only those 18 replacements reconstructs every baseline byte. JSON was not reformatted. No effects/numbers/rewards/cards/pools/rosters/schema changed.

No mixed files, tests, tools, isolation namespace/save/state/PWA/config/hosting/assets/guide/badge were copied. Selected UI files scanned for experimentKey/EXPERIMENT_/experiment-review/experiment-badge dependencies: none. This necessary scan is not a substitute for director integration review.

## Per-file SHA256

| Path | Baseline | R18 source = destination |
|---|---|---|
| `src/ui/acquire-guide.ts` | `84a9e160b5138917e801a1fdc20f67e3ab312ac881f524af930da26a23b99d77` | `46b5fa0bdb582e603ca7578b436add3e4671957918b9c1c16f133ec74a77e283` |
| `src/ui/acquire-view.ts` | `1c427a371286d4abc75828faa3007c1c4a3df02ee26cac8e13be9efb67540399` | `89d3143a4ca787dc3356c8d5892898f5c270242d7f52b7aa84daa141952e41c8` |
| `src/ui/app.ts` | `062b4f3ba370da0b443564cc98807cfbc44a27872ff85a53fb0d2d4684fd6325` | `76112fe9e676e5269f1f99190faf4bda3da4014e4ba6f6a1aff8a551a49b6b1e` |
| `src/ui/battle-fx/pause.ts` | `07928a924484af0132ba23f17402b8d476815c6e492d584cba4385359a5e8349` | `f93f11e088b9cf5ec8b4ba364d42a5df78675d2f56fcf9ee0ba08c9404807af7` |
| `src/ui/battle-session.ts` | `3ec72cbb7681ec554bdb176a3d0e166ecba22a0b233dfc529749d4e2407cd2af` | `7bffc0e492b19d760c02030e3e3d2b742380a35db343a1ade83e9b498a033ef7` |
| `src/ui/chain-tactics.ts` | `ABSENT (new file)` | `bc6e49d26032db8bc3a47fbeffc5f1c2c036f7f0d3de6a7f021e182321f1523c` |
| `src/ui/components/card-picker.ts` | `8179551f7fa7aa6a33829ba726db9286700c5f901c2dda80bcf0e1b4ebd18191` | `3bdecda7ad927c51c22208b19c117d4fc9bc0647322f3bbb58c703ff37d6a2ef` |
| `src/ui/components/chain-tactics.ts` | `ABSENT (new file)` | `1c1f65d0201c75e2bf5113a3d75b7ddc66426b782e3d793918dcecefd3fb6b8d` |
| `src/ui/components/conversion-filter.ts` | `ABSENT (new file)` | `3a912f278886d3c9398606349ef031bb865daa2ef1997dc3067a131267a4984f` |
| `src/ui/components/defeat-guide.ts` | `de658655dfc0f839bbf9c4c8163d02ce57bd6466eecef3c0a26e3e16d870b5c7` | `5c9d12727f5fc8bfeec82353b9b6d8fa47e3dfd42963b7f7af10f7b78ae883cb` |
| `src/ui/components/fixed-tactics.ts` | `ABSENT (new file)` | `f4bff486cf23e8d4a726ceafe656b07b663d518a978f807cc0363833a2306364` |
| `src/ui/components/orb-assistant.ts` | `864d5e071fee1a37eb0101bb85a8887845c81d1ad1aec7654bc48b45bd2ed4d8` | `d8253b050832a27bb85660553ffb8372e02806fac21e0b8cf9c77c52ace116d5` |
| `src/ui/conversion-query.ts` | `ABSENT (new file)` | `65902c88bb2069e8272a642acd39a18f5a446f18c5ae265570cb50cfb00dd08c` |
| `src/ui/fixed-tactics.ts` | `ABSENT (new file)` | `0eac4fb21f86a97bcbfde4a9052a363e5a4f30098b2da84048454e54d35fefe3` |
| `src/ui/oath-stele.ts` | `40fc1702739a74760fbc2dc5506a37f801d02f7c9a11f485b2f138becffbdb08` | `165057bb40fcc4c6aaf308862925b3423906f955c432f6784f4decdbfe3a1e82` |
| `src/ui/practice-picker.ts` | `2d4c9cd9952a569152a1d3b94799f379fb8b76e98f81a1f3883fdb15ec5c8ef1` | `20c724d694698f40ddaad33ede3c2a0b08733634b0a48944ae3ebc9b5ada36b8` |
| `src/ui/screens/abyss.ts` | `85e358367b91ab7169f5ec87b3d298f0a33dd4a26f61d41068012ce240aca188` | `2eb6a0185c3cd11968fdc5d9e885ba87f990a3a4fc874cdb20efcce3672c3801` |
| `src/ui/screens/archetypes.ts` | `08ad4aa1b6372afbdf96b1c863aaeec1419be36adb3f801869665f82dc9ef2df` | `6bb091ae1e22181cdf211c3e83559584fb5642d96b94fa85b0f393baae35576b` |
| `src/ui/screens/battle.ts` | `c9c90a29e3999b6bbc74a21d9e93d44a5e7666417df40604093bca84f3d51e3e` | `9333a1720a9b76dc84b11e04e997acf03706d3582fdfabaf36d6f47b8a471a63` |
| `src/ui/screens/cards.ts` | `e488a0c355625e192563c33b45187964d0a3a7061be6d6e9badc622a53c1f6ed` | `e64af7aafb6509bbed13011b946747a18c700533b364f245b7c94e330c34bca3` |
| `src/ui/screens/collection.ts` | `84964e9bab75bb00a9e50679d34f6ed639443c2787c641fd18257d5c030d04d9` | `c99449789645a94cbe49ec7e5ffe45e0a748a60f762c2e71a61de5525d85b5e9` |
| `src/ui/screens/enhance.ts` | `fc36246ad5c4f3d2f90479dfca859dda31c71a37284cddc3944aad255cce1cda` | `4d2267f45be58ba6e0dca07f0c2c9a8f0f3114245fcf2acc9ccf8bc4c8fea911` |
| `src/ui/screens/evolve.ts` | `b6d59822e3f805b7ff92bba3cc8c9089c7560ce9ab3988688d44a324a3ac9f79` | `7c9eb745e806d95ca6e99a9cc003a35ce8730d85aa774f5dc99ceb1268e92da2` |
| `src/ui/screens/expedition.ts` | `baddd3f825fb06394106e76cf829257063936e0bc73bfb20844eea4b2529a837` | `095891a079488fef2698173810e145077eb655660732e60c505dd26ac97aa846` |
| `src/ui/screens/login-bonus.ts` | `820fa2e7f4a932e93b8c9ff79eae3a55d3cf75cad9c8b38ac1be3e4c4668801b` | `758381e884658d5520aaca5251e775a5e78d082efb74e07ce9a1d42764b27de0` |
| `src/ui/screens/prepare.ts` | `73c0c23788db64c4378c8c7f37e394728950daefd6a4c01ff1ebed86785c90e1` | `848d9d9b8b524ff4d20d43e22310b9fc9cf6bf779aadea024806c8270066d32f` |
| `src/ui/screens/shop.ts` | `8155ed5a434b4bad07f7669df0d9877b66b09f2b7381b27f81038952e809d6e7` | `df0524a0f2ac03080c4738665ef6efbf04fdfb6f873ab770adb85a64e197e838` |
| `src/ui/screens/summon-ritual.ts` | `80173dad60e0e5eeb8ca23d790f8da6dbc42b859d1cef12e78e22d9c4f3cbfaa` | `8a6848943f9d706e0f0b8e8a5fb9a2c2c506795a2ac7c074cde18a5482ba5b29` |
| `src/ui/screens/summon.ts` | `f112405bf9713726753ccd440534fa95722246b08cb168f157e7ea94a67c8f82` | `bb89390151bb207f6ba47373704fc3bb7a46683d74b7ec56f5bb2df814894376` |
| `src/ui/screens/team.ts` | `cb70732c716648fc01699bafc06f69f2e9583a33711ebda664b73c73e400e326` | `689236a254ab10bad093c87ee04708f60b9c61be670e9d4191ec6f7558bc4fba` |
| `src/ui/skill-conversion-preview.ts` | `ABSENT (new file)` | `243e841fef804493aece1baaf779ab9dc418395dde23d04d486d7c113a40663f` |
| `src/ui/team-capabilities.ts` | `285ac3232522d3a617a250666bf78535983961b62cd47ef16c3c4e3bdb8fc2df` | `a3c1203c8eafd557e30bb61b2dd57c839564a4f0ab2126b7611edd9a1f454897` |
| `src/ui/team-fit-presentation.ts` | `ABSENT (new file)` | `39d21dee2ba8348fbbe34de9182ef99ffb87bc2adb8d30d6e176d30597b2046b` |
| `src/ui/tutorial/battle-guide.ts` | `6a1153f8c3c03d41aeae456283413bfef7dcb8f8d7b22b2c3113dfbdfdee60e3` | `efe390ed0918f1a8142ed383c96b7a1f0bd44dcbfd648f349f8964246f991811` |
| `src/ui/tutorial/controller.ts` | `bb82220d3bd3a7a5ce46182d0cdb01ca8d9270d942ed43b2370f8ab9baddb194` | `cf1ea360ff5486af786b29f49d50b1bae0bc3aa5945866f63fc83d49d9bef1bd` |
| `data/archetypes.json` | `fb6d9dfd1774882195d0d47140eb048d382e24122310fb1584462afe7dcf3d5c` | `1aa11edfcbd9ba1596492efd955567e6bbd96787d6b794088fd2077d505e6d04` |
| `data/skills.json` | `aec58e35ed0c0ba9322af4f7a23500e0bf7d22a6681d4d66baf76e52a6681b2a` | `74b2e39ff07bbc38c9775819701b680c094ed9100de7cb1dec093ae9533012b1` |
| `data/leader-skills.json` | `e2113521f0891f4629fbc93e6ba9f51dc5b5362895e8a49dd9f16ac72529a6b9` | `17d8e5d08454a3280d876116ce43e871487afdb7e7c347033b5f412cdf21a9eb` |

## Exact approved data old → new proof (18 fields)

### data/archetypes.json: fixed.summary
- Old: 造成不看攻擊力的固定傷害，無視護盾。
- New: 造成不看攻擊力的固定傷害，可無視防禦與 Combo 盾；不代表能無視所有護盾。

### data/archetypes.json: fixed.howToPlay
- Old: 消除心珠觸發追打，專門對付高防禦與護盾敵人。
- New: 消除心珠觸發追打；面對高防禦可發揮優勢，遇到減傷盾或七曜環仍要處理護盾。

### data/archetypes.json: chain.summary
- Old: 一次消除 6 顆以上同色珠，打全體並無視防禦。
- New: 靠長串觸發隊長加成；全體攻擊與無視防禦是不同效果，不是所有長串隊都能破防。

### data/archetypes.json: chain.howToPlay
- Old: 集中同色珠排成長串，少 Combo 也能打出高傷害。
- New: 一組 5 顆以上本色珠的傷害打全體，其他組仍依各自珠數判定；依隊長門檻安排長串，開轉珠技前先確認要保留的顏色與施放順序。

### data/archetypes.json: berserk.summary
- Old: 生命越低攻擊越高。
- New: 依隊長技的低血量門檻取得加成，不是每少一點生命都會增加倍率。

### data/archetypes.json: berserk.howToPlay
- Old: 刻意保持低血量，配合保命技能打出爆發。
- New: 主動技補血或自損會先改變血線；轉珠攻擊按本回合心珠回復前的生命判定隊長門檻，因此同回合消心回復不會取消已算出的這次攻擊加成。仍須評估敵人下一次攻擊，低血量不等於安全。

### data/archetypes.json: heart.summary
- Old: 保留心珠，把回復力轉成攻擊力。
- New: 依隊長條件消心取得攻擊加成並支援回復；回復力轉為攻擊力須有對應的主動技效果。

### data/archetypes.json: heart.howToPlay
- Old: 每回合消除心珠，高回復換高傷害與高續航。
- New: 依隊長技要求的心珠組數安排消除，搭配轉心與回復支援；提高回復倍率不會自動提高攻擊倍率。

### data/archetypes.json: race.summary
- Old: 全隊同種族，種族成員越多越強。
- New: 依隊長技強化指定種族的成員；同族人數不會自動提高每人的倍率，全隊同族的額外效果須另看隊長條件。

### data/archetypes.json: skillcycle.summary
- Old: 技能冷卻快，幾乎每回合都能放技能。
- New: 運用開場充能、冷卻縮減與隊員技能安排施技順序；能否連續施放仍須確認冷卻與封印等限制。

### data/archetypes.json: skillcycle.howToPlay
- Old: 輪流施放主動技，技能本身附帶追擊傷害。
- New: 部分隊長技會在施放主動技的回合提高攻擊；技能連鎖的追打須先啟動對應效果，再由後續施技觸發，不是每招都自帶傷害。

### data/skills.json: s103.description
- Old: 同上，並把潮珠轉為焰珠，讓背水回合也能湊出長串。
- New: 扣除目前生命 50%（至少保留 1 點生命），把潮珠轉為焰珠，1 回合內全隊攻擊力 2 倍。

### data/skills.json: s110.description
- Old: 同上，並獲得 1 回合瀕死保命。
- New: 扣除目前生命 30%（至少保留 1 點生命），1 回合內全隊攻擊力 1.5 倍，並在 1 回合內獲得一次致命傷害保命效果（觸發時保留 1 點生命）。

### data/skills.json: s205.description
- Old: 同上，並強化潮珠與輝珠。
- New: 把焰珠轉為潮珠、蝕珠轉為輝珠，並強化全部潮珠與輝珠。

### data/skills.json: s305.description
- Old: 同上改為 50000，並把蝕珠轉為心珠。
- New: 對全體敵人造成 50000 固定傷害（無視防禦與護盾），回復生命上限 15%，並把蝕珠轉為心珠。

### data/skills.json: s410.description
- Old: 同上。
- New: 其他隊員的主動技冷卻減少 1 回合，不包含施放者。

### data/leader-skills.json: l205.description
- Old: 同上改為 4 倍；潮、輝屬性生命 1.3 倍。
- New: 同時消除潮珠與輝珠時全隊攻擊力 4 倍；潮、輝屬性成員生命 1.3 倍。

### data/leader-skills.json: l403.description
- Old: 同上倍率改為 3.5 倍，並且每回合全員技能冷卻額外 −1。
- New: 開場全員主動技冷卻歸零；施放主動技的回合全隊攻擊力 3.5 倍；每回合全員主動技冷卻額外減少 1 回合。

## Limits

This is a verified selective port of previously tested R18 corrections, not new feature development; no fabricated new RED cycle. Baseline test evidence is director-owned. Save/PWA protected-file hashes and backward compatibility are independent-owner/director checks. Full suite, Pages-base build, browser/mobile update/offline/touch and formal publication are not claimed by this worker. Mixed-owner readiness received; typecheck completed successfully. All 38 owned product files and this report are now frozen, with no running worker process.
