import assert from "node:assert/strict"
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"

import {
  applyJobDone,
  buildQueueJob,
  cardInfoLines,
  cardTraitItems,
  copyProfileTree,
  hasUsableImages,
  mergeQueueJobs,
  profilePathForWorker,
  resolveCreatureAlignment,
  selectNewImage,
  splitCreatureType,
} from "./chatgpt_creature_image_batch_core.ts"

const paths = {
  root: "/vault",
  promptDir: "/vault/09_素材与图片/ChatGPT批量生成/prompts",
  resultDir: "/vault/09_素材与图片/ChatGPT批量生成/results",
  assetDir: "/vault/09_素材与图片",
}

const creature = {
  name: "剪梦剑螂",
  slug: "剪梦剑螂",
  filePath: "/vault/04_异化生物/剪梦剑螂.md",
  frontFilename: "剪梦剑螂_正面设定图.png",
  cardFilename: "剪梦剑螂_档案卡.png",
  frontPrompt: "front prompt",
  cardPrompt: "card prompt",
  visualStyle: "宣纸水墨",
}

test("mergeQueueJobs reopens a done job when a requested step is missing", () => {
  const existingQueue = {
    createdAt: "2026-06-05T00:00:00.000Z",
    jobs: [
      {
        id: "剪梦剑螂_v001",
        creature: "剪梦剑螂",
        filePath: "04_异化生物/剪梦剑螂.md",
        visualStyle: "宣纸水墨",
        status: "done",
        attempts: 1,
        maxAttempts: 3,
        createdAt: "2026-06-05T00:00:00.000Z",
        updatedAt: "2026-06-05T00:01:00.000Z",
        startedAt: "2026-06-05T00:00:30.000Z",
        completedAt: "2026-06-05T00:01:00.000Z",
        error: "",
        steps: {
          front: {
            status: "done",
            promptPath: "09_素材与图片/ChatGPT批量生成/prompts/剪梦剑螂_front.txt",
            outputPath: "09_素材与图片/ChatGPT批量生成/results/剪梦剑螂/剪梦剑螂_正面设定图.png",
            acceptedPath: "09_素材与图片/剪梦剑螂_正面设定图.png",
            requestedAt: "2026-06-05T00:00:30.000Z",
            completedAt: "2026-06-05T00:01:00.000Z",
            error: "",
            prompt: "old front prompt",
          },
        },
      },
    ],
  }

  const queue = mergeQueueJobs(
    existingQueue,
    [creature],
    { types: ["front", "card"], resetQueue: false, concurrency: 1, rateLimit: 10, rateWindowMs: 300_000 },
    paths,
  )
  const job = queue.jobs[0]

  assert.equal(job.status, "pending")
  assert.equal(job.completedAt, "")
  assert.match(job.error, /Reopened incomplete done job/)
  assert.equal(job.steps.front.status, "done")
  assert.equal(job.steps.card.status, "pending")
  assert.equal(
    job.steps.card.outputPath,
    "09_素材与图片/ChatGPT批量生成/results/剪梦剑螂/剪梦剑螂_档案卡.png",
  )
})

test("hasUsableImages checks the requested asset types", async () => {
  const frontmatter = {
    node_image: "剪梦剑螂_正面设定图.png",
    panel_image: "剪梦剑螂_正面设定图.png",
  }
  const exists = async (filePath) => filePath.endsWith("_正面设定图.png")

  assert.equal(await hasUsableImages(frontmatter, { types: ["front"], assetDir: paths.assetDir, exists }), true)
  assert.equal(await hasUsableImages(frontmatter, { types: ["front", "card"], assetDir: paths.assetDir, exists }), false)
})

test("applyJobDone keeps a job pending until every step is done", () => {
  const queue = {
    jobs: [buildQueueJob(creature, { types: ["front", "card"] }, paths)],
  }
  const jobId = "剪梦剑螂_v001"

  applyJobDone(
    queue,
    jobId,
    { front: "/vault/09_素材与图片/ChatGPT批量生成/results/剪梦剑螂/剪梦剑螂_正面设定图.png" },
    { front: "/vault/09_素材与图片/剪梦剑螂_正面设定图.png" },
    { root: paths.root, now: "2026-06-05T00:01:00.000Z" },
  )

  assert.equal(queue.jobs[0].status, "pending")
  assert.equal(queue.jobs[0].steps.front.status, "done")
  assert.equal(queue.jobs[0].steps.card.status, "pending")

  applyJobDone(
    queue,
    jobId,
    { card: "/vault/09_素材与图片/ChatGPT批量生成/results/剪梦剑螂/剪梦剑螂_档案卡.png" },
    { card: "/vault/09_素材与图片/剪梦剑螂_档案卡.png" },
    { root: paths.root, now: "2026-06-05T00:02:00.000Z" },
  )

  assert.equal(queue.jobs[0].status, "done")
  assert.equal(queue.jobs[0].completedAt, "2026-06-05T00:02:00.000Z")
  assert.equal(queue.jobs[0].steps.card.status, "done")
})

