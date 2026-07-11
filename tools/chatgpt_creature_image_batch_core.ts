import path from "node:path"
import { cp, mkdir, rm } from "node:fs/promises"

export const DEFAULT_STEP_TYPES = ["front", "card"]
export const DEFAULT_ALIGNMENT = "中立"
export const PROFILE_SKIP_NAMES = new Set([
  "SingletonLock",
  "SingletonCookie",
  "SingletonSocket",
  "Cache",
  "Code Cache",
  "GPUCache",
  "GraphiteDawnCache",
  "GrShaderCache",
  "ShaderCache",
  "DawnCache",
  "Crashpad",
  "BrowserMetrics",
  "component_crx_cache",
  "extensions_crx_cache",
  "optimization_guide_model_store",
  "segmentation_platform",
  "Safe Browsing",
  "Subresource Filter",
])

export function requestedStepTypes(args = {}) {
  return Array.isArray(args.types) && args.types.length ? args.types : DEFAULT_STEP_TYPES
}

export function filenameForStep(creature, type) {
  if (type === "front") return creature.frontFilename
  if (type === "card") return creature.cardFilename
  throw new Error(`Unknown job step type: ${type}`)
}

export function promptForStep(creature, type) {
  if (type === "front") return creature.frontPrompt
  if (type === "card") return creature.cardPrompt
  throw new Error(`Unknown job step type: ${type}`)
}

export function promptPathForStep(creature, type, paths) {
  return path.relative(paths.root, path.join(paths.promptDir, `${creature.slug}_${type}.txt`))
}

export function outputPathForStep(creature, type, paths) {
  return path.relative(paths.root, path.join(paths.resultDir, creature.slug, filenameForStep(creature, type)))
}

export function acceptedPathForStep(creature, type, paths) {
  return path.relative(paths.root, path.join(paths.assetDir, filenameForStep(creature, type)))
}

function imagePathsForStep(frontmatter, type, assetDir) {
  if (type === "front") {
    return [frontmatter.node_image, frontmatter.panel_image]
      .filter(Boolean)
      .map((filename) => path.join(assetDir, filename))
  }
  if (type === "card") {
    return frontmatter.card_image ? [path.join(assetDir, frontmatter.card_image)] : []
  }
  throw new Error(`Unknown image step type: ${type}`)
}

export async function hasUsableImages(frontmatter, { types = DEFAULT_STEP_TYPES, assetDir, exists }) {
  for (const type of requestedStepTypes({ types })) {
    const imagePaths = imagePathsForStep(frontmatter, type, assetDir)
    const expectedCount = type === "front" ? 2 : 1
    if (imagePaths.length < expectedCount) return false
    for (const imagePath of imagePaths) {
      if (!(await exists(imagePath))) return false
    }
  }
  return true
}

export function buildQueueJob(creature, args, paths, options = {}) {
  const now = options.now || new Date().toISOString()
  const steps = {}
  for (const type of requestedStepTypes(args)) {
    steps[type] = {
      status: "pending",
      promptPath: promptPathForStep(creature, type, paths),
      outputPath: outputPathForStep(creature, type, paths),
      acceptedPath: acceptedPathForStep(creature, type, paths),
      requestedAt: "",
      completedAt: "",
      error: "",
      prompt: promptForStep(creature, type),
    }
  }

  return {
    id: `${creature.slug}_v001`,
    creature: creature.name,
    filePath: path.relative(paths.root, creature.filePath),
    visualStyle: creature.visualStyle,
    status: "pending",
    attempts: 0,
    maxAttempts: 3,
    createdAt: now,
    updatedAt: now,
    startedAt: "",
    completedAt: "",
    error: "",
    steps,
  }
}

export function allRequestedStepsDone(job, types = Object.keys(job.steps || {})) {
  return types.every((type) => job.steps?.[type]?.status === "done")
}

function normalizeMergedStatus(job, requestedTypes) {
  if (job.status === "running") {
    job.status = "pending"
    job.error = "Recovered stale running job during queue merge."
  }

  if (job.status === "done" && !allRequestedStepsDone(job, requestedTypes)) {
    job.status = "pending"
    job.completedAt = ""
    job.error = "Reopened incomplete done job after queue merge."
  }

  return job
}

