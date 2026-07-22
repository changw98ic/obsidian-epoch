export type LifeProfileActorKind = "actor" | "npc";
export type LifeProfileIdentityKind = "employed" | "student" | "both" | "dependent" | "unassigned";
export type LifeProfileResourceKey = "money" | "food" | "water" | "tuition_credit" | "skill_material";
export type LifeProfileConsequenceKind =
  | "debt"
  | "missed_work"
  | "missed_study"
  | "health"
  | "psychological"
  | "resource_shortage";

export interface LifeProfileResources {
  readonly money: number;
  readonly food: number;
  readonly water: number;
  readonly tuition_credit: number;
  readonly skill_material: number;
}

export interface LifeProfileMetricSet {
  readonly hunger: number;
  readonly thirst: number;
  readonly fatigue: number;
  readonly stress: number;
  readonly health: number;
  readonly mood: number;
  readonly belonging: number;
  readonly purpose: number;
}

export interface LifeProfileSkillProgress {
  readonly skillRef: string;
  readonly progressBps: number;
  readonly studiedWorldMinutes: number;
}

export interface LifeProfileScheduleWindow {
  readonly startMinuteOfDay: number;
  readonly endMinuteOfDay: number;
}

export interface LifeProfileWorkCommitment {
  readonly employerAccountRef: string;
  readonly wagePerWorldMinute: number;
  readonly schedule: readonly LifeProfileScheduleWindow[];
}

export interface LifeProfileStudyCommitment {
  readonly schoolAccountRef: string;
  readonly skillRef: string;
  readonly progressBpsPerWorldMinute: number;
  readonly tuitionPerWorldMinute: number;
  readonly materialPerWorldMinute: number;
  readonly schedule: readonly LifeProfileScheduleWindow[];
}

export interface LifeProfileSleepCommitment {
  readonly schedule: readonly LifeProfileScheduleWindow[];
}

export interface LifeProfileActor {
  readonly actorKind: LifeProfileActorKind;
  readonly actorRef: string;
  readonly householdRef: string;
  readonly identityKind: LifeProfileIdentityKind;
  readonly body: LifeProfileMetricSet;
  readonly mind: LifeProfileMetricSet;
  readonly skills: readonly LifeProfileSkillProgress[];
  readonly work?: LifeProfileWorkCommitment;
  readonly study?: LifeProfileStudyCommitment;
  readonly sleep: LifeProfileSleepCommitment;
}

export interface LifeProfileHousehold {
  readonly householdRef: string;
  readonly memberActorRefs: readonly string[];
  readonly resourceAccountRef: string;
  readonly resources: LifeProfileResources;
  readonly debt: LifeProfileResources;
}

export interface LifeProfileState {
  readonly worldMinute: number;
  readonly actors: readonly LifeProfileActor[];
  readonly households: readonly LifeProfileHousehold[];
  readonly externalAccounts: Readonly<Record<string, LifeProfileResources>>;
  readonly resourceDeltas: readonly LifeProfileResourceDelta[];
  readonly consequences: readonly LifeProfileConsequence[];
}

export interface LifeProfileCreateInput {
  readonly worldMinute?: number;
  readonly actors: readonly LifeProfileActorInput[];
  readonly households?: readonly LifeProfileHouseholdInput[];
  readonly externalAccounts?: Readonly<Record<string, Partial<LifeProfileResources>>>;
}

export interface LifeProfileActorInput {
  readonly actorKind?: LifeProfileActorKind;
  readonly actorRef: string;
  readonly householdRef: string;
  readonly identityKind?: LifeProfileIdentityKind;
  readonly body?: Partial<LifeProfileMetricSet>;
  readonly mind?: Partial<LifeProfileMetricSet>;
  readonly skills?: readonly LifeProfileSkillProgress[];
  readonly work?: LifeProfileWorkCommitment;
  readonly study?: LifeProfileStudyCommitment;
  readonly sleep?: Partial<LifeProfileSleepCommitment>;
}

