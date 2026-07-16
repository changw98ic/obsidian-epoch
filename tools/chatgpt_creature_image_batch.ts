#!/usr/bin/env node

import path from "node:path"
import os from "node:os"
import { fileURLToPath } from "node:url"
import { mkdir, readFile, writeFile, access } from "node:fs/promises"
import { execSync, spawn } from "node:child_process"
import { existsSync, readdirSync, readFileSync } from "node:fs"
import {
  applyJobDone,
  cardInfoLines,
  cardTraitItems,
  copyProfileTree,
  hasUsableImages,
  mergeQueueJobs,
  outputPathForStep,
  profilePathForWorker,
  resolveCreatureAlignment,
  selectNewImage,
} from "./chatgpt_creature_image_batch_core.ts"

const __filename = fileURLToPath(import.meta.url)
const ROOT = path.resolve(path.dirname(__filename), "..")
const DEFAULT_CREATURE_DIR = path.join(ROOT, "04_异化生物")
const BIO_UNIT_DIR = path.join(ROOT, "04_生物单位")
const ASSET_DIR = path.join(ROOT, "09_素材与图片")
const WORK_DIR = path.join(ASSET_DIR, "ChatGPT批量生成")
const PROMPT_DIR = path.join(WORK_DIR, "prompts")
const RESULT_DIR = path.join(WORK_DIR, "results")
const DIAGNOSTIC_DIR = path.join(WORK_DIR, "diagnostics")
const JOBS_PATH = path.join(WORK_DIR, "creature-image-jobs.json")
const QUEUE_PATH = path.join(WORK_DIR, "creature-image-queue.json")
const RATE_STATE_PATH = path.join(WORK_DIR, "rate-limit-state.json")
const STYLE_MAP_PATH = path.join(ROOT, "tools", "creature_image_styles.json")
const BASE_PROFILE_DIR = path.join(os.homedir(), ".cloakbrowser-profiles", "chatgpt")
const PROFILE_RUN_ROOT = path.join(os.homedir(), ".cloakbrowser-profiles", "chatgpt-runs")

// macOS Tahoe 26 workaround: helper .app bundles inside Framework get SIGKILL
// by macOS due to com.apple.provenance + unknown TeamIdentifier.
// Solution: extract standalone binary + Framework, launch with --single-process
// (no helper processes needed), connect via CDP port instead of Playwright pipes.
let CLOAKBROWSER_WORKAROUND_BIN = null
if (!process.env.CLOAKBROWSER_BINARY_PATH) {
  const cloakDir = path.join(os.homedir(), ".cloakbrowser")
  const chromiumEntry = readdirSync(cloakDir).find(d => d.startsWith("chromium-"))
  if (chromiumEntry) {
    const srcContents = path.join(cloakDir, chromiumEntry, "Chromium.app", "Contents")
    const workDir = path.join(os.tmpdir(), "cloakbrowser-workaround")
    const workBin = path.join(workDir, "bin", "Chromium")
    const workFW = path.join(workDir, "Frameworks", "Chromium Framework.framework")
    if (!existsSync(workBin)) {
      execSync(`rm -rf "${workDir}"`)
      execSync(`mkdir -p "${path.join(workDir, "bin")}"`)
      execSync(`mkdir -p "${path.join(workDir, "Frameworks")}"`)
      execSync(`cp "${srcContents}/MacOS/Chromium" "${workBin}"`)
      execSync(`cp -R "${srcContents}/Frameworks/Chromium Framework.framework" "${workFW}"`)
      execSync(`codesign --force --deep --sign - "${workFW}"`)
      execSync(`codesign --force --sign - "${workBin}"`)
      console.log(`[workaround] copied and re-signed Chromium to ${workDir}`)
    }
    CLOAKBROWSER_WORKAROUND_BIN = workBin
    console.log(`[workaround] single-process CDP mode, binary=${workBin}`)
  }
}

async function launchViaCDP({ binaryPath, userDataDir, headless }) {
  const { chromium } = await import("playwright-core")
  const fingerprint = Math.floor(Math.random() * 90000) + 10000
  const procArgs = [
    "--single-process", "--disable-gpu", "--no-sandbox",
    headless ? "--headless=new" : "",
    "--remote-debugging-port=0",
    `--user-data-dir=${userDataDir}`,
    `--fingerprint=${fingerprint}`, "--fingerprint-platform=macos",
  ].filter(Boolean)

  const proc = spawn(binaryPath, procArgs, { stdio: ["pipe", "pipe", "pipe"] })
  const portFile = path.join(userDataDir, "DevToolsActivePort")

  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 1000))
    if (proc.exitCode !== null) {
      throw new Error(`Chromium exited with code ${proc.exitCode} (helper .app killed by macOS)`)
    }
    try {
      const content = readFileSync(portFile, "utf8")
      const port = content.split("\n")[0].trim()
      const browser = await chromium.connectOverCDP(`http://localhost:${port}`)
      const context = browser.contexts()[0]
      const pages = context.pages()
      const page = pages.length > 0 ? pages[0] : await context.newPage()
      const origClose = context.close.bind(context)
      context.close = async () => { try { await browser.close() } catch {} try { proc.kill() } catch {} }
      console.log(`[workaround] connected via CDP port ${port}, fingerprint=${fingerprint}`)
      return { context, page, userDataDir }
    } catch { if (i === 29) throw new Error("Timed out waiting for Chromium CDP port") }
  }
}
const SCRIPT_PATHS = { root: ROOT, promptDir: PROMPT_DIR, resultDir: RESULT_DIR, assetDir: ASSET_DIR }

const CHATGPT_PROVIDER = {
  startUrl: "https://chatgpt.com",
  auth: {
    loginCheck: [
      "button:has-text('Log in')",
      "a:has-text('Log in')",
      "button:has-text('Sign in')",
      "a:has-text('Sign in')",
      "button:has-text('登录')",
      "a:has-text('登录')",
      "button:has-text('免费注册')",
      "a:has-text('免费注册')",
    ].join(", "),
    readyCheck: "#prompt-textarea:not([class*=fallback]), textarea:not([class*=fallback])",
  },
  input: {
    selector: "#prompt-textarea:not([class*=fallback]), textarea:not([class*=fallback])",
    submitSelector: "button[data-testid='send-button']",
  },
}
const LOW_TIER_TYPE = "势力低级生物"
const E_TIER_TYPE = "E级弱小生物"
const EXTRA_BATCH_CREATURES = new Set(["孢雾巡猎者"])
const CREATURE_ALIGNMENT = {
  丹瘤药鼠: "混乱中立",
  借面狸奴: "混乱中立",
  冰腔雪虱: "中立",
  符芯傀犬: "秩序中立",
  拾眼骨鸦: "中立",
  圣银钉鹿: "秩序中立",
  魂灯纸吏: "秩序中立",
  剪梦剑螂: "秩序中立",
  月井蟾仆: "中立",
  命线根蛛: "混乱中立",
  炉牙火豚: "混乱中立",
  蒸魂瓶俑: "秩序中立",
  塔灯书蛾: "秩序中立",
  雾鳞环蛇: "秩序邪恶",
  星盘瞳雀: "中立善良",
  钉环祈虫: "秩序中立",
  黑页书虱: "混乱邪恶",
}
const DEFAULT_TIMEOUT_MS = 900_000
const DEFAULT_CONCURRENCY = 3
const DEFAULT_RATE_LIMIT = 10
const DEFAULT_RATE_WINDOW_MS = 5 * 60 * 1000
const DEFAULT_LAUNCH_TIMEOUT_MS = 90_000
let browserLaunchChain = Promise.resolve()

