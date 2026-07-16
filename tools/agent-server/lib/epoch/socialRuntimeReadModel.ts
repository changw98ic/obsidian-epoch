import type {
  EpochDiplomacyRecord,
  EpochProjection,
} from "./gameCore.ts";
import { diplomacyView } from "./organizationReadModel.ts";
import { relationshipsView, type EpochRelationshipEdgeView } from "./relationshipReadModel.ts";
import { canonicalRegionIdFromInput } from "./runtimeInputRules.ts";

type AnyRecord = Record<string, unknown>;

export interface EpochRelationshipGraphInfo {
  readonly agentId?: string;
  readonly kind?: string;
  readonly relationships: readonly EpochRelationshipEdgeView[];
}

export interface EpochDiplomacyInfo {
  readonly regionId?: string;
  readonly agentId?: string;
  readonly status?: string;
  readonly diplomacy: readonly EpochDiplomacyRecord[];
}

export function relationshipsInfoView(
  projection: EpochProjection,
  input: AnyRecord = {},
): EpochRelationshipGraphInfo {
  return {
    agentId: typeof input.agentId === "string" ? input.agentId : undefined,
    kind: typeof input.kind === "string" ? input.kind : undefined,
    relationships: relationshipsView(projection, {
      agentId: typeof input.agentId === "string" ? input.agentId : undefined,
      kind: typeof input.kind === "string" ? input.kind : undefined,
    }),
  };
}

export function diplomacyInfoView(
  projection: EpochProjection,
  input: AnyRecord = {},
): EpochDiplomacyInfo {
  return {
    regionId: typeof input.regionId === "string" ? input.regionId : undefined,
    agentId: typeof input.agentId === "string" ? input.agentId : undefined,
    status: typeof input.status === "string" ? input.status : undefined,
    diplomacy: diplomacyView(projection, {
      regionId: canonicalRegionIdFromInput(input.regionId),
      agentId: typeof input.agentId === "string" ? input.agentId : undefined,
      status: typeof input.status === "string" ? input.status : undefined,
    }),
  };
}
