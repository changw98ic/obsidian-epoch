import { createHash, randomBytes } from "node:crypto";

type UnknownRecord = Record<string, unknown>;
type TicketState = "issued" | "active" | "submitted" | "settled" | "expired" | "void";

interface TicketRecord {
  readonly runTicket: string;
  readonly explorerId: string;
  readonly agentId: string;
  readonly contextVersion: string;
  readonly regionId: string;
  readonly risk: string;
  readonly partyRunId?: string;
  readonly participantRole?: string;
  readonly multiAgentReservation?: unknown;
  readonly actionBudget: {
    readonly maxEvents: number;
    readonly maxHighRiskActions: number;
  };
  readonly sequence: number;
  readonly sequenceWindow: {
    readonly first: number;
    readonly last: number;
  };
  readonly state: TicketState | string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly expiredAt?: string;
  readonly heartbeatAt?: string;
  readonly submittedAt?: string;
  readonly settledAt?: string;
  readonly voidedAt?: string;
  readonly voidReason?: string;
  readonly runHash?: string;
  readonly adjudication?: unknown;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function hashRunPayload(run: unknown): string {
  return createHash("sha256").update(stableJson(run)).digest("hex");
}

const DEFAULT_TICKET_TTL_MS = 30 * 60 * 1000;
const LEGACY_UNSPECIFIED_REGION_ID = "legacy_region_unspecified";
const LEGACY_UNSPECIFIED_CONTEXT_VERSION = "legacy_context_unspecified";

function positiveInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

function actionBudgetForRisk(risk: string) {
  if (risk === "A") return { maxEvents: 10, maxHighRiskActions: 3 };
  if (risk === "B") return { maxEvents: 8, maxHighRiskActions: 2 };
  return { maxEvents: 6, maxHighRiskActions: 1 };
}

function isLiveTicketState(state: string): boolean {
  return state === "issued" || state === "active";
}

function normalizeTicketRecord(ticket: TicketRecord | Record<string, unknown>, fallbackSequence: number): TicketRecord {
  const sequence = positiveInteger(ticket.sequence) || fallbackSequence;
  const rawWindow = ticket.sequenceWindow && typeof ticket.sequenceWindow === "object"
    ? ticket.sequenceWindow as Record<string, unknown>
    : {};
  const risk = typeof ticket.risk === "string" && ticket.risk ? ticket.risk : "C";
  const rawBudget = ticket.actionBudget && typeof ticket.actionBudget === "object"
    ? ticket.actionBudget as Record<string, unknown>
    : {};
  const fallbackBudget = actionBudgetForRisk(risk);
  const first = positiveInteger(rawWindow.first) || sequence;
  const last = positiveInteger(rawWindow.last) || sequence;
  return {
    ...ticket,
    contextVersion: typeof ticket.contextVersion === "string" && ticket.contextVersion.trim()
      ? ticket.contextVersion
      : LEGACY_UNSPECIFIED_CONTEXT_VERSION,
    regionId: typeof ticket.regionId === "string" && ticket.regionId.trim()
      ? ticket.regionId
      : LEGACY_UNSPECIFIED_REGION_ID,
    risk,
    actionBudget: {
      maxEvents: positiveInteger(rawBudget.maxEvents) || fallbackBudget.maxEvents,
      maxHighRiskActions: positiveInteger(rawBudget.maxHighRiskActions) || fallbackBudget.maxHighRiskActions,
    },
    sequence,
    sequenceWindow: {
      first: Math.min(first, last),
      last: Math.max(first, last),
    },
  } as TicketRecord;
}

export function createTicketRegistry(options: {
  readonly now?: () => Date;
  readonly idFactory?: () => string;
  readonly ttlMs?: number;
  readonly initialTickets?: readonly TicketRecord[];
} = {}) {
  const now = options.now || (() => new Date());
  const idFactory = options.idFactory || (() => `rt_${randomBytes(12).toString("hex")}`);
  const configuredTtlMs = options.ttlMs;
  const ttlMs = typeof configuredTtlMs === "number" && Number.isFinite(configuredTtlMs) && configuredTtlMs > 0
    ? Math.floor(configuredTtlMs)
    : DEFAULT_TICKET_TTL_MS;
  const tickets = new Map<string, TicketRecord>();

  let maxSequence = 0;
  for (const ticket of options.initialTickets || []) {
    const normalized = normalizeTicketRecord(ticket, maxSequence + 1);
    maxSequence = Math.max(maxSequence, normalized.sequence);
    tickets.set(normalized.runTicket, normalized);
  }

  function nextSequence() {
    const sequence = maxSequence + 1;
    maxSequence = sequence;
    return sequence;
  }

  function createTicket(input: {
    readonly explorerId?: string;
    readonly agentId?: string;
    readonly contextVersion?: string;
    readonly regionId?: string;
    readonly risk?: string;
    readonly partyRunId?: string;
    readonly participantRole?: string;
    readonly multiAgentReservation?: unknown;
  }) {
    if (!input?.explorerId || !input?.agentId) {
      throw new Error("ticket_identity_required");
    }

    const createdAt = now();
    const sequence = nextSequence();
    const risk = input.risk || "C";
    const ticket = {
      runTicket: idFactory(),
      explorerId: input.explorerId,
      agentId: input.agentId,
      contextVersion: input.contextVersion || LEGACY_UNSPECIFIED_CONTEXT_VERSION,
      regionId: input.regionId || LEGACY_UNSPECIFIED_REGION_ID,
      risk,
      ...(input.partyRunId ? { partyRunId: input.partyRunId } : {}),
      ...(input.participantRole ? { participantRole: input.participantRole } : {}),
      ...(input.multiAgentReservation ? { multiAgentReservation: input.multiAgentReservation } : {}),
      actionBudget: actionBudgetForRisk(risk),
      sequence,
      sequenceWindow: { first: sequence, last: sequence },
      state: "issued",
      createdAt: createdAt.toISOString(),
      expiresAt: new Date(createdAt.getTime() + ttlMs).toISOString(),
    };
    tickets.set(ticket.runTicket, ticket);
    return { ...ticket };
  }

  function expireIfStale(ticket: TicketRecord): TicketRecord {
    if (!isLiveTicketState(ticket.state) || !ticket.expiresAt) return ticket;
    const expiresAtMs = Date.parse(ticket.expiresAt);
    if (!Number.isFinite(expiresAtMs) || now().getTime() <= expiresAtMs) return ticket;
    const expired = {
      ...ticket,
      state: "expired",
      expiredAt: now().toISOString(),
    };
    tickets.set(ticket.runTicket, expired);
    return expired;
  }

  function getTicket(runTicket: string) {
    const ticket = tickets.get(runTicket);
    return ticket ? { ...expireIfStale(ticket) } : null;
  }

  function assertTicketIdentity(ticket: TicketRecord, input: { readonly explorerId?: string; readonly agentId?: string }) {
    if (!input?.explorerId || !input?.agentId) throw new Error("ticket_identity_required");
    if (input.explorerId !== ticket.explorerId || input.agentId !== ticket.agentId) {
      throw new Error("ticket_identity_mismatch");
    }
  }

  function checkpointTicket(
    runTicket: string,
    input: { readonly explorerId?: string; readonly agentId?: string } = {},
  ) {
    const storedTicket = tickets.get(runTicket);
    const ticket = storedTicket ? expireIfStale(storedTicket) : null;
    if (!ticket) throw new Error("ticket_not_found");
    assertTicketIdentity(ticket, input);
    if (ticket.state === "expired") throw new Error("ticket_expired");
    if (ticket.state === "void") throw new Error("ticket_void");
    if (!isLiveTicketState(ticket.state)) throw new Error("ticket_not_active");

    const heartbeatAt = now();
    const sequence = nextSequence();
    const checkpointed = {
      ...ticket,
      state: "active",
      sequence,
      sequenceWindow: { first: sequence, last: sequence },
      heartbeatAt: heartbeatAt.toISOString(),
      expiresAt: new Date(heartbeatAt.getTime() + ttlMs).toISOString(),
    };
    tickets.set(runTicket, checkpointed);
    return { ...checkpointed };
  }

  function assertSequenceWindow(ticket: TicketRecord, run: UnknownRecord) {
    const sequence = positiveInteger(run.sequence);
    if (!sequence) throw new Error("ticket_sequence_required");
    if (sequence < ticket.sequenceWindow.first || sequence > ticket.sequenceWindow.last) {
      throw new Error("ticket_sequence_mismatch");
    }
  }

  function assertContextVersion(ticket: TicketRecord, run: UnknownRecord) {
    if (ticket.contextVersion === LEGACY_UNSPECIFIED_CONTEXT_VERSION) return;
    const contextVersion = typeof run.contextVersion === "string" && run.contextVersion.trim()
      ? run.contextVersion
      : null;
    if (!contextVersion) throw new Error("ticket_context_version_required");
    if (contextVersion !== ticket.contextVersion) throw new Error("ticket_context_version_mismatch");
  }

  function submitTicket(runTicket: string, run: UnknownRecord, adjudication: unknown) {
    const storedTicket = tickets.get(runTicket);
    const ticket = storedTicket ? expireIfStale(storedTicket) : null;
    if (!ticket) throw new Error("ticket_not_found");

    const runHash = hashRunPayload(run);
    if (ticket.state === "submitted" || ticket.state === "settled") {
      if (ticket.runHash !== runHash) throw new Error("ticket_payload_mismatch");
      return { ...ticket, duplicate: true };
    }
    if (ticket.state === "expired") throw new Error("ticket_expired");
    if (ticket.state === "void") throw new Error("ticket_void");
    if (!isLiveTicketState(ticket.state)) throw new Error("ticket_not_active");
    assertSequenceWindow(ticket, run);
    assertContextVersion(ticket, run);

    const submitted = {
      ...ticket,
      state: "submitted",
      submittedAt: now().toISOString(),
      runHash,
      adjudication,
    };
    tickets.set(runTicket, submitted);
    return { ...submitted, duplicate: false };
  }

  function settleTicket(runTicket: string) {
    const storedTicket = tickets.get(runTicket);
    const ticket = storedTicket ? expireIfStale(storedTicket) : null;
    if (!ticket) throw new Error("ticket_not_found");
    if (ticket.state === "settled") return { ...ticket };
    if (ticket.state === "expired") throw new Error("ticket_expired");
    if (ticket.state === "void") throw new Error("ticket_void");
    if (ticket.state !== "submitted") throw new Error("ticket_not_submitted");

    const settled = {
      ...ticket,
      state: "settled",
      settledAt: now().toISOString(),
    };
    tickets.set(runTicket, settled);
    return { ...settled };
  }

  function voidTicket(runTicket: string, input: { readonly reason?: string } = {}) {
    const storedTicket = tickets.get(runTicket);
    const ticket = storedTicket ? expireIfStale(storedTicket) : null;
    if (!ticket) throw new Error("ticket_not_found");
    if (ticket.state === "void") return { ...ticket };
    if (ticket.state === "expired") throw new Error("ticket_expired");
    if (ticket.state === "submitted" || ticket.state === "settled") throw new Error("ticket_already_submitted");

    const voided = {
      ...ticket,
      state: "void",
      voidedAt: now().toISOString(),
      voidReason: typeof input.reason === "string" && input.reason.trim() ? input.reason.trim() : "unspecified",
    };
    tickets.set(runTicket, voided);
    return { ...voided };
  }

  return {
    createTicket,
    checkpointTicket,
    getTicket,
    settleTicket,
    submitTicket,
    voidTicket,
    listTickets: () => Array.from(tickets.values(), (ticket) => ({ ...ticket })),
  };
}