function parseArgs(argv) {
  const args = {
    run: false,
    status: false,
    retryFailed: false,
    resetRunning: false,
    resetQueue: false,
    eTier: false,
    includeExisting: false,
    allBioUnits: false,
    refreshCards: false,
    writeMd: true,
    headless: true,
    concurrency: DEFAULT_CONCURRENCY,
    rateLimit: DEFAULT_RATE_LIMIT,
    rateWindowMs: DEFAULT_RATE_WINDOW_MS,
    readyTimeoutMs: null,
    launchTimeoutMs: DEFAULT_LAUNCH_TIMEOUT_MS,
    limit: Number.POSITIVE_INFINITY,
    creature: "",
    types: ["front", "card"],
    jobsPath: JOBS_PATH,
    queuePath: QUEUE_PATH,
    creatureDir: DEFAULT_CREATURE_DIR,
    baseProfileDir: BASE_PROFILE_DIR,
    profileRunRoot: PROFILE_RUN_ROOT,
    profileRunId: `run-${new Date().toISOString().replace(/[:.]/g, "-")}`,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === "--run") args.run = true
    else if (arg === "--status") args.status = true
    else if (arg === "--retry-failed") args.retryFailed = true
    else if (arg === "--reset-running") args.resetRunning = true
    else if (arg === "--reset-queue") args.resetQueue = true
    else if (arg === "--e-tier") args.eTier = true
    else if (arg === "--include-existing") args.includeExisting = true
    else if (arg === "--all-bio-units") {
      args.allBioUnits = true
      args.creatureDir = BIO_UNIT_DIR
    }
    else if (arg === "--refresh-cards") args.refreshCards = true
    else if (arg === "--no-write-md") args.writeMd = false
    else if (arg === "--headless") args.headless = true
    else if (arg === "--show-browser") args.headless = false
    else if (arg === "--front-only") args.types = ["front"]
    else if (arg === "--card-only") args.types = ["card"]
    else if (arg === "--concurrency") args.concurrency = Math.min(DEFAULT_CONCURRENCY, Math.max(1, Number(argv[++index] || DEFAULT_CONCURRENCY)))
    else if (arg === "--rate-limit") args.rateLimit = Math.max(1, Number(argv[++index] || DEFAULT_RATE_LIMIT))
    else if (arg === "--rate-window-minutes") args.rateWindowMs = Math.max(1, Number(argv[++index] || 5)) * 60 * 1000
    else if (arg === "--ready-timeout-minutes") args.readyTimeoutMs = Math.max(1, Number(argv[++index] || 5)) * 60 * 1000
    else if (arg === "--launch-timeout-minutes") args.launchTimeoutMs = Math.max(1, Number(argv[++index] || 1.5)) * 60 * 1000
    else if (arg === "--limit") args.limit = Number(argv[++index] || 0)
    else if (arg === "--creature") args.creature = argv[++index] || ""
    else if (arg === "--jobs") args.jobsPath = path.resolve(argv[++index] || JOBS_PATH)
    else if (arg === "--queue") args.queuePath = path.resolve(argv[++index] || QUEUE_PATH)
    else if (arg === "--creature-dir") args.creatureDir = path.resolve(argv[++index] || DEFAULT_CREATURE_DIR)
    else if (arg === "--base-profile") args.baseProfileDir = path.resolve(argv[++index] || BASE_PROFILE_DIR)
    else if (arg === "--profiles-dir") args.profileRunRoot = path.resolve(argv[++index] || PROFILE_RUN_ROOT)
    else if (arg === "--profile-run-id") args.profileRunId = argv[++index] || args.profileRunId
    else if (arg === "--help" || arg === "-h") {
      printHelp()
      process.exit(0)
    }
  }

  if (!args.readyTimeoutMs) {
    args.readyTimeoutMs = args.headless ? 30_000 : 5 * 60 * 1000
  }

  return args
}

function printHelp() {
  console.log(`Usage:
  node tools/chatgpt_creature_image_batch.ts
  node tools/chatgpt_creature_image_batch.ts --status
  node tools/chatgpt_creature_image_batch.ts --limit 3
  node tools/chatgpt_creature_image_batch.ts --run --limit 1 --concurrency 3
  node tools/chatgpt_creature_image_batch.ts --run --creature 符芯傀犬
  node tools/chatgpt_creature_image_batch.ts --e-tier --jobs 09_素材与图片/ChatGPT批量生成/e-tier-image-jobs.json --queue 09_素材与图片/ChatGPT批量生成/e-tier-image-queue.json

Options:
  --run                Run pending queue jobs through ChatGPT web.
  --status             Print queue status.
  --retry-failed       Mark failed jobs as pending.
  --reset-running      Mark stale running jobs as pending.
  --reset-queue        Rebuild queue from current creature files.
  --e-tier             Load E级弱小生物 instead of the default D/C low-tier batch.
  --limit N            Limit creatures in queue init, or jobs in this run.
  --creature NAME      Process one creature.
  --include-existing   Include creatures that already have node_image/panel_image.
  --all-bio-units      Load image-ready creatures from 04_生物单位 instead of 04_异化生物.
  --creature-dir PATH  Load creature Markdown files from a custom directory.
  --refresh-cards      Regenerate cards while preserving existing accepted front images.
  --front-only         Generate only front character images.
  --card-only          Generate only dossier cards. Best used after a front image in the same chat.
  --no-write-md        Do not write generated asset refs back to Markdown.
  --concurrency N      Parallel browser sessions using cloned profiles. Default: 3, capped at 3.
  --rate-limit N       Max prompt requests per rate window. Default: 10.
  --rate-window-minutes N
                       Rate window in minutes. Default: 5.
  --ready-timeout-minutes N
                       Max time to wait for ChatGPT input to become ready. Default: 0.5 headless, 5 visible.
  --launch-timeout-minutes N
                       Max time to wait for cloakbrowser launch. Default: 1.5.
  --headless           Run browser headless. This is the default.
  --show-browser       Show browser windows instead of running in background.
  --jobs PATH          Use a custom jobs JSON path.
  --queue PATH         Use a custom queue JSON path.
  --base-profile PATH  Source ChatGPT profile to clone. Default: ${BASE_PROFILE_DIR}
  --profiles-dir PATH  Root for per-run worker profile clones. Default: ${PROFILE_RUN_ROOT}
  --profile-run-id ID  Name for this run's profile clone directory.
`)
}

