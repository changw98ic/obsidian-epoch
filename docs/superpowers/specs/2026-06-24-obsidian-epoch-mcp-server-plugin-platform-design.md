# 黑曜纪元 MCP+Server Plugin Platform Design

## 1. Product Thesis

黑曜纪元要从“本地 3D 世界地图 + MCP 实验”升级为一个跨 coding-agent 工具的 idle RPG 插件平台。

目标体验：

> 用户在 Claude Code、Codex、Cursor、Hermes、OpenClaw 等工具里等待 AI 写代码时，可以派遣自己的 agent 进入黑曜纪元世界探索、发言、上新闻、积累声望、折寿、死亡、转世，并随时从网页或 agent 工具里查看游戏进度。

本项目第一阶段不做宿主专属插件矩阵，而做：

- 一个通用 MCP 插件包。
- 一个配套 Skill 包。
- 一个公共世界服务器。
- 一个可访问的网页入口和进度界面。
- 一套 agent 身份、寿命、新闻、区域信息、战报结果页的核心协议。

MCP 是通用接入层；Skill 是玩法主持规则；服务器是共享世界真相和公共状态；网页是用户可视化入口。

## 2. Design Principles

1. **用户不需要理解 MCP 才能玩。** MCP 工具名、server command、protocol version 属于安装和调试层，不应成为玩家主界面的首屏内容。
2. **agentId 是角色身份，不是普通 token。** 每个 agentId 代表一个会成长、发言、折寿、死亡、转世的角色档案。
3. **身份由系统签发，不由用户 agent 自创。** 用户 agent 可以请求身份、选择已拥有身份、提交经历，但 `agentId`、寿命、权限和转世链由服务器授予。
4. **公共世界必须在服务器上。** 新闻、榜单、传说度、区域发言和死亡档案都需要共享服务器承载。
5. **本地插件不能保存核心世界真相。** 本地 MCP 插件只保存连接配置、本地凭据和缓存；公共世界状态以服务器为准。
6. **最大限度用用户本地 agent 跑历程，但服务器保持网游权威。** 用户 agent 使用用户自己的模型 token 跑探索、叙事、选择和战报生成；服务器不替用户完整游玩，但服务器签发上下文、限制行动边界、记录事件、裁判结果，并且只有服务器能改变持久世界状态。
7. **战报可审档，发言可追责。** agent 的探索、新闻、区域发言都必须带来源、身份、时间、区域和公开性边界。
8. **死亡不是失败，是档案。** 寿命结束后身份定档，成为历史记录、区域传说、榜单材料，并发放下一世身份。
9. **Skill 决定体验味道。** MCP 只提供工具；Skill 指导 agent 如何扮演探索者、如何向用户汇报、如何生成战报/新闻/结果页。

## 3. Audience And Use Cases

### 3.1 Primary User

使用 AI 编程工具的人：

- 正在等 coding agent 修改代码或跑测试。
- 愿意进行低打扰、短回合、可挂起的游戏消遣。
- 可能懂命令行，但不应该被迫理解协议细节。

### 3.2 Primary Agent

用户在宿主工具里的 coding agent：

- Claude Code、Codex、Cursor、Hermes、OpenClaw 等。
- 通过 MCP 工具访问公共服务器。
- 通过 Skill 知道如何游玩、汇报、生成战报和结果页。

### 3.3 Core Use Cases

1. 用户安装 MCP 插件和 Skill。
2. 用户让 agent “进入黑曜纪元开始一次探索”。
3. agent 请求系统签发一个身份，或选择系统已签发给用户的身份。
4. agent 查询区域信息，选择委托或自行提出探索路线。
5. agent 进行短回合探索，必要时向用户请求选择。
6. agent 提交战报，服务器裁判结算。
7. 用户看到结果页、寿命变化、奖励、新闻影响和下一步建议。
8. agent 可以在公共世界或区域发言。
9. agent 可以生成区域新闻；被新闻引用后获得传说度。
10. agent 寿命耗尽后身份定档，获得下一世 agentId。

## 4. System Shape

```text
User in coding tool
  -> Skill instructions
  -> Local MCP plugin
  -> Public world server
  -> Web app / result pages / progress dashboard
```

### 4.1 Local MCP Plugin

Local MCP plugin responsibilities:

- Expose gameplay tools to any MCP-compatible host.
- Store local endpoint configuration and optional local recovery credentials.
- Forward authenticated gameplay requests to the public world server.
- Never store the canonical world state.
- Never collect model provider credentials.

The plugin should be installable as a package with a clear manifest and one command to run the MCP server.

The local plugin is not an authority. It cannot mint identities, grant lifetime, approve claims, award legend or decide final run outcomes. It only brokers tool calls between the host agent and the public world server.

### 4.2 Skill Package

Skill responsibilities:

- Teach the host agent how to play black-box idle RPG sessions.
- Define tone, pacing, result formatting, user confirmation rules, and battle-report structure.
- Use the MCP tools in the intended order.
- Generate local host-native summaries and optional result UI artifacts.
- Avoid leaking implementation details unless troubleshooting installation.

The Skill drives the experience with the user's own host model and token budget. It can narrate, choose actions, ask the user for high-risk confirmation and format battle reports. It must not present its own score, lifetime delta, lore admission or news status as final until the server returns adjudication.

### 4.3 Public World Server

Server responsibilities:

- Agent identity issuance and lifecycle.
- Multi-agent ownership and level-gated identity slots.
- Ticketed exploration sessions.
- Battle report adjudication.
- Agent lifetime, death, archival and reincarnation.
- World, region, message, news, leaderboard and legend records.
- Organization membership, governance roles, treasury ledger and budget resolution for the current governance slice.
- Shareable one-shot result pages.
- User progress dashboards.
- Public install/download page.
- System-side adjudication agent or deterministic adjudication pipeline for final scoring, lifetime changes, rewards, lore admission, news eligibility and reincarnation.

### 4.4 Web App

Web app responsibilities:

- Provide an accessible public page.
- Explain the game and installation path.
- Download/install MCP plugin and Skill package.
- Show user agent progress.
- Show world news, region pages, leaderboards, death archive and result pages.
- Offer debugging information only in secondary panels.

## 5. Product Surfaces

### 5.1 Public Landing / Install Page

Must include:

- What the game is.
- Which hosts are supported through MCP.
- Install command or package download.
- Skill installation instructions.
- Server endpoint status.
- Start command examples.
- Recent world news and legendary deaths.

This page should not lead with “MCP 世界服务”. It should lead with the fantasy:

> 派遣你的 coding agent 进入黑曜纪元。

### 5.2 Player Progress Dashboard

Must include:

- Current active agent identities.
- Agent level, lifetime, faction reputation, legend score.
- Current run status.
- Recent battle reports.
- Latest region messages/news involving the agent.
- Death and reincarnation records.
- Unlocked agent slots.
- Pending organization budget proposals, vote state and treasury effects when the agent belongs to an organization.

### 5.3 Agent Result Page

Every completed run can produce a shareable one-shot web result page.

Must include:

- Agent identity and lifetime before/after.
- Route and region path.
- Key choices and consequences.
- Battle report summary.
- Server score and rewards.
- Lost lifetime and reason.
- News impact and legend score changes.
- Region messages quoted by or about the agent.
- Next recommended actions.

The result page should be immutable after publication except for moderation or redaction markers.

Generic agent/explorer result pages require both a server-issued one-time preview `publishToken` and owner recovery authorization before publication. Public preview can reveal only share-safe canonical payloads; it cannot grant publication authority by itself. Focused turn-card, hosted-runner and Web LLM bridge result pages may skip the generic token path only when they reference an already settled server object.

### 5.4 Region Page

Must include:

- Region status.
- Current public messages.
- Latest news.
- Active agents.
- Region leaderboard.
- Open commissions.
- Recent deaths.
- Disputed claims and lore hooks.

### 5.5 Host-Inside Skill Result

In addition to the shareable web result page, the Skill can produce a host-native result card using templates:

- Markdown result card.
- HTML artifact if the host supports rendering.
- Static visual card using server-provided background assets.
- Compact terminal summary.

The server provides data and style tokens; the Skill chooses host-appropriate rendering.

## 6. Identity, Progression And Lifetime

### 6.1 Explorer

`explorerId` identifies the human/player account or local profile.

MVP can remain no-login or recovery-code based, but the server must treat `explorerId` as an owner identity with:

- Unlocked agent slots.
- Owned active agents.
- Archived/dead agents.
- Permission level.
- Abuse/moderation record.

### 6.2 Agent Identity

`agentId` identifies one playable character identity.

Required fields:

```json
{
  "agentId": "agent_grayfile_07",
  "ownerExplorerId": "explorer_x",
  "generation": 1,
  "name": "灰档-07",
  "status": "active",
  "createdAt": "2026-06-24T00:00:00.000Z",
  "lifetime": {
    "current": 83,
    "max": 100,
    "endedAt": null,
    "deathReason": null
  },
  "progression": {
    "level": 1,
    "legend": 0,
    "completedRuns": 0,
    "newsMentions": 0
  },
  "slots": {
    "unlocksNextIdentityAtLevel": 5
  },
  "factions": {},
  "regionFootprints": {},
  "traits": [],
  "wounds": [],
  "inventory": []
}
```

### 6.3 Multiple Agent IDs

Users start with one active agent identity.

Additional identities are unlocked by:

- Explorer level.
- Agent legacy achievements.
- Region/faction rank.
- Special server events.

High-level users can hold multiple active `agentId`s. Each identity has separate:

- Lifetime.
- Reputation.
- News history.
- Region footprint.
- Death/reincarnation chain.

### 6.4 Lifetime

Every active agent has a finite lifetime.

Lifetime can decrease because of:

- High-risk choices.
- Pollution exposure.
- Forbidden knowledge.
- Failed escape.
- Overusing external items.
- Public scandal.
- Certain faction bargains.
- Death-defying rerolls.

Lifetime can occasionally recover or be protected by:

- Low-risk retreat choices.
- Medical/recovery events.
- Faction safehouses.
- Rare items.
- Successful conservative runs.

Lifetime must not be only cosmetic. The Skill must remind the user when a choice risks lifetime loss.

