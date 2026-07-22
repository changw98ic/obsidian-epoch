import { createHash } from "node:crypto";
import {
  existsSync,
  readFileSync,
  readdirSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const WORLD_CONTENT_REGISTRY_SCHEMA_VERSION = 1;

export type WorldContentEntryKind = "rule" | "system" | "species" | "faction" | "place";

export interface WorldContentEntry {
  readonly id: string;
  readonly kind: WorldContentEntryKind;
  readonly label: string;
  readonly status: "可用";
  readonly sourcePath: string;
  readonly sourceType: string;
  readonly version: number;
  readonly contentHash: `sha256:${string}`;
  readonly canonicalText: string;
}

export interface WorldContentLayer {
  readonly id: string;
  readonly label: string;
}

export interface WorldContentPlace extends WorldContentEntry {
  readonly kind: "place";
  readonly spatialKind: string;
  readonly layerId: string;
  readonly parentId: string | null;
  readonly jurisdictionIds: readonly string[];
  readonly tags: readonly string[];
  readonly persistent: boolean;
}

export interface WorldContentFaction extends WorldContentEntry {
  readonly kind: "faction";
  readonly coreMemberBaseline: number;
  readonly affiliatedPopulationBaseline: number;
}

export interface WorldContentRoute {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly mode: readonly string[];
  readonly baseMinutes: number;
  readonly bidirectional: boolean;
}

export interface WorldContentRegistryCounts {
  readonly rules: number;
  readonly systems: number;
  readonly species: number;
  readonly factions: number;
  readonly layers: number;
  readonly places: number;
  readonly routes: number;
}

export interface WorldContentRegistry {
  readonly schemaVersion: typeof WORLD_CONTENT_REGISTRY_SCHEMA_VERSION;
  readonly loreVersion: string;
  readonly worldTimeOrigin: string;
  readonly sourceHash: `sha256:${string}`;
  readonly counts: WorldContentRegistryCounts;
  readonly rules: readonly WorldContentEntry[];
  readonly systems: readonly WorldContentEntry[];
  readonly species: readonly WorldContentEntry[];
  readonly factions: readonly WorldContentFaction[];
  readonly layers: readonly WorldContentLayer[];
  readonly places: readonly WorldContentPlace[];
  readonly routes: readonly WorldContentRoute[];
}

interface SourceDocument extends Omit<WorldContentEntry, "contentHash" | "canonicalText"> {
  readonly content: string;
}

interface Frontmatter {
  readonly [key: string]: string | number | boolean | undefined;
}

interface AtlasPlace {
  readonly id: string;
  readonly label: string;
  readonly kind: string;
  readonly layerId: string;
  readonly parentId: string | null;
  readonly jurisdictionIds: readonly string[];
  readonly tags: readonly string[];
  readonly persistent?: boolean;
}

interface CanonicalWorldAtlas {
  readonly schemaVersion: number;
  readonly loreVersion: string;
  readonly worldTimeOrigin: string;
  readonly layers: readonly WorldContentLayer[];
  readonly places: readonly AtlasPlace[];
  readonly routes: readonly WorldContentRoute[];
}

interface FactionPopulationBaseline {
  readonly coreMemberBaseline: number;
  readonly affiliatedPopulationBaseline: number;
}

const REGISTRY_BASELINES: WorldContentRegistryCounts = {
  rules: 21,
  systems: 7,
  species: 30,
  factions: 18,
  layers: 6,
  places: 25,
  routes: 15,
};

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_WORLD_VAULT_ROOT = path.resolve(MODULE_DIR, "../../../..");
export const DEFAULT_WORLD_CONTENT_REGISTRY_PATH = path.resolve(
  MODULE_DIR,
  "../../package/obsidian-epoch/references/world-content-registry.json",
);

function record(value: unknown, error: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(error);
  return value as Record<string, unknown>;
}

function nonEmptyString(value: unknown, error: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(error);
  return value.trim();
}

function nonEmptyText(value: unknown, error: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(error);
  return value;
}

function stringArray(value: unknown, error: string): readonly string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim())) {
    throw new Error(error);
  }
  return value.map((item) => item.trim());
}