function parseFrontmatter(text) {
  if (!text.startsWith("---\n")) return { data: {}, bodyStart: 0 }
  const end = text.indexOf("\n---", 4)
  if (end === -1) return { data: {}, bodyStart: 0 }
  const data = {}
  let currentKey = ""
  for (const line of text.slice(4, end).split("\n")) {
    if (!line.trim()) continue
    if (line.startsWith("  - ") && currentKey) {
      if (!Array.isArray(data[currentKey])) data[currentKey] = []
      data[currentKey].push(line.slice(4).trim().replace(/^"|"$/g, ""))
      continue
    }
    const colon = line.indexOf(":")
    if (colon === -1) continue
    const key = line.slice(0, colon).trim()
    const raw = line.slice(colon + 1).trim()
    currentKey = key
    data[key] = raw ? raw.replace(/^"|"$/g, "") : []
  }
  return { data, bodyStart: end + 5 }
}

function extractSection(text, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const match = text.match(new RegExp(`^##\\s+${escaped}\\s*\\n([\\s\\S]*?)(?=^##\\s+|\\Z)`, "m"))
  return match ? match[1].trim() : ""
}

function cleanMarkdown(value) {
  return value
    .replace(/!\[\[[^\]]+\]\]/g, "")
    .replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/^[-*]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim()
}

function extractH1(text, fallback) {
  const match = text.match(/^#\s+(.+?)\s*$/m)
  return match ? match[1].trim() : fallback
}

function extractSummary(text) {
  const quote = text.match(/^>\s*(.+?)\s*$/m)
  return quote ? cleanMarkdown(quote[1]) : ""
}

function extractRelationLine(text, label) {
  const relation = extractSection(text, "关系")
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const match = relation.match(new RegExp(`^[-*]\\s*${escaped}：(.+)$`, "m"))
  return match ? cleanMarkdown(match[1]) : ""
}

function extractCardField(cardSection, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const match = cardSection.match(new RegExp(`^[-*]\\s*${escaped}：(.+)$`, "m"))
  return match ? cleanMarkdown(match[1]) : ""
}

function extractCardNestedBullets(cardSection, label, limit = 6) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const match = cardSection.match(new RegExp(`^[-*]\\s*${escaped}：\\s*\\n([\\s\\S]*?)(?=^[-*]\\s*[^\\n：]+：|\\Z)`, "m"))
  if (!match) return []
  return match[1]
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .slice(0, limit)
    .map((line) => cleanMarkdown(line.slice(2)))
}

function extractBullets(sectionText, limit = 6) {
  return sectionText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .slice(0, limit)
    .map((line) => cleanMarkdown(line.slice(2)))
}

function extractTraitClauses(sectionText, limit = 6) {
  return cleanMarkdown(sectionText)
    .split(/[。；]/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, limit)
}

function normalizeDataList(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join(" / ")
  return cleanMarkdown(value || "")
}

function normalizeFilenamePart(value) {
  return value.replace(/[/:*?"<>|\\]/g, "_").replace(/\s+/g, "")
}

async function exists(filePath) {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function withTimeout(promise, timeoutMs, message) {
  let timer
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), timeoutMs)
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"))
  } catch {
    return fallback
  }
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8")
}

async function loadStyleConfig() {
  const raw = await readFile(STYLE_MAP_PATH, "utf8")
  return JSON.parse(raw)
}

function resolveVisualStyle(creature, styleConfig) {
  const style = creature.frontmatter?.visual_style
    || styleConfig.creatures?.[creature.name]
    || styleConfig.default
    || "暗黑奇幻手绘设定"
  if (!styleConfig.styles?.[style]) {
    throw new Error(`Unknown visual style "${style}" for ${creature.name} in ${path.relative(ROOT, STYLE_MAP_PATH)}`)
  }
  return style
}

function styleRules(style, styleConfig) {
  return styleConfig.styles?.[style] || styleConfig.styles?.["暗黑奇幻手绘设定"] || "暗黑奇幻手绘涂鸦，主体清晰。"
}

function buildFrontPrompt(creature) {
  const eTierVisualGuidance = creature.isETier
    ? "\nE级弱小生物补充：体型可以更小、更轻、更容易亲近；允许怪萌、透明、发光、慢吞吞或会跟随的细节，但仍保持黑曜纪元异化生态质感，不要变成普通宠物或玩具。\n"
    : ""
  const petNotes = creature.petNotes ? `\n萌宠化/亲近行为补充：\n${creature.petNotes}\n` : ""
  const bannedCute = creature.isETier ? "过度Q版、幼儿玩具化、普通宠物化" : "可爱宠物化"

  return `请直接生成一张图片，不要只回复文字。

生成《黑曜纪元》${creature.category || creature.type || "异化生物"}「${creature.name}」的正面设定图。

画面：单只生物，正面站姿或正面爬伏姿态，主体居中，完整露出头部、身体、四肢/足/翅/尾等关键结构。背景使用中性浅灰、浅纸色或透明感浅底，不要模仿档案卡背景，不要大面积主题色背景。画面不要标题和大段文字，最多只允许很小的手写标注，不能遮挡主体。

风格：高完成度暗黑奇幻手绘涂鸦设定图，粗粝墨线、刮擦、污渍、手工设定稿质感；不是儿童涂鸦，不要过度写实照片感，不要二次元。

配色：${styleRules(creature.visualStyle, creature.styleConfig)}

${eTierVisualGuidance}禁止元素：日式武士、和服、鸟居、浮世绘、日式妖怪面具、${bannedCute}、主体过黑、背景抢主体、多只生物。

生物数据：
- 名称：${creature.name}
- 所属势力：${creature.faction}
- 威胁等级：${creature.threat}
- 生物倾向：${creature.alignment}
- 基底色：${creature.base.join(" / ")}
- 生态定位：${creature.ecology}
- 一句话简介：${creature.summary}

外观设定：
${creature.appearance}
${petNotes}
`
}

