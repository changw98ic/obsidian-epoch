import assert from "node:assert/strict";
import test from "node:test";

import {
  JOURNEY_STATUSES,
  activeJourneyForAgent,
  canTransitionJourney,
  hasActiveJourneyForAgent,
  isActiveJourneyStatus,
  isIsoTimestamp,
  isTerminalJourneyStatus,
  prepareJourney,
  recordJourneyEpisode,
  recallJourney,
  startJourney,
  transitionJourney,
  type EpochJourney,
  type JourneyStatus,
  type TransitionJourneyInput,
} from "../lib/epoch/journeyRules.ts";

const STARTED_AT = "2026-07-12T00:00:00.000Z";
const DUE_WORLD = "2026-07-12T01:00:00.000Z";
const NEXT_POLL = "2026-07-12T00:10:00.000Z";
const DUE_REAL = "2026-07-12T00:30:00.000Z";

function journeyFixture(status: JourneyStatus = "draft", overrides: Partial<EpochJourney> = {}): EpochJourney {
  const isStarted = status !== "draft" && status !== "prepared" && status !== "cancelled";
  return {
    journeyId: "journey_1",
    agentId: "agent_1",
    explorerId: "explorer_1",
    status,
    originRegionId: "region_origin",
    destinationRegionId: "region_destination",
    mandate: {
      objective: "find stable work",
      priorities: ["safety"],
      avoid: ["anomalies"],
      preferredActivities: ["work"],
      socialPreference: "balanced",
      returnCondition: "time",
    },
    policyVersion: 1,
    ...(isStarted
      ? {
          startedAtWorldTime: STARTED_AT,
          dueAtWorldTime: DUE_WORLD,
          dueAtRealTime: DUE_REAL,
          nextPollAt: NEXT_POLL,
        }
      : {}),
    episodeIds: [],
    interactionIds: [],
    sourceEventIds: [],
    synchronousQuestionCount: status === "awaiting_user" ? 1 : 0,
    version: 0,
    ...overrides,
  };
}

const EXPECTED_TRANSITIONS: Readonly<Record<JourneyStatus, readonly JourneyStatus[]>> = {
  draft: ["prepared", "cancelled", "identity_ended"],
  prepared: ["traveling", "cancelled", "identity_ended"],
  traveling: ["awaiting_agent", "awaiting_user", "returning", "identity_ended"],
  awaiting_agent: ["traveling", "awaiting_user", "returning", "identity_ended"],
  awaiting_user: ["traveling", "awaiting_agent", "returning", "identity_ended"],
  returning: ["settling", "identity_ended"],
  settling: ["settled", "identity_ended"],
  settled: [],
  cancelled: [],
  identity_ended: [],
};

function transitionInput(from: JourneyStatus, to: JourneyStatus): TransitionJourneyInput {
  return {
    journey: journeyFixture(from),
    toStatus: to,
    expectedVersion: 0,
    ...(from === "prepared" && to === "traveling"
      ? {
          dueTimes: {
            startedAtWorldTime: STARTED_AT,
            dueAtWorldTime: DUE_WORLD,
            dueAtRealTime: DUE_REAL,
            nextPollAt: NEXT_POLL,
          },
        }
      : {}),
    ...(to === "settled" ? { settledAtWorldTime: DUE_WORLD } : {}),
  };
}

test("journey rules enumerate every legal and illegal transition", () => {
  for (const from of JOURNEY_STATUSES) {
    for (const to of JOURNEY_STATUSES) {
      const expected = EXPECTED_TRANSITIONS[from].includes(to);
      assert.equal(canTransitionJourney(from, to), expected, `${from} -> ${to}`);

      if (expected) {
        const result = transitionJourney(transitionInput(from, to));
        assert.equal(result.status, to, `${from} -> ${to}`);
        assert.equal(result.version, 1);
      } else if (isTerminalJourneyStatus(from)) {
        assert.throws(
          () => transitionJourney(transitionInput(from, to)),
          /journey_terminal_immutable/,
          `${from} -> ${to}`,
        );
      } else {
        assert.throws(
          () => transitionJourney(transitionInput(from, to)),
          /journey_transition_invalid/,
          `${from} -> ${to}`,
        );
      }
    }
  }
});

