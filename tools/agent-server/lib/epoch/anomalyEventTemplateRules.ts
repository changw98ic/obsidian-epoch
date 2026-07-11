import { createHash } from "node:crypto";
import { epochBossAssetForTemplate } from "../bossAssets.ts";
import type {
  EpochAnomalySeverity,
  EpochResourceId,
} from "./protocol.ts";
import type { CreateAnomalyEventInput } from "./gameCore.ts";

type AnyRecord = Record<string, unknown>;

export interface AnomalyEventTemplate extends Omit<CreateAnomalyEventInput, "regionId"> {
  readonly narrativeVariants?: readonly string[];
}

function bossMediaAsset(templateKey: string) {
  const asset = epochBossAssetForTemplate(templateKey);
  if (!asset) throw new Error(`boss_asset_missing:${templateKey}`);
  return {
    assetPath: asset.path,
    imageUrl: asset.url,
  };
}

const ANOMALY_EVENT_TEMPLATES = {
  gray_harbor_minor_rift: {
    title: "灰港低阶裂隙",
    description: "港口盐雾里张开的一道低阶异常裂隙，只有服务器结算会授予奖励。",
    severity: "minor",
    targetScore: 6,
    reward: {
      resourceId: "aether",
      amount: 2,
      reason: "anomaly_contained",
    },
    lifetimeRisk: 1,
  },
  obsidian_wyrm_boss: {
    title: "黑曜裂隙兽",
    description: "从黑曜潮线爬出的区域级裂隙首领。服务器模板决定目标分、奖励与寿命风险，agent 只能在规则内参与压制。",
    media: {
      variantLabel: "黑曜潮线",
      scenePrompt: "wide cinematic game art, obsidian rift beast crawling from a black tide shoreline, crystalline spine, old harbor lighthouse, readable MMO boss event splash, no text",
      palette: ["#0f172a", "#7c3aed", "#f97316", "#38bdf8"],
      accentColor: "#7c3aed",
      dangerColor: "#f97316",
      sigil: "fractured-horn",
      publicAlt: "黑曜裂隙兽从黑色潮线和旧灯塔阴影中爬出。",
      ...bossMediaAsset("obsidian_wyrm_boss"),
    },
    narrativeVariants: [
      "黑曜潮线在低空翻卷，裂隙兽拖着结晶脊骨爬上岸线，所有压制进度都由服务器事件记录。",
      "港区地面浮起黑色鳞片，裂隙兽从雾墙中探出角冠，区域榜单会记录每一次有效专注投入。",
      "旧灯塔投下反向影子，裂隙兽沿着影子啃开空间缝隙，奖励、寿命风险和结算只按服务器规则生效。",
    ],
    severity: "major",
    targetScore: 18,
    reward: {
      resourceId: "legend",
      amount: 2,
      reason: "obsidian_wyrm_contained",
    },
    lifetimeRisk: 3,
  },
  salt_mirror_leviathan_boss: {
    title: "盐镜巡海巨兽",
    description: "在盐雾海面和镜化码头之间巡游的巨型异常首领，会把区域交易与航路折射成高风险幻象。",
    media: {
      variantLabel: "盐镜航路",
      scenePrompt: "wide cinematic game art, salt mirror leviathan moving through mirrored harbor water, inverted tide, fractured trade route reflections, readable MMO boss event splash, no text",
      palette: ["#1e293b", "#f8fafc", "#0ea5e9", "#facc15"],
      accentColor: "#0ea5e9",
      dangerColor: "#facc15",
      sigil: "mirror-fin",
      publicAlt: "盐镜巡海巨兽穿过镜化海面和倒置潮汐。",
      ...bossMediaAsset("salt_mirror_leviathan_boss"),
    },
    narrativeVariants: [
      "盐镜海面升起倒置潮汐，巡海巨兽在镜化航路间折返，扰动本区市场与航线传闻。",
      "码头木桩映出第二个月亮，巡海巨兽的脊鳍划开盐雾，所有压制贡献进入服务器榜单。",
      "海面像银色档案页一样翻动，巡海巨兽把商队影子拖进镜中，结算奖励只来自服务器事件。",
    ],
    severity: "major",
    targetScore: 22,
    reward: {
      resourceId: "legend",
      amount: 2,
      reason: "salt_mirror_leviathan_contained",
    },
    lifetimeRisk: 3,
  },
  glass_archive_seraph_boss: {
    title: "玻璃档案炽使",
    description: "从破碎档案馆升起的多翼异常首领，会重写区域传闻、NPC 记忆和旧季节记录的可见层。",
    media: {
      variantLabel: "玻璃档案馆",
      scenePrompt: "wide cinematic game art, glass archive seraph with many transparent wings above broken filing cabinets, burning memory dust, occult library anomaly, readable MMO boss event splash, no text",
      palette: ["#111827", "#a7f3d0", "#f43f5e", "#f8fafc"],
      accentColor: "#a7f3d0",
      dangerColor: "#f43f5e",
      sigil: "glass-wing",
      publicAlt: "玻璃档案炽使在破碎档案馆和透明羽翼间降临。",
      ...bossMediaAsset("glass_archive_seraph_boss"),
    },
    narrativeVariants: [
      "破碎档案馆展开玻璃羽翼，炽使把旧新闻烧成透明灰烬，区域记忆开始出现重影。",
      "成排档案柜同时开合，炽使从索引页背面降临，NPC 记忆与季节记录进入高危校验。",
      "玻璃穹顶映出无数过期战报，炽使沿着裂纹行走，只有服务器确认的压制会进入正史。",
    ],
    severity: "cataclysm",
    targetScore: 30,
    reward: {
      resourceId: "legend",
      amount: 3,
      reason: "glass_archive_seraph_contained",
    },
    lifetimeRisk: 5,
  },
  ash_crown_titan_boss: {
    title: "灰冠炉心巨像",
    description: "由废炉、旧王冠和黑曜余烬拼合出的重装异常首领，会压迫区域资源点并诱发多人争夺。",
    media: {
      variantLabel: "灰冠炉心",
      scenePrompt: "wide cinematic game art, ash crown furnace titan rising from ruined industrial kiln, broken crown chains, ember pressure over resource fields, readable MMO boss event splash, no text",
      palette: ["#18181b", "#dc2626", "#fbbf24", "#94a3b8"],
      accentColor: "#fbbf24",
      dangerColor: "#dc2626",
      sigil: "crowned-furnace",
      publicAlt: "灰冠炉心巨像从废炉和旧王冠链条中站起。",
      ...bossMediaAsset("ash_crown_titan_boss"),
    },
    narrativeVariants: [
      "废炉重新点火，灰冠巨像拖着王冠链条踏入资源区，区域节点出现重压告警。",
      "黑曜余烬在地面排成王座纹路，炉心巨像从纹路中央站起，争夺压力同步写入服务器事件。",
      "旧王冠倒扣在熔炉上方，巨像每一步都震落灰色火星，压制失败会让区域资源线持续动荡。",
    ],
    severity: "major",
    targetScore: 24,
    reward: {
      resourceId: "aether",
      amount: 6,
      reason: "ash_crown_titan_contained",
    },
    lifetimeRisk: 4,
  },
  moonwell_hollow_queen_boss: {
    title: "月井空壳女王",
    description: "栖在废弃月井里的空壳蜂群首领，会把区域低语编织成魅惑型公共事件和高传说度战报。",
    media: {
      variantLabel: "月井空壳",
      scenePrompt: "wide cinematic game art, hollow queen beside an abandoned moonwell, silver swarm, echo crown, enchanted whispers over dark water, readable MMO boss event splash, no text",
      palette: ["#0b1120", "#c084fc", "#e5e7eb", "#22c55e"],
      accentColor: "#c084fc",
      dangerColor: "#22c55e",
      sigil: "hollow-crown",
      publicAlt: "月井空壳女王在废弃月井边召集银色回声蜂群。",
      ...bossMediaAsset("moonwell_hollow_queen_boss"),
    },
    narrativeVariants: [
      "废弃月井反射出无月夜空，空壳女王在井壁产下回声蜂群，区域低语开始同步扩散。",
      "井水变成薄银色蛛网，空壳女王让空壳蜂群模仿熟人的声音，公共事件进入魅惑风险层。",
      "月井边缘浮起空壳王冠，女王把低语编成战报诱饵，传说奖励仍只按服务器压制结算发放。",
    ],
    severity: "major",
    targetScore: 20,
    reward: {
      resourceId: "legend",
      amount: 2,
      reason: "moonwell_hollow_queen_contained",
    },
    lifetimeRisk: 3,
  },
} satisfies Record<string, AnomalyEventTemplate>;

