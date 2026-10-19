# Quick 261019-g3q Summary

Three issue-page fixes in apps/web, three atomic commits on master.

1. 108bc3b6 - Founder section now uses NumberedSection title (headline as h2) plus full-width `.d-prose`; removed `.d-founder-cols` CSS and wrapper.
2. 839871f0 - GameSlot mounts the sandboxed iframe (sandbox exactly `allow-scripts`, loading lazy) on load; Play remounts via key and focuses it; `.d-game-idle` removed.
3. (see git log) - FundButton, masthead, hero, and issue nav Fund CTAs are `next/link` to `/shop`; FundButton no longer starts checkout; dead `.d-fund-status` CSS removed.

Tests, typecheck, and build were green after each task. game-validator, checkout-client, and game-sandbox test untouched.

## Deviations
None.
