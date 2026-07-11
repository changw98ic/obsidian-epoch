# Implemented Systems Status

This note records what the current Obsidian Epoch server implements in code and
what still depends on external deployment work. Treat it as an operator and
Skill-facing status summary, not as a product roadmap.

## Implemented In This Repository

| Area | Implemented behavior | Evidence |
| --- | --- | --- |
| Lineage inheritance | Archived identities can reincarnate into the next server-issued identity. The new identity records `previousAgentId`, `generation` and an `inheritance` payload containing lineage legend echo, known regions and the latest scar reason when present. Lifetime exhaustion can emit archive plus reincarnation events in the same settlement. | `lib/epoch/identityLifecycleRules.ts`, `lib/epoch/gameCore.ts`, `test/identityArchiveReadModel.test.ts`, `test/server.test.ts` |
| Multi-source identity slots | Active slot entitlement is server-derived from explorer lineage legend, with `active`, `max`, `available`, `legendToNextSlot`, `nextUnlockLegend` and cap state exposed through `progress.identitySlots` and `explorer_profile.identitySlots`. Archived identities do not consume active slots. | `lib/epoch/identityProjectionRules.ts`, `lib/epoch/explorerProfileReadModel.ts`, `lib/epoch/gameCore.ts`, `test/identityProjectionRules.test.ts`, `test/server.test.ts` |
| Race commissions | Contested objectives support `mode: "race"`, record `race_commission_completed`, assign finish place, grant consolation spend/reward behavior and settle using race winner ordering. Regional commissions expose open objectives, resource nodes, anomalies, bounties, party runs and social hooks with source type, media, canonical flag, progress, secret exposure tier, prefile isolation and action label. | `lib/epoch/gameCore.ts`, `lib/epoch/regionCommissionReadModel.ts`, `test/encounterReadModel.test.ts`, `test/regionCommissionReadModel.test.ts`, `test/server.test.ts` |
| Player data export | `obsidian_epoch.player_data_export` returns a public-projection export for one explorer lineage with schema version, counts, profile, identities, resources, inventory items, downtime states and diary entries, NPC bonds, messages, news mentions, season contributions and replay/audit links. | `lib/epoch/playerDataExportReadModel.ts`, `lib/epoch/runtime.ts`, `lib/mcpTools.ts`, `test/playerDataExportReadModel.test.ts` |
| Competitive ladder | `obsidian_epoch.competitive_ladder` builds region, season or tournament ladders in `casual`, `ranked` and `verified` modes. Entries include rank, canonical score, verified score, excluded score, delivery class, trust-class breakdown, source event ids and audit links. Verified mode counts only server-hosted or attested delivery classes. | `lib/epoch/competitiveLadderReadModel.ts`, `lib/epoch/runtime.ts`, `lib/mcpTools.ts`, `test/competitiveLadderReadModel.test.ts` |
| Downtime custody and eligibility | Downtime set, claim and tick use a shared eligibility snapshot. The gate rejects missing or archived identities, unknown/imprisoned custody, open turn cards, active hosted sessions, open party runs, unsafe regions, missing preparation resources, cooldowns and bad server/projection time. Custody changes are server-trust-only events. | `lib/epoch/downtimeEligibilityRules.ts`, `lib/epoch/downtimeRules.ts`, `lib/epoch/gameCore.ts`, `test/downtimeEligibilityRules.test.ts`, `test/downtimeRules.test.ts`, `test/server.test.ts` |
| Reproducible release package | Package archive generation supports deterministic `SOURCE_DATE_EPOCH`, package integrity manifests, Ed25519 signatures, live manifest rewrite, operator release key metadata and production smoke gates. Deployment docs require immutable image metadata and record image reference plus digest. | `lib/packageArchive.ts`, `lib/http/installRoutes.ts`, `release-rehearsal.ts`, `deploy/README.md`, `test/packageArchive.test.ts`, `test/install-smoke-command.test.ts`, `test/release-rehearsal-command.test.ts`, `test/deploy-config.test.ts` |
| Backup, restore and release rehearsal | Operator commands exist for backup, restore, recovery drill and release rehearsal. Restore verifies `recovery-backup.json`, refuses existing targets, and release rehearsal chains install smoke, operator overview, recovery drill, backup and restore proof. | `backup.ts`, `restore-backup.ts`, `recovery-drill.ts`, `release-rehearsal.ts`, `lib/recovery.ts`, `deploy/runbooks/off-host-restore.md`, `test/recovery.test.ts`, `test/release-rehearsal-command.test.ts` |

## External Work Not Completed By Repository Code

These items cannot be truthfully claimed as implemented until an operator
performs them outside the repository and captures evidence from the target
environment:

| External item | Current status |
| --- | --- |
| Public HTTPS and DNS | The Compose/Caddy profile and production config require a canonical HTTPS origin, exact allowed origins and public DNS, but this repository does not provision DNS records, certificates or a reachable production host by itself. |
| Container registry publication | The deployment config can tag and push an image when `AGENT_IMAGE_REGISTRY`, `AGENT_IMAGE_VERSION`, `AGENT_IMAGE_REVISION`, `AGENT_IMAGE_SOURCE` and `SOURCE_DATE_EPOCH` are supplied. The actual registry namespace, push, registry-assigned digest and retention policy remain operator work. |
| Operator release signing secret | The key generator and production smoke gate are implemented. A real production `AGENT_PACKAGE_SIGNING_PRIVATE_KEY_PEM` must still be generated, stored in the deployment secret store and pinned by `releaseKeyId`. |
| Off-host restore execution | Restore tooling and the off-host runbook are implemented. A real disaster-recovery claim requires a copied backup on a fresh host, a passing recovery drill against restored paths, updated service environment variables, health checks and remote install smoke against the restored public URL. |
| Live production release rehearsal | The command exists and tests cover its behavior. A production pass still requires the real HTTPS origin, operator key, expected release key id, immutable image reference and registry digest from the deployed artifact. |

## Documentation Rule

When writing user-facing status, say "implemented in repository" only for the
first table. Say "requires operator deployment evidence" for the second table.
Do not state that production HTTPS, DNS, registry publication or off-host
restore has been completed unless the live environment evidence is present in
the current task context.