export function mergeQueueJobs(existingQueue, creatures, args, paths, options = {}) {
  const now = options.now || new Date().toISOString()
  const existingById = new Map((existingQueue.jobs || []).map((job) => [job.id, job]))
  const jobs = []
  const freshIds = new Set()

  for (const creature of creatures) {
    const fresh = buildQueueJob(creature, args, paths, { now })
    const requestedTypes = Object.keys(fresh.steps)
    freshIds.add(fresh.id)
    const existing = existingById.get(fresh.id)
    if (!existing || args.resetQueue) {
      jobs.push(fresh)
      continue
    }

    const merged = {
      ...fresh,
      ...existing,
      visualStyle: fresh.visualStyle,
      filePath: fresh.filePath,
      updatedAt: existing.updatedAt || fresh.updatedAt,
      steps: { ...fresh.steps },
    }

    for (const [type, freshStep] of Object.entries(fresh.steps)) {
      const existingStep = existing.steps?.[type]
      merged.steps[type] = existingStep
        ? {
            ...freshStep,
            ...existingStep,
            prompt: freshStep.prompt,
            promptPath: freshStep.promptPath,
            outputPath: freshStep.outputPath,
            acceptedPath: freshStep.acceptedPath,
          }
        : freshStep
    }

    jobs.push(normalizeMergedStatus(merged, requestedTypes))
  }

  if (!args.resetQueue) {
    for (const existing of existingQueue.jobs || []) {
      if (!freshIds.has(existing.id)) jobs.push(existing)
    }
  }

  return {
    schemaVersion: 1,
    createdAt: existingQueue.createdAt || now,
    updatedAt: now,
    root: paths.root,
    policy: {
      concurrency: args.concurrency,
      rateLimit: args.rateLimit,
      rateWindowMs: args.rateWindowMs,
      unit: "prompt_request",
    },
    jobs,
  }
}

export function applyJobDone(queue, jobId, saved, accepted, options = {}) {
  const now = options.now || new Date().toISOString()
  const root = options.root
  const job = (queue.jobs || []).find((candidate) => candidate.id === jobId)
  if (!job) return

  job.updatedAt = now
  job.error = ""

  for (const [type, outputPath] of Object.entries(saved || {})) {
    if (!outputPath || !job.steps?.[type]) continue
    const step = job.steps[type]
    step.status = "done"
    step.completedAt = now
    step.outputPath = root ? path.relative(root, outputPath) : outputPath
    if (accepted?.[type]) {
      step.acceptedPath = root ? path.relative(root, accepted[type]) : accepted[type]
    }
    step.error = ""
  }

  if (allRequestedStepsDone(job)) {
    job.status = "done"
    job.completedAt = now
  } else {
    job.status = "pending"
    job.completedAt = ""
  }
}

export function profilePathForWorker(args, workerId, jobId = "") {
  const parts = [args.profileRunRoot, args.profileRunId, `worker-${workerId}`]
  if (jobId) parts.push(jobId.replace(/[/:*?"<>|\\]/g, "_"))
  return path.join(...parts)
}

export function shouldCopyProfilePath(sourcePath) {
  return !PROFILE_SKIP_NAMES.has(path.basename(sourcePath))
}

export async function copyProfileTree(sourceDir, targetDir) {
  await rm(targetDir, { recursive: true, force: true })
  await mkdir(path.dirname(targetDir), { recursive: true })
  await cp(sourceDir, targetDir, {
    recursive: true,
    force: true,
    filter: shouldCopyProfilePath,
  })
}

export function imageHandleKey(imageHandle) {
  return imageHandle?.src || ""
}

export function selectNewImage(images, knownImageKeys) {
  for (const image of images.slice().reverse()) {
    const key = imageHandleKey(image)
    if (key && !knownImageKeys.has(key)) return image
  }
  return null
}

export function resolveCreatureAlignment(creature, alignmentMap = {}) {
  return creature.frontmatter?.alignment || creature.alignment || alignmentMap[creature.name] || DEFAULT_ALIGNMENT
}

function normalizeTraitItem(item) {
  return String(item || "")
    .replace(/^[^：:\n]{1,12}[：:]\s*/, "")
    .trim()
}

export function cardTraitItems(creature, limit = 6) {
  return [...(creature.appearanceTraits || []), ...(creature.abilities || [])]
    .map(normalizeTraitItem)
    .filter(Boolean)
    .slice(0, limit)
}

export function splitCreatureType(type = "") {
  const parts = String(type)
    .split(/\s*\/\s*/)
    .map((part) => part.trim())
    .filter(Boolean)
  return {
    category: parts[0] || "",
    dutyTags: parts.slice(1).join(" / "),
  }
}

function withoutDuplicateDutyTags(dutyTags, ecology) {
  const ecologyValue = String(ecology || "").trim()
  return String(dutyTags || "")
    .split(/\s*\/\s*/)
    .map((tag) => tag.trim())
    .filter((tag) => tag && tag !== ecologyValue)
    .join(" / ")
}

export function cardInfoLines(creature) {
  const { category, dutyTags } = splitCreatureType(creature.type)
  const visibleDutyTags = withoutDuplicateDutyTags(dutyTags, creature.ecology)
  return [
    ["分类", category || creature.type],
    ["生物倾向", creature.alignment || DEFAULT_ALIGNMENT],
    ["生态位", creature.ecology],
    ["职能标签", visibleDutyTags],
    ["典型行为", creature.behavior],
    ["可利用素材", creature.usage],
    ["弱点", creature.weakness],
  ]
    .filter(([, value]) => value)
    .map(([label, value]) => `- ${label}：${value}`)
}