function positiveWhole(value: unknown, error: string): number {
  if (!Number.isSafeInteger(value) || Number(value) <= 0) throw new Error(error);
  return Number(value);
}

function relativeSourcePath(vaultRoot: string, sourcePath: string): string {
  const relative = path.relative(vaultRoot, sourcePath).split(path.sep).join("/");
  if (!relative || relative.startsWith("../") || path.isAbsolute(relative)) {
    throw new Error("world_content_source_outside_vault");
  }
  return relative;
}

function scalar(value: string): string | number | boolean {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"'))
    || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  if (/^-?\d+(?:\.\d+)?$/u.test(trimmed)) return Number(trimmed);
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  return trimmed;
}

function parseFrontmatter(content: string, sourcePath: string): Frontmatter {
  if (!content.startsWith("---\n") && !content.startsWith("---\r\n")) {
    throw new Error(`world_content_frontmatter_missing:${sourcePath}`);
  }
  const lines = content.split(/\r?\n/u);
  const closing = lines.indexOf("---", 1);
  if (closing < 0) throw new Error(`world_content_frontmatter_unclosed:${sourcePath}`);
  const result: Record<string, string | number | boolean> = {};
  for (const line of lines.slice(1, closing)) {
    if (/^\s/u.test(line)) continue;
    const match = /^([a-zA-Z][a-zA-Z0-9_]*):\s*(.*?)\s*$/u.exec(line);
    if (!match || !match[2]) continue;
    result[match[1]!] = scalar(match[2]);
  }
  return result;
}

function markdownTitle(content: string, sourcePath: string): string {
  const match = /^#\s+(.+?)\s*$/mu.exec(content);
  if (!match?.[1]) throw new Error(`world_content_title_missing:${sourcePath}`);
  return match[1].trim();
}

function markdownFiles(root: string): readonly string[] {
  if (!existsSync(root)) throw new Error(`world_content_directory_missing:${root}`);
  const files: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const absolute = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...markdownFiles(absolute));
    else if (entry.isFile() && entry.name.endsWith(".md")) files.push(absolute);
  }
  return files.sort((left, right) => left.localeCompare(right, "zh-CN"));
}

function discoverDocuments(
  vaultRoot: string,
  directories: readonly string[],
  idKey: string,
  kind: Exclude<WorldContentEntryKind, "place">,
): readonly SourceDocument[] {
  const documents: SourceDocument[] = [];
  for (const directory of directories) {
    for (const sourcePath of markdownFiles(path.join(vaultRoot, directory))) {
      const content = readFileSync(sourcePath, "utf8");
      const frontmatter = parseFrontmatter(content, sourcePath);
      if (frontmatter[idKey] === undefined) continue;
      const id = nonEmptyString(frontmatter[idKey], `world_content_id_invalid:${sourcePath}`);
      const status = nonEmptyString(frontmatter.status, `world_content_status_missing:${id}`);
      if (status !== "可用") throw new Error(`world_content_not_usable:${id}:${status}`);
      documents.push({
        id,
        kind,
        label: markdownTitle(content, sourcePath),
        status,
        sourcePath: relativeSourcePath(vaultRoot, sourcePath),
        sourceType: nonEmptyString(frontmatter.type, `world_content_type_missing:${id}`),
        version: frontmatter.version === undefined ? 1 : positiveWhole(frontmatter.version, `world_content_version_invalid:${id}`),
        content,
      });
    }
  }
  return uniqueEntries(documents, kind);
}

function discoverPlaceDocuments(vaultRoot: string): readonly SourceDocument[] {
  const documents: SourceDocument[] = [];
  for (const sourcePath of markdownFiles(path.join(vaultRoot, "05_地点生态"))) {
    const content = readFileSync(sourcePath, "utf8");
    const frontmatter = parseFrontmatter(content, sourcePath);
    if (frontmatter.region_id === undefined) continue;
    const id = nonEmptyString(frontmatter.region_id, `world_content_place_id_invalid:${sourcePath}`);
    const status = nonEmptyString(frontmatter.status, `world_content_status_missing:${id}`);
    if (status !== "可用") throw new Error(`world_content_not_usable:${id}:${status}`);
    documents.push({
      id,
      kind: "place",
      label: markdownTitle(content, sourcePath),
      status,
      sourcePath: relativeSourcePath(vaultRoot, sourcePath),
      sourceType: nonEmptyString(frontmatter.type, `world_content_type_missing:${id}`),
      version: frontmatter.version === undefined ? 1 : positiveWhole(frontmatter.version, `world_content_version_invalid:${id}`),
      content,
    });
  }
  return uniqueEntries(documents, "place");
}

