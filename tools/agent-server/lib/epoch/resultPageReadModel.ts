import type {
  EpochResultPagePayload,
  EpochSharedResultPage,
  EpochWorldOverviewRecentResult,
} from "./runtime.ts";
import { buildEpochGameRunReadModelForResultPage } from "./gameRunReadModel.ts";
import type { EpochResultPagePhase6Sidecar, EpochResultPageReceiptWithPhase6 } from "./resultPageReceiptRules.ts";
import { storedResultPageShareVersion } from "./resultPageRuntimeRules.ts";

export interface EpochResultPageReadModel {
  readonly size: number;
  get(pageId: string): EpochSharedResultPage | undefined;
  set(pageId: string, page: EpochSharedResultPage): void;
  values(): IterableIterator<EpochSharedResultPage>;
  phase6Sidecar(pageId: string): EpochResultPagePhase6Sidecar | undefined;
  recentResults(input: {
    readonly limit: number;
    readonly isExpired: (page: EpochSharedResultPage) => boolean;
  }): readonly EpochWorldOverviewRecentResult[];
}

function hasResultPagePayload(
  page: EpochSharedResultPage,
): page is EpochSharedResultPage & { readonly payload: EpochResultPagePayload } {
  return Boolean(page.payload);
}

function hasCanonicalResultPagePayload(
  page: EpochSharedResultPage,
): page is EpochSharedResultPage & { readonly payload: EpochResultPagePayload } {
  return hasResultPagePayload(page) && Boolean(page.payload.receipt);
}

function resultPagePhase6Sidecar(page: EpochSharedResultPage | undefined): EpochResultPagePhase6Sidecar | undefined {
  if (!page || !hasResultPagePayload(page)) return undefined;
  return (page.payload.receipt as EpochResultPageReceiptWithPhase6 | undefined)?.phase6;
}

export function createEpochResultPageReadModel(
  initialPages: readonly EpochSharedResultPage[] = [],
  assertPage: (page: EpochSharedResultPage) => void = () => undefined,
): EpochResultPageReadModel {
  const pagesById = new Map<string, EpochSharedResultPage>();

  for (const page of initialPages) {
    assertPage(page);
    const current = pagesById.get(page.pageId);
    if (!current || storedResultPageShareVersion(page) > storedResultPageShareVersion(current)) {
      pagesById.set(page.pageId, page);
    }
  }

  return {
    get size() {
      return pagesById.size;
    },
    get(pageId) {
      return pagesById.get(pageId);
    },
    set(pageId, page) {
      if (!pageId || pageId !== page.pageId) throw new Error("result_page_page_id_mismatch");
      assertPage(page);
      pagesById.set(pageId, page);
    },
    values() {
      return pagesById.values();
    },
    phase6Sidecar(pageId) {
      return resultPagePhase6Sidecar(pagesById.get(pageId));
    },
    recentResults({ limit, isExpired }) {
      return [...pagesById.values()]
        .filter((page) => (page.status ?? "active") === "active")
        .filter(hasCanonicalResultPagePayload)
        .filter((page) => !isExpired(page))
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || right.pageId.localeCompare(left.pageId))
        .slice(0, limit)
        .map((page): EpochWorldOverviewRecentResult => {
          const identity = page.payload.progress.identity || page.payload.progress.identities.at(-1);
          const receipt = page.payload.receipt;
          return {
            pageId: page.pageId,
            createdAt: page.createdAt,
            expiresAt: page.expiresAt,
            urlPath: page.urlPath,
            createdBy: page.createdBy,
            agentId: page.payload.progress.agentId || identity?.agentId,
            explorerId: page.payload.progress.explorerId || identity?.explorerId,
            identityName: identity?.identityName,
            publicSafeSummary: page.publicSafeSummary || page.payload.publicSafeSummary,
            receiptHash: receipt.payloadHash,
            receiptFocus: receipt.focus,
            canonicalEventCount: receipt.canonicalEvents.length,
            run: buildEpochGameRunReadModelForResultPage(page),
          };
        });
    },
  };
}