function formatThreatLabel(threat) {
  const value = String(threat || "D").trim()
  return value.endsWith("级") ? value : `${value}级`
}

function buildCardPrompt(creature) {
  const traitItems = cardTraitItems(creature)
  const eTierVisualGuidance = creature.isETier
    ? "\nE级弱小生物补充：卡面可以体现小型、弱威胁、可亲近、可采集或可指路的特征；允许怪萌但不要削弱异化生态感。\n"
    : ""
  const petNotes = creature.petNotes ? `\n萌宠化/亲近行为补充：\n${creature.petNotes}\n` : ""
  const bannedCute = creature.isETier ? "过度Q版、幼儿玩具化、普通宠物化" : "可爱宠物化"

  return `请基于上一张「${creature.name}」正面设定图中的同一只生物，直接生成一张图片，不要只回复文字。

生成《黑曜纪元》生物档案卡素材，竖版 9:16。主体形象必须和上一张正面设定图一致，不要重新设计成另一只。

卡片风格：暗黑奇幻手绘涂鸦档案卡，高完成度、粗粝墨线、污渍纸面、手工排版、档案感。整体亮度提高，主体清楚，文字区和插图区分明。

配色：${styleRules(creature.visualStyle, creature.styleConfig)}

版式：顶部大标题「${creature.name}」，副标题「${creature.category || LOW_TIER_TYPE} / ${formatThreatLabel(creature.threat)}」，显示所属势力或生态归属「${creature.faction}」。中部包含主体小图和 4 到 6 个局部特性小格。底部有属性格。中文尽量大、清晰、高对比；不要小字堆满页面。
${eTierVisualGuidance}

局部特性优先画：
${traitItems.map((item) => `- ${item}`).join("\n")}

局部特性格只写形态、器官、能力、习性等生物自身特征；不要把所属势力分配的工作、职责、用途、可利用素材或弱点写进局部特性格。

底部信息：
${cardInfoLines(creature).join("\n")}
${petNotes}

禁止元素：日式武士、和服、鸟居、浮世绘、日式妖怪面具、${bannedCute}、纯黑糊成一团、背景抢主体。
`
}

async function readCreature(filePath, styleConfig, args) {
  const text = await readFile(filePath, "utf8")
  const { data } = parseFrontmatter(text)
  const name = extractH1(text, path.basename(filePath, ".md"))
  const isETier = name !== E_TIER_TYPE
    && data.type === "异化生物"
    && (
      data.threat === "E"
      || (Array.isArray(data.subtype) && data.subtype.includes(E_TIER_TYPE))
      || (Array.isArray(data.tags) && data.tags.includes(E_TIER_TYPE))
    )
  if (args.allBioUnits) {
    // Cross-world biology entries already carry required rank/alignment/style fields.
  } else if (args.eTier) {
    if (!isETier) return null
  } else if (data.type !== LOW_TIER_TYPE && !EXTRA_BATCH_CREATURES.has(name)) {
    return null
  }

  const cardSection = extractSection(text, "档案卡内容")
  const appearanceSection = extractSection(text, "外观")
  const petSection = extractSection(text, "萌宠化扩写")
  const appearance = cleanMarkdown(appearanceSection)
  const appearanceTraits = extractCardNestedBullets(cardSection, "局部特性", 6)
  const fallbackAppearanceTraits = extractBullets(appearanceSection, 6)
  const fallbackTraitClauses = extractTraitClauses(appearanceSection, 6)
  const abilities = extractBullets(extractSection(text, "能力"))
  const weakness = extractCardField(cardSection, "弱点") || normalizeDataList(data.weakness) || cleanMarkdown(extractSection(text, "弱点"))
  const behavior = extractCardField(cardSection, "典型行为") || cleanMarkdown(extractSection(text, "行为"))
  const usage = extractCardField(cardSection, "可利用素材") || extractRelationLine(text, "可被利用")
  const cardCategory = extractCardField(cardSection, "分类")
  const cardDutyTags = extractCardField(cardSection, "职能标签")
  const relationType = extractRelationLine(text, "分类")
  const category = cardCategory || cleanMarkdown(data.type) || LOW_TIER_TYPE
  const type = cardCategory
    ? [cardCategory, cardDutyTags].filter(Boolean).join(" / ")
    : relationType || category
  const creature = {
    name,
    filePath,
    frontmatter: data,
    category,
    faction: extractCardField(cardSection, "所属势力") || data.faction || extractRelationLine(text, "所属势力") || extractRelationLine(text, "生态位置") || "无固定势力",
    base: Array.isArray(data.base) ? data.base : String(data.base || "").split(/\s*\/\s*/).filter(Boolean),
    ecology: extractCardField(cardSection, "生态位") || data.ecology || extractRelationLine(text, "生态位置") || normalizeDataList(data.habitat),
    threat: data.threat || "D",
    summary: extractSummary(text),
    appearance,
    appearanceTraits: appearanceTraits.length ? appearanceTraits : (fallbackAppearanceTraits.length ? fallbackAppearanceTraits : fallbackTraitClauses),
    abilities,
    weakness,
    behavior: behavior || extractSummary(text),
    usage,
    type,
    isETier,
    petNotes: cleanMarkdown(petSection),
  }
  creature.alignment = extractCardField(cardSection, "生物倾向") || resolveCreatureAlignment(creature, CREATURE_ALIGNMENT)
  creature.styleConfig = styleConfig
  creature.visualStyle = resolveVisualStyle(creature, styleConfig)
  creature.slug = normalizeFilenamePart(creature.name)
  creature.frontFilename = `${creature.slug}_正面设定图.png`
  creature.cardFilename = `${creature.slug}_档案卡.png`
  creature.frontPrompt = buildFrontPrompt(creature)
  creature.cardPrompt = buildCardPrompt(creature)
  creature.hasFrontImages = await hasUsableImages(data, { types: ["front"], assetDir: ASSET_DIR, exists })
  creature.hasCardImage = await hasUsableImages(data, { types: ["card"], assetDir: ASSET_DIR, exists })
  creature.hasImages = await hasUsableImages(data, { types: args.types, assetDir: ASSET_DIR, exists })
  return creature
}

async function loadCreatures(args) {
  const styleConfig = await loadStyleConfig()
  const entries = await import("node:fs/promises").then((fs) => fs.readdir(args.creatureDir))
  const creatures = []
  for (const entry of entries.sort()) {
    if (!entry.endsWith(".md")) continue
    const creature = await readCreature(path.join(args.creatureDir, entry), styleConfig, args)
    if (!creature) continue
    if (args.creature && creature.name !== args.creature) continue
    if (!args.includeExisting && creature.hasImages) continue
    creatures.push(creature)
  }
  return creatures.slice(0, Number.isFinite(args.limit) ? args.limit : creatures.length)
}