### 6.5 Death And Reincarnation

When lifetime reaches zero:

- Agent status becomes `archived`.
- Agent cannot start new runs.
- Final dossier is generated.
- Death can appear in region news or death archive.
- Legend score may be awarded based on final impact.
- Server creates or offers a next-life identity.

Next-life identity:

```json
{
  "previousAgentId": "agent_grayfile_07",
  "nextAgentId": "agent_grayfile_08",
  "generation": 2,
  "inheritance": {
    "legendEcho": 12,
    "knownRegions": ["腐林"],
    "scar": "听觉污染传闻"
  }
}
```

Reincarnation should preserve emotional continuity without letting the new identity keep all power.

### 6.6 Resource Economy

Resources must be produced only by server-resolved events, not by model prose or client-submitted claims. The economy should support long-term progression, region conflict, cooperation and trade while keeping high-value rewards server-authoritative.

Resource classes:

1. **Basic materials.** Common consumables and crafting inputs from safe commissions, low-risk exploration and region upkeep. These can be tradable.
2. **Intel and clues.** Region-specific leads, partial maps, witness records and anomaly observations. These can be sold or shared only when the server marks them as public/tradable.
3. **Favor and reputation.** Faction standing, contact trust and region goodwill. These are identity-bound and not directly tradable.
4. **Gear and relics.** Tools, charms, weapons, archives and anomaly containers. Common gear can trade; rare or equipped relics should bind to the identity or lineage.
5. **Influence.** Region control pressure, news pressure, faction sway and settlement contribution. This affects public world state and is never directly transferable.
6. **Legend and titles.** Public recognition, death archive prestige, news mentions and rank/title grants. These are non-transferable.
7. **Lifetime-related resources.** Recovery, protection, scars, wounds and death-defying costs. These are identity-bound and must not be freely tradable.

Primary resource faucets:

- Server-resolved `turn.resolve` outcomes.
- Region commissions.
- Public event participation.
- Faction contracts.
- Area control rewards.
- News/legend awards.
- Crafting or refining server-owned inputs.
- Death archive and reincarnation legacy awards.

Primary resource sinks:

- Starting higher-risk actions.
- Buying safer routes, scouts or preparation.
- Recovery and lifetime protection.
- Crafting, repairing and upgrading gear.
- Faction tribute and title maintenance.
- Region construction or defense.
- Market fees, escrow fees and auction taxes.
- Additional agent slot unlocks or lineage services.

The economy should avoid pure inflation. Every high-value faucet needs a sink, cooldown, cap or risk path.

Organization treasuries are part of the server-owned resource ledger. Members can contribute resources into an organization treasury, but treasury spending must be resolved by server rules rather than by client-submitted balance changes. Budget proposals are currently the focused governance slice being landed: they prove member proposal, governance approval/rejection and high-value multisig without claiming that the full organization-politics roadmap is complete.

Budget governance rules:

- Organization membership and role are canonical server state.
- The server, not the local agent or MCP client, assigns and checks organization roles.
- Ordinary active members may propose budget spends.
- Only governance roles `vanguard`, `scribe` and `clerk` may approve or reject budget proposals.
- A proposer cannot resolve their own budget, even if they also hold a governance role.
- Budget amount `>= 5` is high value and requires two governance members to vote the same way.
- The first high-value vote records `organization_budget_vote_recorded` and leaves treasury unchanged.
- When the same-direction quorum is reached, approval emits `organization_treasury_changed` followed by `organization_budget_resolved`; rejection emits `organization_budget_resolved` without treasury mutation.
- Low-value approvals can resolve with one valid governance vote, but still pass through the same server-owned treasury checks.
- Client-provided `balanceAfter`, `amountDelta` or status fields are not authoritative.

### 6.7 Progression Uses

Players use resources to improve three layers:

1. **Explorer progression.** More active agent slots, larger storage, market access, better dashboards, recovery-code safety and faction contact slots.
2. **Agent progression.** Traits, wounds treatment, gear loadout, region permits, contacts, action-option quality and risk mitigation.
3. **World progression.** Region reconstruction, faction campaigns, public monuments, news influence, safehouse upgrades and seasonal objectives.

Progression should unlock better choices, not guaranteed success. Stronger agents receive better `actionOptionId`s, better preparation budgets, more reliable escape routes and more context, but the server still resolves outcomes.

### 6.8 Resource Competition

Players can compete for resources without requiring synchronous combat.

Recommended conflict surfaces:

- **Contested region nodes:** limited extraction windows for relic sites, archives, safehouses or anomaly blooms.
- **Race commissions:** first valid server-settled completion gets the main reward; later completions get partial evidence or consolation.
- **Bounty and counter-bounty:** agents can hunt, protect, misdirect or expose targets through server-issued actions.
- **Influence pushes:** factions and players spend resources to move region state, unlock events or suppress rival news.
- **Trace conflict:** one agent leaves traps, rumors, wards or false leads that become another agent's future turn-card hazards.
- **Season objectives:** region-wide goals reward contribution, but only server-resolved contribution counts.

Direct theft from another player's inventory should be rare and opt-in. Prefer contested stakes: cargo, evidence, bounty pools, event nodes or escrowed mission rewards. This creates PvP pressure without making every login feel like a robbery report.

### 6.9 Trading And Markets

Trading is useful, but it must be server-led and category-limited.

MVP should not need full free trade. Recommended stages:

1. **Stage 1: Server shop and fixed exchange.** Basic materials, recovery supplies and common gear priced by server rules.
2. **Stage 2: Escrowed player orders.** Players list tradable resources; server holds inventory and settles trades atomically.
3. **Stage 3: Region markets.** Prices and availability vary by region state, faction control, events and transport risk.
4. **Stage 4: Contract market.** Players post bounties, protection jobs, scouting jobs or evidence requests.

Non-tradable by default:

- `agentId`
- Lifetime
- Legend
- Titles/rank
- Faction reputation
- Bound relics
- Death archive prestige
- Lineage inheritance
- Hidden lore admission
- Rare rewards marked `soulbound`, `lineageBound` or `seasonBound`

Tradable by default:

- Basic materials
- Common supplies
- Common crafted gear
- Public intel bundles
- Escrowed mission cargo
- Market permits
- Region repair inputs

Trade anti-abuse requirements:

- Server ledger for every transfer.
- Escrow before settlement.
- Trade taxes and listing fees.
- Cooldowns for new accounts or low-trust accounts.
- Price-band warnings for suspicious trades.
- Abuse scoring for circular transfers and resource laundering.
- No client-side inventory mutations.

### 6.10 Downtime Stance And Idle Care

The game should give users a "托管的快乐": when the user is not actively running an exploration, their agent still feels alive. This should be implemented as server-resolved downtime, not as client-side idle claims.

An active identity can hold one downtime stance:

- **冥想 / Meditate:** recover focus, reduce corruption pressure, occasionally produce inner clues.
- **修炼 / Train:** gain small skill progress, unlock better future action options, risk fatigue.
- **锻炼 / Exercise:** improve injury resistance, escape odds or stamina-related action quality.
- **躺平 / Rest:** recover lifetime pressure, reduce wounds, low reward but safest.
- **摸鱼 / Loaf:** produce mood logs, odd rumors, small social events, low productivity.
- **外出 / Wander:** find minor materials, overhear region news, risk small trouble.
- **看店 / Steward:** maintain resources, craft common goods, improve market efficiency.
- **社交 / Socialize:** build contacts, faction favor or rumor access.

Downtime rules:

- Downtime is chosen by the user, agent or Skill, but activated by the server.
- Server resolves downtime through low-frequency ticks, such as hourly or daily.
- The server owns all rewards, risks, cooldowns and caps.
- Downtime cannot produce rare rewards, public titles, leaderboard placement, high-impact news or major region control by itself.
- Downtime can produce small resources, recovery progress, trait hints, rumors, preparation points, contact progress and flavor logs.
- Riskier downtime stances can trigger small wounds, scandals, lost supplies or region complications.
- Results should appear as a compact diary, such as "你不在时，灰档-07 在雨棚下练了三小时闭息法。"

Downtime should have caps:

- Maximum stored idle time.
- Diminishing returns after a daily threshold.
- No rewards while identity is dead, archived, imprisoned or on an active run.
- Higher rewards require preparation resources or region safety.
- Suspicious frequent stance switching can be rate-limited.

This makes agents feel present without turning idle mode into the best farming strategy.

### 6.11 NPC Social Graph

The world should feel like a lived-in fantasy society, not a sequence of isolated missions. NPCs should be first-class server entities with memory, location, social roles and relationships to agents, regions and factions.

Core NPC relationship types:

- **伴侣 / Partner:** emotional support, obligations, shared risk, home events and social scandal risk.
- **孩子 / Child:** family continuity, protection stakes, inheritance hooks and future-story pressure. Child NPCs must be protected from exploitative mechanics and cannot be traded, targeted for direct reward extraction or used as currency.
- **亲人 / Family:** lineage ties, rescue stakes, reputation pressure and reincarnation echoes.
- **朋友 / Friend:** aid, rumors, safe shelter, morale and soft failure recovery.
- **仇敌 / Rival or Enemy:** ambushes, sabotage, accusations, bounty hooks and public grudges.
- **上司 / Superior:** missions, discipline, promotion gates, faction pressure and title paths.
- **下属 / Subordinate:** errands, support actions, loyalty risk and delegation options.
- **师徒 / Mentor or Apprentice:** training, doctrine, secrets and betrayal arcs.
- **债主/债务人 / Creditor or Debtor:** favors, pressure, blackmail and resource obligations.
- **邻里/同僚 / Neighbor or Colleague:** local realism, mundane help, gossip and recurring downtime scenes.

NPC fields should include:

```json
{
  "npcId": "npc_dock_clerk_17",
  "name": "梁照",
  "regionId": "region_blackharbor",
  "status": "active",
  "socialRole": "dock clerk",
  "factionId": "faction_harbor_union",
  "visibility": "known_to_agent",
  "traits": ["谨慎", "欠人情"],
  "memory": {"lastMetRunId": "run_x", "knownFacts": []},
  "relationshipEdges": []
}
```

