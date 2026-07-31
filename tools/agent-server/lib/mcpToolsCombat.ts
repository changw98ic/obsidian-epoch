/**
 * Combat / raid / diplomacy MCP tool handlers, extracted from mcpTools.ts.
 *
 * `registerCombatHandlers` adds all combat, raid, diplomacy, relationship,
 * and turn-card tool entries to the shared handler Map.  Every handler is a
 * thin delegate to the corresponding `runtime.epochXxx(args)` method -- the
 * operation-switch gate and public-safety checks are already baked into the
 * runtime methods.
 */

type AnyRecord = Record<string, unknown>;

// ── Combat tool names ─────────────────────────────────────────────

export const COMBAT_TOOL_NAMES: readonly string[] = [
  "obsidian_epoch.raids",
  "obsidian_epoch.resolve_raid",
  "obsidian_epoch.resolve_region_revolt",
  "obsidian_epoch.resolve_retaliation",
  "obsidian_epoch.relationship_graph",
  "obsidian_epoch.diplomacy",
  "obsidian_epoch.propose_diplomacy",
  "obsidian_epoch.respond_diplomacy",
  "obsidian_epoch.update_relationship",
  "obsidian_epoch.turn_card",
  "obsidian_epoch.resolve_turn",
];

// ── Minimal runtime interface for the combat delegates ────────────

interface CombatRuntime {
  epochRaids(args: AnyRecord): unknown;
  epochResolveRaid(args: AnyRecord): unknown;
  epochResolveRegionRevolt(args: AnyRecord): unknown;
  epochResolveRetaliation(args: AnyRecord): unknown;
  epochRelationships(args: AnyRecord): unknown;
  epochDiplomacy(args: AnyRecord): unknown;
  epochProposeDiplomacy(args: AnyRecord): unknown;
  epochRespondDiplomacy(args: AnyRecord): unknown;
  epochUpdateRelationship(args: AnyRecord): unknown;
  epochTurnCard(args: AnyRecord): unknown;
  epochResolveTurn(args: AnyRecord): unknown;
}

// ── Registration ──────────────────────────────────────────────────

export function registerCombatHandlers(
  handlers: Map<string, (args: AnyRecord) => unknown>,
  runtime: CombatRuntime,
): void {
  // Raid handlers.
  handlers.set("obsidian_epoch.raids", (args) => runtime.epochRaids(args));
  handlers.set("obsidian_epoch.resolve_raid", (args) => runtime.epochResolveRaid(args));
  handlers.set("obsidian_epoch.resolve_region_revolt", (args) => runtime.epochResolveRegionRevolt(args));
  handlers.set("obsidian_epoch.resolve_retaliation", (args) => runtime.epochResolveRetaliation(args));

  // Relationship & diplomacy handlers.
  handlers.set("obsidian_epoch.relationship_graph", (args) => runtime.epochRelationships(args));
  handlers.set("obsidian_epoch.diplomacy", (args) => runtime.epochDiplomacy(args));
  handlers.set("obsidian_epoch.propose_diplomacy", (args) => runtime.epochProposeDiplomacy(args));
  handlers.set("obsidian_epoch.respond_diplomacy", (args) => runtime.epochRespondDiplomacy(args));
  handlers.set("obsidian_epoch.update_relationship", (args) => runtime.epochUpdateRelationship(args));

  // Turn-card handlers.
  handlers.set("obsidian_epoch.turn_card", (args) => runtime.epochTurnCard(args));
  handlers.set("obsidian_epoch.resolve_turn", (args) => runtime.epochResolveTurn(args));
}