export interface LifeProfileHouseholdInput {
  readonly householdRef: string;
  readonly memberActorRefs?: readonly string[];
  readonly resourceAccountRef?: string;
  readonly resources?: Partial<LifeProfileResources>;
  readonly debt?: Partial<LifeProfileResources>;
}

export interface LifeProfileAdvanceInput {
  readonly state: LifeProfileState;
  readonly toWorldMinute: number;
}

export interface LifeProfileValidationError {
  readonly code: string;
  readonly path: string;
  readonly message: string;
}

export interface LifeProfileResourceDelta {
  readonly deltaId: string;
  readonly occurredAtWorldMinute: number;
  readonly actorRef?: string;
  readonly householdRef?: string;
  readonly resourceKey: LifeProfileResourceKey;
  readonly unit: "minor" | "portion" | "liter" | "credit" | "material";
  readonly quantity: number;
  readonly fromAccountRef: string;
  readonly toAccountRef: string;
  readonly sourceRef: string;
  readonly sinkRef: string;
  readonly reason: "eat" | "drink" | "purchase" | "wage" | "tuition" | "study_material";
}

export interface LifeProfileConsequence {
  readonly consequenceId: string;
  readonly occurredAtWorldMinute: number;
  readonly actorRef?: string;
  readonly householdRef?: string;
  readonly kind: LifeProfileConsequenceKind;
  readonly resourceKey?: LifeProfileResourceKey;
  readonly quantity?: number;
  readonly message: string;
}

const DAY_MINUTES = 1_440;
const DEFAULT_SLEEP: readonly LifeProfileScheduleWindow[] = [{ startMinuteOfDay: 1_320, endMinuteOfDay: 360 }];
const DEFAULT_RESOURCES: LifeProfileResources = {
  money: 0,
  food: 0,
  water: 0,
  tuition_credit: 0,
  skill_material: 0,
};
const RESOURCE_UNITS: Readonly<Record<LifeProfileResourceKey, LifeProfileResourceDelta["unit"]>> = {
  money: "minor",
  food: "portion",
  water: "liter",
  tuition_credit: "credit",
  skill_material: "material",
};

export function createLifeProfile(input: LifeProfileCreateInput): LifeProfileState {
  const worldMinute = minute(input.worldMinute ?? 0);
  const households = createHouseholds(input, worldMinute);
  const actors = input.actors.map((actor) => createActor(actor, worldMinute));
  return {
    worldMinute,
    actors,
    households: households.map((household) => ({
      ...household,
      memberActorRefs: actors
        .filter((actor) => actor.householdRef === household.householdRef)
        .map((actor) => actor.actorRef),
    })),
    externalAccounts: normalizeExternalAccounts(input.externalAccounts),
    resourceDeltas: [],
    consequences: [],
  };
}

