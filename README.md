# AI Radar public collectors

Independent collection and validation for the Mojing AI Radar public data feed. This repository contains server-side collectors and data contracts. The mini-program application and operations backend are maintained separately.

Data is published to https://pursuerlin.github.io/miniapp-ai-radar-data/radar/ after validation. The client endpoint stays unchanged. Existing operational configuration has its own publishing lifecycle and is preserved.

## Operation

- News: every 30 minutes; model catalogue: every 4 hours; full collection: twice daily.
- Automatic runs repair overdue sources independently and retain verified snapshots on source failure, without advancing their observation times.
- GitHub scheduling is best effort. `workflow_dispatch` with `heartbeat=true` can fill a delayed news slot.
- Tests run on code changes, separately from scheduled collection. Data updates do not build the mini-program.
- Missing AA credentials stop requested media collection explicitly; they are never treated as a successful update.
- A source outage can leave a run red after the validated retained snapshot has been published; publication and source health are separate checks.

Repository Secrets: `AA_API_KEY` for the AA media data API; `DATA_REPO_DEPLOY_KEY`, a write deploy key scoped to the public data repository. No private application checkout or application repository token is needed by this workflow. Runtime secrets must not be placed in config files, snapshots, logs or fixtures.

## Local checks

Use Node.js 22+, clone the public data repository into `state/data-site`, then run:

```sh
npm ci --ignore-scripts
node scripts/bootstrap-public-data.mjs
npm test
```

To collect, set `INPUT_PROFILE` to `catalog`, `news`, `aa`, `media`, `research`, `skills` or `all`, supply required credentials privately, and run `node scripts/run-public-collection.mjs`. No automatic notification messages are sent.

## Source terms

Collected model data remains subject to its upstream terms. AIHOT summaries and reports are distributed under Mojing's existing written authorization; that authorization does not grant downstream rights to third-party full articles. Skill catalogue entries link to original authors, immutable source revisions and their licenses. Test fixtures are recorded public source responses. Repository visibility does not replace upstream data or software licenses.
