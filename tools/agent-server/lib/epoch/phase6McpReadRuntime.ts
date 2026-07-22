import {
  validatePhase6McpPhase6ResultInput,
  validatePhase6McpPhase6ResultRead,
  validatePhase6McpRunReceiptInput,
  validatePhase6McpRunReceiptRead,
  type Phase6McpError,
  type Phase6McpPhase6ResultOutput,
  type Phase6McpRunReceiptInput,
  type Phase6McpRunReceiptOutput,
  type Phase6McpStoredReceiptLookup,
  type Phase6McpStoredResultSidecarLookup,
  type Phase6McpValidationResult,
} from "./phase6McpContractRules.ts";
import type { JourneyRunReceipt } from "./journeyRunReceiptRules.ts";

type Awaitable<T> = T | Promise<T>;

export type Phase6McpReceiptLoadResult =
  | JourneyRunReceipt
  | Phase6McpStoredReceiptLookup
  | undefined;

export interface Phase6McpReceiptRepository {
  readonly loadByReceiptId?: (receiptId: string) => Awaitable<Phase6McpReceiptLoadResult>;
  readonly loadByJourneyId?: (journeyId: string) => Awaitable<Phase6McpReceiptLoadResult>;
}

export interface Phase6McpReadRuntimeOptions {
  readonly receiptRepository?: Phase6McpReceiptRepository;
  readonly loadReceipt?: (input: Phase6McpRunReceiptInput) => Awaitable<Phase6McpReceiptLoadResult>;
  readonly loadPhase6Sidecar: (
    pageId: string,
  ) => Awaitable<Phase6McpStoredResultSidecarLookup | undefined>;
}

export interface Phase6McpReadRuntime {
  readonly readRunReceipt: (
    input: unknown,
  ) => Promise<Phase6McpValidationResult<Phase6McpRunReceiptOutput>>;
  readonly readPhase6Result: (
    input: unknown,
  ) => Promise<Phase6McpValidationResult<Phase6McpPhase6ResultOutput>>;
}

function fail<T>(error: Phase6McpError): Phase6McpValidationResult<T> {
  return { ok: false, error };
}

function invalidReceipt(message: string, path?: string): Phase6McpValidationResult<never> {
  return fail({
    code: "invalid_receipt",
    message,
    ...(path ? { path } : {}),
  });
}

function forbidden(): Phase6McpValidationResult<never> {
  return fail({
    code: "forbidden",
    message: "read request could not be completed",
  });
}

function normalizeReceiptLookup(result: Phase6McpReceiptLoadResult): Phase6McpStoredReceiptLookup {
  if (!result) return {};
  if ("receipt" in result) return result;
  return { receipt: result };
}

function sameJourneyId(receipt: JourneyRunReceipt, journeyId: string | undefined) {
  return !journeyId || receipt.journeyId === journeyId;
}

function assertRunReceiptJourney(
  output: Phase6McpRunReceiptOutput,
  input: Phase6McpRunReceiptInput,
): Phase6McpValidationResult<Phase6McpRunReceiptOutput> {
  if (!sameJourneyId(output.receipt, input.journeyId)) {
    return invalidReceipt("server persisted receipt does not match requested journeyId", "journeyId");
  }
  return { ok: true, value: output };
}

function assertPhase6ResultJourney(
  lookup: Phase6McpStoredResultSidecarLookup,
  output: Phase6McpPhase6ResultOutput,
): Phase6McpValidationResult<Phase6McpPhase6ResultOutput> {
  if (lookup.receipt && lookup.result && lookup.receipt.journeyId !== lookup.result.receipt.journeyId) {
    return invalidReceipt("verified result sidecar does not match persisted receipt journeyId", "result.receipt.journeyId");
  }
  return { ok: true, value: output };
}

async function loadReceiptLookup(
  options: Phase6McpReadRuntimeOptions,
  input: Phase6McpRunReceiptInput,
): Promise<Phase6McpStoredReceiptLookup> {
  if (options.loadReceipt) {
    return normalizeReceiptLookup(await options.loadReceipt(input));
  }

  if (input.receiptId && options.receiptRepository?.loadByReceiptId) {
    return normalizeReceiptLookup(await options.receiptRepository.loadByReceiptId(input.receiptId));
  }

  if (input.journeyId && options.receiptRepository?.loadByJourneyId) {
    return normalizeReceiptLookup(await options.receiptRepository.loadByJourneyId(input.journeyId));
  }

  return {};
}

async function loadReceiptIdLookup(
  options: Phase6McpReadRuntimeOptions,
  receiptId: string,
): Promise<Phase6McpStoredReceiptLookup> {
  if (!options.receiptRepository?.loadByReceiptId) return {};
  return normalizeReceiptLookup(await options.receiptRepository.loadByReceiptId(receiptId));
}

export function createPhase6McpReadRuntime(options: Phase6McpReadRuntimeOptions): Phase6McpReadRuntime {
  async function readRunReceipt(
    input: unknown,
  ): Promise<Phase6McpValidationResult<Phase6McpRunReceiptOutput>> {
    const inputValidation = validatePhase6McpRunReceiptInput(input);
    if (!inputValidation.ok) return inputValidation;

    try {
      const lookup = await loadReceiptLookup(options, inputValidation.value);
      const readValidation = validatePhase6McpRunReceiptRead(lookup);
      if (!readValidation.ok) return readValidation;
      return assertRunReceiptJourney(readValidation.value, inputValidation.value);
    } catch {
      return forbidden();
    }
  }

  async function readPhase6Result(
    input: unknown,
  ): Promise<Phase6McpValidationResult<Phase6McpPhase6ResultOutput>> {
    const inputValidation = validatePhase6McpPhase6ResultInput(input);
    if (!inputValidation.ok) return inputValidation;

    try {
      const sidecar = await options.loadPhase6Sidecar(inputValidation.value.pageId);
      if (!sidecar) {
        return validatePhase6McpPhase6ResultRead({
          pageId: inputValidation.value.pageId,
          receiptId: "",
          verified: false,
        });
      }
      const receiptLookup = await loadReceiptIdLookup(options, sidecar.receiptId);
      const lookup = {
        ...sidecar,
        receipt: receiptLookup.receipt,
      };
      const readValidation = validatePhase6McpPhase6ResultRead(
        lookup,
      );
      if (!readValidation.ok) return readValidation;
      return assertPhase6ResultJourney(lookup, readValidation.value);
    } catch {
      return forbidden();
    }
  }

  return {
    readRunReceipt,
    readPhase6Result,
  };
}