export function validateLifeProfile(state: LifeProfileState): readonly LifeProfileValidationError[] {
  const errors: LifeProfileValidationError[] = [];
  const householdRefs = new Set(state.households.map((household) => household.householdRef));
  const actorRefs = new Set<string>();

  state.actors.forEach((actor, index) => {
    const path = `actors.${index}`;
    if (!actor.actorRef) errors.push(error("LIFE_PROFILE_ACTOR_REF", path, "actorRef is required"));
    if (actorRefs.has(actor.actorRef)) errors.push(error("LIFE_PROFILE_DUPLICATE_ACTOR", path, "actorRef must be unique"));
    actorRefs.add(actor.actorRef);
    if (!householdRefs.has(actor.householdRef)) {
      errors.push(error("LIFE_PROFILE_HOUSEHOLD_REF", `${path}.householdRef`, "actor householdRef must exist"));
    }
    errors.push(...validateSchedule(actor.sleep.schedule, `${path}.sleep.schedule`));
    if (actor.work) errors.push(...validateSchedule(actor.work.schedule, `${path}.work.schedule`));
    if (actor.study) errors.push(...validateSchedule(actor.study.schedule, `${path}.study.schedule`));
    for (const metric of Object.values(actor.body)) {
      if (!Number.isFinite(metric) || metric < 0 || metric > 10_000) {
        errors.push(error("LIFE_PROFILE_METRIC_RANGE", `${path}.body`, "body metrics must be 0..10000"));
        break;
      }
    }
  });

  state.households.forEach((household, index) => {
    const path = `households.${index}`;
    for (const memberRef of household.memberActorRefs) {
      if (!actorRefs.has(memberRef)) errors.push(error("LIFE_PROFILE_MEMBER_REF", `${path}.memberActorRefs`, "household member must exist"));
    }
    for (const [key, quantity] of Object.entries(household.resources)) {
      if (!Number.isFinite(quantity) || quantity < 0) {
        errors.push(error("LIFE_PROFILE_RESOURCE_RANGE", `${path}.resources.${key}`, "resources cannot be negative"));
      }
    }
  });

  const totals = new Map<string, number>();
  state.resourceDeltas.forEach((delta, index) => {
    if (delta.quantity <= 0 || !Number.isFinite(delta.quantity)) {
      errors.push(error("LIFE_PROFILE_DELTA_QUANTITY", `resourceDeltas.${index}.quantity`, "delta quantity must be positive"));
    }
    if (!delta.fromAccountRef || !delta.toAccountRef || !delta.sourceRef || !delta.sinkRef) {
      errors.push(error("LIFE_PROFILE_DELTA_PROVENANCE", `resourceDeltas.${index}`, "delta requires source and sink provenance"));
    }
    const key = `${delta.resourceKey}:${delta.unit}`;
    totals.set(key, totals.get(key) || 0);
  });
  for (const [key, total] of totals) {
    if (total !== 0) errors.push(error("LIFE_PROFILE_RESOURCE_CONSERVATION", "resourceDeltas", `${key} deltas must conserve resources`));
  }
  return errors;
}

export function advanceLifeProfile(input: LifeProfileAdvanceInput): LifeProfileState {
  const targetMinute = minute(input.toWorldMinute);
  if (targetMinute <= input.state.worldMinute) {
    return { ...input.state, worldMinute: targetMinute };
  }

  let mutable = mutableState(input.state);
  let cursor = input.state.worldMinute;
  while (cursor < targetMinute) {
    const next = Math.min(targetMinute, cursor + 60);
    const duration = next - cursor;
    mutable = advanceSlice(mutable, cursor, duration);
    cursor = next;
  }
  return freezeState({ ...mutable, worldMinute: targetMinute });
}

function advanceSlice(state: MutableLifeProfileState, startMinute: number, duration: number): MutableLifeProfileState {
  const actors = state.actors.map((actor) => {
    const household = state.households.find((item) => item.householdRef === actor.householdRef);
    if (!household) return actor;
    let nextActor = applyMetabolicDrift(actor, duration);
    const sleepMinutes = overlapScheduleMinutes(startMinute, duration, nextActor.sleep.schedule);
    const workMinutes = nextActor.work ? overlapScheduleMinutes(startMinute, duration, nextActor.work.schedule) : 0;
    const studyMinutes = nextActor.study ? overlapScheduleMinutes(startMinute, duration, nextActor.study.schedule) : 0;

    nextActor = applyFoodAndWater(state, nextActor, household, startMinute, duration);
    nextActor = applySleep(nextActor, sleepMinutes);
    if (nextActor.work) nextActor = applyWork(state, nextActor, household, startMinute, workMinutes);
    if (nextActor.study) {
      const studyStartMinute = firstScheduleOccurrenceMinute(startMinute, duration, nextActor.study.schedule) ?? startMinute;
      nextActor = applyStudy(state, nextActor, household, studyStartMinute, studyMinutes);
    }
    return clampActor(nextActor);
  });

  return { ...state, actors };
}