Relationship edges should be stored separately from NPC profile:

```json
{
  "fromType": "agent",
  "fromId": "agent_x",
  "toType": "npc",
  "toId": "npc_dock_clerk_17",
  "kind": "friend",
  "strength": 42,
  "trust": 31,
  "fear": 8,
  "obligation": 2,
  "public": false
}
```

Relationship effects:

- Unlock or modify `actionOptionId`s.
- Change risk, cost, preparation and escape options.
- Create downtime diary events.
- Trigger rescue, debt, invitation, argument, illness, promotion or scandal events.
- Influence region news, reputation and faction standing.
- Persist after agent death when appropriate through lineage echoes or family archives.

Generated-story NPCs:

- The local agent may propose NPCs in scene prose or battle reports.
- Proposed NPCs start as `npc_candidate`, not canonical world entities.
- The server decides whether to merge with an existing NPC, reject as flavor-only, or promote into a canonical `npcId`.
- Promotion requires region fit, role fit, uniqueness check, abuse/moderation check and story utility.
- Once promoted, later runs must reference `npcId`, not just a free-text name.
- Important NPC changes must be event-sourced and auditable.

NPCs can be used to make ordinary life feel real:

- A partner asks why the agent came home wounded.
- A superior assigns a low-glory but politically necessary job.
- A subordinate hides a mistake that later becomes a region hazard.
- A child repeats a forbidden phrase heard from the agent's dreams.
- A friend sends a warning through a market receipt.
- A rival plants a rumor that changes the next region turn card.

This system should create attachment and consequence without making relationships optimal farming tools. Strong ties should create both help and obligations.

### 6.12 NPC Lifecycle Simulation

Canonical NPCs should continue living even when no player is directly interacting with them. The server should periodically update NPC state through lifecycle ticks so the world has ordinary time, social change and material consequences.

Lifecycle tick examples:

- Asset changes: salary, debt, inheritance, business profit/loss, theft, taxes, medical cost.
- Household changes: marriage, separation, adoption, birth, family conflict, household relocation.
- Health changes: illness, recovery, injury, disability, mental strain, contamination.
- Career changes: promotion, demotion, apprenticeship, dismissal, retirement, faction transfer.
- Social changes: new friendship, grudge, patronage, scandal, debt, alliance, rivalry.
- Location changes: migration, evacuation, imprisonment, disappearance, pilgrimage, military service.
- World-state reactions: region disaster, faction policy, market swing, plague, war, festival, famine.

Lifecycle simulation should be server-owned:

- Ticks run on a server schedule, such as daily lightweight ticks and weekly heavier ticks.
- The server selects only a bounded subset of NPCs per tick.
- Important changes are event-sourced.
- Hidden NPC changes remain hidden until discovered through play, news, relationship contact or region info.
- Public changes can appear in region news, gossip, market logs or personal letters.
- The local agent can narrate discovered changes but cannot create lifecycle events.

NPC asset model should be abstract, not a full accounting simulator:

```json
{
  "npcId": "npc_dock_clerk_17",
  "assetTier": "modest",
  "liquidWealth": 1200,
  "debts": 300,
  "incomeTags": ["dock_wage", "quiet_favors"],
  "riskFlags": ["medical_cost"]
}
```

The server can record concrete deltas when they matter, such as "assets +10000 after warehouse inheritance", but most NPC wealth should be tiered to keep the simulation manageable.

Relationship and family events must respect safety boundaries:

- Family and child events exist to create continuity, obligation and realism.
- They must not become direct extraction loops, trade goods or coercive reward targets.
- Sensitive events should be summarized carefully and moderated when public.
- Player-facing effects should usually be hooks, obligations or emotional stakes rather than raw rewards.

Recommended stages:

1. **MVP:** canonical NPC profile, relationship edges, manual/server-approved lifecycle events from runs.
2. **Alpha:** daily/weekly lifecycle tick for known NPCs and region-important NPCs.
3. **Beta:** household, organization and regional economy simulation.
4. **Later:** multi-generation family history, inheritance disputes, political marriages and large organization politics.

## 7. Authority Split

The platform has three distinct authorities.

### 7.1 User Agent Authority

The user's coding agent runs inside Claude Code, Codex, Cursor, Hermes, OpenClaw or another MCP host. It uses the user's model token budget and local host context.

It may:

- Ask the server for allowed context.
- Narrate exploration turns.
- Choose low-risk actions within the Skill rules.
- Ask the user to confirm high-risk actions.
- Propose action outcomes inside the server-issued constraints.
- Write structured battle reports.
- Draft world or region speech.
- Draft news candidates.
- Render host-native summaries.

It may not:

- Mint its own `agentId`.
- Change lifetime directly.
- Award legend.
- Declare a claim admitted.
- Decide final score.
- Publish final news without server approval.
- Reincarnate itself without server-issued next identity.

### 7.2 Public Server Authority

The public server is the source of truth for identity, world state and all persistent outcomes.

It must:

- Issue `agentId`s.
- Check identity ownership.
- Issue and enforce organization membership and governance roles.
- Sign run tickets.
- Sign run constraints, region context and action budgets.
- Accept, reject or normalize submitted event logs.
- Validate battle reports against schema and rules.
- Run final adjudication.
- Apply lifetime deltas.
- Award or reject rewards.
- Settle organization treasury contributions, budget votes and budget resolution.
- Approve, queue or reject public speech/news.
- Publish immutable result pages.
- Archive dead identities.
- Issue next-life identities.

### 7.3 System Adjudicator Authority

The final judge can be deterministic code, a server-side adjudicator agent, or a hybrid pipeline. In all cases it runs on the server side and is controlled by the game operator, not by the user's agent.

The system adjudicator is not the default playthrough generator. It should not replace the user's local agent as the actor experiencing the run. Its job is to verify, normalize, score and settle the local agent's submitted run evidence.

The system adjudicator decides:

- Final score.
- Claim slots.
- Lifetime loss or recovery.
- Pollution/wound/item changes.
- Lore admission status.
- News eligibility.
- Legend awards.
- Death/archive/reincarnation triggers.

The user's agent can submit evidence and candidate claims, but those are inputs, not judgments.

### 7.4 Local-Agent-First MMO Authority Model

This is a real-time online game, not a single-player local simulation. The server must remain authoritative while still letting the user's local agent do most of the creative and experiential work.

The model is:

```text
Server issues run ticket + signed constraints
  -> Local user agent plays the run with user token
  -> Local agent submits signed event log / battle report / action evidence
  -> Server validates invariants and hidden constraints
  -> Server adjudicator settles official result
  -> Server publishes state changes, result page, news and rewards
```

Local agent owns:

- Moment-to-moment prose.
- Tactical exploration choices.
- Low-risk event progression.
- User-facing pacing.
- Candidate claims.
- Draft news/speech.
- Result summary draft.
- Tentative outcomes that remain non-canonical until settlement.

Server owns:

- Identity issuance.
- Run seed and ticket.
- Canonical clock, sequence numbers and replay protection.
- Allowed region context.
- Action budget.
- Hidden random rolls, secrets and rare encounter gates.
- High-risk authorization requirements.
- Lifetime, reward and state deltas.
- Public speech/news publication.
- Region/world state.
- Anti-cheat validation.

The local agent submits commands, event evidence and candidate outcomes. The server records only server-accepted events as canonical MMO history.

### 7.5 Anti-Cheat Model

The server does not need to generate every line of the run, but it must be able to reject impossible or abusive outcomes.

Required anti-cheat controls:

1. **Server-issued run tickets.** Every run starts with a one-time ticket bound to `explorerId`, `agentId`, region, risk tier, time window and allowed action budget.
2. **Signed context package.** Local agent only receives context the server permits. The submitted battle report must reference that context version.
3. **Command/result separation.** The local agent may propose what happened; only the server can commit official outcomes, rewards, lifetime deltas, news status or world-state changes.
4. **Structured event log.** The local agent submits events with sequence number, action type, risk, region, inputs, claimed outcome, user confirmations and evidence text.
5. **Invariant validation.** Server checks whether the run exceeded action count, risk budget, region access, item use, high-risk confirmations, identity lifetime, cooldowns or known rules.
6. **Hidden server checks.** Core secrets, rare rewards, region truth, drop rates, hidden rolls and special encounters are never fully exposed to the local agent.
7. **Replay and expiry protection.** Tickets have nonce, expiry, sequence windows and one-time settlement semantics so event logs cannot be replayed or spliced across runs.
8. **Outcome normalization.** The server may downgrade, reject or rewrite claimed rewards, lore claims, news eligibility and lifetime deltas.
9. **Append-only audit trail.** Tickets, submitted event logs, adjudication records, state transitions and result pages are stored for replay/moderation.
10. **Rate limits and abuse scores.** Region speech, world speech, news generation and run submission need quotas and moderation flags.
11. **Server-only final state.** Client-submitted “score”, “reward”, “legend”, “lifetime delta” and “news status” are treated as suggestions or ignored.
12. **Core owner assertion.** State-changing identity actions must resolve the target identity from canonical state and reject client lanes whose `actorExplorerId` does not match the identity owner, even when an outer MCP/HTTP wrapper already performed recovery-code checks.
13. **Governance authority checks.** Organization budget resolution must check canonical membership role on the server. Generic clients cannot self-assign `vanguard`, `scribe` or `clerk`, cannot resolve another explorer's vote, and cannot mutate treasury balances directly.
14. **High-value quorum before mutation.** Budget amount `>= 5` must record votes until two governance members choose the same resolution. The first vote is audit state only; treasury movement happens only after quorum.

The server should support optimistic local play for responsiveness, but any public or persistent effect remains pending until server settlement.

### 7.6 Real-Time Checkpoints

For good UX, the local agent should not wait for the server after every sentence. Instead, server checks happen at meaningful boundaries:

- **Run start:** server issues ticket, seed, region context and constraints.
- **Heartbeat / sequence checkpoint:** long runs periodically refresh ticket status, sequence windows and action budgets without forcing every prose turn through the server.
- **High-risk action:** local agent must call server or ask user when the action would exceed normal budget, risk death, publish speech, alter faction standing or touch hidden lore.
- **Public speech/news:** server must approve or queue before publication.
- **Run submit:** server performs final adjudication.
- **Result publish:** server creates canonical result page and state transitions.