async function writeJobs(creatures, args) {
  await mkdir(PROMPT_DIR, { recursive: true })
  await mkdir(RESULT_DIR, { recursive: true })

  const jobs = {
    createdAt: new Date().toISOString(),
    root: ROOT,
    mode: args.run ? "run" : "dry-run",
    types: args.types,
    creatures: creatures.map((creature) => ({
      name: creature.name,
      faction: creature.faction,
      threat: creature.threat,
      alignment: creature.alignment,
      base: creature.base,
      ecology: creature.ecology,
      type: creature.type,
      visualStyle: creature.visualStyle,
      hasImages: creature.hasImages,
      filePath: path.relative(ROOT, creature.filePath),
      outputs: {
        front: outputPathForStep(creature, "front", SCRIPT_PATHS),
        card: outputPathForStep(creature, "card", SCRIPT_PATHS),
      },
      prompts: {
        front: creature.frontPrompt,
        card: creature.cardPrompt,
      },
    })),
  }

  for (const creature of creatures) {
    await writeFile(path.join(PROMPT_DIR, `${creature.slug}_front.txt`), creature.frontPrompt, "utf8")
    await writeFile(path.join(PROMPT_DIR, `${creature.slug}_card.txt`), creature.cardPrompt, "utf8")
  }
  await writeFile(args.jobsPath, `${JSON.stringify(jobs, null, 2)}\n`, "utf8")
  return jobs
}

async function loadOrCreateQueue(creatures, args) {
  const existing = args.resetQueue ? {} : await readJson(args.queuePath, {})
  const queue = mergeQueueJobs(existing, creatures, args, SCRIPT_PATHS)
  await writeJson(args.queuePath, queue)
  return queue
}

function summarizeQueue(queue) {
  const counts = {}
  for (const job of queue.jobs || []) {
    counts[job.status] = (counts[job.status] || 0) + 1
  }
  return counts
}

function printQueueStatus(queue, queuePath = QUEUE_PATH) {
  const counts = summarizeQueue(queue)
  console.log(`queue=${path.relative(ROOT, queuePath)}`)
  console.log(`total=${(queue.jobs || []).length} pending=${counts.pending || 0} running=${counts.running || 0} done=${counts.done || 0} failed=${counts.failed || 0}`)
  for (const job of queue.jobs || []) {
    const stepSummary = Object.entries(job.steps || {})
      .map(([type, step]) => `${type}:${step.status}`)
      .join(" ")
    console.log(`- ${job.creature} ${job.status} attempts=${job.attempts || 0} ${stepSummary}${job.error ? ` error=${job.error}` : ""}`)
  }
}

async function mutateQueue(args, mutator) {
  const queue = await readJson(args.queuePath, { schemaVersion: 1, jobs: [] })
  mutator(queue)
  queue.updatedAt = new Date().toISOString()
  await writeJson(args.queuePath, queue)
  return queue
}

class QueueStore {
  constructor(queuePath) {
    this.queuePath = queuePath
    this._writeChain = Promise.resolve()
  }

  async read() {
    return readJson(this.queuePath, { schemaVersion: 1, jobs: [] })
  }

  async update(mutator) {
    this._writeChain = this._writeChain.then(async () => {
      const queue = await this.read()
      const result = await mutator(queue)
      queue.updatedAt = new Date().toISOString()
      await writeJson(this.queuePath, queue)
      return result
    })
    return this._writeChain
  }
}

class PersistentRateLimiter {
  constructor({ statePath, limit, windowMs }) {
    this.statePath = statePath
    this.limit = limit
    this.windowMs = windowMs
    this._chain = Promise.resolve()
  }

  async acquire(label) {
    this._chain = this._chain.then(async () => {
      while (true) {
        const now = Date.now()
        const state = await readJson(this.statePath, { timestamps: [] })
        const timestamps = (state.timestamps || []).filter((time) => now - time < this.windowMs)
        if (timestamps.length < this.limit) {
          timestamps.push(now)
          await writeJson(this.statePath, {
            windowMs: this.windowMs,
            limit: this.limit,
            timestamps,
            updatedAt: new Date().toISOString(),
          })
          console.log(`[rate] ${label}: ${timestamps.length}/${this.limit} in ${Math.round(this.windowMs / 60000)}m`)
          return
        }
        const waitMs = Math.max(1000, this.windowMs - (now - timestamps[0]) + 500)
        const waitSeconds = Math.ceil(waitMs / 1000)
        console.log(`[rate] ${label}: waiting ${waitSeconds}s (${timestamps.length}/${this.limit})`)
        await sleep(waitMs)
      }
    })
    return this._chain
  }
}

async function createBrowserSession(args, workerId, jobId) {
  const launch = async () => {
    const userDataDir = profilePathForWorker(args, workerId, jobId)
    await copyProfileTree(args.baseProfileDir, userDataDir)
    console.log(`[profile] worker ${workerId}: ${path.relative(ROOT, userDataDir)} cloned from ${args.baseProfileDir}`)

    if (CLOAKBROWSER_WORKAROUND_BIN) {
      return await withTimeout(
        launchViaCDP({ binaryPath: CLOAKBROWSER_WORKAROUND_BIN, userDataDir, headless: args.headless }),
        args.launchTimeoutMs,
        `Timed out launching cloakbrowser after ${Math.round(args.launchTimeoutMs / 1000)}s.`,
      )
    }

    const { launchPersistentContext } = await import("cloakbrowser")
    const context = await withTimeout(
      launchPersistentContext({
        userDataDir,
        headless: args.headless,
        args: ["--in-process-gpu", "--headless=new"],
      }),
      args.launchTimeoutMs,
      `Timed out launching cloakbrowser after ${Math.round(args.launchTimeoutMs / 1000)}s.`,
    )
    const pages = context.pages()
    const page = pages.length > 0 ? pages[0] : await context.newPage()
    return { context, page, userDataDir }
  }

  const sessionPromise = browserLaunchChain.then(launch, launch)
  browserLaunchChain = sessionPromise.catch(() => {})
  return sessionPromise
}

async function closeBrowserSession(session) {
  if (!session) return
  try {
    await session.context.close()
  } catch {}
}

async function fillPrompt(page, prompt) {
  const el = page.locator(CHATGPT_PROVIDER.input.selector).first()
  await el.fill("")
  await el.fill(prompt)
}

async function submitPrompt(page) {
  const btn = page.locator(CHATGPT_PROVIDER.input.submitSelector).first()
  await btn.click()
}