function uniqueEntries<TEntry extends { readonly id: string }>(
  entries: readonly TEntry[],
  kind: string,
): readonly TEntry[] {
  const ids = new Set<string>();
  for (const entry of entries) {
    if (ids.has(entry.id)) throw new Error(`world_content_duplicate_${kind}_id:${entry.id}`);
    ids.add(entry.id);
  }
  return [...entries].sort((left, right) => left.id.localeCompare(right.id));
}

function atlasFromJson(value: unknown): CanonicalWorldAtlas {
  const candidate = record(value, "world_atlas_object_required");
  if (candidate.schemaVersion !== 1) throw new Error("world_atlas_schema_version_unsupported");
  const layers = (candidate.layers as readonly unknown[] | undefined)?.map((item) => {
    const layer = record(item, "world_atlas_layer_invalid");
    return {
      id: nonEmptyString(layer.id, "world_atlas_layer_id_invalid"),
      label: nonEmptyString(layer.label, "world_atlas_layer_label_invalid"),
    };
  });
  const places = (candidate.places as readonly unknown[] | undefined)?.map((item) => {
    const place = record(item, "world_atlas_place_invalid");
    return {
      id: nonEmptyString(place.id, "world_atlas_place_id_invalid"),
      label: nonEmptyString(place.label, "world_atlas_place_label_invalid"),
      kind: nonEmptyString(place.kind, "world_atlas_place_kind_invalid"),
      layerId: nonEmptyString(place.layerId, "world_atlas_place_layer_invalid"),
      parentId: place.parentId === null ? null : nonEmptyString(place.parentId, "world_atlas_place_parent_invalid"),
      jurisdictionIds: stringArray(place.jurisdictionIds, "world_atlas_place_jurisdictions_invalid"),
      tags: stringArray(place.tags, "world_atlas_place_tags_invalid"),
      ...(place.persistent === undefined ? {} : { persistent: place.persistent === true }),
    };
  });
  const routes = (candidate.routes as readonly unknown[] | undefined)?.map((item) => {
    const route = record(item, "world_atlas_route_invalid");
    return {
      id: nonEmptyString(route.id, "world_atlas_route_id_invalid"),
      from: nonEmptyString(route.from, "world_atlas_route_from_invalid"),
      to: nonEmptyString(route.to, "world_atlas_route_to_invalid"),
      mode: stringArray(route.mode, "world_atlas_route_mode_invalid"),
      baseMinutes: positiveWhole(route.baseMinutes, "world_atlas_route_minutes_invalid"),
      bidirectional: route.bidirectional === true,
    };
  });
  if (!layers || !places || !routes) throw new Error("world_atlas_collections_required");
  uniqueEntries(layers, "layer");
  uniqueEntries(places, "place");
  uniqueEntries(routes, "route");
  const layerIds = new Set(layers.map((layer) => layer.id));
  const placeIds = new Set(places.map((place) => place.id));
  for (const place of places) {
    if (!layerIds.has(place.layerId)) throw new Error(`world_atlas_place_layer_missing:${place.id}:${place.layerId}`);
    if (place.parentId && !placeIds.has(place.parentId)) {
      throw new Error(`world_atlas_place_parent_missing:${place.id}:${place.parentId}`);
    }
  }
  for (const route of routes) {
    if (!placeIds.has(route.from) || !placeIds.has(route.to)) {
      throw new Error(`world_atlas_route_endpoint_missing:${route.id}`);
    }
  }
  return {
    schemaVersion: 1,
    loreVersion: nonEmptyString(candidate.loreVersion, "world_atlas_lore_version_invalid"),
    worldTimeOrigin: nonEmptyString(candidate.worldTimeOrigin, "world_atlas_time_origin_invalid"),
    layers: uniqueEntries(layers, "layer"),
    places: uniqueEntries(places, "place"),
    routes: uniqueEntries(routes, "route"),
  };
}

