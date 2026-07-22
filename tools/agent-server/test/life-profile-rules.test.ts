import assert from "node:assert/strict";
import test from "node:test";

import {
  advanceLifeProfile,
  createLifeProfile,
  validateLifeProfile,
  type LifeProfileResourceDelta,
  type LifeProfileState,
} from "../lib/epoch/lifeProfileRules.ts";

const workWindow = [{ startMinuteOfDay: 9 * 60, endMinuteOfDay: 17 * 60 }];
const studyWindow = [{ startMinuteOfDay: 19 * 60, endMinuteOfDay: 21 * 60 }];
const sleepWindow = [{ startMinuteOfDay: 23 * 60, endMinuteOfDay: 7 * 60 }];

test("creates actor and household life profile with body, mind, work, study, and 24h commitments", () => {
  const profile = createBaseProfile();

  assert.equal(profile.worldMinute, 0);
  assert.equal(profile.actors.length, 2);
  assert.deepEqual(profile.households[0]?.memberActorRefs, ["actor:a", "actor:b"]);
  assert.equal(profile.actors[0]?.identityKind, "both");
  assert.equal(profile.actors[0]?.sleep.schedule[0]?.startMinuteOfDay, 23 * 60);
  assert.equal(profile.actors[0]?.work?.employerAccountRef, "employer:forge");
  assert.equal(profile.actors[0]?.study?.skillRef, "skill:accounting");
  assert.equal(validateLifeProfile(profile).length, 0);
});

test("advances across days deterministically and applies eating, drinking, sleep, work, and study", () => {
  const profile = createBaseProfile();
  const once = advanceLifeProfile({ state: profile, toWorldMinute: 2_940 });
  const twice = advanceLifeProfile({ state: createBaseProfile(), toWorldMinute: 2_940 });

  assert.deepEqual(once, twice);
  assert.equal(once.worldMinute, 2_940);
  assert.ok(once.resourceDeltas.some((delta) => delta.reason === "eat"));
  assert.ok(once.resourceDeltas.some((delta) => delta.reason === "drink"));
  assert.ok(once.resourceDeltas.some((delta) => delta.reason === "wage"));
  assert.ok(once.resourceDeltas.some((delta) => delta.reason === "tuition"));
  assert.ok((once.actors[0]?.skills[0]?.progressBps || 0) > 0);
  assert.ok((once.actors[0]?.body.fatigue || 0) < 10_000);
  assertResourceDeltasConserve(once.resourceDeltas);
});

test("handles multi-person household consumption without silently skipping resources", () => {
  const profile = createBaseProfile({
    resources: { money: 10_000, food: 4, water: 4, skill_material: 20 },
  });
  const advanced = advanceLifeProfile({ state: profile, toWorldMinute: 360 });

  assert.equal(advanced.households[0]?.resources.food, 0);
  assert.equal(advanced.households[0]?.resources.water, 0);
  assert.equal(advanced.households[0]?.debt.food, 8);
  assert.equal(advanced.households[0]?.debt.water, 8);
  assert.equal(advanced.resourceDeltas.filter((delta) => delta.reason === "eat").length, 4);
  assert.equal(advanced.resourceDeltas.filter((delta) => delta.reason === "drink").length, 4);
  assertResourceDeltasConserve(advanced.resourceDeltas);
});

test("records debt and health or psychological consequences when required resources are missing", () => {
  const profile = createBaseProfile({
    resources: { money: 0, food: 0, water: 0, skill_material: 0 },
    employerMoney: 0,
  });
  const advanced = advanceLifeProfile({ state: profile, toWorldMinute: 21 * 60 });

  assert.ok((advanced.households[0]?.debt.food || 0) > 0);
  assert.ok((advanced.households[0]?.debt.water || 0) > 0);
  assert.ok((advanced.households[0]?.debt.money || 0) > 0);
  assert.ok(advanced.consequences.some((item) => item.kind === "resource_shortage"));
  assert.ok(advanced.consequences.some((item) => item.kind === "debt"));
  assert.ok(advanced.consequences.some((item) => item.kind === "missed_study"));
  assert.ok((advanced.actors[0]?.mind.stress || 0) > (profile.actors[0]?.mind.stress || 10_000));
  assertResourceDeltasConserve(advanced.resourceDeltas);
});