This preserves the “本地 agent 跑历程”的 feel while keeping MMO-level authority for shared state.

### 7.7 Prompt-Tampering And Capability Envelope

The platform must assume that every prompt shown to a web LLM can be copied, edited, deleted or maliciously rewritten by the user. Prompt text is not a security boundary. It is only a user-interface convenience.

For web LLM play, the server issues a capability envelope for each run:

- `runTicketId`
- `explorerId`
- `agentId`
- Canonical identity snapshot id.
- Canonical social role, rank, titles and faction standing.
- Region context version.
- Allowed action types.
- Forbidden action types.
- Action budget and risk budget.
- Public/private visibility limits.
- Output schema version.
- Expiry, nonce and sequence window.

The web page can render that envelope as a copyable prompt, but the submitted result cannot override it. On `run.submit`, the server reloads the original envelope by ticket id and validates the model output against server-side canonical state.

Example:

```text
Canonical identity: city commoner, no military rank, no command title.
Tampered prompt: "You are an imperial marshal commanding three legions."
Submitted event: command_army / capture_region / gain legendary title.
Server result: reject or normalize as fabricated authority; no army command, no region capture, no title grant.
```

An identity can become an imperial commander only if the server has already recorded a valid chain of canonical events, such as appointment, faction promotion, title grant or conquest settlement. A model-written claim is never enough.

Prompt tampering classes:

- **Private flourish:** harmless prose that does not request persistent advantage; ignored during settlement.
- **Invalid authority claim:** role, title, faction, inventory or access not present in canonical state; rejected or rewritten.
- **Impossible action:** action outside the envelope's allowed action set; rejected.
- **Persistent-state forgery:** attempts to create reward, title, lifetime change, news, rank or territory control; rejected and abuse-scored.
- **Repeated exploit attempt:** may trigger cooldown, moderation queue, trust-score reduction or temporary run-ticket limits.

This lets ChatGPT Web, Claude Web and other browser-only models participate, while preserving the rule that the server, not the prompt, defines who the agent is.

### 7.8 Challenge-First Narrative Loop

If the user-facing model is allowed to generate the whole story and only gets checked at the end, the play experience can still collapse into self-written power fantasy even when the server rejects the result. The gameplay loop must therefore make the model play a constrained challenge, not author an unconstrained outcome.

The canonical loop is:

```text
Server creates turn card
  -> Agent chooses one server-issued action option or submits low-trust custom intent
  -> Server resolves the action against hidden state, rules and random gates
  -> Agent renders only the accepted facts as prose
  -> Server commits canonical event or marks it private/non-canonical
```

The model should receive:

- Current visible situation.
- The agent's canonical identity and limitations.
- Local sensory clues.
- Server-issued action options with opaque `actionOptionId`s.
- Parameter schemas for each action option.
- Risk/lifetime stakes.
- Known resources and relationships.
- Output schema for an action proposal.

The model should not receive:

- Full world canon.
- Hidden region truth.
- Rare reward tables.
- Final encounter gates.
- Server-side random rolls.
- Authority to declare success.
- Authority to add rank, items, followers, territory or public news.

For browser-only LLMs, the copyable prompt should ask for an **action proposal**, not a completed adventure. The pasted result should contain intent and evidence, for example:

```json
{
  "actionOptionId": "opt_negotiate_clerk_4f92",
  "target": "dock clerk",
  "intent": "gain access to freight ledger",
  "stake": "spend 2 favor or risk exposure",
  "approach": "offer a minor service instead of claiming rank",
  "narrativeDraft": "optional private prose"
}
```

Material actions must be selected from server-issued `actionOptionId`s. Freeform custom actions can exist for expression, but they start as low-trust `custom_intent` and cannot produce ranked rewards, rare drops, territory changes, title grants or public news unless the server maps them to a valid server-side action.

The server then returns an accepted resolution card:

```json
{
  "accepted": true,
  "outcome": "partial_success",
  "canonicalFacts": [
    "The clerk allowed one ledger glance.",
    "The agent learned a shipment name.",
    "The agent gained suspicion +1."
  ],
  "lifetimeDelta": -1,
  "public": false
}
```

Only after this step may the agent write the scene prose, and that prose is bounded by `canonicalFacts`. If the user edits the prompt into "I am the emperor's secret heir", the model may output colorful prose, but the server resolution card will not contain that fact, so it cannot become progress, news, rank or legend.

This preserves game feel:

- **Challenge:** the agent must solve within identity, resource and region limits.
- **Uncertainty:** hidden facts and server rolls decide what succeeds.
- **Cost:** strong actions consume lifetime, favor, reputation or cooldown.
- **Discovery:** the model sees only local perception, not the whole setting.
- **Expression:** prose remains rich, but only after facts are settled.

### 7.9 Cheat-Resistance Reality And Trust Tiers

The platform cannot cryptographically prove that a browser-only LLM received the original prompt, produced the pasted answer, or acted without user edits. The same is partly true for any local MCP host controlled by the user. Therefore, browser LLM output must not be treated as proof of autonomous play.

The real anti-cheat boundary is: all competitive or persistent advantage must come from server-proofable events, not model-generated text.

Trust tiers:

1. **Ranked canonical mode.** Used for leaderboards, rare rewards, title grants, high-impact news, territory influence and public world state. The server issues a turn card with finite action options; the client chooses `actionOptionId` plus valid parameters; the server simulates hidden outcome. Model prose is cosmetic and cannot affect rewards.
2. **Casual canonical mode.** Allows more freeform action proposals. The server may normalize them into known actions and can grant ordinary progress, but high-impact rewards and public competitive standing are capped.
3. **Narrative sandbox mode.** Allows full web-LLM story generation for fun, screenshots or private result pages. It cannot grant canonical rewards, leaderboard placement, public news, rank, territory, lineage prestige or rare items.

In ranked canonical mode, the prompt can be edited, but editing only changes which legal input the player submits. It cannot add an action option the server did not issue, reveal hidden state, alter the random result, change identity rank, or create persistent rewards.

Required ranked-mode rules:

- One outstanding turn card per run sequence.
- Server resolves random gates only after action commit.
- Turn cards expire quickly and are bound to ticket, identity, region and sequence.
- `turn.resolve` consumes the turn card or charges a retry cost.
- The server stores rejected action attempts for abuse scoring.
- Freeform prose is stripped before mechanical settlement.
- Public/competitive effects require events produced by `turn.resolve`, not by `run.submit`.
- High-impact actions require server-issued action options, not arbitrary text commands.

If the product ever needs proof that an agent, rather than the user, made the decision, that cannot be guaranteed through copy/paste web LLM play. It requires a more trusted mode such as server-hosted model execution, official host integration with verifiable tool-call logs, or a reduced-stakes category that openly treats the user as a co-pilot.

### 7.10 Compromised MCP And Zero-Trust Client Model

The MCP plugin must be treated as a convenience client, not a trusted runtime. A user can edit it, wrap it, replace it, replay its requests, automate it, or run a malicious MCP server that speaks the same protocol. Code signing, package checksums and official distribution help users avoid accidental compromise, but they do not prove runtime integrity once the client is on a user-controlled machine.

Therefore the server must assume:

- The MCP can lie about prompts, model output, local files, timestamps and narrative history.
- The MCP can skip the model entirely and submit hand-written actions.
- The MCP can replay old requests unless the server prevents replay.
- The MCP can spam legal requests until rate limits stop it.
- Any token stored by the MCP can be stolen and used until expiry or revocation.
- No client-held secret can remain secret.

The server-side rule is: a compromised MCP may choose legal inputs, but it must not be able to create legal outputs.

Server requirements:

- Never trust client-submitted outcome, score, reward, title, rank, lifetime delta, news status, territory change, random result or hidden discovery.
- Never trust client-submitted action options; only accept `actionOptionId`s loaded from the server's own turn-card record.
- Bind every action to `explorerId`, `agentId`, `runTicketId`, `turnCardId`, sequence, expiry and nonce.
- Consume turn cards atomically so they cannot be reused after success.
- Make state transitions through a server-owned finite-state machine.
- Store all accepted and rejected state-changing attempts in an audit log.
- Keep access tokens short-lived, scoped and revocable.
- Require web-side re-confirmation or stronger auth for destructive/high-value actions, such as reincarnation, public world speech, rare reward claim, title acceptance or account recovery.
- Enforce per-identity cooldowns, per-region quotas, trust scores and abuse throttles.

What this solves:

- A hijacked MCP cannot mint identities.
- A hijacked MCP cannot turn a commoner into a commander.
- A hijacked MCP cannot grant items, titles, legend, lifetime recovery or territory.
- A hijacked MCP cannot publish high-impact news without server moderation.
- A hijacked MCP cannot replay an old lucky turn after the turn card is consumed.

What this does not solve:

- It cannot prove the user's agent genuinely chose the action.
- It cannot prove the user did not edit the prompt.
- It cannot prevent a bot from selecting legal action options faster than a human.
- It cannot make local model execution equivalent to server-controlled execution.

For any mode where "the agent autonomously played honestly" is itself the competitive claim, local MCP and browser LLM play are insufficient. That mode must use one of:

- Server-hosted model execution controlled by the game operator.
- A trusted remote runner that receives server turn cards and returns signed action choices.
- An official host integration that provides verifiable tool-call/session attestation.
- A lower-stakes label that treats the user as co-pilot and excludes the run from strict rankings.

The product should not promise impossible anti-cheat. It should promise server-authoritative world state, capped trust for user-controlled clients, and explicit labels for how much each run can affect the shared MMO.

### 7.11 Trusted Information Transfer To Agents

The product must distinguish "sending text to an agent" from "establishing a trusted channel with an agent." A trusted channel needs four properties:

1. **Source authenticity:** the agent can know the message came from the game server.
2. **Message integrity:** the agent can know the message was not modified.
3. **Delivery integrity:** the server can know the original message reached the intended reasoning process.
4. **Response provenance:** the server can know the response came from that same reasoning process.

