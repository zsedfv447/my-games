# R18 production selected regression test port

## Scope / source authentication
Work only in isolated `starfall-production-promotion/starfall-covenant`; no product/tool/data/Git/build/deployment changes. Verified every copied file SHA256 against immutable `/tmp/experiment-r18-director-source.json` **before** copying/adapting. Reverified source hashes and destination hashes after adaptations.

Ported **80 newly added general feature/safety test files**, **7 strict audit test files +4 dedicated config files**, and the two semantic expectations in existing `tests/acquire-guide.test.ts`. Excluded16 added experimental/tool-dependent test files. Existing `tests/save.test.ts` remains byte-identical to production baseline; its raw-base64 and frozen v2/v3 importer-success tests preserved. C's promotion-* tests/fixtures were not touched.

No fake experiment shim, no copied experimental guide/storage/SW/hosting/tool implementation. No skipped/it.fails cases or safety assertion weakening.

## Exact adaptations
- e12-backup-restore: inactive neighbor sentinels changed from production keys to experimental-prefixed keys (production keys are now the real operation targets); exported backup must be raw base64, not experimental tag. Exact reset/import/restore/live snapshot/zero stale-write assertions retained. Inactive-key nonaccess assertions retained against their actual new meaning.
- e12-save-recovery: same sentinel inversion; removed experiment module/prefix import. Deliberately tagged experimental backup now exercises invalid import, whereas valid raw production backup recovers through existing API. Source formerly rejected untagged code, which would be the wrong production expectation. Replaced experiment-review route target with existing collection route; unchanged cancellation/route revocation/full save-byte checks.
- e20-helper-resume: actual production startup __starfall_probe__ set1/remove expected, followed by exact zero resume writes; no namespace shim.
- audit/e16/assistant: actual production `starfall-covenant.orb-assistant.request.v1` key; unchanged stale preference/event/snapshot assertions.
- e18-chain-navigation: retained first2 chain/quickview/locked-unlocked original-route tests; excluded only third experiment-guide-entry test, as explicitly approved.
- existing acquire-guide: pool-standard route retains its pool ID; material allowed-kind list includes periodFirstClear. These mirror real selected feature changes, not weakened old-kind assertions.

The source names retain historical E labels. That does not add experiment runtime dependencies or deploy old guide content. E23 resolver/tool mixed file was wholly excluded per director, not split into new scope.

## Excluded additions (exact)
- `tests/e03-release.test.ts`
- `tests/e05-release.test.ts`
- `tests/e06-entry.test.ts`
- `tests/e06-guide.test.ts`
- `tests/e06-navigation.test.ts`
- `tests/e06-practice-app.test.ts`
- `tests/e12-review-guide.test.ts`
- `tests/e18-chain-release.test.ts`
- `tests/e20-source-manifest.test.ts`
- `tests/e21-berserk-release.test.ts`
- `tests/e22-archetype-release.test.ts`
- `tests/e23-card-budget-integrity.test.ts`
- `tests/e23-card-budget-tool.test.ts`
- `tests/e23-card-image-resolution.test.ts`
- `tests/experiment-crossflow.test.ts`
- `tests/experiment-isolation.test.ts`

## Copied file manifest
Source SHA checked individually; destination hash differs only where adaptation is marked.