function applyMetabolicDrift(actor: MutableActor, duration: number): MutableActor {
  return {
    ...actor,
    body: {
      ...actor.body,
      hunger: clampBps(actor.body.hunger + duration * 4),
      thirst: clampBps(actor.body.thirst + duration * 6),
      fatigue: clampBps(actor.body.fatigue + duration * 3),
      stress: clampBps(actor.body.stress + duration),
      health: clampBps(actor.body.health - (actor.body.hunger > 8_500 || actor.body.thirst > 8_500 ? duration * 2 : 0)),
    },
    mind: {
      ...actor.mind,
      stress: clampBps(actor.mind.stress + duration),
      mood: clampBps(actor.mind.mood - duration),
    },
  };
}

function applyFoodAndWater(
  state: MutableLifeProfileState,
  actor: MutableActor,
  household: MutableHousehold,
  startMinute: number,
  duration: number,
): MutableActor {
  let nextActor = actor;
  const foodNeeded = Math.ceil(duration / 360);
  const waterNeeded = Math.ceil(duration / 240);
  if (foodNeeded > 0) {
    nextActor = consumeOrConsequence(state, nextActor, household, startMinute, "food", foodNeeded, "eat");
  }
  if (waterNeeded > 0) {
    nextActor = consumeOrConsequence(state, nextActor, household, startMinute, "water", waterNeeded, "drink");
  }
  return nextActor;
}

function applySleep(actor: MutableActor, sleepMinutes: number): MutableActor {
  if (sleepMinutes <= 0) return actor;
  return {
    ...actor,
    body: {
      ...actor.body,
      fatigue: clampBps(actor.body.fatigue - sleepMinutes * 16),
      stress: clampBps(actor.body.stress - sleepMinutes * 3),
      health: clampBps(actor.body.health + sleepMinutes),
    },
    mind: {
      ...actor.mind,
      stress: clampBps(actor.mind.stress - sleepMinutes * 4),
      mood: clampBps(actor.mind.mood + sleepMinutes * 2),
    },
  };
}

function applyWork(
  state: MutableLifeProfileState,
  actor: MutableActor,
  household: MutableHousehold,
  startMinute: number,
  workMinutes: number,
): MutableActor {
  if (workMinutes <= 0 || !actor.work) return actor;
  const wage = Math.floor(workMinutes * actor.work.wagePerWorldMinute);
  const employer = ensureExternalAccount(state, actor.work.employerAccountRef);
  if (wage > 0 && employer.money >= wage) {
    transfer(state, {
      occurredAtWorldMinute: startMinute,
      actorRef: actor.actorRef,
      householdRef: household.householdRef,
      resourceKey: "money",
      quantity: wage,
      fromAccountRef: actor.work.employerAccountRef,
      toAccountRef: household.resourceAccountRef,
      reason: "wage",
    });
    employer.money -= wage;
    household.resources.money += wage;
  } else if (wage > 0) {
    state.consequences.push(consequence(startMinute, actor.actorRef, household.householdRef, "debt", "money", wage, "employer could not settle wages; receivable debt recorded"));
    household.debt.money += wage;
  }
  return {
    ...actor,
    body: {
      ...actor.body,
      fatigue: clampBps(actor.body.fatigue + workMinutes * 5),
      hunger: clampBps(actor.body.hunger + workMinutes),
      thirst: clampBps(actor.body.thirst + workMinutes),
    },
    mind: {
      ...actor.mind,
      stress: clampBps(actor.mind.stress + workMinutes * 4),
      purpose: clampBps(actor.mind.purpose + workMinutes * 2),
    },
  };
}