function registryEntry(document: SourceDocument): WorldContentEntry {
  const { content, ...entry } = document;
  return {
    ...entry,
    contentHash: `sha256:${createHash("sha256").update(content).digest("hex")}`,
    canonicalText: content,
  };
}

function sourceHash(
  documents: readonly SourceDocument[],
  supplementalSources: readonly { readonly sourcePath: string; readonly content: string }[],
): `sha256:${string}` {
  const sources = [
    ...documents.map((document) => ({ sourcePath: document.sourcePath, content: document.content })),
    ...supplementalSources,
  ].sort((left, right) => left.sourcePath.localeCompare(right.sourcePath));
  const hash = createHash("sha256");
  for (const source of sources) hash.update(source.sourcePath).update("\0").update(source.content).update("\0");
  return `sha256:${hash.digest("hex")}`;
}

function factionPopulationBaselines(content: string): ReadonlyMap<string, FactionPopulationBaseline> {
  const result = new Map<string, FactionPopulationBaseline>();
  for (const line of content.split(/\r?\n/u)) {
    if (!line.startsWith("|")) continue;
    const cells = line.split("|").map((cell) => cell.trim());
    const factionId = /`(faction_[a-z0-9_]+)`/u.exec(cells[1] || "")?.[1];
    if (!factionId) continue;
    if (result.has(factionId)) throw new Error(`world_content_faction_baseline_duplicate:${factionId}`);
    const governance = cells[2] || "";
    const namedCounts = [...governance.matchAll(/(\d[\d,]*)\s*名/gu)]
      .map((match) => Number((match[1] || "").replaceAll(",", "")))
      .filter((count) => Number.isSafeInteger(count) && count > 0);
    const fallbackCount = /成员约\s*(\d[\d,]*)\s*人/u.exec(governance)?.[1];
    const counts = namedCounts.length > 0
      ? namedCounts
      : fallbackCount
        ? [Number(fallbackCount.replaceAll(",", ""))]
        : [];
    if (counts.length === 0) throw new Error(`world_content_faction_population_missing:${factionId}`);
    result.set(factionId, {
      coreMemberBaseline: counts[0]!,
      affiliatedPopulationBaseline: counts.slice(1).reduce((total, count) => total + count, 0),
    });
  }
  return result;
}

function assertBaseline(counts: WorldContentRegistryCounts) {
  for (const [key, minimum] of Object.entries(REGISTRY_BASELINES)) {
    if (counts[key as keyof WorldContentRegistryCounts] < minimum) {
      throw new Error(`world_content_baseline_missing:${key}:${counts[key as keyof WorldContentRegistryCounts]}:${minimum}`);
    }
  }
}