test("prepare is pure, increments CAS version, and enforces one active journey per identity", () => {
  const draft = journeyFixture("draft", { version: 7 });
  const prepared = prepareJourney({ journey: draft, expectedVersion: 7, journeys: [draft] });

  assert.equal(draft.status, "draft");
  assert.equal(draft.version, 7);
  assert.equal(prepared.status, "prepared");
  assert.equal(prepared.version, 8);

  const otherAgent = journeyFixture("traveling", {
    journeyId: "journey_other_agent",
    agentId: "agent_2",
  });
  assert.doesNotThrow(() => prepareJourney({
    journey: draft,
    expectedVersion: 7,
    journeys: [otherAgent],
  }));

  const existing = journeyFixture("traveling", { journeyId: "journey_existing" });
  assert.equal(hasActiveJourneyForAgent([existing], "agent_1"), true);
  assert.throws(
    () => prepareJourney({ journey: draft, expectedVersion: 7, journeys: [existing] }),
    /journey_active_conflict/,
  );
});

test("active journey lookup excludes drafts and terminals and detects corrupt projections", () => {
  assert.equal(isActiveJourneyStatus("draft"), false);
  assert.equal(isActiveJourneyStatus("prepared"), true);
  assert.equal(isActiveJourneyStatus("settled"), false);

  const prepared = journeyFixture("prepared");
  assert.equal(activeJourneyForAgent([journeyFixture("draft"), prepared], "agent_1"), prepared);
  assert.equal(activeJourneyForAgent([journeyFixture("settled")], "agent_1"), undefined);
  assert.throws(
    () => activeJourneyForAgent([
      prepared,
      journeyFixture("returning", { journeyId: "journey_2" }),
    ], "agent_1"),
    /journey_active_projection_conflict/,
  );
});

test("start writes validated due times without mutating the prepared journey", () => {
  const prepared = journeyFixture("prepared", { version: 3 });
  const started = startJourney({
    journey: prepared,
    expectedVersion: 3,
    startedAtWorldTime: STARTED_AT,
    dueAtWorldTime: DUE_WORLD,
    dueAtRealTime: DUE_REAL,
    nextPollAt: NEXT_POLL,
  });

  assert.equal(prepared.status, "prepared");
  assert.equal(prepared.dueAtRealTime, undefined);
  assert.deepEqual(started, {
    ...prepared,
    status: "traveling",
    startedAtWorldTime: STARTED_AT,
    dueAtWorldTime: DUE_WORLD,
    dueAtRealTime: DUE_REAL,
    nextPollAt: NEXT_POLL,
    version: 4,
  });
});

test("due fields require valid unambiguous ISO timestamps and coherent ordering", () => {
  assert.equal(isIsoTimestamp("2026-07-12T00:00:00Z"), true);
  assert.equal(isIsoTimestamp("2026-07-12T00:00:00.123Z"), true);
  assert.equal(isIsoTimestamp("2026-02-30T00:00:00.000Z"), false);
  assert.equal(isIsoTimestamp("2026-07-12T00:00:00+08:00"), false);
  assert.equal(isIsoTimestamp("2026-07-12"), false);

  const prepared = journeyFixture("prepared");
  const valid = {
    journey: prepared,
    expectedVersion: 0,
    startedAtWorldTime: STARTED_AT,
    dueAtWorldTime: DUE_WORLD,
    dueAtRealTime: DUE_REAL,
    nextPollAt: NEXT_POLL,
  } as const;

  assert.throws(
    () => startJourney({ ...valid, dueAtWorldTime: "tomorrow" }),
    /journey_due_at_world_time_invalid/,
  );
  assert.throws(
    () => startJourney({ ...valid, dueAtWorldTime: "2026-07-11T23:59:59.000Z" }),
    /journey_due_before_start/,
  );
  assert.throws(
    () => startJourney({ ...valid, nextPollAt: "2026-07-12T00:31:00.000Z" }),
    /journey_next_poll_after_due/,
  );
  assert.throws(
    () => transitionJourney({ journey: prepared, expectedVersion: 0, toStatus: "traveling" }),
    /journey_due_times_required/,
  );
});

test("CAS rejects stale and invalid versions before changing state", () => {
  const traveling = journeyFixture("traveling", { version: 4 });
  assert.throws(
    () => transitionJourney({ journey: traveling, toStatus: "returning", expectedVersion: 3 }),
    /journey_version_conflict/,
  );
  assert.throws(
    () => transitionJourney({ journey: traveling, toStatus: "returning", expectedVersion: -1 }),
    /journey_expected_version_invalid/,
  );
  assert.throws(
    () => transitionJourney({
      journey: journeyFixture("traveling", { version: 1.5 }),
      toStatus: "returning",
      expectedVersion: 1,
    }),
    /journey_version_invalid/,
  );
});

