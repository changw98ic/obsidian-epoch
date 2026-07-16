export type SharedNameSurface = "faction" | "character" | "location";

export type IpSimilarityCategory = "work" | "character" | "location" | "organization";

export interface IpSimilarityMatch {
  readonly surface: SharedNameSurface;
  readonly field: string;
  readonly value: string;
  readonly canonicalName: string;
  readonly category: IpSimilarityCategory;
  readonly matchedAlias: string;
  readonly similarity: number;
  readonly reason: "alias_contained" | "near_alias";
}

export interface IpSimilarityAssessment {
  readonly status: "clear" | "suspected";
  readonly reviewDefault: "none" | "moderation_hold";
  readonly matches: readonly IpSimilarityMatch[];
  readonly policy: {
    readonly action: "allow" | "moderation_hold";
    readonly threshold: number;
    readonly surfaces: readonly SharedNameSurface[];
  };
}

interface IpCatalogEntry {
  readonly canonicalName: string;
  readonly category: IpSimilarityCategory;
  readonly aliases: readonly string[];
}

const IP_SIMILARITY_THRESHOLD = 0.78;
const IP_SIMILARITY_SURFACES = ["faction", "character", "location"] as const;

const IP_CATALOG: readonly IpCatalogEntry[] = [
  {
    canonicalName: "Hogwarts",
    category: "location",
    aliases: ["hogwarts", "霍格沃茨", "霍格华兹", "霍格沃兹"],
  },
  {
    canonicalName: "Gandalf",
    category: "character",
    aliases: ["gandalf", "甘道夫"],
  },
  {
    canonicalName: "Harry Potter",
    category: "character",
    aliases: ["harrypotter", "哈利波特", "哈利·波特"],
  },
  {
    canonicalName: "Darth Vader",
    category: "character",
    aliases: ["darthvader", "达斯维达", "达斯·维达"],
  },
  {
    canonicalName: "Jedi Order",
    category: "organization",
    aliases: ["jediorder", "绝地武士团", "绝地议会"],
  },
  {
    canonicalName: "Middle-earth",
    category: "location",
    aliases: ["middleearth", "中土世界"],
  },
  {
    canonicalName: "Rivendell",
    category: "location",
    aliases: ["rivendell", "瑞文戴尔"],
  },
  {
    canonicalName: "Winterfell",
    category: "location",
    aliases: ["winterfell", "临冬城"],
  },
  {
    canonicalName: "SCP Foundation",
    category: "organization",
    aliases: ["scpfoundation", "scp基金会"],
  },
];

function displayText(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function normalizeForSimilarity(value: unknown) {
  return displayText(value)
    .normalize("NFKC")
    .toLocaleLowerCase("zh-CN")
    .replace(/[\p{P}\p{S}_\s]+/gu, "");
}

function levenshteinDistance(left: string, right: string) {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
    const current = [leftIndex + 1];
    for (let rightIndex = 0; rightIndex < right.length; rightIndex += 1) {
      const cost = left[leftIndex] === right[rightIndex] ? 0 : 1;
      current[rightIndex + 1] = Math.min(
        current[rightIndex] + 1,
        previous[rightIndex + 1] + 1,
        previous[rightIndex] + cost,
      );
    }
    previous = current;
  }
  return previous[right.length];
}

function similarity(left: string, right: string) {
  const length = Math.max(left.length, right.length);
  if (!length) return 1;
  return 1 - (levenshteinDistance(left, right) / length);
}

function bestWindowSimilarity(value: string, alias: string) {
  if (!value || !alias) return 0;
  if (value.length <= alias.length) return similarity(value, alias);
  let best = 0;
  for (let index = 0; index <= value.length - alias.length; index += 1) {
    best = Math.max(best, similarity(value.slice(index, index + alias.length), alias));
  }
  return best;
}

function matchAlias(value: string, alias: string) {
  if (!value || !alias) return undefined;
  if (value.includes(alias)) {
    return {
      similarity: 1,
      reason: "alias_contained" as const,
    };
  }
  if (alias.length < 4) return undefined;
  const score = bestWindowSimilarity(value, alias);
  if (score < IP_SIMILARITY_THRESHOLD) return undefined;
  return {
    similarity: Number(score.toFixed(3)),
    reason: "near_alias" as const,
  };
}

export function assessSharedNameIpSimilarity(input: {
  readonly surface: SharedNameSurface;
  readonly fields: Readonly<Record<string, unknown>>;
}): IpSimilarityAssessment {
  const matches: IpSimilarityMatch[] = [];
  for (const [field, rawValue] of Object.entries(input.fields)) {
    const value = displayText(rawValue);
    const normalizedValue = normalizeForSimilarity(value);
    if (!normalizedValue) continue;
    for (const entry of IP_CATALOG) {
      for (const alias of entry.aliases) {
        const normalizedAlias = normalizeForSimilarity(alias);
        const match = matchAlias(normalizedValue, normalizedAlias);
        if (!match) continue;
        matches.push({
          surface: input.surface,
          field,
          value,
          canonicalName: entry.canonicalName,
          category: entry.category,
          matchedAlias: alias,
          similarity: match.similarity,
          reason: match.reason,
        });
        break;
      }
    }
  }
  const deduped = Array.from(
    new Map(matches.map((match) => [`${match.field}:${match.canonicalName}`, match])).values(),
  ).sort((left, right) => right.similarity - left.similarity || left.canonicalName.localeCompare(right.canonicalName));
  const suspected = deduped.length > 0;
  return {
    status: suspected ? "suspected" : "clear",
    reviewDefault: suspected ? "moderation_hold" : "none",
    matches: deduped,
    policy: {
      action: suspected ? "moderation_hold" : "allow",
      threshold: IP_SIMILARITY_THRESHOLD,
      surfaces: IP_SIMILARITY_SURFACES,
    },
  };
}