export function compileWorldContentRegistry(vaultRoot = DEFAULT_WORLD_VAULT_ROOT): WorldContentRegistry {
  const absoluteRoot = path.resolve(vaultRoot);
  const rules = discoverDocuments(absoluteRoot, ["00_总览", "01_世界底层"], "rule_id", "rule");
  const systems = discoverDocuments(absoluteRoot, ["01_世界底层"], "system_id", "system");
  const species = discoverDocuments(absoluteRoot, ["02_种族"], "species_id", "species");
  const factions = discoverDocuments(absoluteRoot, ["03_势力组织"], "faction_id", "faction");
  const placeDocuments = discoverPlaceDocuments(absoluteRoot);
  const atlasAbsolutePath = path.join(absoluteRoot, "00_总览/canonical-world-atlas.json");
  const atlasContent = readFileSync(atlasAbsolutePath, "utf8");
  const atlas = atlasFromJson(JSON.parse(atlasContent));
  const factionInstitutionsAbsolutePath = path.join(absoluteRoot, "00_总览/势力制度总表.md");
  const factionInstitutionsContent = readFileSync(factionInstitutionsAbsolutePath, "utf8");
  const factionBaselines = factionPopulationBaselines(factionInstitutionsContent);
  const placeDocumentsById = new Map(placeDocuments.map((document) => [document.id, document]));
  const atlasPlaceIds = new Set(atlas.places.map((place) => place.id));
  for (const document of placeDocuments) {
    if (!atlasPlaceIds.has(document.id)) throw new Error(`world_content_place_missing_from_atlas:${document.id}`);
  }
  const places: WorldContentPlace[] = atlas.places.map((place) => {
    const document = placeDocumentsById.get(place.id);
    if (!document) throw new Error(`world_content_place_document_missing:${place.id}`);
    if (document.label !== place.label) {
      throw new Error(`world_content_place_label_mismatch:${place.id}:${document.label}:${place.label}`);
    }
    return {
      ...registryEntry(document),
      kind: "place",
      spatialKind: place.kind,
      layerId: place.layerId,
      parentId: place.parentId,
      jurisdictionIds: [...place.jurisdictionIds],
      tags: [...place.tags],
      persistent: place.persistent !== false,
    };
  });
  const counts: WorldContentRegistryCounts = {
    rules: rules.length,
    systems: systems.length,
    species: species.length,
    factions: factions.length,
    layers: atlas.layers.length,
    places: places.length,
    routes: atlas.routes.length,
  };
  const compiledFactions: WorldContentFaction[] = factions.map((document) => {
    const baseline = factionBaselines.get(document.id);
    if (!baseline) throw new Error(`world_content_faction_baseline_missing:${document.id}`);
    return {
      ...registryEntry(document),
      kind: "faction",
      ...baseline,
    };
  });
  for (const factionId of factionBaselines.keys()) {
    if (!compiledFactions.some((faction) => faction.id === factionId)) {
      throw new Error(`world_content_faction_document_missing:${factionId}`);
    }
  }
  assertBaseline(counts);
  return validateWorldContentRegistry({
    schemaVersion: WORLD_CONTENT_REGISTRY_SCHEMA_VERSION,
    loreVersion: atlas.loreVersion,
    worldTimeOrigin: atlas.worldTimeOrigin,
    sourceHash: sourceHash(
      [...rules, ...systems, ...species, ...factions, ...placeDocuments],
      [
        { sourcePath: relativeSourcePath(absoluteRoot, atlasAbsolutePath), content: atlasContent },
        {
          sourcePath: relativeSourcePath(absoluteRoot, factionInstitutionsAbsolutePath),
          content: factionInstitutionsContent,
        },
      ],
    ),
    counts,
    rules: rules.map(registryEntry),
    systems: systems.map(registryEntry),
    species: species.map(registryEntry),
    factions: compiledFactions,
    layers: atlas.layers,
    places,
    routes: atlas.routes,
  });
}

function validateEntry(value: unknown, expectedKind: WorldContentEntryKind): WorldContentEntry {
  const candidate = record(value, `world_content_${expectedKind}_invalid`);
  if (candidate.kind !== expectedKind) throw new Error(`world_content_kind_invalid:${expectedKind}`);
  if (candidate.status !== "可用") throw new Error(`world_content_status_invalid:${expectedKind}`);
  const sourcePath = nonEmptyString(candidate.sourcePath, `world_content_source_invalid:${expectedKind}`);
  if (path.isAbsolute(sourcePath) || sourcePath.split("/").includes("..")) {
    throw new Error(`world_content_source_unsafe:${sourcePath}`);
  }
  const canonicalText = nonEmptyText(candidate.canonicalText, `world_content_text_invalid:${expectedKind}`);
  const contentHash = nonEmptyString(candidate.contentHash, `world_content_content_hash_invalid:${expectedKind}`);
  const expectedContentHash = `sha256:${createHash("sha256").update(canonicalText).digest("hex")}`;
  if (contentHash !== expectedContentHash) throw new Error(`world_content_content_hash_mismatch:${sourcePath}`);
  return {
    id: nonEmptyString(candidate.id, `world_content_id_invalid:${expectedKind}`),
    kind: expectedKind,
    label: nonEmptyString(candidate.label, `world_content_label_invalid:${expectedKind}`),
    status: "可用",
    sourcePath,
    sourceType: nonEmptyString(candidate.sourceType, `world_content_type_invalid:${expectedKind}`),
    version: positiveWhole(candidate.version, `world_content_version_invalid:${expectedKind}`),
    contentHash: contentHash as `sha256:${string}`,
    canonicalText,
  };
}