test("recall initiates safe return instead of cancellation or rollback", () => {
  for (const status of ["traveling", "awaiting_agent", "awaiting_user"] as const) {
    const journey = journeyFixture(status, {
      version: 2,
      sourceEventIds: ["event_already_happened"],
    });
    const recalled = recallJourney({ journey, expectedVersion: 2 });
    assert.equal(recalled.status, "returning");
    assert.deepEqual(recalled.sourceEventIds, ["event_already_happened"]);
    assert.equal(recalled.version, 3);
  }

  const returning = journeyFixture("returning", { version: 5 });
  assert.equal(recallJourney({ journey: returning, expectedVersion: 5 }), returning);
  assert.throws(
    () => recallJourney({ journey: journeyFixture("prepared"), expectedVersion: 0 }),
    /journey_recall_not_in_world/,
  );
  assert.throws(
    () => recallJourney({ journey: journeyFixture("settled"), expectedVersion: 0 }),
    /journey_terminal_immutable/,
  );
});

test("ordinary journey can enter awaiting_user only once", () => {
  const firstQuestion = transitionJourney({
    journey: journeyFixture("traveling"),
    toStatus: "awaiting_user",
    expectedVersion: 0,
  });
  assert.equal(firstQuestion.synchronousQuestionCount, 1);

  const resumed = transitionJourney({
    journey: firstQuestion,
    toStatus: "traveling",
    expectedVersion: 1,
  });
  assert.throws(
    () => transitionJourney({
      journey: resumed,
      toStatus: "awaiting_user",
      expectedVersion: 2,
    }),
    /journey_synchronous_question_limit_exceeded/,
  );
  assert.throws(
    () => transitionJourney({
      journey: journeyFixture("traveling", { synchronousQuestionCount: 2 }),
      toStatus: "returning",
      expectedVersion: 0,
    }),
    /journey_synchronous_question_count_invalid/,
  );
});

test("settling requires a valid settlement time and terminal journeys stay immutable", () => {
  const settling = journeyFixture("settling");
  assert.throws(
    () => transitionJourney({ journey: settling, toStatus: "settled", expectedVersion: 0 }),
    /journey_settled_at_world_time_required/,
  );
  const settled = transitionJourney({
    journey: settling,
    toStatus: "settled",
    expectedVersion: 0,
    settledAtWorldTime: DUE_WORLD,
  });
  assert.equal(settled.settledAtWorldTime, DUE_WORLD);
  assert.throws(
    () => transitionJourney({ journey: settled, toStatus: "identity_ended", expectedVersion: 1 }),
    /journey_terminal_immutable/,
  );
});

test("episode recording requires in-world status, unique ids, and canonical source events", () => {
  const traveling = journeyFixture("traveling", { version: 4, sourceEventIds: ["event_existing"] });
  const recorded = recordJourneyEpisode({
    journey: traveling,
    expectedVersion: 4,
    episodeId: "episode_1",
    sourceEventIds: ["event_existing", "event_scene"],
    interactionIds: ["interaction_1"],
  });
  assert.deepEqual(recorded.episodeIds, ["episode_1"]);
  assert.deepEqual(recorded.sourceEventIds, ["event_existing", "event_scene"]);
  assert.deepEqual(recorded.interactionIds, ["interaction_1"]);
  assert.equal(recorded.version, 5);
  assert.throws(() => recordJourneyEpisode({
    journey: recorded,
    expectedVersion: 5,
    episodeId: "episode_1",
    sourceEventIds: ["event_scene"],
  }), /journey_episode_duplicate/);
  assert.throws(() => recordJourneyEpisode({
    journey: journeyFixture("settled"),
    expectedVersion: 0,
    episodeId: "episode_2",
    sourceEventIds: ["event_scene"],
  }), /journey_terminal_immutable/);
  assert.throws(() => recordJourneyEpisode({
    journey: traveling,
    expectedVersion: 4,
    episodeId: "episode_2",
    sourceEventIds: [],
  }), /journey_episode_source_event_ids_required/);
});
