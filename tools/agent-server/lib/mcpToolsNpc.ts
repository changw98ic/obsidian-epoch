/**
 * NPC / organization / household / social-hook MCP tool handlers, extracted
 * from mcpTools.ts.
 *
 * `registerNpcHandlers` adds all NPC and organization tool entries to the
 * shared handler Map.  Every handler is a thin delegate to the corresponding
 * `runtime.epochXxx(args)` method -- no helper closures are needed because
 * NPC tools do not carry complex transport or persistence wrappers.
 */

type AnyRecord = Record<string, unknown>;

// ── NPC / organization tool names ────────────────────────────────────

export const NPC_TOOL_NAMES: readonly string[] = [
  "obsidian_epoch.npc_relationships",
  "obsidian_epoch.agent_npc_bonds",
  "obsidian_epoch.update_agent_npc_bond",
  "obsidian_epoch.npc_memories",
  "obsidian_epoch.households",
  "obsidian_epoch.organizations",
  "obsidian_epoch.create_organization",
  "obsidian_epoch.update_organization_membership",
  "obsidian_epoch.purchase_organization_upgrade",
  "obsidian_epoch.contribute_organization_treasury",
  "obsidian_epoch.propose_organization_budget",
  "obsidian_epoch.resolve_organization_budget",
  "obsidian_epoch.organization_politics",
  "obsidian_epoch.tick_organization_politics",
  "obsidian_epoch.npc_careers",
  "obsidian_epoch.npc_locations",
  "obsidian_epoch.npc_assets",
  "obsidian_epoch.npc_health",
  "obsidian_epoch.social_hooks",
  "obsidian_epoch.npc_note",
  "obsidian_epoch.submit_npc_candidate",
  "obsidian_epoch.review_npc_candidate",
  "obsidian_epoch.tick_npc_lifecycle",
];

// ── Minimal runtime interface for the NPC delegates ───────────────────

interface NpcRuntime {
  epochNpcRelationships(args: AnyRecord): unknown;
  epochAgentNpcBonds(args: AnyRecord): unknown;
  epochUpdateAgentNpcBond(args: AnyRecord): unknown;
  epochNpcMemories(args: AnyRecord): unknown;
  epochHouseholds(args: AnyRecord): unknown;
  epochOrganizations(args: AnyRecord): unknown;
  epochCreateOrganization(args: AnyRecord): unknown;
  epochUpdateOrganizationMembership(args: AnyRecord): unknown;
  epochPurchaseOrganizationUpgrade(args: AnyRecord): unknown;
  epochContributeOrganizationTreasury(args: AnyRecord): unknown;
  epochProposeOrganizationBudget(args: AnyRecord): unknown;
  epochResolveOrganizationBudget(args: AnyRecord): unknown;
  epochOrganizationPolitics(args: AnyRecord): unknown;
  epochTickOrganizationPolitics(args: AnyRecord): unknown;
  epochNpcCareers(args: AnyRecord): unknown;
  epochNpcLocations(args: AnyRecord): unknown;
  epochNpcAssets(args: AnyRecord): unknown;
  epochNpcHealth(args: AnyRecord): unknown;
  epochSocialHooks(args: AnyRecord): unknown;
  epochNpcNote(args: AnyRecord): unknown;
  epochSubmitNpcCandidate(args: AnyRecord): unknown;
  epochReviewNpcCandidate(args: AnyRecord): unknown;
  epochTickNpcLifecycle(args: AnyRecord): unknown;
}

// ── Registration ─────────────────────────────────────────────────────

export function registerNpcHandlers(
  handlers: Map<string, (args: AnyRecord) => unknown>,
  runtime: NpcRuntime,
): void {
  // NPC relationships / bonds / memories.
  handlers.set("obsidian_epoch.npc_relationships", (args) => runtime.epochNpcRelationships(args));
  handlers.set("obsidian_epoch.agent_npc_bonds", (args) => runtime.epochAgentNpcBonds(args));
  handlers.set("obsidian_epoch.update_agent_npc_bond", (args) => runtime.epochUpdateAgentNpcBond(args));
  handlers.set("obsidian_epoch.npc_memories", (args) => runtime.epochNpcMemories(args));

  // Households.
  handlers.set("obsidian_epoch.households", (args) => runtime.epochHouseholds(args));

  // Organizations.
  handlers.set("obsidian_epoch.organizations", (args) => runtime.epochOrganizations(args));
  handlers.set("obsidian_epoch.create_organization", (args) => runtime.epochCreateOrganization(args));
  handlers.set("obsidian_epoch.update_organization_membership", (args) => runtime.epochUpdateOrganizationMembership(args));
  handlers.set("obsidian_epoch.purchase_organization_upgrade", (args) => runtime.epochPurchaseOrganizationUpgrade(args));
  handlers.set("obsidian_epoch.contribute_organization_treasury", (args) => runtime.epochContributeOrganizationTreasury(args));
  handlers.set("obsidian_epoch.propose_organization_budget", (args) => runtime.epochProposeOrganizationBudget(args));
  handlers.set("obsidian_epoch.resolve_organization_budget", (args) => runtime.epochResolveOrganizationBudget(args));
  handlers.set("obsidian_epoch.organization_politics", (args) => runtime.epochOrganizationPolitics(args));
  handlers.set("obsidian_epoch.tick_organization_politics", (args) => runtime.epochTickOrganizationPolitics(args));

  // NPC detail queries.
  handlers.set("obsidian_epoch.npc_careers", (args) => runtime.epochNpcCareers(args));
  handlers.set("obsidian_epoch.npc_locations", (args) => runtime.epochNpcLocations(args));
  handlers.set("obsidian_epoch.npc_assets", (args) => runtime.epochNpcAssets(args));
  handlers.set("obsidian_epoch.npc_health", (args) => runtime.epochNpcHealth(args));

  // Social hooks.
  handlers.set("obsidian_epoch.social_hooks", (args) => runtime.epochSocialHooks(args));

  // NPC lifecycle / candidate management.
  handlers.set("obsidian_epoch.npc_note", (args) => runtime.epochNpcNote(args));
  handlers.set("obsidian_epoch.submit_npc_candidate", (args) => runtime.epochSubmitNpcCandidate(args));
  handlers.set("obsidian_epoch.review_npc_candidate", (args) => runtime.epochReviewNpcCandidate(args));
  handlers.set("obsidian_epoch.tick_npc_lifecycle", (args) => runtime.epochTickNpcLifecycle(args));
}