function validateCollection<TEntry extends { readonly id: string }>(
  value: unknown,
  label: string,
  validator: (item: unknown) => TEntry,
): readonly TEntry[] {
  if (!Array.isArray(value)) throw new Error(`world_content_${label}_required`);
  return uniqueEntries(value.map(validator), label);
}

export function validateWorldContentRegistry(value: unknown): WorldContentRegistry {
  const candidate = record(value, "world_content_registry_object_required");
  if (candidate.schemaVersion !== WORLD_CONTENT_REGISTRY_SCHEMA_VERSION) {
    throw new Error("world_content_registry_schema_unsupported");
  }
  const sourceHashValue = nonEmptyString(candidate.sourceHash, "world_content_source_hash_invalid");
  if (!/^sha256:[0-9a-f]{64}$/u.test(sourceHashValue)) throw new Error("world_content_source_hash_invalid");
  const rules = validateCollection(candidate.rules, "rules", (item) => validateEntry(item, "rule"));
  const systems = validateCollection(candidate.systems, "systems", (item) => validateEntry(item, "system"));
  const species = validateCollection(candidate.species, "species", (item) => validateEntry(item, "species"));
  const factions = validateCollection(candidate.factions, "factions", (item) => {
    const faction = record(item, "world_content_faction_invalid");
    return {
      ...validateEntry(faction, "faction"),
      kind: "faction" as const,
      coreMemberBaseline: positiveWhole(
        faction.coreMemberBaseline,
        "world_content_faction_core_members_invalid",
      ),
      affiliatedPopulationBaseline: faction.affiliatedPopulationBaseline === 0
        ? 0
        : positiveWhole(
            faction.affiliatedPopulationBaseline,
            "world_content_faction_affiliated_population_invalid",
          ),
    };
  });
  const layers = validateCollection(candidate.layers, "layers", (item) => {
    const layer = record(item, "world_content_layer_invalid");
    return {
      id: nonEmptyString(layer.id, "world_content_layer_id_invalid"),
      label: nonEmptyString(layer.label, "world_content_layer_label_invalid"),
    };
  });
  const places = validateCollection(candidate.places, "places", (item) => {
    const place = record(item, "world_content_place_invalid");
    const entry = validateEntry(place, "place");
    return {
      ...entry,
      kind: "place" as const,
      spatialKind: nonEmptyString(place.spatialKind, "world_content_place_kind_invalid"),
      layerId: nonEmptyString(place.layerId, "world_content_place_layer_invalid"),
      parentId: place.parentId === null ? null : nonEmptyString(place.parentId, "world_content_place_parent_invalid"),
      jurisdictionIds: stringArray(place.jurisdictionIds, "world_content_place_jurisdictions_invalid"),
      tags: stringArray(place.tags, "world_content_place_tags_invalid"),
      persistent: place.persistent !== false,
    };
  });
  const routes = validateCollection(candidate.routes, "routes", (item) => {
    const route = record(item, "world_content_route_invalid");
    return {
      id: nonEmptyString(route.id, "world_content_route_id_invalid"),
      from: nonEmptyString(route.from, "world_content_route_from_invalid"),
      to: nonEmptyString(route.to, "world_content_route_to_invalid"),
      mode: stringArray(route.mode, "world_content_route_mode_invalid"),
      baseMinutes: positiveWhole(route.baseMinutes, "world_content_route_minutes_invalid"),
      bidirectional: route.bidirectional === true,
    };
  });
  const layerIds = new Set(layers.map((layer) => layer.id));
  const placeIds = new Set(places.map((place) => place.id));
  for (const place of places) {
    if (!layerIds.has(place.layerId)) throw new Error(`world_content_place_layer_missing:${place.id}`);
    if (place.parentId && !placeIds.has(place.parentId)) throw new Error(`world_content_place_parent_missing:${place.id}`);
  }
  for (const route of routes) {
    if (!placeIds.has(route.from) || !placeIds.has(route.to)) {
      throw new Error(`world_content_route_endpoint_missing:${route.id}`);
    }
  }
  const counts: WorldContentRegistryCounts = {
    rules: rules.length,
    systems: systems.length,
    species: species.length,
    factions: factions.length,
    layers: layers.length,
    places: places.length,
    routes: routes.length,
  };
  const declaredCounts = record(candidate.counts, "world_content_counts_required");
  for (const [key, count] of Object.entries(counts)) {
    if (declaredCounts[key] !== count) throw new Error(`world_content_count_mismatch:${key}`);
  }
  assertBaseline(counts);
  return {
    schemaVersion: WORLD_CONTENT_REGISTRY_SCHEMA_VERSION,
    loreVersion: nonEmptyString(candidate.loreVersion, "world_content_lore_version_invalid"),
    worldTimeOrigin: nonEmptyString(candidate.worldTimeOrigin, "world_content_time_origin_invalid"),
    sourceHash: sourceHashValue as `sha256:${string}`,
    counts,
    rules,
    systems,
    species,
    factions,
    layers,
    places,
    routes,
  };
}