function applyStudy(
  state: MutableLifeProfileState,
  actor: MutableActor,
  household: MutableHousehold,
  occurredAtWorldMinute: number,
  studyMinutes: number,
): MutableActor {
  if (studyMinutes <= 0 || !actor.study) return actor;
  const tuition = Math.floor(studyMinutes * actor.study.tuitionPerWorldMinute);
  const material = Math.ceil(studyMinutes * actor.study.materialPerWorldMinute);
  let paid = true;
  const school = ensureExternalAccount(state, actor.study.schoolAccountRef);
  if (tuition > 0) paid = transferHouseholdResource(state, household, actor, actor.study.schoolAccountRef, "money", tuition, "tuition", occurredAtWorldMinute);
  if (material > 0) paid = transferHouseholdResource(state, household, actor, actor.study.schoolAccountRef, "skill_material", material, "study_material", occurredAtWorldMinute) && paid;
  if (!paid) {
    state.consequences.push(consequence(occurredAtWorldMinute, actor.actorRef, household.householdRef, "missed_study", "tuition_credit", studyMinutes, "study commitment lost progress because tuition or materials were short"));
    school.tuition_credit += 0;
    return stressActor(actor, studyMinutes * 4, studyMinutes * 3);
  }

  const nextSkill = upsertSkill(actor.skills, actor.study.skillRef, studyMinutes, actor.study.progressBpsPerWorldMinute);
  return {
    ...actor,
    skills: nextSkill,
    body: {
      ...actor.body,
      fatigue: clampBps(actor.body.fatigue + studyMinutes * 3),
    },
    mind: {
      ...actor.mind,
      stress: clampBps(actor.mind.stress + studyMinutes * 2),
      purpose: clampBps(actor.mind.purpose + studyMinutes),
    },
  };
}

function consumeOrConsequence(
  state: MutableLifeProfileState,
  actor: MutableActor,
  household: MutableHousehold,
  startMinute: number,
  resourceKey: "food" | "water",
  quantity: number,
  reason: "eat" | "drink",
): MutableActor {
  if (household.resources[resourceKey] >= quantity) {
    const sinkAccountRef = `sink:${actor.actorRef}:${reason}`;
    transfer(state, {
      occurredAtWorldMinute: startMinute,
      actorRef: actor.actorRef,
      householdRef: household.householdRef,
      resourceKey,
      quantity,
      fromAccountRef: household.resourceAccountRef,
      toAccountRef: sinkAccountRef,
      reason,
    });
    household.resources[resourceKey] -= quantity;
    return {
      ...actor,
      body: {
        ...actor.body,
        hunger: reason === "eat" ? clampBps(actor.body.hunger - quantity * 1_200) : actor.body.hunger,
        thirst: reason === "drink" ? clampBps(actor.body.thirst - quantity * 1_500) : actor.body.thirst,
        health: clampBps(actor.body.health + quantity * 100),
      },
    };
  }
  household.debt[resourceKey] += quantity;
  state.consequences.push(consequence(startMinute, actor.actorRef, household.householdRef, "resource_shortage", resourceKey, quantity, `${resourceKey} shortage recorded as household debt and actor harm`));
  return {
    ...actor,
    body: {
      ...actor.body,
      hunger: resourceKey === "food" ? clampBps(actor.body.hunger + quantity * 800) : actor.body.hunger,
      thirst: resourceKey === "water" ? clampBps(actor.body.thirst + quantity * 1_000) : actor.body.thirst,
      health: clampBps(actor.body.health - quantity * 500),
    },
    mind: {
      ...actor.mind,
      stress: clampBps(actor.mind.stress + quantity * 400),
      mood: clampBps(actor.mind.mood - quantity * 300),
    },
  };
}