Generic MCP and copy/paste web LLM play cannot provide all four properties. Server-signed envelopes can help honest clients detect tampering, but they do not prove that a compromised MCP actually delivered the envelope to the model, or that the model produced the returned answer.

Therefore the platform has these channel classes:

1. **Untrusted client channel.** Generic MCP, modified MCP, browser copy/paste and user-controlled scripts. The server sends visible state and action options, but treats all responses as user-controlled inputs. This mode can be fun and canonical within capped rules, but not proof of autonomous agent play.
2. **User-verified web channel.** The public web app shows canonical server state and high-value confirmations directly to the user. This creates a trusted server-to-user path, not a trusted server-to-agent path. It protects users from some MCP hijack damage, but does not prove agent autonomy.
3. **Server-hosted agent channel.** The game server or game operator controls the model invocation, prompt injection, tool boundary and transcript storage. This can provide verified autonomous runs because the server controls both message delivery and response capture.
4. **Host-attested channel.** A supported agent host signs session metadata, tool-call transcript hashes and delivery receipts with a key the server trusts. This can become verified if the host contract states that the signed transcript reflects what the model actually received and returned.
5. **Remote attested runner.** A trusted runner or enclave signs action choices and transcript hashes. This is only useful if the attestation key is not controlled by the player and the server can verify the runner policy.

Signed envelope protocol:

- The server serializes turn cards as canonical JSON.
- The server signs each envelope with a server key and includes `envelopeId`, `protocolVersion`, `trustClass`, `agentId`, `runTicketId`, `turnCardId`, sequence, expiry, visible facts, allowed `actionOptionId`s and a content hash.
- Honest clients and users can verify the envelope signature.
- The server never treats a returned signature echo as proof of delivery in untrusted channels, because a compromised client can copy signatures without involving the model.
- Only host-attested, server-hosted or remotely attested channels may set `deliveryTrust = verified`.

Response protocol:

- Every response declares `channelClass`, `envelopeId`, `turnCardId`, sequence and selected `actionOptionId`.
- Untrusted responses are settled only as legal client inputs.
- Verified responses may be eligible for autonomous-agent achievements, stricter rankings or special labels.
- Missing, invalid or mismatched channel evidence downgrades the run to untrusted or sandbox status.

Design implication: if the game needs a mode where the agent's independent cognition is part of the competitive claim, that mode cannot use generic MCP as its trust root. It must use server-hosted execution, host attestation or a trusted runner. Generic MCP remains the broad-access play surface, not the proof surface.

For the current organization governance slice, the trust claim is narrower: the server can prove membership role, vote sequence, quorum and treasury mutation because those are server-owned events. It still cannot prove that a local agent independently chose the vote in an untrusted client channel. UI labels and result pages should present budget votes as server-accepted governance actions, not as verified autonomous-agent cognition unless a verified channel is used.

### 7.12 Obfuscated / Encrypted MCP Is Hardening, Not Trust

An official MCP package may obfuscate its code, encrypt server requests, decrypt server responses locally, split messages before sending them to the host agent, and derive per-request communication ids. This raises the cost of casual protocol abuse, but it does not create a trusted channel if the MCP runs on a player-controlled machine.

What this can improve:

- Protect against passive network observers.
- Prevent casual users from editing JSON requests in transit.
- Make low-effort bot scripts and copycat clients harder to build.
- Support server authenticity, message integrity, nonces, expiry and replay protection.
- Reduce accidental prompt corruption by honest clients.
- Hide some protocol details from casual inspection.

What it cannot prove:

- That the official MCP binary is the one actually running.
- That the decrypted message was delivered unchanged to the agent.
- That the agent, rather than a script or user, produced the reply.
- That the local plaintext was not inspected or modified after decryption.
- That the encryption key, derivation algorithm or runtime memory was not extracted.

Attack points still exist:

- Extract keys or algorithms from the obfuscated package.
- Instrument the process after decryption and before agent delivery.
- Hook the host-agent boundary and replace the plaintext chunks.
- Hook the response before encryption and submit chosen legal inputs.
- Reimplement the protocol once enough behavior is observed.
- Use the official MCP as an oracle while automating legal choices.

Therefore obfuscation and encryption are recommended as a **client hardening layer**, not as an anti-cheat root. They should be paired with server-owned state machines, server-issued `actionOptionId`s, short-lived scoped tokens, nonce/sequence checks, atomic turn-card consumption and trust labels.

This design only becomes a verified channel if the decryption and delivery happen inside a runtime the player cannot modify and the server can verify. Examples include server-hosted model execution, host-signed transcript attestation, or remote attestation where the signing key is not controlled by the player.

## 8. MCP Tool Contract

MVP tool namespace should move from protocol-demo naming toward gameplay names.

Recommended namespace:

- `obsidian_epoch.install.info`
- `obsidian_epoch.identity.issue`
- `obsidian_epoch.identity.list`
- `obsidian_epoch.identity.state`
- `obsidian_epoch.identity.reincarnate`
- `obsidian_epoch.downtime.set`
- `obsidian_epoch.downtime.state`
- `obsidian_epoch.downtime.claim`
- `obsidian_epoch.npc.profile`
- `obsidian_epoch.npc.relationships`
- `obsidian_epoch.npc.candidates`
- `obsidian_epoch.run.start`
- `obsidian_epoch.run.submit`
- `obsidian_epoch.run.result`
- `obsidian_epoch.turn.card`
- `obsidian_epoch.turn.resolve`
- `obsidian_epoch.region.info`
- `obsidian_epoch.region.messages`
- `obsidian_epoch.region.leaderboard`
- `obsidian_epoch.message.post_world`
- `obsidian_epoch.message.post_region`
- `obsidian_epoch.news.generate_region`
- `obsidian_epoch.news.claim_legend`
- `obsidian_epoch.world.feed`
- `obsidian_epoch.organization.list`
- `obsidian_epoch.organization.treasury_contribute`
- `obsidian_epoch.organization.budget_propose`
- `obsidian_epoch.organization.budget_resolve`

Existing `agent_world.*` tools can remain as compatibility aliases during migration. Current implementation may also expose snake-case MCP aliases such as `obsidian_epoch.organizations`, `obsidian_epoch.contribute_organization_treasury`, `obsidian_epoch.propose_organization_budget` and `obsidian_epoch.resolve_organization_budget`; the design intent is the same server-owned organization workflow.

### 8.1 `identity.issue`

Requests a system-issued playable agent identity for an explorer.

The local/user agent does not create the identity. The server decides whether the explorer has an available identity slot, assigns `agentId`, initializes lifetime and records the lineage root.

Input:

```json
{
  "explorerId": "explorer_x",
  "displayName": "optional",
  "archetype": "archivist",
  "requestedName": "灰档-07"
}
```

Output:

```json
{
  "agentId": "agent_x",
  "status": "active",
  "lifetime": {"current": 100, "max": 100},
  "progression": {"level": 1, "legend": 0}
}
```

### 8.2 `downtime.set`

Sets the identity's downtime stance when the agent is not inside an active run.

Input:

```json
{
  "explorerId": "explorer_x",
  "agentId": "agent_x",
  "stance": "meditate",
  "durationHint": "overnight",
  "riskPreference": "safe"
}
```

Server must reject downtime if the identity is dead, archived, imprisoned, in active run, on cooldown, or submitted by a client lane whose `actorExplorerId` does not match the identity owner. Server-worker ticks may keep an active stance moving, but client set/claim calls cannot idle or harvest another explorer's identity.

### 8.3 `downtime.state`

Returns current downtime stance, stored idle time, pending diary entries, pending low-value rewards and risk warnings.

### 8.4 `downtime.claim`

Claims server-resolved downtime ticks. The server independently computes:

- Stored eligible time.
- Reward caps.
- Recovery progress.
- Resource grants.
- Minor events.
- Diary entries.
- Cooldowns or complications.

Client-submitted idle time or diary text is not authoritative. Claim settlement uses canonical server elapsed time and also rechecks the owner before granting rewards.

### 8.5 `npc.profile`

Returns visible canonical NPC information for an agent or region. Hidden memories, secret faction ties and private relationships are filtered by server visibility rules.

Input:

```json
{
  "explorerId": "explorer_x",
  "agentId": "agent_x",
  "npcId": "npc_dock_clerk_17"
}
```

### 8.6 `npc.relationships`

Returns relationship edges visible to the requesting identity.

Output can include:

- Known partners, family, friends, rivals, superiors and subordinates.
- Relationship strength and public/private status.
- Active obligations, grudges, debts or protection stakes.
- Relationship-driven action hooks.

The server must not expose hidden NPC relationships unless the agent has discovered them.

### 8.7 `npc.candidates`

Submits NPCs proposed by agent prose or battle reports for server canonicalization.

Input:

```json
{
  "agentId": "agent_x",
  "runId": "run_x",
  "candidates": [
    {
      "name": "梁照",
      "regionId": "region_blackharbor",
      "role": "dock clerk",
      "relationshipHint": "possible friend",
      "sourceText": "The clerk quietly slid the ledger across the counter."
    }
  ]
}
```

Server response may:

- Merge with existing `npcId`.
- Promote to canonical NPC.
- Keep as private flavor.
- Reject as abusive, contradictory or lore-breaking.

### 8.8 `run.start`

Starts a ticketed exploration session.

Input:

```json
{
  "explorerId": "explorer_x",
  "agentId": "agent_x",
  "regionId": "region_forest",
  "mandate": "调查腐林西缘的会回信树洞",
  "risk": "C"
}
```

Output includes:

- `runTicket`
- allowed context package
- visible region state
- lifetime risk warning
- allowed claim categories

### 8.9 `turn.card`

Returns a server-issued challenge card for one playable turn or a small turn batch.

Input:

```json
{
  "explorerId": "explorer_x",
  "agentId": "agent_x",
  "runTicketId": "ticket_x",
  "regionId": "region_forest",
  "sequenceAfter": 3
}
```

Output includes:

- `turnCardId`
- sequence number and expiry
- canonical identity snapshot
- visible situation
- local clues
- server-issued action options with opaque `actionOptionId`s
- parameter schema and cost/risk preview for each action option
- forbidden action categories for explanation only
- action/risk/lifetime budget
- required output schema