export type AnomalyEventTemplateKey = keyof typeof ANOMALY_EVENT_TEMPLATES;

const DEFAULT_ANOMALY_TEMPLATE_KEY: AnomalyEventTemplateKey = "gray_harbor_minor_rift";
const MAINTENANCE_BOSS_TEMPLATE_KEYS = [
  "obsidian_wyrm_boss",
  "salt_mirror_leviathan_boss",
  "glass_archive_seraph_boss",
  "ash_crown_titan_boss",
  "moonwell_hollow_queen_boss",
] as const satisfies readonly AnomalyEventTemplateKey[];

export function anomalyEventTemplateCatalog() {
  return Object.entries(ANOMALY_EVENT_TEMPLATES).map(([key, template]) => ({
    key,
    ...template,
  }));
}

function isAnomalyEventTemplateKey(value: string): value is AnomalyEventTemplateKey {
  return Object.prototype.hasOwnProperty.call(ANOMALY_EVENT_TEMPLATES, value);
}

export function anomalyBossTemplateKeyForSeed(seed: string): AnomalyEventTemplateKey {
  const digest = createHash("sha256").update(seed).digest();
  return MAINTENANCE_BOSS_TEMPLATE_KEYS[digest[0] % MAINTENANCE_BOSS_TEMPLATE_KEYS.length];
}

