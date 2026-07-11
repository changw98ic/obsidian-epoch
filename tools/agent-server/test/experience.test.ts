import test from "node:test";
import assert from "node:assert/strict";
import {
  createExperienceLedger,
  ratingRevealFor,
  settlementEffectFor,
} from "../lib/experience.ts";

test("custom TTS unlocks only after enough completed stories", () => {
  const ledger = createExperienceLedger({ ttsUnlockRuns: 2 });

  assert.equal(ledger.getExperienceState("explorer_audio").tts.unlocked, false);
  ledger.recordRunCompletion({ explorerId: "explorer_audio", runTicket: "rt_1", score: 70 });
  assert.equal(ledger.getExperienceState("explorer_audio").tts.unlocked, false);
  ledger.recordRunCompletion({ explorerId: "explorer_audio", runTicket: "rt_2", score: 82 });
  assert.equal(ledger.getExperienceState("explorer_audio").tts.unlocked, true);
});

test("voice profile selection is blocked before unlock and allowed after unlock", () => {
  const ledger = createExperienceLedger({ ttsUnlockRuns: 1 });

  const blocked = ledger.selectVoiceProfile({ explorerId: "explorer_voice", voiceId: "archive_whisper" });
  ledger.recordRunCompletion({ explorerId: "explorer_voice", runTicket: "rt_1", score: 88 });
  const selected = ledger.selectVoiceProfile({ explorerId: "explorer_voice", voiceId: "archive_whisper" });

  assert.equal(blocked.status, "locked");
  assert.equal(selected.status, "selected");
  assert.equal(ledger.getExperienceState("explorer_voice").tts.voiceId, "archive_whisper");
});

test("custom TTS public sharing requires voice rights confirmation and is not platform hosted", () => {
  const ledger = createExperienceLedger({ ttsUnlockRuns: 1 });

  ledger.recordRunCompletion({ explorerId: "explorer_voice_share", runTicket: "rt_voice_share", score: 88 });
  const selected = ledger.selectVoiceProfile({
    explorerId: "explorer_voice_share",
    voiceId: "custom_celebrity_like_voice",
  });
  const state = ledger.getExperienceState("explorer_voice_share");

  assert.equal(selected.status, "selected");
  assert.ok(selected.sharePolicy);
  assert.equal(selected.sharePolicy.requiresVoiceRightsConfirmation, true);
  assert.equal(selected.sharePolicy.customTtsHosting, "not_hosted");
  assert.match(selected.sharePolicy.confirmationCopy, /拥有音色使用权/);
  assert.equal(state.tts.sharePolicy.publicSharing, "requires_voice_rights_confirmation");
  assert.equal(state.tts.sharePolicy.customTtsHosting, "not_hosted");
});

test("faction-specific sound styles are deterministic and safe defaults exist", () => {
  const ledger = createExperienceLedger();

  assert.equal(ledger.soundStyleForFaction("云脑族").style, "dream_index");
  assert.equal(ledger.soundStyleForFaction("赛博工业财团").style, "industrial_pulse");
  assert.equal(ledger.soundStyleForFaction("未知阵营").style, "archive_neutral");
});

test("settlement and rating reveal effects vary by score band", () => {
  assert.equal(settlementEffectFor({ score: 59 }).intensity, "low");
  assert.equal(settlementEffectFor({ score: 82 }).intensity, "strong");
  assert.equal(settlementEffectFor({ score: 99 }).badge, "夯");

  assert.equal(ratingRevealFor("repair").motion, "static");
  assert.equal(ratingRevealFor("hang").motion, "full_settlement");
});

test("new users receive a quiet default audio configuration", () => {
  const ledger = createExperienceLedger();
  const state = ledger.getExperienceState("explorer_new");

  assert.equal(state.tts.unlocked, false);
  assert.equal(state.tts.voiceId, "system_default");
  assert.equal(state.audio.enabled, false);
  assert.equal(state.audio.soundStyle, "archive_neutral");
});