async function checkSelectorVisible(page, selector, timeoutMs = 5000) {
  try {
    await page.waitForSelector(selector, { state: "visible", timeout: timeoutMs })
    return true
  } catch {
    return false
  }
}

async function saveSessionDiagnostics(page, label, error) {
  const safeLabel = normalizeFilenamePart(label)
  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  const basePath = path.join(DIAGNOSTIC_DIR, `${stamp}-${safeLabel}`)
  await mkdir(DIAGNOSTIC_DIR, { recursive: true })
  const message = error?.stack || error?.message || String(error)

  try {
    await page.screenshot({ path: `${basePath}.png`, fullPage: true })
  } catch {}

  try {
    await writeFile(`${basePath}.html`, await page.content(), "utf8")
  } catch {}

  await writeFile(`${basePath}.txt`, `${message}\n`, "utf8")
  console.error(`[diagnostic] saved ${path.relative(ROOT, basePath)}.{png,html,txt}`)
}

async function hasHumanVerification(page) {
  try {
    const text = await page.evaluate(() => `${document.title}\n${document.body?.innerText || ""}`)
    return /Just a moment|Verify you are human|Verification successful|Enable JavaScript and cookies to continue/i.test(text)
  } catch {
    return false
  }
}

async function hasLoggedOutLanding(page) {
  try {
    const text = await page.evaluate(() => `${document.title}\n${document.body?.innerText || ""}`)
    return /Log in to get|Sign up for free|登录以获取|获取为你量身定制的回复|免费注册/i.test(text)
  } catch {
    return false
  }
}

async function openChatGptSession(args, workerId, jobId) {
  const session = await createBrowserSession(args, workerId, jobId)
  try {
    const { page } = session
    await page.goto(CHATGPT_PROVIDER.startUrl, { waitUntil: "domcontentloaded" })
    await sleep(2000)

    const loginVisible = await checkSelectorVisible(page, CHATGPT_PROVIDER.auth.loginCheck, 3000)
    const loggedOutLanding = loginVisible || await hasLoggedOutLanding(page)
    if (loggedOutLanding) {
      throw new Error(`ChatGPT requires login in the base profile. Run once with --show-browser --ready-timeout-minutes 5, log in, then rerun.`)
    }
    const verificationVisible = await hasHumanVerification(page)
    if (verificationVisible && args.headless) {
      throw new Error("ChatGPT human verification is blocking the cloned profile. Run once with --show-browser --ready-timeout-minutes 5, finish the verification, then rerun the headless queue.")
    }
    if (verificationVisible) {
      console.log(`[auth] ChatGPT human verification is visible; waiting up to ${Math.ceil(args.readyTimeoutMs / 60000)}m for the input box.`)
    }
    await page.waitForSelector(CHATGPT_PROVIDER.auth.readyCheck, { state: "visible", timeout: args.readyTimeoutMs })
    return session
  } catch (error) {
    await saveSessionDiagnostics(session.page, "open-chatgpt-session", error)
    try {
      await closeBrowserSession(session)
    } catch {}
    throw error
  }
}

async function sendChatPrompt({ page }, prompt) {
  await fillPrompt(page, prompt)
  const before = await collectImageHandles(page)
  await submitPrompt(page)
  return before
}

async function collectImageHandles(page) {
  return page.evaluate(() => {
    const results = []
    const seen = new Set()

    const addImg = (img, source) => {
      const src = img.currentSrc || img.src || ""
      if (!src || seen.has(src)) return
      seen.add(src)
      results.push({
        source,
        src,
        previewSrc: src.slice(0, 200),
        alt: img.alt || "",
        width: img.naturalWidth || img.width || 0,
        height: img.naturalHeight || img.height || 0,
        complete: img.complete,
      })
    }

    // Strategy 1: assistant messages with data attribute
    const assistantMessages = [...document.querySelectorAll("[data-message-author-role='assistant']")]
    for (const msg of assistantMessages) {
      for (const img of msg.querySelectorAll("img")) {
        addImg(img, "assistant-msg")
      }
      for (const canvas of msg.querySelectorAll("canvas")) {
        const dataUrl = canvas.toDataURL?.("image/png") || ""
        if (dataUrl && canvas.width >= 100 && canvas.height >= 100) {
          results.push({
            source: "assistant-canvas",
            src: dataUrl,
            previewSrc: dataUrl.slice(0, 200),
            width: canvas.width,
            height: canvas.height,
            alt: "",
            complete: true,
          })
        }
      }
    }

    // Strategy 2: any large image on page (fallback)
    for (const img of document.querySelectorAll("img")) {
      const w = img.naturalWidth || img.width || 0
      const h = img.naturalHeight || img.height || 0
      const src = img.currentSrc || img.src || ""
      if (src && !seen.has(src) && (w >= 200 || h >= 200)) {
        addImg(img, "page-wide")
      }
    }

    return results
  })
}

async function waitForNewImage(page, knownImageKeys, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs
  let lastCount = knownImageKeys.size
  let screenshotInterval = 0
  while (Date.now() < deadline) {
    await sleep(3000)
    const images = await collectImageHandles(page)
    lastCount = images.length
    const image = selectNewImage(images, knownImageKeys)
    if (image) return image
    screenshotInterval++
    if (screenshotInterval % 20 === 0) {
      try {
        const stamp = new Date().toISOString().replace(/[:.]/g, "-")
        await mkdir(DIAGNOSTIC_DIR, { recursive: true })
        const shotPath = path.join(DIAGNOSTIC_DIR, `poll-${stamp}.png`)
        await page.screenshot({ path: shotPath, fullPage: true })
        console.log(`  [poll] imageCount=${lastCount} screenshot=${path.relative(ROOT, shotPath)}`)
        const htmlPath = path.join(DIAGNOSTIC_DIR, `poll-${stamp}.html`)
        await writeFile(htmlPath, await page.content(), "utf8")
        const imgDebug = await page.evaluate(() => {
          const allImgs = [...document.querySelectorAll("img")].slice(0, 10)
          return allImgs.map(img => ({
            previewSrc: (img.currentSrc || img.src || "").slice(0, 80),
            w: img.naturalWidth, h: img.naturalHeight,
            parent: img.parentElement?.className?.slice(0, 40),
            grandparent: img.parentElement?.parentElement?.getAttribute("data-message-author-role") || "",
          }))
        })
        console.log(`  [poll] imgDebug=${JSON.stringify(imgDebug)}`)
      } catch {}
    }
  }
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-")
    const shotPath = path.join(DIAGNOSTIC_DIR, `timeout-${stamp}.png`)
    await mkdir(DIAGNOSTIC_DIR, { recursive: true })
    await page.screenshot({ path: shotPath, fullPage: true })
    console.log(`  [timeout] screenshot=${path.relative(ROOT, shotPath)}`)
  } catch {}
  throw new Error(`Timed out waiting for generated image. imageCount=${lastCount}, known=${knownImageKeys.size}`)
}

