import assert from "node:assert/strict";
import test from "node:test";

import { embeddedResultPagesForPersistence } from "../lib/httpServer.ts";
import { hydrateAgentRuntimeOptions, validateCanonicalRecoveryConflicts } from "../lib/store.ts";

const fullPage = {
  pageId: "phase6_result_receipt_restart_1",
  createdAt: "2026-07-21T12:18:33.031Z",
  urlPath: "/phase6/result/phase6_result_receipt_restart_1",
  createdBy: "obsidian_epoch.phase6",
  idempotencyKey: "phase6-result-restart-1",
  shareVersion: 1,
  payload: { receiptId: "receipt_restart_1" },
};

const compactProjection = {
  authority: "server_phase6_result",
  transportVersion: "phase6_result.compact.v1",
  verified: true,
  rulesetVersion: "obsidian-epoch-phase6-mcp-contract-v0.1.0",
  pageId: fullPage.pageId,
  receiptId: "receipt_restart_1",
  result: { receipt: { receiptId: "receipt_restart_1" } },
};

const journeyStatusPageReference = {
  pageId: "epoch_page_restart_1",
  createdAt: "2026-07-21T12:18:33.316Z",
  urlPath: "/epoch/result/epoch_page_restart_1?shareToken=test_share_token&shareVersion=1",
};

function commandCommit(command: string, commandId: string, resultPages: readonly object[]) {
  return {
    type: "agent_command_commit",
    version: 1,
    command,
    commandId,
    journeyEvents: [],
    epochEvents: [],
    resultPages,
  };
}

test("compact Phase 6 transport projections are not persisted as result pages", () => {
  assert.deepEqual(embeddedResultPagesForPersistence(compactProjection), []);
  assert.deepEqual(embeddedResultPagesForPersistence(journeyStatusPageReference), []);
  assert.deepEqual(embeddedResultPagesForPersistence(fullPage), [fullPage]);
  assert.deepEqual(
    embeddedResultPagesForPersistence({ finalVerification: fullPage }),
    [fullPage],
  );
});

test("recovery discards the exact historical compact projection but retains its full page", () => {
  const commandEvents = [
    commandCommit("obsidian_epoch.phase6_result_page", "full-page-1", [fullPage]),
    commandCommit("obsidian_epoch.phase6_result_compact", "compact-projection-1", [compactProjection]),
    commandCommit("obsidian_epoch.journey_status_compact", "status-page-reference-1", [journeyStatusPageReference]),
  ];

  assert.doesNotThrow(() => validateCanonicalRecoveryConflicts({ commandEvents }));
  const hydrated = hydrateAgentRuntimeOptions({ commandEvents });
  assert.deepEqual(hydrated.resultPages, [fullPage]);
});

test("recovery still rejects malformed or spoofed compact result pages", () => {
  const malformed = { ...compactProjection, verified: false };
  const malformedPhase6Events = [
    commandCommit("obsidian_epoch.phase6_result_compact", "compact-projection-invalid", [malformed]),
  ];

  assert.throws(
    () => validateCanonicalRecoveryConflicts({ commandEvents: malformedPhase6Events }),
    /agent_command_commit_result_page_invalid/,
  );
  assert.throws(
    () => hydrateAgentRuntimeOptions({ commandEvents: malformedPhase6Events }),
    /agent_command_commit_result_page_invalid/,
  );

  const spoofedStatusEvents = [commandCommit(
    "obsidian_epoch.journey_status_compact",
    "status-page-reference-invalid",
    [{ ...journeyStatusPageReference, createdBy: "spoofed_transport" }],
  )];
  assert.throws(
    () => validateCanonicalRecoveryConflicts({ commandEvents: spoofedStatusEvents }),
    /agent_command_commit_result_page_invalid/,
  );
});
