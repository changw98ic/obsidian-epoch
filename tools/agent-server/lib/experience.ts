const FACTION_SOUND_STYLES: Record<string, { style: string; ambience: string }> = {
  "腐林档案会": { style: "spore_archive", ambience: "damp_tape_loop" },
  "云脑族": { style: "dream_index", ambience: "soft_polyphonic_static" },
  "赛博工业财团": { style: "industrial_pulse", ambience: "cold_servo_floor" },
};

interface CompletedRun {
  readonly runTicket: unknown;
  readonly score: unknown;
}

export type TtsPublicSharingPolicy = "system_voice_allowed" | "requires_voice_rights_confirmation";
export type CustomTtsHostingPolicy = "not_hosted";

export interface TtsSharePolicy {
  readonly publicSharing: TtsPublicSharingPolicy;
  readonly requiresVoiceRightsConfirmation: boolean;
  readonly customTtsHosting: CustomTtsHostingPolicy;
  readonly confirmationCopy: string;
}

interface ExperienceState {
  readonly explorerId: string;
  readonly completedRuns: CompletedRun[];
  readonly tts: {
    unlocked: boolean;
    voiceId: string;
    unlockRequirement: string;
    sharePolicy: TtsSharePolicy;
  };
  readonly audio: {
    enabled: boolean;
    soundStyle: string;
  };
}

interface ExperienceLedgerOptions {
  readonly ttsUnlockRuns?: number;
  readonly initialStates?: readonly Partial<ExperienceState>[];
}

function ttsSharePolicyFor(voiceId: string): TtsSharePolicy {
  const customVoice = voiceId !== "system_default";
  return {
    publicSharing: customVoice ? "requires_voice_rights_confirmation" : "system_voice_allowed",
    requiresVoiceRightsConfirmation: customVoice,
    customTtsHosting: "not_hosted",
    confirmationCopy: customVoice
      ? "公开分享语音前，请确认你拥有音色使用权；平台默认不托管自定义 TTS 产物。"
      : "系统默认音色可用于结果页体验；平台默认不托管自定义 TTS 产物。",
  };
}

function defaultState(explorerId: string): ExperienceState {
  return {
    explorerId,
    completedRuns: [],
    tts: {
      unlocked: false,
      voiceId: "system_default",
      unlockRequirement: "complete_more_stories",
      sharePolicy: ttsSharePolicyFor("system_default"),
    },
    audio: {
      enabled: false,
      soundStyle: "archive_neutral",
    },
  };
}

export function settlementEffectFor({ score }: { score: number }) {
  if (score >= 98) return { badge: "夯", intensity: "full", palette: "gold_cyan", soundCue: "mythic_lock" };
  if (score >= 90) return { badge: "S", intensity: "high", palette: "gold", soundCue: "archive_seal" };
  if (score >= 80) return { badge: "A", intensity: "strong", palette: "cyan", soundCue: "claim_unlock" };
  if (score >= 70) return { badge: "B", intensity: "medium", palette: "blue", soundCue: "field_report" };
  if (score >= 60) return { badge: "C", intensity: "medium", palette: "green", soundCue: "pass_stamp" };
  return { badge: "修", intensity: "low", palette: "muted", soundCue: "repair_ping" };
}

export function ratingRevealFor(rating: unknown) {
  if (rating === "hang") return { motion: "full_settlement", durationMs: 2200 };
  if (rating === "major") return { motion: "seal_drop", durationMs: 1600 };
  if (rating === "strong") return { motion: "claim_fan", durationMs: 1200 };
  if (rating === "qualified" || rating === "pass") return { motion: "stamp", durationMs: 900 };
  return { motion: "static", durationMs: 400 };
}

export function createExperienceLedger(options: ExperienceLedgerOptions = {}) {
  const ttsUnlockRuns = options.ttsUnlockRuns || 3;
  const explorers = new Map<string, ExperienceState>();
  for (const state of options.initialStates || []) {
    if (state?.explorerId) {
      const tts = { ...defaultState(state.explorerId).tts, ...(state.tts || {}) };
      tts.sharePolicy = ttsSharePolicyFor(tts.voiceId);
      explorers.set(state.explorerId, {
        explorerId: state.explorerId,
        completedRuns: Array.isArray(state.completedRuns) ? state.completedRuns.map((run) => ({ ...run })) : [],
        tts,
        audio: { ...(state.audio || defaultState(state.explorerId).audio) },
      });
    }
  }

  function getMutable(explorerId: string) {
    if (!explorers.has(explorerId)) explorers.set(explorerId, defaultState(explorerId));
    return explorers.get(explorerId) as ExperienceState;
  }

  function refreshUnlock(state: ExperienceState) {
    state.tts.unlocked = state.completedRuns.length >= ttsUnlockRuns;
    state.tts.unlockRequirement = state.tts.unlocked
      ? "unlocked"
      : `complete_${ttsUnlockRuns - state.completedRuns.length}_more_stories`;
    state.tts.sharePolicy = ttsSharePolicyFor(state.tts.voiceId);
  }

  function getExperienceState(explorerId: string) {
    const state = getMutable(explorerId);
    refreshUnlock(state);
    return {
      explorerId: state.explorerId,
      completedRuns: state.completedRuns.map((run) => ({ ...run })),
      tts: { ...state.tts },
      audio: { ...state.audio },
    };
  }

  function recordRunCompletion({ explorerId, runTicket, score }: {
    readonly explorerId: string;
    readonly runTicket: unknown;
    readonly score: unknown;
  }) {
    const state = getMutable(explorerId);
    if (Number(score || 0) >= 60 && !state.completedRuns.some((run) => run.runTicket === runTicket)) {
      state.completedRuns.push({ runTicket, score });
    }
    refreshUnlock(state);
    return getExperienceState(explorerId);
  }

  function selectVoiceProfile({ explorerId, voiceId }: {
    readonly explorerId: string;
    readonly voiceId?: string;
  }) {
    const state = getMutable(explorerId);
    refreshUnlock(state);
    if (!state.tts.unlocked) return { status: "locked", requirement: state.tts.unlockRequirement };
    state.tts.voiceId = voiceId || "system_default";
    state.tts.sharePolicy = ttsSharePolicyFor(state.tts.voiceId);
    return { status: "selected", voiceId: state.tts.voiceId, sharePolicy: state.tts.sharePolicy };
  }

  function soundStyleForFaction(factionId: string) {
    return FACTION_SOUND_STYLES[factionId] || { style: "archive_neutral", ambience: "quiet_room" };
  }

  return {
    getExperienceState,
    recordRunCompletion,
    selectVoiceProfile,
    soundStyleForFaction,
  };
}