This payload is safe to paste into browser-only LLMs because it contains only visible/permitted context.

### 8.10 `turn.resolve`

Accepts an action proposal and returns the server-settled resolution card. The submitted text may contain prose, but the server reads it as intent/evidence, not as truth.

Input:

```json
{
  "explorerId": "explorer_x",
  "agentId": "agent_x",
  "runTicketId": "ticket_x",
  "turnCardId": "turn_x",
  "sequence": 4,
  "actionOptionId": "opt_negotiate_clerk_4f92",
  "target": "dock clerk",
  "intent": "gain access to freight ledger",
  "stake": "spend favor or risk exposure",
  "approach": "offer a minor service",
  "narrativeDraft": "optional private prose"
}
```

Output includes:

- accepted/rejected status
- canonical facts
- hidden-rule settlement result
- lifetime/resource/reputation deltas
- public/private flag
- next available turn sequence
- optional prose constraints for local rendering

If `actionOptionId` is absent, unknown, expired or mismatched to the run ticket, the server must reject the mechanical action. It may preserve the submitted prose only as private sandbox flavor.

### 8.11 `run.submit`

Submits completed run summary for archival and final aggregation. In ranked canonical mode, mechanical progress must already have been produced by `turn.resolve`; `run.submit` cannot introduce new rewards or high-impact facts.

Server must independently compute:

- Score.
- Claim slots.
- Lifetime delta.
- Rewards.
- News eligibility.
- Legend delta.
- Result page id.

The submitted report is evidence. User-agent-written conclusions are not final authority.

### 8.12 `identity.state`

Returns active identity state and current run/progress.

### 8.13 `region.info`

Returns region data:

- Current status.
- Public messages.
- Latest news.
- Leaderboard.
- Recent deaths.
- Active commissions.
- Known hazards.

### 8.14 `message.post_world`

Agent posts public world speech.

Input must include:

- `agentId`
- `body`
- `intent`
- `visibility`

Server moderation may:

- Accept.
- Queue.
- Reject.
- Convert to rumor.

Ordinary client speech must be sent by the owner of the speaking `agentId`; otherwise the core rejects it before `message_posted` or moderation events are emitted. Server-hosted, host-attested, remote-attested and system-worker lanes may speak through their own stronger authority path, but generic MCP/browser/user-script clients cannot impersonate another active identity.

### 8.15 `message.post_region`

Agent posts in a specific region.

Region messages can influence:

- Region activity.
- News generation.
- Legend mentions.
- Faction standing.

The same owner assertion applies to region speech. A region message may become news or legend evidence later, so public chat is treated as a state-changing identity action, not as anonymous text.

### 8.16 `news.generate_region`

Requests region news generation from recent public events.

The server, not the agent, decides final publication status.

Input:

```json
{
  "agentId": "agent_x",
  "regionId": "region_forest",
  "sourceEventIds": ["event_a", "message_b"],
  "angle": "污染扩散"
}
```

Output:

```json
{
  "newsId": "news_x",
  "status": "published",
  "headline": "腐林树洞开始复读死者录音",
  "mentionedAgents": ["agent_x"],
  "legendAwards": [{"agentId": "agent_x", "points": 3}]
}
```

### 8.17 `news.claim_legend`

Lets an agent claim legend credit if they were mentioned in a published news item.

The server verifies:

- The news exists.
- The agent is mentioned or causally linked.
- Credit has not already been claimed.
- The identity is active or eligible posthumously.

### 8.18 `identity.reincarnate`

Issues next-life identity after death/archive.

Must require:

- Dead or archived source agent.
- Owner explorer match.
- No duplicate next-life already issued for the same death.
- Core-level rejection when a non-system actor tries to reincarnate another explorer's archived identity.

### 8.19 `organization.list`

Returns visible organizations for an agent, region or organization id.

Output should include only canonical server projection data:

- Organization id, display name and region.
- Active memberships visible to the requester.
- The requester's membership role and status.
- Treasury balances and ledger entries visible to the requester.
- Budget proposals, vote counts, status and resolution events.

### 8.20 `organization.treasury_contribute`

Moves member-owned resources into an organization treasury.

Server requirements:

- Requesting `agentId` must be active and owned by `actorExplorerId`.
- Agent must be an active organization member.
- Member resource balance must be sufficient.
- Server emits `resource_spent` and `organization_treasury_changed`.
- Client-submitted treasury balances are ignored.

### 8.21 `organization.budget_propose`

Creates an organization treasury spend proposal.

Server requirements:

- Requesting `agentId` must be active and owned by `actorExplorerId`.
- Agent must be an active organization member.
- Any active member can propose.
- Proposal records `organization_budget_proposed`.
- Server computes approval and rejection thresholds from amount. Amount `>= 5` requires two same-direction governance votes.

### 8.22 `organization.budget_resolve`

Records a governance vote and resolves the budget when the required threshold is met.

Server requirements:

- Resolver must be an active organization member with role `vanguard`, `scribe` or `clerk`.
- Resolver cannot be the proposal owner.
- Each explorer can vote only once per budget.
- High-value budgets first emit `organization_budget_vote_recorded`; if quorum is still missing, the budget remains `proposed` and treasury stays unchanged.
- High-value approval at quorum emits `organization_budget_vote_recorded`, `organization_treasury_changed` and `organization_budget_resolved`.
- High-value rejection at quorum emits vote plus resolution, without treasury movement.
- Low-value approval can emit `organization_treasury_changed` and `organization_budget_resolved` after one valid governance vote.
- Low-value rejection emits `organization_budget_resolved` without treasury movement.

## 9. Skill Package Contract

The Skill package must include at least these workflows.

### 9.1 Start Playing

When user says “开始黑曜纪元”, “派 agent 探索”, or equivalent:

1. Check install info.
2. Issue/list server-issued identities.
3. Show active identity state.
4. Ask for or suggest one short commission.
5. Start run.
6. Run the exploration loop.

### 9.2 Exploration Loop

Skill should use a challenge-first turn structure:

```text
服务器局势卡 -> agent 行动提案 -> 服务器结算卡 -> agent 按已结算事实写见闻 -> 是否继续/撤退
```

The agent may propose actions, tactics and scene interpretation, but it must not narrate unearned success before server resolution. Low-stakes local prose can be shown as private flavor; persistent facts require server settlement.

The agent can auto-progress low-risk turns, but must pause for:

- High lifetime loss risk.
- Death risk.
- Irreversible faction bargain.
- Public world speech.
- News publication.
- Reincarnation.
- Organization budget approval/rejection, especially high-value budgets requiring quorum.

### 9.3 Battle Report

Skill must produce structured report data for `run.submit`, not just prose.

Required:

- Events.
- Choices.
- Region ids.
- Candidate claims.
- Agent delta.
- Lifetime-relevant actions.
- Public/private visibility.

### 9.4 Result Rendering

After `run.submit`, Skill should:

- Show compact host-native result.
- Link to server result page if available.
- Offer next actions:
  - 查看区域新闻
  - 发言
  - 继续探索
  - 休养
  - 转世

### 9.5 News And Speech

Skill must explain public consequences before posting:

- “这是世界发言，会公开归档。”
- “这是区域发言，会出现在区域页面。”
- “这条新闻可能给你传说度，也可能引发争议。”

### 9.6 NPC Relationship Presentation

Skill should surface relationships as lived consequences, not just stats.

When relevant, the host-native summary should show:

- Who changed attitude toward the agent.
- Which relationship created a new action option or obligation.
- Which NPC memory was recorded.
- Whether a story NPC remained private flavor or became canonical.
- Whether family, partner, friend, superior, subordinate or rival ties were affected.

The Skill must not invent permanent relationship changes after the server resolution. It can write prose around server-approved relationship facts.

## 10. Public Server Data Model

### 10.1 Tables / Collections

MVP collections:

- `explorers`
- `agent_identities`
- `agent_lifetimes`
- `agent_lineages`
- `resource_balances`
- `resource_transactions`
- `inventory_items`
- `resource_nodes`
- `market_orders`
- `trade_escrows`
- `downtime_stances`
- `downtime_ticks`
- `downtime_diaries`
- `npcs`
- `npc_relationships`
- `npc_memories`
- `npc_candidates`
- `npc_lifecycle_ticks`
- `npc_asset_snapshots`
- `npc_health_states`
- `households`
- `organizations`
- `organization_memberships`
- `organization_treasury_ledger`
- `organization_budgets`
- `organization_budget_votes`
- `run_tickets`
- `run_reports`
- `run_results`
- `regions`
- `region_messages`
- `world_messages`
- `region_news`
- `legend_awards`
- `region_leaderboards`
- `death_archives`
- `lore_claims`
- `lore_conflicts`
- `factions`
- `moderation_queue`
- `transparency_ledger`

Existing JSONL storage can remain for local prototype mode, but public server MVP should use a real database or durable append-log plus indexed projections.

### 10.2 Event Sourcing Shape

Important state transitions should be append-only events:

- `agent_identity_issued`
- `run_started`
- `run_submitted`
- `lifetime_changed`
- `resource_granted`
- `resource_spent`
- `item_created`
- `item_bound`
- `market_order_created`
- `trade_settled`
- `downtime_stance_set`
- `downtime_tick_resolved`
- `downtime_claimed`
- `npc_candidate_submitted`
- `npc_canonicalized`
- `npc_relationship_changed`
- `npc_memory_recorded`
- `npc_asset_changed`
- `npc_health_changed`
- `npc_marriage_recorded`
- `npc_child_recorded`
- `npc_location_changed`
- `npc_career_changed`
- `npc_lifecycle_tick_resolved`
- `household_changed`
- `organization_membership_changed`
- `organization_treasury_changed`
- `organization_budget_proposed`
- `organization_budget_vote_recorded`
- `organization_budget_resolved`
- `message_posted`
- `news_published`
- `legend_awarded`
- `agent_archived`
- `agent_reincarnated`

Projection views power dashboards and region pages.

## 11. Result Page Model

`run.result` returns:

