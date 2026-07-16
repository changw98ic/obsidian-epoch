import {
  normalizeTrustClass,
  type EpochCommandContext,
  type EpochTrustClass,
} from "./protocol.ts";

export interface IdentityOwnerForAuthorizationRules {
  readonly explorerId: string;
}

export const SERVER_ACTOR_OWNER_BYPASS_TRUST_CLASSES: ReadonlySet<EpochTrustClass> = new Set([
  "server_hosted_agent",
  "host_attested",
  "remote_attested_runner",
  "system_worker",
]);

export function assertIdentityOwner(
  identity: IdentityOwnerForAuthorizationRules,
  context: EpochCommandContext,
  errorCode: string,
): void {
  if (context.actorExplorerId !== identity.explorerId) throw new Error(errorCode);
}

export function assertUserVerifiedIdentityOwner(
  identity: IdentityOwnerForAuthorizationRules,
  context: EpochCommandContext,
  trustClass: EpochTrustClass,
  errorCode: string,
): void {
  if (trustClass === "user_verified_web") assertIdentityOwner(identity, context, errorCode);
}

export function assertClientIdentityOwner(
  identity: IdentityOwnerForAuthorizationRules,
  context: EpochCommandContext,
  errorCode: string,
): void {
  const trustClass = normalizeTrustClass(context.trustClass);
  if (!SERVER_ACTOR_OWNER_BYPASS_TRUST_CLASSES.has(trustClass)) {
    assertIdentityOwner(identity, context, errorCode);
  }
}

export function assertIdentityOwnerOrSystemWorker(
  identity: IdentityOwnerForAuthorizationRules,
  context: EpochCommandContext,
  errorCode: string,
): void {
  if (normalizeTrustClass(context.trustClass) !== "system_worker") {
    assertIdentityOwner(identity, context, errorCode);
  }
}