| Path | Immutable R18 SHA256 | Destination SHA256 | Harness adapted |
|---|---|---|---|
| `tests/e01-fit-classification.test.ts` | `829d7bc8ecbad3577c6c24f52f284d9a8c0302be2f034be60973b9372410b774` | `829d7bc8ecbad3577c6c24f52f284d9a8c0302be2f034be60973b9372410b774` | no |
| `tests/e01-team-fit.test.ts` | `3578b071e4f7212af155eb7eb3612ec450835531ceebd0ddf7bf5c5eab753223` | `3578b071e4f7212af155eb7eb3612ec450835531ceebd0ddf7bf5c5eab753223` | no |
| `tests/e02-conversion-preview.test.ts` | `2bebd84435dc609b91e5b8fbf39590d40456d25a0ae9c8e1a4e0fba8e78ca4bf` | `2bebd84435dc609b91e5b8fbf39590d40456d25a0ae9c8e1a4e0fba8e78ca4bf` | no |
| `tests/e02-skill-dialog.test.ts` | `480a88aabe7cee0d55c04da4f8a439e88e0f7aee4bd33b655354211679c6bc1b` | `480a88aabe7cee0d55c04da4f8a439e88e0f7aee4bd33b655354211679c6bc1b` | no |
| `tests/e03-content.test.ts` | `30865d365166eb2b1a700e51f7d9b60522ab95fe1e08599780b0b024b710bfcf` | `30865d365166eb2b1a700e51f7d9b60522ab95fe1e08599780b0b024b710bfcf` | no |
| `tests/e03-engine-fixed.test.ts` | `4d5916c1d7963f1648f705624de6b3ca286c40fefaaa5e18f64e8a021f6a595a` | `4d5916c1d7963f1648f705624de6b3ca286c40fefaaa5e18f64e8a021f6a595a` | no |
| `tests/e03-prepare.test.ts` | `c9524dd79e4baee1dad8bf735afc3e7964cca2746367513dd8796a7361a77e0b` | `c9524dd79e4baee1dad8bf735afc3e7964cca2746367513dd8796a7361a77e0b` | no |
| `tests/e03-view.test.ts` | `6e9402261ef603825171803ed01ec8ee3e52c03782a476bd8225ed6254a39d2c` | `6e9402261ef603825171803ed01ec8ee3e52c03782a476bd8225ed6254a39d2c` | no |
| `tests/e04-data-conversion.test.ts` | `a12c9ea6d72787e4abdd697f239590153e921ab876d9ba7465f43d7959c94410` | `a12c9ea6d72787e4abdd697f239590153e921ab876d9ba7465f43d7959c94410` | no |
| `tests/e04-navigation.test.ts` | `0473c08748089599835980f9094a070610dde1312ca6ffacbded0687790a35f1` | `0473c08748089599835980f9094a070610dde1312ca6ffacbded0687790a35f1` | no |
| `tests/e04-query.test.ts` | `12da707cdc438af6302be588a8cdd2ec19a495f6aaf0c3ec3a26a14593808b14` | `12da707cdc438af6302be588a8cdd2ec19a495f6aaf0c3ec3a26a14593808b14` | no |
| `tests/e04-view.test.ts` | `4865d591b58a93b6b96579050baf235e034e6376bf440eff8c387f1d1538e43d` | `4865d591b58a93b6b96579050baf235e034e6376bf440eff8c387f1d1538e43d` | no |
| `tests/e05-active-copy.test.ts` | `4b618fadfbbd9f1dfe64e5bcabc45fce82a78782ce252c26a7d89eb7ee5cef72` | `4b618fadfbbd9f1dfe64e5bcabc45fce82a78782ce252c26a7d89eb7ee5cef72` | no |
| `tests/e05-display-battle.test.ts` | `7e166edb567515c28a319b1b1d8e29cb8514f68f4591a850b3eac2840341434a` | `7e166edb567515c28a319b1b1d8e29cb8514f68f4591a850b3eac2840341434a` | no |
| `tests/e05-display.test.ts` | `80ca416d13ebf15d6bca5999b8f17186c2129ca203f5c8298c6a12e7f02d880c` | `80ca416d13ebf15d6bca5999b8f17186c2129ca203f5c8298c6a12e7f02d880c` | no |
| `tests/e05-engine-descriptions.test.ts` | `4a4ed32cc46382f274696cc08a572c42d27e8e849c353c566f6ec6c415ceec61` | `4a4ed32cc46382f274696cc08a572c42d27e8e849c353c566f6ec6c415ceec61` | no |
| `tests/e05-tutorial-fit.test.ts` | `0e7b3894a732dc5b61da6ff397932a9a48db28cf510672a3137d7e6532d29ad0` | `0e7b3894a732dc5b61da6ff397932a9a48db28cf510672a3137d7e6532d29ad0` | no |
| `tests/e07-continue-app.test.ts` | `1956ffca4b6f27c7a384c9b219b1332562dd574a62eb853c1d566b8efda9e9ed` | `1956ffca4b6f27c7a384c9b219b1332562dd574a62eb853c1d566b8efda9e9ed` | no |
| `tests/e07-continue.test.ts` | `9f4665f59fb8ca50af612eda069b15ac59c0f6de98856ca6ae82e71f9f0c85f1` | `9f4665f59fb8ca50af612eda069b15ac59c0f6de98856ca6ae82e71f9f0c85f1` | no |
| `tests/e07-departure-app.test.ts` | `0c237597223341961b9b66f5c21ce146b2e95b68cc41a205a0a7824056b2c6d2` | `0c237597223341961b9b66f5c21ce146b2e95b68cc41a205a0a7824056b2c6d2` | no |
| `tests/e07-departure.test.ts` | `47fbb51084ed8ef9921b1e0b7edf0d4d34e1bf5c36ee2f8dd36925e03839a5c5` | `47fbb51084ed8ef9921b1e0b7edf0d4d34e1bf5c36ee2f8dd36925e03839a5c5` | no |
| `tests/e08-acquire-team.test.ts` | `a78d6fc5175dfef89237baf28d6c8109eab8ba5a9538ea814af6b3cb48830b11` | `a78d6fc5175dfef89237baf28d6c8109eab8ba5a9538ea814af6b3cb48830b11` | no |
| `tests/e08-defeat-recovery.test.ts` | `1af075dad371f48736aa5354ef7a8b3db3c1c70df90e96492e58f934601a7f57` | `1af075dad371f48736aa5354ef7a8b3db3c1c70df90e96492e58f934601a7f57` | no |
| `tests/e08-new-player.test.ts` | `4ff31377fb78ad609145937da6fefc871aaba9702f875e43d35f18b62deb5841` | `4ff31377fb78ad609145937da6fefc871aaba9702f875e43d35f18b62deb5841` | no |
| `tests/e08-pool-route.test.ts` | `cce503ee8f3c3cedf167073a3162ced72e9ed97dcb61e56282af180b7c7c11eb` | `cce503ee8f3c3cedf167073a3162ced72e9ed97dcb61e56282af180b7c7c11eb` | no |
| `tests/e08-saved-battle.test.ts` | `2b232aae707b93e2ef654a90abc757ffd5581aee726884ff796ec97046e00c2a` | `2b232aae707b93e2ef654a90abc757ffd5581aee726884ff796ec97046e00c2a` | no |
| `tests/e08-win-lifecycle.test.ts` | `397d4ecead50ac3b90baf97df994270516aca89f8a0f48a81f2d84b5d5c2b493` | `397d4ecead50ac3b90baf97df994270516aca89f8a0f48a81f2d84b5d5c2b493` | no |
| `tests/e09-action-dialogs.test.ts` | `fe41d6432dc906feccaa76798da03ecac49a8255e7deb0aedd129a79dccebf34` | `fe41d6432dc906feccaa76798da03ecac49a8255e7deb0aedd129a79dccebf34` | no |
| `tests/e09-action-lifecycle.test.ts` | `26a440e5b7dbb50aec2c71bbde775e23be2dafd22532c10ec850bb2b06f601dc` | `26a440e5b7dbb50aec2c71bbde775e23be2dafd22532c10ec850bb2b06f601dc` | no |
| `tests/e09-retreat-app.test.ts` | `438c3941bdfa3f81c6de9941858a374bdf7cbc060ae73b98742e6b6c74fd8c04` | `438c3941bdfa3f81c6de9941858a374bdf7cbc060ae73b98742e6b6c74fd8c04` | no |
| `tests/e09-stale-skill-app.test.ts` | `d2f52922f6daa2ae38c15b1e7edf058e5a128794d0191e05845e39cb60e8efdc` | `d2f52922f6daa2ae38c15b1e7edf058e5a128794d0191e05845e39cb60e8efdc` | no |
| `tests/e10-economy-crossflow.test.ts` | `eaafad0f63a0bd339356f0f584d86edd555e6b9c2f0c607deaf59432ccc332bd` | `eaafad0f63a0bd339356f0f584d86edd555e6b9c2f0c607deaf59432ccc332bd` | no |
| `tests/e10-sale.test.ts` | `38b39b3e8a3ecb7a230cc46f40f684cf0f5ece0949138d5a75297f67591b3c16` | `38b39b3e8a3ecb7a230cc46f40f684cf0f5ece0949138d5a75297f67591b3c16` | no |
| `tests/e10-shop.test.ts` | `8f3e41894ea53d8dd4827e99f6c011b4f36afab9e46cf8a17e7dfbc482c16ae8` | `8f3e41894ea53d8dd4827e99f6c011b4f36afab9e46cf8a17e7dfbc482c16ae8` | no |
| `tests/e10-summon.test.ts` | `ba25515b84acb1ebd9a226adc084e8aa9770d2804830e28b5a103a4f06415e73` | `ba25515b84acb1ebd9a226adc084e8aa9770d2804830e28b5a103a4f06415e73` | no |
| `tests/e11-enhance.test.ts` | `46863f112d5760029498fa42d245592853f156386e28767728033460477b1dbb` | `46863f112d5760029498fa42d245592853f156386e28767728033460477b1dbb` | no |
| `tests/e11-evolve.test.ts` | `683b510dbf107f1abe387329411adc7c3826f6a73dcc87ca7ece825aac9cd848` | `683b510dbf107f1abe387329411adc7c3826f6a73dcc87ca7ece825aac9cd848` | no |
| `tests/e11-growth-app.test.ts` | `b00498b2fc7291481e81d0023ccb2f760f6e5c305d793942f28e004f5904adc3` | `b00498b2fc7291481e81d0023ccb2f760f6e5c305d793942f28e004f5904adc3` | no |
| `tests/e11-growth-modes.test.ts` | `f37a9455a4b0c387267cc92db87c24550a1209790856abfc0a45d84513aef5b5` | `f37a9455a4b0c387267cc92db87c24550a1209790856abfc0a45d84513aef5b5` | no |
| `tests/e12-backup-restore.test.ts` | `68233c8f72e9b8baa7889968b3bfc74e04469b49d3db4a0b4753bf1bebb22dac` | `addbfbaf3ebbd7768899fc42a10c4eb3eef7abd9a6f7b161fa86846be255dbfa` | yes |
| `tests/e12-save-recovery.test.ts` | `e1eeaf4078b4f219ccf1077d58026d9ea0f14d5b8c92389b58d56a2cdccaca91` | `1bd06222da349b620e54a5a6aba25bfb32560ee18d00327622a6cc2227c23ae0` | yes |
| `tests/e12-settings-lifecycle.test.ts` | `3b61cc3b6cf8ce132da58ea017536fe0cd628553d0e597ad09483cb9b5c62ca9` | `3b61cc3b6cf8ce132da58ea017536fe0cd628553d0e597ad09483cb9b5c62ca9` | no |
| `tests/e13-warning.test.ts` | `1b90f56ca6040b31402d076f16bc61beeae0cf8e5c6842ba797e8277b620af2d` | `1b90f56ca6040b31402d076f16bc61beeae0cf8e5c6842ba797e8277b620af2d` | no |
| `tests/e14-expedition-login.test.ts` | `437cf98f49d06f16c585e80b9817718c3b0c4a93ee70171fae7aa62afd425aab` | `437cf98f49d06f16c585e80b9817718c3b0c4a93ee70171fae7aa62afd425aab` | no |
| `tests/e14-ritual.test.ts` | `042009170c5eaefa00c3eedf5e9f8cd374103bc9d88a6fccbbd97fe902634985` | `042009170c5eaefa00c3eedf5e9f8cd374103bc9d88a6fccbbd97fe902634985` | no |
| `tests/e14-session.test.ts` | `7c3d17ca45a68bf2564af69a9e8614c472bb9c76d9b395e8e7981d5d7ec8626c` | `7c3d17ca45a68bf2564af69a9e8614c472bb9c76d9b395e8e7981d5d7ec8626c` | no |
| `tests/e14-team-picker.test.ts` | `1d6a3db5ebc4f1dc2d0a9ae5e01ca978f1286c40fdd78b7463ced498955701fc` | `1d6a3db5ebc4f1dc2d0a9ae5e01ca978f1286c40fdd78b7463ced498955701fc` | no |
| `tests/e15-oath-app.test.ts` | `ee710d2f612869b5378ae6da48baee30232c0425f40765f4538403a338292081` | `ee710d2f612869b5378ae6da48baee30232c0425f40765f4538403a338292081` | no |
| `tests/e15-oath.test.ts` | `2de8c478abdc7777791d279ab08bdd1dc66a608f0eb746dfc3b684a39eebdb92` | `2de8c478abdc7777791d279ab08bdd1dc66a608f0eb746dfc3b684a39eebdb92` | no |
| `tests/e15-tutorial-app.test.ts` | `1003d18fd5f25442b03e558eef26ce4828ff5d51e5864806ea88d83a1d9cc8a4` | `1003d18fd5f25442b03e558eef26ce4828ff5d51e5864806ea88d83a1d9cc8a4` | no |
| `tests/e15-tutorial.test.ts` | `4981c59c31fdc480db5c0f1b74842a976f2237f95eeb0a52fffe5ad8f6817ff9` | `4981c59c31fdc480db5c0f1b74842a976f2237f95eeb0a52fffe5ad8f6817ff9` | no |
| `tests/e17-assistant.test.ts` | `e2f30a5738c50c0166ab8d6d06f978685bf7bf512b61b8f757e8b47a09430874` | `e2f30a5738c50c0166ab8d6d06f978685bf7bf512b61b8f757e8b47a09430874` | no |
| `tests/e17-navigation.test.ts` | `aa55cc06e5555be0a18b5294660f26327a919a81cc77b24a621b742cf9cda6ee` | `aa55cc06e5555be0a18b5294660f26327a919a81cc77b24a621b742cf9cda6ee` | no |
| `tests/e17-pause.test.ts` | `587c7f6b8014531183d27c3974fbc15b244fa8643e729c56c31cd527804e4f06` | `587c7f6b8014531183d27c3974fbc15b244fa8643e729c56c31cd527804e4f06` | no |
| `tests/e17-practice.test.ts` | `a1a81f680bc8bbfc9597e81dc8c93cb9f4727da2e2a90918ad75f47b57565f77` | `a1a81f680bc8bbfc9597e81dc8c93cb9f4727da2e2a90918ad75f47b57565f77` | no |
| `tests/e18-chain-engine.test.ts` | `b75e544802493552b18fea34af16c67da9bfb3d6fc125b4d81612a981a337a89` | `b75e544802493552b18fea34af16c67da9bfb3d6fc125b4d81612a981a337a89` | no |
| `tests/e18-chain-model.test.ts` | `1499bbd268ad517f8a12e185ac68d4b0f0decbbba3b73ec68d7e203ca681d7c1` | `1499bbd268ad517f8a12e185ac68d4b0f0decbbba3b73ec68d7e203ca681d7c1` | no |
| `tests/e18-chain-navigation.test.ts` | `f851027536e7c00ae4c24f32a5b7bbf0091675c5ec7cc37e509edfd50cf3e8d5` | `1da047c35fca54f9d88dc80277ca8071aee4aede932895c26f6a24ef33a73027` | yes |
| `tests/e18-chain-view.test.ts` | `c1d31cf84fef12cfeb870592f1bf42411e237a594b41b1c057b87e365ecc28cf` | `c1d31cf84fef12cfeb870592f1bf42411e237a594b41b1c057b87e365ecc28cf` | no |
| `tests/e19-capability-engine.test.ts` | `a75600f646677e75847eee334d9fe82e7ec521bd882aec19015f4ae6b9474988` | `a75600f646677e75847eee334d9fe82e7ec521bd882aec19015f4ae6b9474988` | no |
| `tests/e19-capability-model.test.ts` | `ff5db8581e8fc292e02d306647605d63a1feffdea69f17172125e1a5a03d7fc0` | `ff5db8581e8fc292e02d306647605d63a1feffdea69f17172125e1a5a03d7fc0` | no |
| `tests/e19-capability-navigation.test.ts` | `b33ee206f04b7eb958cbbdaf7931aacd95c1e093e14964056d6863ef40eebe7b` | `b33ee206f04b7eb958cbbdaf7931aacd95c1e093e14964056d6863ef40eebe7b` | no |
| `tests/e19-capability-view.test.ts` | `c88b7ca2aafacf5bb3dca4d1083aad66fa7079ce7cb6872a8b7ecb7df3ee7cbe` | `c88b7ca2aafacf5bb3dca4d1083aad66fa7079ce7cb6872a8b7ecb7df3ee7cbe` | no |
| `tests/e20-helper-resume.test.ts` | `c0ac8c827eb8c46d6b3a00236dd7de452cf656df214febeb6a6055b1554f2f30` | `0f80a151fd5662d446f9224ec937f0459513f1940a37c9cc3f307c01d81ba852` | yes |
| `tests/e20-helper-selection.test.ts` | `4fd2e7d03124300085e44c627daed1fa842666478bb536faf06b895deb080fba` | `4fd2e7d03124300085e44c627daed1fa842666478bb536faf06b895deb080fba` | no |
| `tests/e20-oath-helper.test.ts` | `00358697e942312738a428f2e66567682af066f4ca909a94f47eff2b4959e0b8` | `00358697e942312738a428f2e66567682af066f4ca909a94f47eff2b4959e0b8` | no |
| `tests/e21-berserk-copy.test.ts` | `2647ab7420840888c9f7baea7cf68c79e0499880154d0d2444cfd08571ee54ec` | `2647ab7420840888c9f7baea7cf68c79e0499880154d0d2444cfd08571ee54ec` | no |
| `tests/e21-berserk-engine.test.ts` | `6b1d28419882cf8606d2e3a260665b404ea66b84cca112aa01b786ab96eda307` | `6b1d28419882cf8606d2e3a260665b404ea66b84cca112aa01b786ab96eda307` | no |
| `tests/e21-berserk-view.test.ts` | `6d38e32a42783040192755affc191661983213e69f4335ead95b806d06241ed2` | `6d38e32a42783040192755affc191661983213e69f4335ead95b806d06241ed2` | no |
| `tests/e22-archetype-copy.test.ts` | `03316b6e1f44608a89e93c6c353efdc20b5b99b7e461548dc3dffeb72731804e` | `03316b6e1f44608a89e93c6c353efdc20b5b99b7e461548dc3dffeb72731804e` | no |
| `tests/e22-archetype-engine.test.ts` | `33d527540888bf3a370d3d9971060457f105f1d1cb0a3e4cf0f435eeb9fd92f4` | `33d527540888bf3a370d3d9971060457f105f1d1cb0a3e4cf0f435eeb9fd92f4` | no |
| `tests/e22-archetype-view.test.ts` | `635bd11240226c8fb44581d54595639f35602fc09b4999512deb74baa86af8aa` | `635bd11240226c8fb44581d54595639f35602fc09b4999512deb74baa86af8aa` | no |
| `tests/e23-card-image-dom.test.ts` | `5a669eac80e8732b021091d3914c47c7c1311e18d4acfa2ca0573a3b8a5b2f28` | `5a669eac80e8732b021091d3914c47c7c1311e18d4acfa2ca0573a3b8a5b2f28` | no |
| `tests/e24-active-resume.test.ts` | `563c7fad3bea89605d83057b26ed1f309cbeea231a0d62200437661fff3c034f` | `563c7fad3bea89605d83057b26ed1f309cbeea231a0d62200437661fff3c034f` | no |
| `tests/e24-greek-resume.test.ts` | `5aa775a2ba4df64b58005275953c934564af220d6daf22b23f3bd5e9d2367454` | `5aa775a2ba4df64b58005275953c934564af220d6daf22b23f3bd5e9d2367454` | no |
| `tests/e24-oath-resume.test.ts` | `4cdcb242128f937e5034b6b323e3d9420bc532a109d71b3155149bdceef90029` | `4cdcb242128f937e5034b6b323e3d9420bc532a109d71b3155149bdceef90029` | no |
| `tests/e25-period-acquire-data.test.ts` | `dfe9479d9f72e1e40f30010ca2e0739553eadfd9f94e3e3d80482b74f2119c29` | `dfe9479d9f72e1e40f30010ca2e0739553eadfd9f94e3e3d80482b74f2119c29` | no |
| `tests/e25-period-acquire-navigation.test.ts` | `41678ca71af9f7335ce191900520155c7d06bbd9e21c1f8b7cd3dcbe2e5b3f35` | `41678ca71af9f7335ce191900520155c7d06bbd9e21c1f8b7cd3dcbe2e5b3f35` | no |
| `tests/e25-period-acquire-view.test.ts` | `bc2618a4faf5ffcc348f570136b94aa62b21c033fb6bba457c42e0368e44dabc` | `bc2618a4faf5ffcc348f570136b94aa62b21c033fb6bba457c42e0368e44dabc` | no |
| `tests/e25-period-acquire.test.ts` | `ef9b1ad6fa4abc346890c08ddec7a8c0fd19884c548cd30c9904ffc3ac872249` | `ef9b1ad6fa4abc346890c08ddec7a8c0fd19884c548cd30c9904ffc3ac872249` | no |
| `audit/e13/a-resource.test.ts` | `a02a7f9763dbfbe866aa675ac9e252e139895dc3edbe075c790e744456afac6d` | `a02a7f9763dbfbe866aa675ac9e252e139895dc3edbe075c790e744456afac6d` | no |
| `audit/e13/tsconfig.json` | `08ba980eb10af54379e31ed96b69c76d7012975b361a3e0afd68dc887a4f0386` | `08ba980eb10af54379e31ed96b69c76d7012975b361a3e0afd68dc887a4f0386` | no |
| `audit/e13/vitest.config.mjs` | `e0aaba0c0473a9b17b0ff01b0bf7f4e63019fbb98691a6cf733c015872d2ffb4` | `e0aaba0c0473a9b17b0ff01b0bf7f4e63019fbb98691a6cf733c015872d2ffb4` | no |
| `audit/e13/c-navigation.test.ts` | `f7d0a5738eb5e0e7875f8114fd50efd8cad9a9d68969fc9355bb1c1664244775` | `f7d0a5738eb5e0e7875f8114fd50efd8cad9a9d68969fc9355bb1c1664244775` | no |
| `audit/e13/b-team.test.ts` | `c6a69007f5caef27cb61b15001b79c42bb860d066106343cc0892dd23b050278` | `c6a69007f5caef27cb61b15001b79c42bb860d066106343cc0892dd23b050278` | no |
| `audit/e16/practice.test.ts` | `d1b98ad11b1c5a37330cba97d49334ba6d02916b5087807a75bea41c61261cba` | `d1b98ad11b1c5a37330cba97d49334ba6d02916b5087807a75bea41c61261cba` | no |
| `audit/e16/tsconfig.json` | `0ba54d4ec170bb64ea34acf7f4a97ac2556b9e785616498d971c3cbe9d9e1fe6` | `0ba54d4ec170bb64ea34acf7f4a97ac2556b9e785616498d971c3cbe9d9e1fe6` | no |
| `audit/e16/pause.test.ts` | `257a51dcd55cb5f4368e654ccd059e6050376436c15962d5fc72508182b14ac2` | `257a51dcd55cb5f4368e654ccd059e6050376436c15962d5fc72508182b14ac2` | no |
| `audit/e16/navigation.test.ts` | `477e7b9198c1cc8558c44561f494fe074f70037c3491ca81e448a925dc70b5be` | `477e7b9198c1cc8558c44561f494fe074f70037c3491ca81e448a925dc70b5be` | no |
| `audit/e16/vitest.config.mjs` | `014e667da3be91ac02c1ad624603504ed6a63d53080ec68f896046082ff03576` | `014e667da3be91ac02c1ad624603504ed6a63d53080ec68f896046082ff03576` | no |
| `audit/e16/assistant.test.ts` | `bd41eab0c14bdd5ea42321c7348b854d09a7fd0695525db08cb17bb5b841cff0` | `ea3fee02c4e6c6b6068f9ee57ee20b4dd31dce8b6d618b561eae541b72a486c9` | yes |
| `tests/acquire-guide.test.ts` | `1ad592c54026163ab29e3562db485c6796d9f33fca968baf2670cfa8bfca60b4` | `1ad592c54026163ab29e3562db485c6796d9f33fca968baf2670cfa8bfca60b4` | no |