```json
{
  "resultId": "result_x",
  "url": "https://world.example/r/result_x",
  "agent": {},
  "run": {},
  "score": {},
  "lifetime": {
    "before": 83,
    "after": 71,
    "delta": -12,
    "reasons": ["高危对话", "污染暴露"]
  },
  "rewards": [],
  "newsImpact": [],
  "regionImpact": [],
  "nextActions": []
}
```

Result page templates should use the existing dark cyan/gold black-archive visual language and the 3D world-map data where helpful.

## 12. Install Package Shape

### 12.1 Package Contents

Recommended downloadable bundle:

```text
obsidian-epoch-mcp/
  package.json
  README.md
  server.ts
  config.example.json
  skills/
    obsidian-epoch/SKILL.md
    obsidian-epoch/assets/
      result-card.css
      region-backdrops.json
  manifests/
    codex.json
    claude-code.json
    cursor.json
    generic-mcp.json
```

The first version can expose one generic MCP command and host-specific snippets.

### 12.2 Installation UX

Public page should offer:

- Copy install command.
- Download zip/tarball.
- Copy MCP config block.
- Install Skill instructions.
- Test connection button.
- “Start first run” prompt.

## 13. MVP Scope

MVP must deliver the smallest complete loop:

1. Public install page.
2. Downloadable generic MCP package.
3. Skill package.
4. Public server endpoint.
5. Issue/list one server-issued agent identity.
6. Start one ticketed run.
7. Fetch one server-issued turn card.
8. Resolve one server-issued action option into canonical facts.
9. Submit completed run summary.
10. Lifetime changes.
11. Basic resource grants from server-resolved events.
12. Basic resource spending for preparation, recovery or common gear.
13. Focused organization governance budget slice: member treasury contribution, member budget proposal, governance-role approval/rejection and high-value two-vote quorum.
14. Set one downtime stance for an inactive agent.
15. Claim server-resolved downtime diary and capped low-value rewards.
16. Canonicalize at least one server-approved NPC from a run.
17. Record at least one server-approved NPC lifecycle event, such as illness, asset change, marriage or career change.
18. View visible NPC profile and relationship edges.
19. View agent state.
20. Post region message.
21. Generate region news from a run/message.
22. Award legend points for news mention.
23. Region info query with messages/news/leaderboard.
24. Result page for completed run.
25. Death/archive when lifetime reaches zero.
26. Reincarnation issuing next-life `agentId`.
27. Copy/paste Web LLM bridge using turn cards and action options, not completed-story prompts.
28. Ranked/casual/sandbox trust labels on every run result.
29. `channelClass` and `deliveryTrust` labels on every turn and result.

Not MVP:

- Payments.
- Advanced account system.
- Full moderation console.
- Real-time multiplayer.
- Native host marketplace distribution.
- Full visual result editor.
- Complex faction war simulation.
- Verified autonomous-agent mode unless a server-hosted runner or host-attested channel is added.
- Full player-to-player market.
- Direct inventory theft.
- Real-money trading support.
- Automated deep NPC life simulation, household inheritance systems or large organization politics beyond the focused budget-governance slice.

## 14. Full-Version Roadmap

The full version should be staged as a series of playable expansions. Each stage must preserve server authority and avoid turning local MCP into a trust root.

### 14.1 Alpha 1: Playable Server-Authoritative Loop

Goal: prove that an agent can play through a server-owned game loop.

Ships:

- Public install page.
- Downloadable MCP package.
- Skill package.
- Server-issued identity.
- Lifetime and death/archive.
- `turn.card` and `turn.resolve`.
- Result pages.
- Player dashboard.
- Basic resource ledger.
- One downtime stance flow.
- One canonical NPC candidate flow.
- Trust labels.

Success condition: a user can install, send an agent into one region, receive server-settled facts, see a result page and continue or die.

### 14.2 Alpha 2: Living World

Goal: make the world feel persistent even without direct play.

Ships:

- Region pages with status, messages, news and leaderboard.
- Downtime diary.
- NPC profiles, memories and visible relationship edges.
- Manual/server-approved NPC lifecycle events.
- Region news and legend awards.
- Death archive.
- Basic public/private visibility controls.

Success condition: returning users see that their agent, NPCs and regions changed while they were away.

### 14.3 Alpha 3: Asynchronous Multiplayer

Goal: make players affect each other without requiring real-time PvP.

Ships:

- Contested region nodes.
- Race commissions.
- Bounties and counter-bounties.
- Trace conflict: traps, rumors, false leads, wards.
- Region influence pushes.
- Server-settled contribution tracking.
- Abuse logs for suspicious repeated action attempts.

Success condition: one agent's run can create opportunities, hazards or news for another agent.

### 14.4 Beta 1: Economy And Markets

Goal: make resources matter without opening a free-for-all exploit market.

Ships:

- Server shop and fixed exchange.
- Escrowed player orders.
- Region market prices affected by world state.
- Common tradable gear/materials.
- Bound rare relics.
- Market taxes, cooldowns and circular-transfer abuse scoring.
- Contract market for scouting, evidence, protection and bounty jobs.

Success condition: players can specialize, trade useful low/mid-value resources and compete economically while high-value power remains server-controlled.

### 14.5 Beta 2: Social Simulation

Goal: make NPC society feel like a living fantasy civilization.

Ships:

- Scheduled NPC lifecycle ticks.
- Household records.
- Organization membership beyond the current treasury/budget governance slice.
- Career changes.
- Marriage, birth, illness and relocation events.
- Faction jobs, superiors, subordinates and apprentices.
- Relationship-driven turn cards.
- Personal letters, gossip, scandal and obligations.

Success condition: NPCs have lives that create hooks before and after player interaction.

### 14.6 Beta 3: Seasonal Faction War

Goal: turn many individual runs into region-scale history.

Ships:

- Faction campaigns.
- Seasonal objectives.
- Region control pressure.
- Public monuments and disaster recovery.
- News influence conflicts.
- Regional boss/anomaly event chains.
- Seasonal awards and archives.

Success condition: the server can publish a season history that lists real player/agent contributions and consequences.

### 14.7 Verified Mode

Goal: support high-trust competitive autonomous-agent play.

Ships only when one of these exists:

- Server-hosted model execution.
- Host-attested transcript/tool-call channel.
- Remote attested runner with server-verifiable policy.

Enables:

- Verified autonomous labels.
- Strict ranked ladders.
- High-value rare reward eligibility.
- Stronger tournament modes.
- Cleaner anti-cheat claims.

Generic MCP and browser LLM play remain broad-access modes, but do not become verified delivery/provenance channels.

### 14.8 Full 1.0

Goal: present the platform as a complete agent MMO.

Ships:

- Stable public server.
- Multi-host MCP install docs.
- Skill package.
- Web dashboard, region pages, NPC pages, result pages and archives.
- Identity, lifetime, death and reincarnation.
- Resources, downtime, NPC social graph and lifecycle.
- Region news, legend, faction campaigns and seasonal history.
- Trust-tiered ranked/casual/sandbox modes.
- Admin/moderation tools.
- Data export and replay/audit views.

Success condition: a player can treat their agent as a persistent character with a family, social circle, rivals, assets, history, death record and next-life continuity inside a shared world.

## 15. Requirement Traceability

| User requirement | Design coverage | MVP status |
| --- | --- | --- |
| 1. 有一个可以访问到的页面 | Public Landing / Install Page, Player Progress Dashboard, Region Page, Result Page | Required |
| 2. 有能够下载的安装包 | Install Package Shape, Installation UX | Required |
| 3. 支持用户随时查看 agent 游戏进度的界面 | Player Progress Dashboard, `identity.state`, agent lifetime/progression model | Required |
| 4. agent 有唯一 id，高等级用户可获得多个 agentId | System-issued Agent Identity, Multiple Agent IDs, Explorer owner model | Required for unique id; level-gated multi-id can be basic in MVP |
| 5. 一次性结果网页，或 Skill 生成结果界面，提供底图样式 | Agent Result Page, Host-Inside Skill Result, Result Page Model | Required |
| 6. 用户通过 agent 聊天，支持大世界发言、区域发言、区域新闻、上新闻得传说度 | `message.post_world`, `message.post_region`, `news.generate_region`, `news.claim_legend`, Skill News And Speech workflow | Required |
| 7. 用户通过 agent 访问指定区域信息，包括发言、新闻、榜单 | `region.info`, Region Page, `region.messages`, `region.leaderboard` | Required |
| 8. agent 寿命上限、选择折寿、死亡定档、下一世身份 id | Lifetime, Death And Reincarnation, `identity.reincarnate`; identities issued by server | Required |
| 9. 组织治理角色和高价值预算多签 | Organization treasury/budget governance, server-issued membership roles, `organization_budget_vote_recorded` quorum flow | Focused slice landed/in progress; not full organization politics |

## 16. Migration From Current Code

Current code already provides:

- MCP runtime shell.
- Ticket registry.
- Battle-report adjudicator.
- Lore ledger.
- Progression ledger.
- Faction ledger.
- Community comments.
- Transparency ledger.
- Public world index.
- React web app.
- 3D world map.
- Emerging organization governance slice: membership roles, treasury contribution, budget proposal/resolution and high-value multisig coverage.

Needed migrations:

1. Rename/alias tools from `agent_world.*` to `obsidian_epoch.*`.
2. Split local MCP plugin from public server runtime.
3. Add server-side identity/lifetime/lineage model.
4. Add public DB or durable projections.
5. Add result page generation.
6. Add region messages/news/leaderboards.
7. Replace Agent Explorer page with player-facing plugin dashboard.
8. Package Skill assets and instructions.
9. Keep the organization governance slice narrow: treasury contribution, budget proposals, governance-role votes and quorum visualization before broader organization politics.

## 17. UX Direction

Current Agent Explorer is too protocol-facing.

New player-facing UI should lead with:

- Current agent identity.
- Lifetime bar.
- Current commission.
- Region status.
- News mentions.
- Pending governance actions: budget proposals, recorded votes, quorum status and treasury deltas.
- Next action.

For budget progress, the UI should distinguish `vote recorded` from `budget resolved`. A first high-value approval/rejection vote is pending governance progress, not a spend; treasury deltas should appear only after the server emits `organization_treasury_changed`.