export function loadWorldContentRegistry(registryPath = DEFAULT_WORLD_CONTENT_REGISTRY_PATH): WorldContentRegistry {
  const resolvedPath = path.resolve(registryPath);
  let source = "";
  for (let attempt = 0; attempt < 3 && source.trim().length === 0; attempt += 1) {
    source = readFileSync(resolvedPath, "utf8");
  }
  if (source.trim().length === 0) {
    throw new Error(`world_content_registry_empty:${path.basename(resolvedPath)}`);
  }
  try {
    return validateWorldContentRegistry(JSON.parse(source));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`world_content_registry_json_invalid:${path.basename(resolvedPath)}`);
    }
    throw error;
  }
}

export function loadDefaultWorldContentRegistry(
  env: Record<string, string | undefined> = process.env,
): WorldContentRegistry {
  return loadWorldContentRegistry(env.EPOCH_WORLD_CONTENT_REGISTRY_PATH || DEFAULT_WORLD_CONTENT_REGISTRY_PATH);
}

export interface WorldContentRegistryViewInput {
  readonly collection?: "rules" | "systems" | "species" | "factions" | "layers" | "places" | "routes";
  readonly id?: string;
  readonly query?: string;
  readonly limit?: number;
}

export function worldContentRegistryView(
  registry: WorldContentRegistry,
  input: WorldContentRegistryViewInput = {},
) {
  const collection = input.collection;
  const limit = Number.isSafeInteger(input.limit) ? Math.max(1, Math.min(Number(input.limit), 200)) : 50;
  const query = input.query?.trim().toLocaleLowerCase("zh-CN");
  const id = input.id?.trim();
  if (!collection) {
    return {
      authority: "compiled_canonical_world_content" as const,
      schemaVersion: registry.schemaVersion,
      loreVersion: registry.loreVersion,
      worldTimeOrigin: registry.worldTimeOrigin,
      sourceHash: registry.sourceHash,
      counts: registry.counts,
    };
  }
  const items = registry[collection];
  const matches = items.filter((item) => {
    if (id && item.id !== id) return false;
    if (!query) return true;
    return JSON.stringify(item).toLocaleLowerCase("zh-CN").includes(query);
  });
  const selected = matches.slice(0, limit).map((item) => {
    if (id && "canonicalText" in item) return item;
    if (!("canonicalText" in item)) return item;
    const { canonicalText: _canonicalText, ...summary } = item;
    return summary;
  });
  return {
    authority: "compiled_canonical_world_content" as const,
    collection,
    sourceHash: registry.sourceHash,
    total: matches.length,
    items: selected,
  };
}

export function canonicalPlaceContext(registry: WorldContentRegistry, regionId: string) {
  const place = registry.places.find((candidate) => candidate.id === regionId);
  if (!place) return undefined;
  const routes = registry.routes.filter((route) => route.from === regionId || route.to === regionId);
  const jurisdictionIds = new Set(place.jurisdictionIds);
  const factions = registry.factions.filter((faction) => jurisdictionIds.has(faction.id));
  return { place, routes, factions };
}