async function saveImageFromPage(page, imageHandle, outputPath) {
  const payload = await page.evaluate(async ({ src }) => {
    const response = await fetch(src)
    const blob = await response.blob()
    const buffer = await blob.arrayBuffer()
    const bytes = new Uint8Array(buffer)
    let binary = ""
    const chunkSize = 0x8000
    for (let index = 0; index < bytes.length; index += chunkSize) {
      binary += String.fromCharCode(...bytes.slice(index, index + chunkSize))
    }
    return { mimeType: blob.type || "image/png", base64: btoa(binary) }
  }, imageHandle)

  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, Buffer.from(payload.base64, "base64"))
  return payload.mimeType
}

function setFrontmatterScalar(text, key, value) {
  if (!text.startsWith("---\n")) return text
  const end = text.indexOf("\n---", 4)
  if (end === -1) return text
  const head = text.slice(0, end)
  const tail = text.slice(end)
  const line = `${key}: "${value}"`
  const pattern = new RegExp(`^${key}:.*$`, "m")
  if (pattern.test(head)) {
    return `${head.replace(pattern, line)}${tail}`
  }
  return `${head}\n${line}${tail}`
}

function upsertImageSection(text, imageFilenames) {
  const block = [
    "## 图像素材",
    ...imageFilenames.flatMap((filename) => [`![[${filename}]]`, ""]),
  ].join("\n").trimEnd() + "\n\n"

  if (/^##\s+图像素材\s*$/m.test(text)) {
    return text.replace(/^##\s+图像素材\s*\n[\s\S]*?(?=^##\s+|\Z)/m, block)
  }
  if (/^##\s+关系\s*$/m.test(text)) {
    return text.replace(/^##\s+关系\s*$/m, `${block}## 关系`)
  }
  const h1 = text.match(/^#\s+.+$/m)
  if (h1) {
    const insertAt = h1.index + h1[0].length
    return `${text.slice(0, insertAt)}\n\n${block}${text.slice(insertAt).replace(/^\n+/, "")}`
  }
  return `${text.trimEnd()}\n\n${block}`
}

async function updateCreatureMarkdown(creature, saved) {
  let text = await readFile(creature.filePath, "utf8")
  const imageFilenames = []
  if (saved.front) {
    text = setFrontmatterScalar(text, "status", "图像设定草案")
    text = setFrontmatterScalar(text, "source", "ChatGPT 网页端批量生成")
    text = setFrontmatterScalar(text, "node_image", creature.frontFilename)
    text = setFrontmatterScalar(text, "panel_image", creature.frontFilename)
    imageFilenames.push(creature.frontFilename)
  } else if (saved.card && creature.hasFrontImages) {
    imageFilenames.push(...[creature.frontmatter.node_image, creature.frontmatter.panel_image].filter(Boolean))
  }
  if (saved.card) {
    text = setFrontmatterScalar(text, "card_image", creature.cardFilename)
    imageFilenames.push(creature.cardFilename)
  }
  const images = [...new Set(imageFilenames)]
  if (images.length) {
    text = upsertImageSection(text, images)
  }
  await writeFile(creature.filePath, text, "utf8")
}

async function copyAcceptedAssets(creature, saved, args) {
  const accepted = {}
  if (saved.front && !(args.refreshCards && creature.hasFrontImages)) {
    const finalPath = path.join(ASSET_DIR, creature.frontFilename)
    await writeFile(finalPath, await readFile(saved.front))
    accepted.front = finalPath
  }
  if (saved.card) {
    const finalPath = path.join(ASSET_DIR, creature.cardFilename)
    await writeFile(finalPath, await readFile(saved.card))
    accepted.card = finalPath
  }
  return accepted
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

async function claimNextJob(queueStore, args, runBudget) {
  return queueStore.update((queue) => {
    if (runBudget.claimed >= runBudget.max) return null
    const job = (queue.jobs || []).find((candidate) => {
      if (candidate.status !== "pending") return false
      if (args.creature && candidate.creature !== args.creature) return false
      if ((candidate.attempts || 0) >= (candidate.maxAttempts || 3)) return false
      return true
    })
    if (!job) return null

    runBudget.claimed += 1
    job.status = "running"
    job.attempts = (job.attempts || 0) + 1
    job.startedAt = new Date().toISOString()
    job.updatedAt = job.startedAt
    job.error = ""
    for (const step of Object.values(job.steps || {})) {
      step.status = "pending"
      step.error = ""
      step.requestedAt = ""
      step.completedAt = ""
    }
    return clone(job)
  })
}

async function markJobDone(queueStore, jobId, saved, accepted) {
  await queueStore.update((queue) => {
    applyJobDone(queue, jobId, saved, accepted, { root: ROOT })
  })
}

async function markJobFailed(queueStore, jobId, error) {
  await queueStore.update((queue) => {
    const job = (queue.jobs || []).find((candidate) => candidate.id === jobId)
    if (!job) return
    job.status = "failed"
    job.updatedAt = new Date().toISOString()
    job.error = error.message || String(error)
    for (const step of Object.values(job.steps || {})) {
      if (step.status === "running" || step.status === "pending") {
        step.status = "failed"
        step.error = job.error
      }
    }
  })
}

async function runJobStep({ browser, queueStore, rateLimiter, job, creature, type, seenImageKeys }) {
  const prompt = type === "front" ? creature.frontPrompt : creature.cardPrompt
  const filename = type === "front" ? creature.frontFilename : creature.cardFilename
  const label = `${job.creature}/${type}`
  const outputPath = path.join(RESULT_DIR, creature.slug, filename)

  await queueStore.update((queue) => {
    const live = (queue.jobs || []).find((candidate) => candidate.id === job.id)
    const step = live?.steps?.[type]
    if (!step) return
    step.status = "running"
    step.requestedAt = new Date().toISOString()
    step.error = ""
  })

  await rateLimiter.acquire(label)
  const beforeImages = await sendChatPrompt(browser, prompt)
  const knownImageKeys = new Set([
    ...seenImageKeys,
    ...beforeImages.map((image) => image.src).filter(Boolean),
  ])
  const image = await waitForNewImage(browser.page, knownImageKeys)
  if (image.src) seenImageKeys.add(image.src)
  await saveImageFromPage(browser.page, image, outputPath)
  console.log(`  [${label}] saved ${path.relative(ROOT, outputPath)}`)
  return outputPath
}

async function runOneJob({ workerId, queueStore, rateLimiter, job, creature, args }) {
  console.log(`\n[worker ${workerId}] ${job.creature} style=${creature.visualStyle} headless=${args.headless}`)
  const session = await openChatGptSession(args, workerId, job.id)
  const browser = { page: session.page }
  const saved = {}
  const seenImageKeys = new Set()
  try {
    for (const type of Object.keys(job.steps || {})) {
      saved[type] = await runJobStep({ browser, queueStore, rateLimiter, job, creature, type, seenImageKeys })
    }
    const accepted = await copyAcceptedAssets(creature, saved, args)
    if (args.writeMd) await updateCreatureMarkdown(creature, accepted)
    await markJobDone(queueStore, job.id, saved, accepted)
    return { id: job.id, creature: job.creature, status: "done", saved, accepted }
  } finally {
    await closeBrowserSession(session)
  }
}

async function workerLoop({ workerId, queueStore, rateLimiter, creatureByName, args, runBudget, report }) {
  while (true) {
    const job = await claimNextJob(queueStore, args, runBudget)
    if (!job) return

    const creature = creatureByName.get(job.creature)
    if (!creature) {
      const error = new Error(`Creature not loaded for queued job: ${job.creature}`)
      await markJobFailed(queueStore, job.id, error)
      report.push({ id: job.id, creature: job.creature, status: "failed", error: error.message })
      continue
    }

    try {
      const result = await runOneJob({ workerId, queueStore, rateLimiter, job, creature, args })
      report.push(result)
    } catch (error) {
      console.error(`[worker ${workerId}] ${job.creature} failed: ${error.message}`)
      await markJobFailed(queueStore, job.id, error)
      report.push({ id: job.id, creature: job.creature, status: "failed", error: error.message })
    }
  }
}

async function runQueue(creatures, args) {
  const queueStore = new QueueStore(args.queuePath)
  const creatureByName = new Map(creatures.map((creature) => [creature.name, creature]))
  const rateLimiter = new PersistentRateLimiter({
    statePath: RATE_STATE_PATH,
    limit: args.rateLimit,
    windowMs: args.rateWindowMs,
  })
  const runBudget = {
    claimed: 0,
    max: Number.isFinite(args.limit) ? args.limit : Number.POSITIVE_INFINITY,
  }
  const report = []
  const concurrency = Math.max(1, args.concurrency)
  await Promise.all(
    Array.from({ length: concurrency }, (_, index) =>
      workerLoop({ workerId: index + 1, queueStore, rateLimiter, creatureByName, args, runBudget, report })
    )
  )
  return report
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  if (args.status && !args.run && !args.resetQueue && !args.retryFailed && !args.resetRunning) {
    const queue = await readJson(args.queuePath, { schemaVersion: 1, jobs: [] })
    printQueueStatus(queue, args.queuePath)
    return
  }

  if ((args.retryFailed || args.resetRunning) && !args.run && !args.resetQueue) {
    let queue = await readJson(args.queuePath, { schemaVersion: 1, jobs: [] })
    if (args.retryFailed) {
      queue = await mutateQueue(args, (draft) => {
        for (const job of draft.jobs || []) {
          if (job.status !== "failed") continue
          job.status = "pending"
          job.attempts = 0
          job.error = ""
          job.startedAt = ""
          job.completedAt = ""
          for (const step of Object.values(job.steps || {})) {
            step.status = "pending"
            step.error = ""
            step.requestedAt = ""
            step.completedAt = ""
          }
        }
      })
    }
    if (args.resetRunning) {
      queue = await mutateQueue(args, (draft) => {
        for (const job of draft.jobs || []) {
          if (job.status !== "running") continue
          job.status = "pending"
          job.error = "Reset stale running job."
          for (const step of Object.values(job.steps || {})) {
            if (step.status === "running") step.status = "pending"
          }
        }
      })
    }
    printQueueStatus(queue, args.queuePath)
    return
  }

  const loadArgs = args.run && !args.resetQueue ? { ...args, limit: Number.POSITIVE_INFINITY } : args
  const creatures = await loadCreatures(loadArgs)
  const jobs = await writeJobs(creatures, args)
  let queue = await loadOrCreateQueue(creatures, args)

  if (args.retryFailed) {
    queue = await mutateQueue(args, (draft) => {
      for (const job of draft.jobs || []) {
        if (job.status !== "failed") continue
        job.status = "pending"
        job.attempts = 0
        job.error = ""
        job.startedAt = ""
        job.completedAt = ""
        for (const step of Object.values(job.steps || {})) {
          step.status = "pending"
          step.error = ""
          step.requestedAt = ""
          step.completedAt = ""
        }
      }
    })
  }

  if (args.resetRunning) {
    queue = await mutateQueue(args, (draft) => {
      for (const job of draft.jobs || []) {
        if (job.status !== "running") continue
        job.status = "pending"
        job.error = "Reset stale running job."
        for (const step of Object.values(job.steps || {})) {
          if (step.status === "running") step.status = "pending"
        }
      }
    })
  }

  console.log(`creatures=${creatures.length} types=${args.types.join(",")} jobs=${path.relative(ROOT, args.jobsPath)} queue=${path.relative(ROOT, args.queuePath)}`)
  console.log(`prompts=${path.relative(ROOT, PROMPT_DIR)}`)
  console.log(`policy=concurrency:${args.concurrency} rate:${args.rateLimit}/${Math.round(args.rateWindowMs / 60000)}m headless:${args.headless}`)
  console.log(`profiles=base:${args.baseProfileDir} run:${path.relative(ROOT, path.join(args.profileRunRoot, args.profileRunId))}`)
  for (const creature of creatures) {
    console.log(`- ${creature.name} (${creature.visualStyle}) hasImages=${creature.hasImages}`)
  }

  if (args.status) {
    printQueueStatus(queue, args.queuePath)
    return
  }

  if (!args.run) {
    printQueueStatus(queue, args.queuePath)
    console.log("\nQueue prepared only. Add --run to consume pending jobs.")
    return
  }

  if (!(queue.jobs || []).some((job) => job.status === "pending")) {
    console.log("No pending queue jobs.")
    return
  }

  const report = await runQueue(creatures, args)
  const reportPath = path.join(WORK_DIR, `run-report-${Date.now()}.json`)
  await writeFile(reportPath, `${JSON.stringify({ jobs, report }, null, 2)}\n`, "utf8")
  queue = await readJson(args.queuePath, queue)
  printQueueStatus(queue, args.queuePath)
  console.log(`report=${path.relative(ROOT, reportPath)}`)
}

main().catch((error) => {
  console.error(error.stack || error.message)
  process.exit(1)
})