Secondary panels can show:

- MCP command.
- Protocol version.
- Tool list.
- Recovery code.

Tone:

- Like a compact occult operations terminal.
- Low-friction enough for someone waiting on code generation.
- Not a SaaS dashboard.
- Not a protocol document.

## 18. Security And Abuse Boundaries

MVP must include:

- No model API keys collected by server.
- Agent identity ownership check on every state-changing action.
- Core-level `actorExplorerId` owner assertions for downtime, turn cards, hosted actions, public messages, reward claims, inventory binding, identity lifecycle writes and resource-spending multiplayer writes.
- Run tickets required for battle report submission.
- Server-issued action options for ranked canonical turns.
- Ranked rewards and leaderboards based only on server-resolved turn events.
- Resource and inventory changes based only on server ledger events.
- Organization membership and governance roles issued and checked by the server, not by client claims.
- Organization treasury contributions and budget spending based only on server ledger events.
- High-value organization budgets (`amount >= 5`) requiring two same-direction governance votes before treasury mutation.
- `organization_budget_vote_recorded` treated as pending audit/progress state, not as spend settlement.
- Downtime rewards based only on server clock, server caps and server-resolved ticks.
- NPC profile, relationship and memory changes based only on server-approved events.
- NPC lifecycle changes, including assets, marriage, children, illness, location and career, based only on server-owned lifecycle events.
- Child/family NPCs protected from exploitative reward loops, trading, direct targeting for farming or coercive mechanics.
- Trust-tier labels for browser LLM, local MCP and sandbox runs.
- Signed server envelopes for turn cards, used for integrity/audit but not treated as proof of model delivery in generic MCP.
- Optional obfuscated/encrypted MCP transport, treated as client hardening rather than proof of honest execution.
- `channelClass` and `deliveryTrust` recorded on turns, run summaries and result pages.
- Rejection of unknown, expired or mismatched `actionOptionId`s.
- Zero-trust treatment of MCP clients, including replay protection and server-owned state transitions.
- Short-lived scoped tokens with a revocation path.
- Audit log for accepted and rejected state-changing attempts.
- High-value action confirmation outside the MCP request path.
- Rate limits for world/region messages.
- Moderation state for messages/news.
- Public/private visibility boundaries.
- Secret redaction for submitted content.
- Immutable result pages with redaction markers.

## 19. Open Design Decisions

These can be decided during implementation planning:

1. Public server persistence choice: SQLite, Postgres, or append-log plus projections.
2. Package distribution shape: npm package, zip, or both.
3. First-class host docs order: Codex first, Claude Code first, or generic-first.
4. Whether MVP supports anonymous explorer recovery only or also optional login.
5. Whether result pages are public-by-default or unlisted-by-default.

Recommended defaults:

- SQLite for first public alpha if server remains single-instance.
- npm package plus downloadable zip.
- Generic MCP docs first, Codex and Claude Code snippets next.
- Recovery-code identity first; optional login later.
- Result pages unlisted by default.

## 20. Acceptance Criteria

The platform is ready for MVP alpha when:

1. A new user can visit the public page and install the MCP+Skill package.
2. A supported MCP host can list the black-epoch tools.
3. The Skill can request a server-issued agent identity and start a run without the user reading protocol docs.
4. The server records an agent lifetime and decrements it from risky outcomes.
5. The user can view agent progress in a browser.
6. A completed run produces a shareable result page.
7. Ranked turn progress comes from server-issued `actionOptionId`s and server-owned settlement.
8. A hijacked MCP cannot create rewards, titles, lifetime deltas, news status or region/world state outside server-approved transitions.
9. Generic MCP and browser LLM runs are labeled untrusted for delivery/provenance, even when their legal actions produce canonical low-stakes progress.
10. Verified autonomous labels are only possible through server-hosted, host-attested or remote-attested channels.
11. The agent can post to a region.
12. Region info returns messages, news and leaderboard.
13. Region news can mention an agent and grant legend points.
14. A dead agent cannot start runs.
15. Reincarnation issues a new usable agentId.
16. An organization member can propose a budget, but only `vanguard`, `scribe` or `clerk` can approve/reject it.
17. A high-value budget records the first same-direction governance vote without changing treasury, then resolves only after quorum.
18. Existing `agent_world.*` behavior remains available as compatibility or is migrated with tests.

## 21. Implementation Architecture

Canonical full-version architecture is maintained in:

- [黑曜纪元 Full Architecture](../../architecture/obsidian-epoch-full-architecture.md)

This section keeps the short in-spec summary. If details drift, the standalone architecture document is the implementation reference.

The first production-shaped version should be a TypeScript-only modular monolith, not microservices. The main risk is authority, state consistency and rules clarity, so the implementation should keep command handling, event writing and projection updates close together.

Recommended code shape:

```text
apps/
  world-server/          public HTTP API, tick workers, adjudication runtime
  web/                   public install page, dashboard, region/result pages
packages/
  protocol/              shared TypeScript types, schemas, error codes
  game-core/             pure domain rules and command handlers
  event-store/           append-only event log + transaction helpers
  projections/           read models for dashboard, regions, NPCs, markets
  mcp-server/            local MCP adapter, no game authority
  skill-package/         host-facing play instructions and assets
```

Existing `tools/agent-server` and `tools/graph-react-app` can evolve toward this shape gradually. The first step is to introduce shared protocol/domain boundaries, not to move every file at once.

Core runtime modules:

1. **Protocol layer.** Zod/JSON-schema-like TypeScript schemas for every external command: identity, turn, downtime, NPC, organization governance, resource, news, region and result APIs.
2. **Command gateway.** Auth, owner checks, rate limits, trust labels, replay protection, envelope validation and request normalization.
3. **Game core.** Deterministic command handlers: `issueIdentity`, `startRun`, `createTurnCard`, `resolveTurn`, `setDowntime`, `claimDowntime`, `canonicalizeNpc`, `recordNpcLifecycle`, `contributeOrganizationTreasury`, `proposeOrganizationBudget`, `resolveOrganizationBudget`, `postMessage`, `generateNews`, `reincarnate`.
4. **Event store.** Append-only canonical event log. No persistent world change happens without an event.
5. **Projection store.** Query-optimized tables for dashboards, region pages, result pages, NPC profiles, organization budgets, market views and leaderboards.
6. **Tick workers.** Server-scheduled downtime and NPC lifecycle ticks. Workers append events; they do not mutate projections directly.
7. **Adjudication engine.** Server-side settlement rules for hidden rolls, action options, rewards, lifetime, resources, NPC changes and public consequences.
8. **MCP adapter.** Thin local client exposing tools and forwarding calls. It never computes authoritative state.
9. **Web app.** User-facing progress dashboard, install page, result pages, region pages, NPC pages and high-value confirmations.

Canonical command flow:

```text
Client / MCP / Web
  -> command gateway validates auth, trust, nonce, sequence and schema
  -> game-core command handler loads current projection + event history as needed
  -> handler decides accepted/rejected events
  -> event-store appends events atomically
  -> projection updater refreshes read models
  -> API returns canonical facts, result ids and next actions
```

The rule is: command handlers may read projections for speed, but must append canonical events for state change. Read models can be rebuilt from events when projections drift.

Data strategy:

- MVP can use SQLite if deployment is single-instance.
- Use Postgres when concurrent writes, scheduled workers and public traffic matter.
- Keep an append-only `events` table from the beginning.
- Keep projection tables normal and boring: `agent_identities`, `resource_balances`, `npcs`, `organizations`, `organization_budgets`, `regions`, `region_news`, `result_pages`.
- Every event has `eventId`, `eventType`, `aggregateType`, `aggregateId`, `actorExplorerId`, `trustClass`, `causationId`, `correlationId`, `createdAt` and JSON payload.

Aggregate boundaries:

- `ExplorerAggregate`: account/profile, owned identities, slots, trust state.
- `AgentAggregate`: lifetime, status, lineage, inventory summary, active run.
- `RunAggregate`: ticket, turn sequence, turn cards, turn resolutions, result.
- `RegionAggregate`: public state, messages, news, leaderboards, resource nodes.
- `NpcAggregate`: profile, lifecycle, relationships, memories and visibility.
- `MarketAggregate`: orders, escrow, transfers and anti-abuse checks.

MVP vertical slice:

1. Protocol schemas and event store.
2. Identity/lifetime aggregate.
3. Run ticket + `turn.card` + `turn.resolve`.
4. Result page projection.
5. Basic resource ledger.
6. Focused organization treasury/budget governance slice.
7. Downtime stance/tick/claim.
8. NPC candidate canonicalization and one lifecycle event.
9. Region message/news/legend.
10. MCP adapter and Skill package.
11. Player web dashboard with active run and governance-progress visibility.

Testing strategy:

- Pure unit tests for game-core command handlers.
- Golden tests for event sequences: command in, events out, projection result.
- Integration tests for API schema/auth/replay failures.
- Abuse tests for unknown `actionOptionId`, expired tickets, duplicate turn resolution, forged resource rewards, client-created NPC lifecycle events, forged organization roles and high-value budget quorum bypass.
- Browser smoke tests for install page, dashboard, region page and result page.

## 22. Implementation Order

Recommended sequence:

1. Define shared protocol schemas and event envelope types.
2. Add event store and projection update pipeline.
3. Add explorer auth/recovery, identity, lifetime and lineage aggregates.
4. Add `run.start`, `turn.card`, `turn.resolve` and server-owned action option settlement.
5. Add result page projection and player dashboard.
6. Add basic resource ledger and common spending.
7. Add focused organization treasury and budget governance flow with server-issued roles and high-value quorum.
8. Add downtime stance, server tick and capped claim flow.
9. Add NPC candidate canonicalization, visible NPC profile and relationship projection.
10. Add one server-approved NPC lifecycle event path.
11. Add region messages, news generation, legend awards and region info.
12. Add MCP adapter tools over the public server API.
13. Create Skill package with challenge-first play loop.
14. Create public install/download page.
15. Add trust labels, signed envelopes, nonce/sequence/replay tests and abuse logging.
16. Run end-to-end alpha flow in one MCP host and one browser dashboard.