export function anomalyTemplateKeyFromInput(input: AnyRecord): AnomalyEventTemplateKey {
  const candidate = typeof input.anomalyTemplateKey === "string" && input.anomalyTemplateKey.trim()
    ? input.anomalyTemplateKey.trim()
    : typeof input.templateKey === "string" && input.templateKey.trim()
      ? input.templateKey.trim()
      : undefined;
  if (candidate) {
    return isAnomalyEventTemplateKey(candidate) ? candidate : DEFAULT_ANOMALY_TEMPLATE_KEY;
  }
  if (typeof input.anomalyTemplateRotationSeed === "string" && input.anomalyTemplateRotationSeed.trim()) {
    return anomalyBossTemplateKeyForSeed(input.anomalyTemplateRotationSeed.trim());
  }
  return DEFAULT_ANOMALY_TEMPLATE_KEY;
}

function anomalyNarrativeSeed(regionId: string, templateKey: AnomalyEventTemplateKey, input: AnyRecord) {
  const explicitSeed = typeof input.anomalyNarrativeVariantSeed === "string" && input.anomalyNarrativeVariantSeed.trim()
    ? input.anomalyNarrativeVariantSeed.trim()
    : typeof input.anomalyTemplateRotationSeed === "string" && input.anomalyTemplateRotationSeed.trim()
      ? input.anomalyTemplateRotationSeed.trim()
      : `${regionId}:${templateKey}`;
  return `${templateKey}:${explicitSeed}`;
}

function anomalyNarrativeVariantForSeed(
  variants: readonly string[] | undefined,
  fallback: string,
  seed: string,
) {
  if (!variants?.length) return fallback;
  const digest = createHash("sha256").update(seed).digest();
  return variants[digest[0] % variants.length] || fallback;
}

export function anomalyEventInputFromTemplate(regionId: string, input: AnyRecord): CreateAnomalyEventInput {
  const templateKey = anomalyTemplateKeyFromInput(input);
  const { narrativeVariants, ...template } = ANOMALY_EVENT_TEMPLATES[templateKey] as AnomalyEventTemplate;
  return {
    ...template,
    description: anomalyNarrativeVariantForSeed(
      narrativeVariants,
      template.description || "区域异常链",
      anomalyNarrativeSeed(regionId, templateKey, input),
    ),
    regionId,
  };
}

export function anomalyEventInputFromOperatorInput(
  input: AnyRecord,
  regionId: string,
): CreateAnomalyEventInput {
  if (
    typeof input.templateKey === "string"
    || typeof input.anomalyTemplateKey === "string"
    || typeof input.anomalyTemplateRotationSeed === "string"
  ) {
    return anomalyEventInputFromTemplate(regionId, input);
  }
  const severity = typeof input.severity === "string" ? input.severity as EpochAnomalySeverity : "minor";
  const rewardResourceId = typeof input.rewardResourceId === "string"
    ? input.rewardResourceId as EpochResourceId
    : typeof input.resourceId === "string"
      ? input.resourceId as EpochResourceId
      : "aether";
  return {
    regionId,
    title: typeof input.title === "string" ? input.title : ANOMALY_EVENT_TEMPLATES.gray_harbor_minor_rift.title,
    description: typeof input.description === "string"
      ? input.description
      : ANOMALY_EVENT_TEMPLATES.gray_harbor_minor_rift.description,
    severity,
    targetScore: typeof input.targetScore === "number" ? input.targetScore : 6,
    reward: {
      resourceId: rewardResourceId,
      amount: typeof input.rewardAmount === "number" ? input.rewardAmount : 2,
      reason: typeof input.rewardReason === "string" ? input.rewardReason : "anomaly_contained",
    },
    lifetimeRisk: typeof input.lifetimeRisk === "number" ? input.lifetimeRisk : 1,
  };
}
