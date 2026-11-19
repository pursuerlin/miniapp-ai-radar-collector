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
- The existing daily Feishu digest runs at 01:10 UTC; the public-feed freshness check runs at 01:23 UTC and alerts only when news is more than three hours old.
- An external Cloudflare heartbeat dispatches this repository every two hours. It skips fresh news unless a different source needs recovery. Authenticated Feishu approval actions remain in the private application repository.

Repository Secrets: `AA_API_KEY` for the AA media data API; `DATA_REPO_DEPLOY_KEY`, a write deploy key scoped to the public data repository; and `FEISHU_WEBHOOK_URL` for the migrated digest and freshness alerts. No private application checkout or application repository token is needed by these workflows. Runtime secrets must not be placed in config files, snapshots, logs or fixtures.

Standard GitHub-hosted computation for this public repository is free; upstream API terms and artifact-storage limits still apply. Diagnostics expire after three days. GitHub can disable scheduled workflows after 60 days without repository activity; check workflow enablement when investigating a long gap. The external heartbeat provides a separate trigger, rather than a promise of exact execution times.

Maintain collection code in this repository. The private application retains client UI, internal review and operational publishing; internal manual workflows still follow that repository's billing limits. Updating collected JSON does not publish operational drafts or change the mini-program package.

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
