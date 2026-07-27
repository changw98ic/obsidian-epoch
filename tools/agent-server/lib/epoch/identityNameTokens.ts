/**
 * identityNameTokens.ts — system identity-name token tables + deterministic slice.
 *
 * Single source of truth for the origin/unit/role tokens that runtime's
 * `systemAssignedIdentityName` bakes into every system-assigned identity name,
 * AND for the deterministic slice algorithm that selects those tokens from
 * `sha256(explorerId:generation)`.
 *
 * Why this module exists:
 *  - PR5b roleplay-pattern generator
 *    (`journeyRoleplayRules.buildExpectedLifePattern`) must RE-DERIVE the
 *    same origin/unit/role tokens from `(explorerId, generation)` to assemble
 *    the roleplay norm. Duplicating the tables inside the roleplay module
 *    would create silent drift; centralising them here keeps the two call
 *    sites byte-identical so the pattern bytes never diverge from the
 *    identity name.
 *  - Any change to the tables OR the slice algorithm changes the
 *    roleplay-pattern bytes for every identity, so
 *    {@link ROLEPLAY_PATTERN_VERSION} in journeyRoleplayRules MUST bump in
 *    lockstep. The `inputHash` audit on the pattern lets replays detect a
 *    divergence if the bump is ever forgotten.
 *
 * Zero behavior change vs. the previous inline consts in runtime.ts: the
 * identityName produced by runtime's `systemAssignedIdentityName` is
 * byte-identical before and after the refactor.
 */

import { sha256Hex } from "./runtimeAuth.ts";

/**
 * System identity origins — the geocultural "birthplace" token baked into
 * every system-assigned identity name. Order matters: the slice algorithm
 * indexes into this array by `sha256(explorerId:generation)` and the index
 * is taken modulo the array length.
 *
 * Changing this array (member set OR order) MUST bump
 * {@link ROLEPLAY_PATTERN_VERSION} in journeyRoleplayRules and re-issue every
 * identity's roleplay pattern. Otherwise the pattern bytes drift away from
 * the identity name and the inputHash audit becomes meaningless.
 */
export const SYSTEM_IDENTITY_ORIGINS = [
  "雾钟站", "黑石码头", "镜湖工坊", "赤砂哨所", "北墙温室", "星槎坞",
  "旧渠", "风蚀塔", "浮桥集市", "月井营地", "灰烬观测站", "回声仓城",
] as const;

/**
 * System identity units — the organisational "squad" token. Same invariants
 * as {@link SYSTEM_IDENTITY_ORIGINS}: changing member set OR order MUST bump
 * {@link ROLEPLAY_PATTERN_VERSION}.
 */
export const SYSTEM_IDENTITY_UNITS = [
  "第七采样组", "夜航班", "边界测绘队", "临时实验组", "外勤救援队", "遗迹勘探组",
  "生态观察班", "城外猎行队", "补给调度组", "设备检修班", "入门试炼营", "数据校准所",
] as const;

/**
 * System identity roles — the occupational "role" token. Same invariants as
 * {@link SYSTEM_IDENTITY_ORIGINS}. Drives the first-version roleplay-rule
 * template in
 * `journeyRoleplayRules.deriveRoleplayTagsFromTokens` (keyword match against
 * the role token decides which approach bucket the pattern freezes).
 */
export const SYSTEM_IDENTITY_ROLES = [
  "见习记录员", "样本护送员", "设备检修员", "外勤助理", "试炼候补", "变异兽猎手",
  "数据校准员", "药圃照料员", "补给联络员", "遗迹勘探员", "安全观察员", "生态采样员",
] as const;

/**
 * Result of {@link extractOriginUnitRole}. The three tokens runtime's
 * `systemAssignedIdentityName` concatenates to form the identity name, and
 * the roleplay-pattern generator inspects to build the roleplay norm.
 */
export interface OriginUnitRoleTokens {
  readonly origin: string;
  readonly unit: string;
  readonly role: string;
}

/**
 * Deterministic slice of (origin, unit, role) from
 * `sha256(explorerId:generation)`. Reproduces the exact algorithm previously
 * inlined in runtime's `systemAssignedIdentityName` so the roleplay-pattern
 * generator can re-derive the same tokens without crossing the pure-function
 * boundary.
 *
 * Algorithm (FROZEN — change MUST bump {@link ROLEPLAY_PATTERN_VERSION}):
 *   digest = sha256Hex(`${explorerId}:${generation}`)  // 64-char hex
 *   origin = ORIGINS[ parseInt(digest[0..8],  16) % ORIGINS.length ]
 *   unit   = UNITS[   parseInt(digest[8..16], 16) % UNITS.length   ]
 *   role   = ROLES[   parseInt(digest[16..24],16) % ROLES.length   ]
 *
 * Pure: same inputs → same output. No IO, no gameCore import. The output is
 * always non-`undefined` because the slice indices are reduced modulo the
 * array length, which guarantees a valid index for any non-empty digest.
 */
export function extractOriginUnitRole(
  explorerId: string,
  generation: number,
): OriginUnitRoleTokens {
  if (typeof explorerId !== "string" || explorerId.length === 0) {
    throw new Error("identity_name_tokens_empty_explorer_id");
  }
  if (!Number.isInteger(generation) || generation < 0) {
    throw new Error(`identity_name_tokens_invalid_generation:${String(generation)}`);
  }
  const digest = sha256Hex(`${explorerId}:${generation}`);
  const origin = SYSTEM_IDENTITY_ORIGINS[Number.parseInt(digest.slice(0, 8), 16) % SYSTEM_IDENTITY_ORIGINS.length]!;
  const unit = SYSTEM_IDENTITY_UNITS[Number.parseInt(digest.slice(8, 16), 16) % SYSTEM_IDENTITY_UNITS.length]!;
  const role = SYSTEM_IDENTITY_ROLES[Number.parseInt(digest.slice(16, 24), 16) % SYSTEM_IDENTITY_ROLES.length]!;
  return { origin, unit, role };
}