test("profilePathForWorker gives each worker an isolated run profile", () => {
  assert.equal(
    profilePathForWorker({ profileRunRoot: "/vault/work/profiles", profileRunId: "run-1" }, 3, "黑页书虱_v001"),
    "/vault/work/profiles/run-1/worker-3/黑页书虱_v001",
  )
})

test("copyProfileTree skips transient browser locks and caches", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "profile-copy-test-"))
  try {
    const source = path.join(tmp, "base")
    const target = path.join(tmp, "worker")
    await mkdir(path.join(source, "Default", "Local Storage"), { recursive: true })
    await mkdir(path.join(source, "Default", "Cache"), { recursive: true })
    await mkdir(path.join(source, "GPUCache"), { recursive: true })
    await writeFile(path.join(source, "Default", "Cookies"), "cookie")
    await writeFile(path.join(source, "Default", "Local Storage", "leveldb"), "storage")
    await writeFile(path.join(source, "Default", "Cache", "cache-entry"), "cache")
    await writeFile(path.join(source, "GPUCache", "gpu-entry"), "gpu")
    await writeFile(path.join(source, "SingletonLock"), "lock")
    await writeFile(path.join(source, "SingletonSocket"), "socket")

    await copyProfileTree(source, target)

    assert.equal(await readFile(path.join(target, "Default", "Cookies"), "utf8"), "cookie")
    assert.equal(await readFile(path.join(target, "Default", "Local Storage", "leveldb"), "utf8"), "storage")
    assert.deepEqual(await readdir(target), ["Default"])
    assert.rejects(readFile(path.join(target, "Default", "Cache", "cache-entry"), "utf8"))
    assert.rejects(readFile(path.join(target, "SingletonLock"), "utf8"))
  } finally {
    await rm(tmp, { recursive: true, force: true })
  }
})

test("selectNewImage ignores images already saved earlier in the same job", () => {
  const known = new Set(["front-src"])

  assert.equal(selectNewImage([{ src: "front-src" }], known), null)
  assert.deepEqual(
    selectNewImage([{ src: "front-src" }, { src: "card-src", width: 1086, height: 1448 }], known),
    { src: "card-src", width: 1086, height: 1448 },
  )
})

test("cardTraitItems keeps biological traits separate from utility and weakness", () => {
  const items = cardTraitItems({
    appearanceTraits: ["背甲会渗出冷雾"],
    abilities: ["死忆采样：复眼能记录临死画面"],
    usage: "眼珠可用于占卜",
    weakness: "惧怕强光",
  })

  assert.deepEqual(items, ["背甲会渗出冷雾", "复眼能记录临死画面"])
  assert.equal(items.some((item) => item.includes("可用于") || item.includes("惧怕")), false)
})

test("cardInfoLines includes creature alignment as a separate dossier field", () => {
  const lines = cardInfoLines({
    type: "势力低级生物 / 阴司杂役 / 引魂单位",
    alignment: "秩序中立",
    ecology: "阴司现场记录",
    behavior: "只在异常死亡现场出现",
    usage: "魂灯灰可显影脚印",
    weakness: "怕明火",
  })

  assert.deepEqual(lines, [
    "- 分类：势力低级生物",
    "- 生物倾向：秩序中立",
    "- 生态位：阴司现场记录",
    "- 职能标签：阴司杂役 / 引魂单位",
    "- 典型行为：只在异常死亡现场出现",
    "- 可利用素材：魂灯灰可显影脚印",
    "- 弱点：怕明火",
  ])
})

test("resolveCreatureAlignment prefers explicit data and falls back to map", () => {
  assert.equal(
    resolveCreatureAlignment({ name: "魂灯纸吏", frontmatter: { alignment: "秩序中立" } }, { 魂灯纸吏: "中立" }),
    "秩序中立",
  )
  assert.equal(resolveCreatureAlignment({ name: "黑页书虱", frontmatter: {} }, { 黑页书虱: "混乱邪恶" }), "混乱邪恶")
  assert.equal(resolveCreatureAlignment({ name: "未知生物", frontmatter: {} }), "中立")
})

test("splitCreatureType separates category from duty tags", () => {
  assert.deepEqual(splitCreatureType("势力低级生物 / 海雾巡游 / 祭品押送"), {
    category: "势力低级生物",
    dutyTags: "海雾巡游 / 祭品押送",
  })
})

test("cardInfoLines avoids repeating ecology inside duty tags", () => {
  assert.deepEqual(
    cardInfoLines({
      type: "势力低级生物 / 海雾巡游 / 祭品押送",
      alignment: "秩序邪恶",
      ecology: "海雾巡游",
    }),
    ["- 分类：势力低级生物", "- 生物倾向：秩序邪恶", "- 生态位：海雾巡游", "- 职能标签：祭品押送"],
  )
})