Production baseline save.test SHA256 retained: `ee57ec23221c9bd72e6269111fb61c61678a626a9324f0a85606ff41657a0c4e`.

## Verification policy
Explicit focused batches cover80 added files plus existing acquire-guide, not a worker default full-suite run. Two fixed strict audit suites invoked separately. Project and both audit typechecks run. Synthetic saves only; no real user storage touched. Product files supplied by A/B; any failure would be reported rather than patched by this owner. Director owns serial full/PWA Pages build/production boundary acceptance and parent alone publishes.

Results recorded below after commands terminate. No release/promotion acceptance is implied solely by these focused tests.

Director-requested audit naming cleanup only: e12-save-recovery uses `inactiveKeys` and `inactive experiment fixture untouched`; e12-backup-restore sentinel values use `inactive-experiment:`. Conditions/assertions unchanged; destination hashes above updated after this cosmetic change.

## Terminal verification and freeze
- Focused batch1:27 files /156 tests PASS.
- Focused batch2:27 files /185 tests PASS.
- Focused batch3:27 files /130 tests PASS.
- Combined focused selection:81 files /471 tests PASS (80 new general files + baseline acquire-guide).
- Separate strict E13 audit:3 files /57 tests PASS.
- Separate strict E16 audit:4 files /27 tests PASS.
- Final post-naming-cleanup E12 backup + recovery + unchanged production save.test:3 files /26 tests PASS, including original frozen-version raw-code import expectations.
- Final project tsc exit0; audit/e13 tsc exit0; audit/e16 tsc exit0. Empty diagnostics preserved in logs.
- Existing baseline root test comparison confirms only acquire-guide.test.ts changed; save.test.ts and every other existing root baseline test unchanged.

All focused failures: none. First focused passes legitimately verify selected existing fixes in production harness; no artificial RED claimed. Source-manifest authenticity was checked before adaptations; the five adapted destination hashes are explicit in the table. All owned commands terminal and writes frozen. Director may begin independent serial full/build validation; this worker did not run a default full suite/build or publish.