function firstScheduleOccurrenceMinute(
  startMinute: number,
  duration: number,
  schedule: readonly LifeProfileScheduleWindow[],
): number | undefined {
  for (let offset = 0; offset < duration; offset += 1) {
    const worldMinute = startMinute + offset;
    const minuteOfDay = ((worldMinute % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
    if (schedule.some((window) => isMinuteInScheduleWindow(minuteOfDay, window))) return worldMinute;
  }
  return undefined;
}

function isMinuteInScheduleWindow(minuteOfDay: number, window: LifeProfileScheduleWindow): boolean {
  if (window.startMinuteOfDay <= window.endMinuteOfDay) {
    return minuteOfDay >= window.startMinuteOfDay && minuteOfDay < window.endMinuteOfDay;
  }
  return minuteOfDay >= window.startMinuteOfDay || minuteOfDay < window.endMinuteOfDay;
}

function transferHouseholdResource(
  state: MutableLifeProfileState,
  household: MutableHousehold,
  actor: MutableActor,
  toAccountRef: string,
  resourceKey: LifeProfileResourceKey,
  quantity: number,
  reason: "tuition" | "study_material",
  occurredAtWorldMinute: number,
): boolean {
  if (household.resources[resourceKey] < quantity) {
    household.debt[resourceKey] += quantity;
    state.consequences.push(consequence(occurredAtWorldMinute, actor.actorRef, household.householdRef, "debt", resourceKey, quantity, `${resourceKey} shortage recorded for ${reason}`));
    return false;
  }
  ensureExternalAccount(state, toAccountRef)[resourceKey] += quantity;
  household.resources[resourceKey] -= quantity;
  transfer(state, {
    occurredAtWorldMinute,
    actorRef: actor.actorRef,
    householdRef: household.householdRef,
    resourceKey,
    quantity,
    fromAccountRef: household.resourceAccountRef,
    toAccountRef,
    reason,
  });
  return true;
}

function transfer(
  state: MutableLifeProfileState,
  input: Omit<LifeProfileResourceDelta, "deltaId" | "unit" | "sourceRef" | "sinkRef">,
): void {
  state.resourceDeltas.push({
    ...input,
    deltaId: `life_delta_${state.resourceDeltas.length + 1}`,
    unit: RESOURCE_UNITS[input.resourceKey],
    sourceRef: input.fromAccountRef,
    sinkRef: input.toAccountRef,
  });
}

function createHouseholds(input: LifeProfileCreateInput, worldMinute: number): readonly LifeProfileHousehold[] {
  const explicit = new Map((input.households || []).map((household) => [household.householdRef, household]));
  const refs = new Set([...explicit.keys(), ...input.actors.map((actor) => actor.householdRef)]);
  return [...refs].sort().map((householdRef) => {
    const item = explicit.get(householdRef);
    return {
      householdRef,
      memberActorRefs: item?.memberActorRefs || [],
      resourceAccountRef: item?.resourceAccountRef || `household:${householdRef}:resources`,
      resources: resources({ money: 2_000, food: 6, water: 8, ...item?.resources }),
      debt: resources(item?.debt),
    };
  });
}

function createActor(input: LifeProfileActorInput, worldMinute: number): LifeProfileActor {
  const hasWork = Boolean(input.work);
  const hasStudy = Boolean(input.study);
  const identityKind = input.identityKind || (hasWork && hasStudy ? "both" : hasWork ? "employed" : hasStudy ? "student" : "unassigned");
  return {
    actorKind: input.actorKind || "actor",
    actorRef: input.actorRef,
    householdRef: input.householdRef,
    identityKind,
    body: metrics(input.body, input.actorRef, worldMinute),
    mind: metrics(input.mind, `${input.actorRef}:mind`, worldMinute),
    skills: input.skills || [],
    work: input.work,
    study: input.study,
    sleep: { schedule: input.sleep?.schedule || DEFAULT_SLEEP },
  };
}

function metrics(input: Partial<LifeProfileMetricSet> | undefined, seed: string, worldMinute: number): LifeProfileMetricSet {
  return {
    hunger: clampBps(input?.hunger ?? deterministic(seed, "hunger", worldMinute, 1_000, 2_500)),
    thirst: clampBps(input?.thirst ?? deterministic(seed, "thirst", worldMinute, 1_000, 2_500)),
    fatigue: clampBps(input?.fatigue ?? deterministic(seed, "fatigue", worldMinute, 1_500, 3_500)),
    stress: clampBps(input?.stress ?? deterministic(seed, "stress", worldMinute, 1_000, 3_000)),
    health: clampBps(input?.health ?? 8_000),
    mood: clampBps(input?.mood ?? 6_000),
    belonging: clampBps(input?.belonging ?? 5_000),
    purpose: clampBps(input?.purpose ?? 5_000),
  };
}

function validateSchedule(schedule: readonly LifeProfileScheduleWindow[], path: string): readonly LifeProfileValidationError[] {
  const errors: LifeProfileValidationError[] = [];
  schedule.forEach((window, index) => {
    if (
      !Number.isInteger(window.startMinuteOfDay) ||
      !Number.isInteger(window.endMinuteOfDay) ||
      window.startMinuteOfDay < 0 ||
      window.startMinuteOfDay >= DAY_MINUTES ||
      window.endMinuteOfDay < 0 ||
      window.endMinuteOfDay >= DAY_MINUTES ||
      window.startMinuteOfDay === window.endMinuteOfDay
    ) {
      errors.push(error("LIFE_PROFILE_SCHEDULE_RANGE", `${path}.${index}`, "schedule windows must be within one day and non-empty"));
    }
  });
  return errors;
}

function overlapScheduleMinutes(startMinute: number, duration: number, schedule: readonly LifeProfileScheduleWindow[]): number {
  let total = 0;
  for (let minuteOffset = 0; minuteOffset < duration; minuteOffset += 1) {
    const minuteOfDay = positiveModulo(startMinute + minuteOffset, DAY_MINUTES);
    if (schedule.some((window) => inWindow(minuteOfDay, window))) total += 1;
  }
  return total;
}

function inWindow(minuteOfDay: number, window: LifeProfileScheduleWindow): boolean {
  if (window.startMinuteOfDay < window.endMinuteOfDay) {
    return minuteOfDay >= window.startMinuteOfDay && minuteOfDay < window.endMinuteOfDay;
  }
  return minuteOfDay >= window.startMinuteOfDay || minuteOfDay < window.endMinuteOfDay;
}

function upsertSkill(
  skills: readonly LifeProfileSkillProgress[],
  skillRef: string,
  studiedWorldMinutes: number,
  progressBpsPerWorldMinute: number,
): readonly LifeProfileSkillProgress[] {
  const existing = skills.find((skill) => skill.skillRef === skillRef);
  const updated: LifeProfileSkillProgress = {
    skillRef,
    studiedWorldMinutes: (existing?.studiedWorldMinutes || 0) + studiedWorldMinutes,
    progressBps: clampBps((existing?.progressBps || 0) + Math.floor(studiedWorldMinutes * progressBpsPerWorldMinute)),
  };
  return existing
    ? skills.map((skill) => (skill.skillRef === skillRef ? updated : skill))
    : [...skills, updated];
}

function stressActor(actor: MutableActor, stress: number, fatigue: number): MutableActor {
  return {
    ...actor,
    body: { ...actor.body, fatigue: clampBps(actor.body.fatigue + fatigue), health: clampBps(actor.body.health - stress) },
    mind: { ...actor.mind, stress: clampBps(actor.mind.stress + stress), mood: clampBps(actor.mind.mood - stress) },
  };
}

function ensureExternalAccount(state: MutableLifeProfileState, accountRef: string): MutableResources {
  state.externalAccounts[accountRef] ||= mutableResources(DEFAULT_RESOURCES);
  return state.externalAccounts[accountRef];
}

function normalizeExternalAccounts(input: Readonly<Record<string, Partial<LifeProfileResources>>> | undefined): Readonly<Record<string, LifeProfileResources>> {
  return Object.fromEntries(Object.entries(input || {}).map(([accountRef, account]) => [accountRef, resources(account)]));
}

function resources(input: Partial<LifeProfileResources> | undefined): LifeProfileResources {
  return {
    money: amount(input?.money),
    food: amount(input?.food),
    water: amount(input?.water),
    tuition_credit: amount(input?.tuition_credit),
    skill_material: amount(input?.skill_material),
  };
}

function deterministic(seed: string, key: string, worldMinute: number, min: number, width: number): number {
  let value = 0;
  const text = `${seed}:${key}:${worldMinute}`;
  for (let index = 0; index < text.length; index += 1) value = (value * 31 + text.charCodeAt(index)) >>> 0;
  return min + (value % width);
}

function consequence(
  occurredAtWorldMinute: number,
  actorRef: string | undefined,
  householdRef: string | undefined,
  kind: LifeProfileConsequenceKind,
  resourceKey: LifeProfileResourceKey | undefined,
  quantity: number | undefined,
  message: string,
): LifeProfileConsequence {
  return {
    consequenceId: `life_consequence_${occurredAtWorldMinute}_${actorRef || householdRef || "profile"}_${kind}_${resourceKey || "none"}`,
    occurredAtWorldMinute,
    actorRef,
    householdRef,
    kind,
    resourceKey,
    quantity,
    message,
  };
}

function error(code: string, path: string, message: string): LifeProfileValidationError {
  return { code, path, message };
}

function clampActor(actor: MutableActor): MutableActor {
  return {
    ...actor,
    body: clampMetrics(actor.body),
    mind: clampMetrics(actor.mind),
  };
}

function clampMetrics(input: MutableMetrics): MutableMetrics {
  return {
    hunger: clampBps(input.hunger),
    thirst: clampBps(input.thirst),
    fatigue: clampBps(input.fatigue),
    stress: clampBps(input.stress),
    health: clampBps(input.health),
    mood: clampBps(input.mood),
    belonging: clampBps(input.belonging),
    purpose: clampBps(input.purpose),
  };
}

function clampBps(value: number): number {
  return Math.max(0, Math.min(10_000, Math.round(value)));
}

function amount(value: number | undefined): number {
  return Math.max(0, Math.floor(value || 0));
}

function minute(value: number): number {
  return Math.max(0, Math.floor(value));
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

type MutableResources = {
  -readonly [K in keyof LifeProfileResources]: LifeProfileResources[K];
};
type MutableMetrics = {
  -readonly [K in keyof LifeProfileMetricSet]: LifeProfileMetricSet[K];
};
type MutableActor = Omit<LifeProfileActor, "body" | "mind" | "skills"> & {
  readonly body: MutableMetrics;
  readonly mind: MutableMetrics;
  readonly skills: readonly LifeProfileSkillProgress[];
};
type MutableHousehold = Omit<LifeProfileHousehold, "resources" | "debt"> & {
  readonly resources: MutableResources;
  readonly debt: MutableResources;
};
interface MutableLifeProfileState {
  readonly worldMinute: number;
  readonly actors: readonly MutableActor[];
  readonly households: readonly MutableHousehold[];
  readonly externalAccounts: Record<string, MutableResources>;
  readonly resourceDeltas: LifeProfileResourceDelta[];
  readonly consequences: LifeProfileConsequence[];
}

function mutableState(state: LifeProfileState): MutableLifeProfileState {
  return {
    worldMinute: state.worldMinute,
    actors: state.actors.map((actor) => ({
      ...actor,
      body: { ...actor.body },
      mind: { ...actor.mind },
      skills: [...actor.skills],
    })),
    households: state.households.map((household) => ({
      ...household,
      resources: mutableResources(household.resources),
      debt: mutableResources(household.debt),
    })),
    externalAccounts: Object.fromEntries(Object.entries(state.externalAccounts).map(([accountRef, account]) => [accountRef, mutableResources(account)])),
    resourceDeltas: [...state.resourceDeltas],
    consequences: [...state.consequences],
  };
}

function mutableResources(input: LifeProfileResources): MutableResources {
  return { ...input };
}

function freezeState(state: MutableLifeProfileState): LifeProfileState {
  return {
    worldMinute: state.worldMinute,
    actors: state.actors,
    households: state.households,
    externalAccounts: state.externalAccounts,
    resourceDeltas: state.resourceDeltas,
    consequences: state.consequences,
  };
}
