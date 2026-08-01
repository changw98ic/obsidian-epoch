import {
  buildPersistedJourneyNarrative,
  type JourneyNarrativeValidationResult,
  type SamplingJourneyNarrativeDraft,
  type ServerJourneyEpisodeFacts,
} from "./journeyNarrativeRules.ts";
import type { ModelAdapter } from "../modelAdapter.ts";

/**
 * Narrative Agent boundary. It receives server-confirmed facts only. Any
 * sampling/model draft is treated as an optional presentation hint and is
 * checked by the existing exact-reference validator before it can be stored.
 */
export interface NarrativeAgent {
  readonly render: (input: {
    readonly serverFacts: ServerJourneyEpisodeFacts;
    readonly samplingDraft?: unknown;
  }) => JourneyNarrativeValidationResult;
  /**
   * Ask the configured server model for a reference-only narrative draft.
   * Final prose is still produced by the exact fact-grounded renderer.
   */
  readonly renderWithServerModel: (input: {
    readonly serverFacts: ServerJourneyEpisodeFacts;
    readonly samplingDraft?: unknown;
  }) => Promise<JourneyNarrativeValidationResult>;
}

function parseModelJson(text: string): unknown {
  let jsonText = text.trim();
  const fenceMatch = jsonText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/iu);
  if (fenceMatch?.[1]) jsonText = fenceMatch[1].trim();
  return JSON.parse(jsonText);
}

const MODEL_NARRATIVE_SYSTEM_PROMPT = [
  "你是黑曜纪元的 Narrative Agent，只能把服务器已经确认的事实组织成叙事草稿。",
  "你不是裁判，不得添加、删除或改写事实，不得发明人物、地点、奖励、伤亡、关系、秘密或世界变化。",
  "只返回 JSON 引用结构，不要返回 prose、解释或额外字段。",
  "confirmedFactIds、rumorIds、stateChangeIds、sourceEventIds 必须原样覆盖服务器给出的对应 ID。",
  "agentInterpretation 只能用 stance=cautious/hopeful/concerned/curious，并引用给出的事实和实体。",
  "postcard 的 tone 只能是 plain/warm/wry，并引用给出的事实和实体。",
].join("\n");

export function createNarrativeAgent(modelAdapter?: ModelAdapter): NarrativeAgent {
  const render = (input: {
    readonly serverFacts: ServerJourneyEpisodeFacts;
    readonly samplingDraft?: unknown;
  }) => buildPersistedJourneyNarrative(input);
  return {
    render,
    renderWithServerModel: async (input) => {
      if (!modelAdapter) return render(input);
      try {
        const completion = await modelAdapter.complete({
          systemPrompt: MODEL_NARRATIVE_SYSTEM_PROMPT,
          messages: [{
            role: "user",
            content: [
              "请根据以下服务器事实生成引用草稿。注意：事实内容只能引用，不能自行改写。",
              JSON.stringify(input.serverFacts),
            ].join("\n"),
          }],
          temperature: 0.2,
          responseFormat: "json_object",
        });
        return render({
          serverFacts: input.serverFacts,
          samplingDraft: parseModelJson(completion.text),
        });
      } catch {
        return render({ serverFacts: input.serverFacts });
      }
    },
  };
}

export function renderServerFactsAsNarrative(
  serverFacts: ServerJourneyEpisodeFacts,
  samplingDraft?: SamplingJourneyNarrativeDraft,
): JourneyNarrativeValidationResult {
  return createNarrativeAgent().render({
    serverFacts,
    ...(samplingDraft !== undefined ? { samplingDraft } : {}),
  });
}