test("records study transfers and debt at actual cross-hour and cross-day occurrence minutes", () => {
  const paid = advanceLifeProfile({ state: createBaseProfile(), toWorldMinute: 1_170 });
  const paidStudyDeltas = paid.resourceDeltas.filter((delta) => delta.reason === "tuition" || delta.reason === "study_material");

  assert.ok(paidStudyDeltas.length > 0);
  assert.deepEqual([...new Set(paidStudyDeltas.map((delta) => delta.occurredAtWorldMinute))], [19 * 60]);

  const short = advanceLifeProfile({
    state: {
      ...createBaseProfile({ resources: { money: 0, skill_material: 0 } }),
      worldMinute: 24 * 60 + 18 * 60 + 30,
    },
    toWorldMinute: 24 * 60 + 19 * 60 + 30,
  });
  const studyDebt = short.consequences.filter((item) => item.kind === "debt" && (item.resourceKey === "money" || item.resourceKey === "skill_material"));
  const missedStudy = short.consequences.filter((item) => item.kind === "missed_study");

  assert.ok(studyDebt.length > 0);
  assert.ok(missedStudy.length > 0);
  assert.deepEqual([...new Set([...studyDebt, ...missedStudy].map((item) => item.occurredAtWorldMinute))], [24 * 60 + 19 * 60]);
});

test("clamps extreme actor values during validation and advance", () => {
  const profile = createLifeProfile({
    actors: [{
      actorRef: "actor:extreme",
      householdRef: "household:edge",
      body: { hunger: 99_999, thirst: -50, fatigue: 99_999, stress: 99_999, health: -1 },
      mind: { stress: 99_999, mood: -1, belonging: 99_999, purpose: -1 },
      sleep: { schedule: sleepWindow },
    }],
    households: [{
      householdRef: "household:edge",
      resources: { food: 100, water: 100 },
    }],
  });
  const advanced = advanceLifeProfile({ state: profile, toWorldMinute: 120 });
  const actor = advanced.actors[0]!;

  for (const value of [...Object.values(actor.body), ...Object.values(actor.mind)]) {
    assert.ok(value >= 0 && value <= 10_000);
  }
  assert.equal(validateLifeProfile(advanced).length, 0);
});

test("validate rejects invalid households, schedules, and delta provenance", () => {
  const invalid = {
    ...createBaseProfile(),
    actors: [{
      ...createBaseProfile().actors[0]!,
      householdRef: "missing",
      sleep: { schedule: [{ startMinuteOfDay: 99_999, endMinuteOfDay: 99_999 }] },
    }],
    resourceDeltas: [{
      deltaId: "bad",
      occurredAtWorldMinute: 0,
      resourceKey: "money",
      unit: "minor",
      quantity: 0,
      fromAccountRef: "",
      toAccountRef: "",
      sourceRef: "",
      sinkRef: "",
      reason: "wage",
    }],
  } satisfies LifeProfileState;

  const codes = validateLifeProfile(invalid).map((item) => item.code);
  assert.ok(codes.includes("LIFE_PROFILE_HOUSEHOLD_REF"));
  assert.ok(codes.includes("LIFE_PROFILE_SCHEDULE_RANGE"));
  assert.ok(codes.includes("LIFE_PROFILE_DELTA_QUANTITY"));
  assert.ok(codes.includes("LIFE_PROFILE_DELTA_PROVENANCE"));
});

function createBaseProfile(options?: {
  readonly resources?: { readonly money?: number; readonly food?: number; readonly water?: number; readonly skill_material?: number };
  readonly employerMoney?: number;
}): LifeProfileState {
  return createLifeProfile({
    actors: [{
      actorRef: "actor:a",
      householdRef: "household:one",
      body: { hunger: 2_000, thirst: 2_000, fatigue: 2_000, stress: 1_000, health: 8_000 },
      mind: { stress: 1_000, mood: 6_000, belonging: 5_000, purpose: 5_000 },
      work: {
        employerAccountRef: "employer:forge",
        wagePerWorldMinute: 3,
        schedule: workWindow,
      },
      study: {
        schoolAccountRef: "school:night",
        skillRef: "skill:accounting",
        progressBpsPerWorldMinute: 4,
        tuitionPerWorldMinute: 1,
        materialPerWorldMinute: 0.05,
        schedule: studyWindow,
      },
      sleep: { schedule: sleepWindow },
    }, {
      actorRef: "actor:b",
      householdRef: "household:one",
      body: { hunger: 1_000, thirst: 1_000, fatigue: 1_000, stress: 500, health: 9_000 },
      mind: { stress: 500, mood: 7_000, belonging: 6_000, purpose: 4_000 },
      sleep: { schedule: sleepWindow },
    }],
    households: [{
      householdRef: "household:one",
      resources: {
        money: options?.resources?.money ?? 10_000,
        food: options?.resources?.food ?? 40,
        water: options?.resources?.water ?? 40,
        skill_material: options?.resources?.skill_material ?? 40,
      },
    }],
    externalAccounts: {
      "employer:forge": { money: options?.employerMoney ?? 100_000 },
      "school:night": {},
    },
  });
}

function assertResourceDeltasConserve(deltas: readonly LifeProfileResourceDelta[]): void {
  for (const delta of deltas) {
    assert.ok(delta.quantity > 0);
    assert.ok(delta.fromAccountRef);
    assert.ok(delta.toAccountRef);
    assert.equal(delta.sourceRef, delta.fromAccountRef);
    assert.equal(delta.sinkRef, delta.toAccountRef);
  }
}
