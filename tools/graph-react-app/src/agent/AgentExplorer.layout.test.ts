import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFileSync } from "node:fs";
import test from "node:test";

const agentExplorerCss = readFileSync(new URL("./AgentExplorer.css", import.meta.url), "utf8");
const agentExplorerTsx = readFileSync(new URL("./AgentExplorer.tsx", import.meta.url), "utf8");
const viteConfigTs = readFileSync(new URL("../../vite.config.ts", import.meta.url), "utf8");
const appTsx = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
const agentProgressControllerTs = readFileSync(new URL("./agentProgressController.ts", import.meta.url), "utf8");
const agentRegionControllerTs = readFileSync(new URL("./agentRegionController.ts", import.meta.url), "utf8");
const agentInstallReadinessControllerTs = readFileSync(new URL("./agentInstallReadinessController.ts", import.meta.url), "utf8");
const agentPlayerActionReadinessControllerTs = readFileSync(new URL("./agentPlayerActionReadinessController.ts", import.meta.url), "utf8");
const recoveryRotationControllerTs = readFileSync(new URL("./recoveryRotationController.ts", import.meta.url), "utf8");
const agentPlayerLabelsTs = readFileSync(new URL("./agentPlayerLabels.ts", import.meta.url), "utf8");
const gameRunTimelineTsx = readFileSync(new URL("./components/GameRunTimeline.tsx", import.meta.url), "utf8");
const publicReceiptDisclosureTsx = readFileSync(new URL("./components/PublicReceiptDisclosure.tsx", import.meta.url), "utf8");
const resultNavigationTsx = readFileSync(new URL("./components/ResultNavigation.tsx", import.meta.url), "utf8");
const inventoryPanelPath = new URL("./components/InventoryPanel.tsx", import.meta.url);
const inventoryPanelTsx = existsSync(inventoryPanelPath)
  ? readFileSync(inventoryPanelPath, "utf8")
  : "";
const resourcePanelPath = new URL("./components/ResourcePanel.tsx", import.meta.url);
const resourcePanelTsx = existsSync(resourcePanelPath)
  ? readFileSync(resourcePanelPath, "utf8")
  : "";
const marketPanelPath = new URL("./components/MarketPanel.tsx", import.meta.url);
const marketPanelTsx = existsSync(marketPanelPath)
  ? readFileSync(marketPanelPath, "utf8")
  : "";
const directTradePanelPath = new URL("./components/DirectTradePanel.tsx", import.meta.url);
const directTradePanelTsx = existsSync(directTradePanelPath)
  ? readFileSync(directTradePanelPath, "utf8")
  : "";
const organizationPanelPath = new URL("./components/OrganizationPanel.tsx", import.meta.url);
const organizationPanelTsx = existsSync(organizationPanelPath)
  ? readFileSync(organizationPanelPath, "utf8")
  : "";
const encounterPanelPath = new URL("./components/EncounterPanel.tsx", import.meta.url);
const encounterPanelTsx = existsSync(encounterPanelPath)
  ? readFileSync(encounterPanelPath, "utf8")
  : "";
const bountyPanelPath = new URL("./components/BountyPanel.tsx", import.meta.url);
const bountyPanelTsx = existsSync(bountyPanelPath)
  ? readFileSync(bountyPanelPath, "utf8")
  : "";
const competitiveLadderPanelPath = new URL("./components/CompetitiveLadderPanel.tsx", import.meta.url);
const competitiveLadderPanelTsx = existsSync(competitiveLadderPanelPath)
  ? readFileSync(competitiveLadderPanelPath, "utf8")
  : "";
const partyRunPanelPath = new URL("./components/PartyRunPanel.tsx", import.meta.url);
const partyRunPanelTsx = existsSync(partyRunPanelPath)
  ? readFileSync(partyRunPanelPath, "utf8")
  : "";
const webBridgePlaySurfacePath = new URL("./components/WebBridgePlaySurface.tsx", import.meta.url);
const webBridgePlaySurfaceTsx = existsSync(webBridgePlaySurfacePath)
  ? readFileSync(webBridgePlaySurfacePath, "utf8")
  : "";
const publicWorldPanelPath = new URL("./components/PublicWorldPanel.tsx", import.meta.url);
const publicWorldPanelTsx = existsSync(publicWorldPanelPath)
  ? readFileSync(publicWorldPanelPath, "utf8")
  : "";
const raidRetaliationPanelPath = new URL("./components/RaidRetaliationPanel.tsx", import.meta.url);
const raidRetaliationPanelTsx = existsSync(raidRetaliationPanelPath)
  ? readFileSync(raidRetaliationPanelPath, "utf8")
  : "";
const seasonPanelPath = new URL("./components/SeasonPanel.tsx", import.meta.url);
const seasonPanelTsx = existsSync(seasonPanelPath)
  ? readFileSync(seasonPanelPath, "utf8")
  : "";
const relationshipDiplomacyPanelPath = new URL("./components/RelationshipDiplomacyPanel.tsx", import.meta.url);
const relationshipDiplomacyPanelTsx = existsSync(relationshipDiplomacyPanelPath)
  ? readFileSync(relationshipDiplomacyPanelPath, "utf8")
  : "";
const regionOverviewPanelPath = new URL("./components/RegionOverviewPanel.tsx", import.meta.url);
const regionOverviewPanelTsx = existsSync(regionOverviewPanelPath)
  ? readFileSync(regionOverviewPanelPath, "utf8")
  : "";
const turnHostedActionPanelPath = new URL("./components/TurnHostedActionPanel.tsx", import.meta.url);
const turnHostedActionPanelTsx = existsSync(turnHostedActionPanelPath)
  ? readFileSync(turnHostedActionPanelPath, "utf8")
  : "";
const worldOverviewPanelPath = new URL("./components/WorldOverviewPanel.tsx", import.meta.url);
const worldOverviewPanelTsx = existsSync(worldOverviewPanelPath)
  ? readFileSync(worldOverviewPanelPath, "utf8")
  : "";
const worldOverviewRecentResultsPath = new URL("./components/WorldOverviewRecentResults.tsx", import.meta.url);
const worldOverviewRecentResultsTsx = existsSync(worldOverviewRecentResultsPath)
  ? readFileSync(worldOverviewRecentResultsPath, "utf8")
  : "";
const typesTs = readFileSync(new URL("../types.ts", import.meta.url), "utf8");
const packageJson = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
const agentActionControllerTs = readFileSync(new URL("./agentActionController.ts", import.meta.url), "utf8");

function functionBody(name: string) {
  const match = agentExplorerTsx.match(new RegExp(`(?:async\\s+)?function ${name}\\([^)]*\\) \\{([\\s\\S]*?)\\n  \\}`));
  assert.ok(match, `${name} function not found`);
  const body = match[1];
  assert.ok(body, `${name} function body not found`);
  return body;
}

function sourceSlice(startPattern: RegExp, endPattern: RegExp) {
  const startMatch = startPattern.exec(agentExplorerTsx);
  assert.ok(startMatch, `${startPattern} not found`);
  const start = startMatch.index;
  const endMatch = endPattern.exec(agentExplorerTsx.slice(start + startMatch[0].length));
  assert.ok(endMatch, `${endPattern} not found after ${startPattern}`);
  return agentExplorerTsx.slice(start, start + startMatch[0].length + endMatch.index + endMatch[0].length);
}

test("Agent console provides its own vertical scroll container inside the fixed app root", () => {
  assert.match(agentExplorerCss, /\.agent-explorer\s*\{[^}]*\n\s*height:\s*100%;/s);
  assert.match(agentExplorerCss, /\.agent-explorer\s*\{[^}]*overflow-y:\s*auto/s);
  assert.match(agentExplorerCss, /\.agent-explorer\s*\{[^}]*-webkit-overflow-scrolling:\s*touch/s);
});

test("Vite development serves Agent Server routes through a configurable same-origin proxy", () => {
  assert.match(viteConfigTs, /DEFAULT_AGENT_SERVER_PROXY_TARGET\s*=\s*"http:\/\/127\.0\.0\.1:8787"/);
  assert.match(viteConfigTs, /loadEnv\(mode,\s*__dirname,\s*""\)/);
  assert.match(viteConfigTs, /env\.AGENT_SERVER_PROXY_TARGET\s*\|\|\s*env\.VITE_AGENT_SERVER_BASE/);
  assert.match(viteConfigTs, /"\/api":\s*agentServerProxy/);
  assert.match(viteConfigTs, /"\/epoch":\s*agentServerProxy/);
  assert.match(viteConfigTs, /"\/mcp":\s*agentServerProxy/);
  assert.match(viteConfigTs, /changeOrigin:\s*true/);
});

test("Agent console opens with a player waiting mode instead of an operator dashboard", () => {
  assert.match(agentExplorerTsx, /agent-player-mode/);
  assert.match(agentExplorerTsx, /等待写代码时/);
  assert.match(agentExplorerTsx, /开始\/继续身份/);
  assert.match(agentExplorerTsx, /选择托管行动/);
  assert.match(agentExplorerTsx, /一次跑完整局/);
  assert.match(agentExplorerTsx, /runCompleteExploration/);
  assert.match(agentExplorerTsx, /查看结果\/公开世界/);
  assert.match(agentExplorerTsx, /agent-player-actions/);
  assert.match(agentExplorerTsx, /agent-operator-details/);
  assert.match(agentExplorerTsx, /高级与调试/);
  assert.match(agentExplorerTsx, /玩家模式低刺激模式/);
  assert.ok(agentExplorerTsx.indexOf("agent-player-mode") < agentExplorerTsx.indexOf("agent-operator-details"));
  assert.match(agentExplorerCss, /\.agent-player-mode\s*\{/);
  assert.match(agentExplorerCss, /\.agent-player-actions\s*\{/);
  assert.match(agentExplorerCss, /\.agent-player-comfort\s*\{/);
  assert.match(agentExplorerCss, /\.agent-operator-details\s*\{/);
});

test("Agent console first explorer identity is registered by the server pairing endpoint", () => {
  assert.match(agentExplorerTsx, /registerEpochExplorer/);
  assert.match(agentExplorerTsx, /loadExplorerIdentity/);
  assert.doesNotMatch(agentExplorerTsx, /loadOrCreateExplorer/);

  const bootstrapSource = sourceSlice(/useEffect\(\(\)\s*=>\s*\{/, /\},\s*\[\]\);/);
  assert.match(bootstrapSource, /loadExplorerIdentity\(\)/);
  assert.match(bootstrapSource, /setExplorer\(/);
  assert.match(bootstrapSource, /setCurrentAgentId\(/);
  assert.doesNotMatch(bootstrapSource, /registerEpochExplorer\(/);
  assert.doesNotMatch(bootstrapSource, /issueEpochIdentity\(/);
});

test("Agent console uses identity issue only after an explorer already exists", () => {
  const issueIdentityBody = functionBody("issueIdentity");

  assert.match(issueIdentityBody, /if \(!explorer\) \{[\s\S]*registerEpochExplorer\(/);
  assert.match(issueIdentityBody, /if \(!explorer\) \{[\s\S]*setExplorer\(nextExplorer\)/);
  assert.match(issueIdentityBody, /if \(!explorer\) \{[\s\S]*setCurrentAgentId\(registration\.agentId\)/);
  assert.match(issueIdentityBody, /if \(!explorer\) \{[\s\S]*return;\s*\}\s*const issued = await issueEpochIdentity\(/);
  assert.match(issueIdentityBody, /issueEpochIdentity\(/);
  assert.match(issueIdentityBody, /explorerId:\s*explorer\.explorerId/);
  assert.match(issueIdentityBody, /recoveryCode:\s*explorer\.recoveryCode/);
});

test("Agent result panel delegates navigation timeline and receipt display to focused components", () => {
  assert.match(agentExplorerTsx, /<PublicReceiptDisclosure/);
  assert.match(agentExplorerTsx, /<GameRunTimeline/);
  assert.match(agentExplorerTsx, /<ResultNavigation/);
  assert.doesNotMatch(agentExplorerTsx, /resultPage\.receipt\.canonicalEvents\.slice\(0,\s*3\)\.map/);
  assert.doesNotMatch(agentExplorerTsx, /resultPage\.nextActions\.length\s*\?/);

  assert.match(publicReceiptDisclosureTsx, /aria-label="校验证明"/);
  assert.match(publicReceiptDisclosureTsx, /canonicalEvents\.slice\(0,\s*3\)/);
  assert.match(gameRunTimelineTsx, /aria-label="历程时间线"/);
  assert.match(typesTs, /interface EpochResultPageRunSummary/);
  assert.match(typesTs, /interface EpochGameRunReadModel/);
  assert.match(typesTs, /runSummary\?: EpochResultPageRunSummary/);
  assert.match(typesTs, /run\?: EpochGameRunReadModel/);
  assert.match(gameRunTimelineTsx, /resultPage\.runSummary\.stepCount/);
  assert.match(resultNavigationTsx, /aria-label="结果页下一步"/);
  assert.match(resultNavigationTsx, /暂无服务器建议行动/);
});

test("Agent console first screen keeps the S001 information budget and defers complex systems", () => {
  const playerModeStart = agentExplorerTsx.indexOf("agent-player-mode");
  const operatorStart = agentExplorerTsx.indexOf("agent-operator-details");
  assert.ok(playerModeStart >= 0, "player mode section not found");
  assert.ok(operatorStart > playerModeStart, "operator section should follow player mode");
  const firstScreen = agentExplorerTsx.slice(playerModeStart, operatorStart);
  const firstScreenBlocks = [...firstScreen.matchAll(/data-first-screen-block=/g)];

  assert.ok(firstScreenBlocks.length > 0, "first screen information blocks should be marked");
  assert.ok(firstScreenBlocks.length <= 5, `S001 allows at most 5 first-screen blocks; found ${firstScreenBlocks.length}`);
  assert.match(firstScreen, /data-first-screen-block="intro"/);
  assert.match(firstScreen, /data-first-screen-block="actions"/);
  assert.match(firstScreen, /data-first-screen-block="watch"/);
  assert.match(firstScreen, /data-first-screen-block="quick-panel"/);

  const operatorSummaryStart = agentExplorerTsx.indexOf("<summary>", operatorStart);
  const operatorSummaryEnd = agentExplorerTsx.indexOf("</summary>", operatorSummaryStart);
  assert.ok(operatorSummaryStart > operatorStart, "operator summary should be inside folded operator details");
  assert.ok(operatorSummaryEnd > operatorSummaryStart, "operator summary should close");
  const operatorSummary = agentExplorerTsx.slice(operatorSummaryStart, operatorSummaryEnd);
  assert.match(operatorSummary, /稍后查看/);
  assert.match(operatorSummary, /世界图谱/);
  assert.match(operatorSummary, /设定账本/);
  assert.match(operatorSummary, /声望树/);
  assert.match(operatorSummary, /阵营树/);
  assert.match(operatorSummary, /详细身份字段/);
  assert.doesNotMatch(agentExplorerTsx.slice(operatorStart, operatorSummaryStart), /open/);
});

test("Agent console defaults the first run to the archive recommended commission with only risk preference choices", () => {
  const playerModeStart = agentExplorerTsx.indexOf("agent-player-mode");
  const operatorStart = agentExplorerTsx.indexOf("agent-operator-details");
  assert.ok(playerModeStart >= 0, "player mode section not found");
  assert.ok(operatorStart > playerModeStart, "operator section should follow player mode");
  const firstScreen = agentExplorerTsx.slice(playerModeStart, operatorStart);

  assert.match(agentExplorerTsx, /STARTER_RISK_PREFERENCE_OPTIONS/);
  assert.match(agentExplorerTsx, /useState<StarterRiskPreference>\("balanced"\)/);
  assert.match(agentExplorerTsx, /档案馆推荐委托/);
  assert.match(agentExplorerTsx, /灰港边缘巡查/);
  assert.match(firstScreen, /aria-label="首局风险偏好"/);
  assert.match(agentExplorerTsx, /label:\s*"谨慎"/);
  assert.match(agentExplorerTsx, /label:\s*"均衡"/);
  assert.match(agentExplorerTsx, /label:\s*"冒险"/);
  assert.match(firstScreen, /STARTER_RISK_PREFERENCE_OPTIONS\.map/);
  assert.match(agentExplorerTsx, /starterRiskPreference/);
  assert.match(agentExplorerTsx, /risk\.mandate/);
  assert.doesNotMatch(firstScreen, /自定义委托|自由输入|高级风险|创建委托/);
});

test("Agent console protects the first run from permanent death", () => {
  const playerModeStart = agentExplorerTsx.indexOf("agent-player-mode");
  const operatorStart = agentExplorerTsx.indexOf("agent-operator-details");
  assert.ok(playerModeStart >= 0, "player mode section not found");
  assert.ok(operatorStart > playerModeStart, "operator section should follow player mode");
  const firstScreen = agentExplorerTsx.slice(playerModeStart, operatorStart);

  assert.match(agentExplorerTsx, /STARTER_DEATH_PROTECTION/);
  assert.match(agentExplorerTsx, /首局非永久死亡/);
  assert.match(agentExplorerTsx, /最坏结局为重伤封存或失踪待找回/);
  assert.match(agentExplorerTsx, /永久死亡从第二局或高风险委托开始/);
  assert.match(agentExplorerTsx, /必须先明确授权永久死亡风险/);
  assert.match(firstScreen, /agent-player-starter-protection/);
  assert.match(firstScreen, /aria-label="首局非永久死亡保护"/);
  assert.match(functionBody("startStarterCommission"), /STARTER_DEATH_PROTECTION\.mandate/);
  assert.match(functionBody("startStarterCommission"), /mandate:\s*withLowStimulusGuidance\([\s\S]*STARTER_DEATH_PROTECTION\.mandate/);
  assert.match(agentExplorerCss, /\.agent-player-starter-protection/);
});

test("Agent console isolates first-run rewards from transferable world impact", () => {
  const playerModeStart = agentExplorerTsx.indexOf("agent-player-mode");
  const operatorStart = agentExplorerTsx.indexOf("agent-operator-details");
  assert.ok(playerModeStart >= 0, "player mode section not found");
  assert.ok(operatorStart > playerModeStart, "operator section should follow player mode");
  const firstScreen = agentExplorerTsx.slice(playerModeStart, operatorStart);

  assert.match(agentExplorerTsx, /STARTER_REWARD_ISOLATION/);
  assert.match(agentExplorerTsx, /首局收益隔离/);
  assert.match(agentExplorerTsx, /不给可迁移声望、源流或强外物/);
  assert.match(agentExplorerTsx, /后续真实委托证实/);
  assert.match(agentExplorerTsx, /世界影响/);
  assert.match(agentExplorerTsx, /nonEvidence/);
  assert.match(firstScreen, /agent-player-starter-reward-isolation/);
  assert.match(firstScreen, /aria-label="首局收益隔离"/);
  assert.match(functionBody("startStarterCommission"), /STARTER_REWARD_ISOLATION\.mandate/);
  assert.match(functionBody("startStarterCommission"), /mandate:\s*withLowStimulusGuidance\([\s\S]*STARTER_DEATH_PROTECTION\.mandate[\s\S]*STARTER_REWARD_ISOLATION\.mandate/);
  assert.match(agentExplorerCss, /\.agent-player-starter-reward-isolation/);
});

test("Agent console presents world-internal near and long goals", () => {
  const playerModeStart = agentExplorerTsx.indexOf("agent-player-mode");
  const operatorStart = agentExplorerTsx.indexOf("agent-operator-details");
  assert.ok(playerModeStart >= 0, "player mode section not found");
  assert.ok(operatorStart > playerModeStart, "operator section should follow player mode");
  const firstScreen = agentExplorerTsx.slice(playerModeStart, operatorStart);
  const recentGoals = [...agentExplorerTsx.matchAll(/scope:\s*"近期",/g)];
  const longGoals = [...agentExplorerTsx.matchAll(/scope:\s*"长期",/g)];

  assert.match(agentExplorerTsx, /interface WorldInternalGoal/);
  assert.match(agentExplorerTsx, /WORLD_INTERNAL_GOALS/);
  assert.equal(recentGoals.length, 3);
  assert.equal(longGoals.length, 1);
  assert.match(agentExplorerTsx, /腐林证实者 II/);
  assert.match(agentExplorerTsx, /云脑族断线委托/);
  assert.match(firstScreen, /aria-label="世界内目标"/);
  assert.match(firstScreen, /agent-player-world-goals/);
  assert.match(firstScreen, /WORLD_INTERNAL_GOALS\.map/);
  assert.doesNotMatch(firstScreen, /提升档案信用/);
  assert.match(agentExplorerCss, /\.agent-player-world-goals/);
  assert.match(agentExplorerCss, /\.agent-player-world-goals span/);
});

test("Agent console keeps claim and schema terms out of the frontstage wording", () => {
  const playerModeStart = agentExplorerTsx.indexOf("agent-player-mode");
  const operatorStart = agentExplorerTsx.indexOf("agent-operator-details");
  assert.ok(playerModeStart >= 0, "player mode section not found");
  assert.ok(operatorStart > playerModeStart, "operator section should follow player mode");
  const firstScreen = agentExplorerTsx.slice(playerModeStart, operatorStart);
  const operatorSummaryStart = agentExplorerTsx.indexOf("<summary>", operatorStart);
  const operatorSummaryEnd = agentExplorerTsx.indexOf("</summary>", operatorSummaryStart);
  const operatorSummary = agentExplorerTsx.slice(operatorSummaryStart, operatorSummaryEnd);

  assert.match(agentExplorerTsx, /FRONTSTAGE_LORE_OUTPUT_LABEL/);
  assert.match(agentExplorerTsx, /frontstageDiscoverySummary/);
  assert.match(firstScreen, /可入档发现/);
  assert.match(firstScreen, /demoModeReport\.discoveries/);
  assert.doesNotMatch(firstScreen, /设定主张/);
  assert.doesNotMatch(firstScreen, /demoModeReport\.allowedClaimTypes/);
  assert.match(operatorSummary, /设定账本/);
  assert.doesNotMatch(operatorSummary, /claim\/schema/);
  assert.match(worldOverviewPanelTsx, /recentLoreContribution\.claimHash/);
  assert.match(agentExplorerCss, /\.agent-frontstage-discovery/);
});

test("Agent console front-loads the S003 key-safety proof and demo mode isolation", () => {
  const playerModeStart = agentExplorerTsx.indexOf("agent-player-mode");
  const operatorStart = agentExplorerTsx.indexOf("agent-operator-details");
  assert.ok(playerModeStart >= 0, "player mode section not found");
  assert.ok(operatorStart > playerModeStart, "operator section should follow player mode");
  const firstScreen = agentExplorerTsx.slice(playerModeStart, operatorStart);

  assert.match(firstScreen, /agent-player-key-proof/);
  assert.match(firstScreen, /模型密钥安全/);
  assert.match(firstScreen, /本地调用/);
  assert.match(firstScreen, /浏览器 → 本地插件 → 你的模型/);
  assert.match(firstScreen, /网络请求不含模型密钥/);
  assert.match(firstScreen, /演示模式/);
  assert.match(firstScreen, /本地样例/);
  assert.match(firstScreen, /不可上传/);
  assert.match(firstScreen, /不可结算/);
  assert.match(firstScreen, /不进图谱/);
  assert.match(agentExplorerTsx, /DEMO_CONTRACT\.mandate/);
  assert.match(agentExplorerCss, /\.agent-player-key-proof\s*\{/);
});

test("Agent console front-loads S050 privacy and high-stimulus compliance gates", () => {
  const playerModeStart = agentExplorerTsx.indexOf("agent-player-mode");
  const operatorStart = agentExplorerTsx.indexOf("agent-operator-details");
  assert.ok(playerModeStart >= 0, "player mode section not found");
  assert.ok(operatorStart > playerModeStart, "operator section should follow player mode");
  const firstScreen = agentExplorerTsx.slice(playerModeStart, operatorStart);

  assert.match(agentExplorerTsx, /SENSITIVE_KEY_CALL_NOTICE/);
  assert.match(agentExplorerTsx, /HIGH_STIMULUS_COMPLIANCE_REGIONS/);
  assert.match(agentExplorerTsx, /highStimulusComplianceConfirmed/);
  assert.match(agentExplorerTsx, /不要输入真实身份、联系方式、学校、住址/);
  assert.match(agentExplorerTsx, /供应商日志/);
  assert.match(firstScreen, /aria-label="首次模型调用隐私提示"/);
  assert.match(firstScreen, /SENSITIVE_KEY_CALL_NOTICE/);
  assert.match(firstScreen, /aria-label="高刺激年龄地区合规"/);
  assert.match(firstScreen, /年龄\/地区合规/);
  assert.match(firstScreen, /aria-label="内容合规地区"/);
  assert.match(agentExplorerTsx, /checked=\{highStimulusComplianceConfirmed\}/);
  assert.match(agentExplorerTsx, /value=\{contentPolicyRegion\}/);
  assert.match(agentExplorerCss, /\.agent-key-privacy-preflight/);
});

test("Agent console demo mode stays local and cannot upload settle earn reputation or enter graph", () => {
  const playerModeStart = agentExplorerTsx.indexOf("agent-player-mode");
  const operatorStart = agentExplorerTsx.indexOf("agent-operator-details");
  assert.ok(playerModeStart >= 0, "player mode section not found");
  assert.ok(operatorStart > playerModeStart, "operator section should follow player mode");
  const firstScreen = agentExplorerTsx.slice(playerModeStart, operatorStart);

  assert.match(agentExplorerTsx, /interface DemoModeReport/);
  assert.match(agentExplorerTsx, /useState<DemoModeReport \| null>\(null\)/);
  assert.match(firstScreen, /aria-label="本地演示模式"/);
  assert.match(firstScreen, /onClick=\{runLocalDemoMode\}/);
  assert.match(firstScreen, /agent-player-demo-report/);
  assert.match(firstScreen, /本地演示样例/);
  assert.match(firstScreen, /不可上传/);
  assert.match(firstScreen, /不可结算/);
  assert.match(firstScreen, /不获得声望/);
  assert.match(firstScreen, /不进入图谱/);

  const body = functionBody("runLocalDemoMode");
  assert.match(body, /DEMO_CONTRACT/);
  assert.match(body, /uploadable:\s*false/);
  assert.match(body, /settleable:\s*false/);
  assert.match(body, /reputationEligible:\s*false/);
  assert.match(body, /graphEligible:\s*false/);
  assert.doesNotMatch(
    body,
    /\bawait\b|runAction\(|startEpochHostedSession|submitEpochHostedAction|createEpochResultPage|adjudicateEpochLoreTarget|getEpochWorldOverview|setPublicWorld|setResultPage|setSharedResultPage|refreshProgress/,
  );
  assert.match(agentExplorerCss, /\.agent-player-demo-report\s*\{/);
});

test("Agent console renders S005 structured explanations for key actions", () => {
  assert.match(turnHostedActionPanelTsx, /function ActionExplanationDetails/);
  assert.match(turnHostedActionPanelTsx, /className="agent-action-explanation"/);
  assert.match(turnHostedActionPanelTsx, /aria-label="结构化行动解释"/);
  assert.match(turnHostedActionPanelTsx, /<dt>触发线索<\/dt>/);
  assert.match(turnHostedActionPanelTsx, /<dt>可选方案<\/dt>/);
  assert.match(turnHostedActionPanelTsx, /<dt>选择原因<\/dt>/);
  assert.match(turnHostedActionPanelTsx, /<dt>放弃原因<\/dt>/);
  assert.match(turnHostedActionPanelTsx, /<dt>风险<\/dt>/);
  assert.match(turnHostedActionPanelTsx, /<dt>预计收益<\/dt>/);
  assert.match(turnHostedActionPanelTsx, /explanation\.trigger/);
  assert.match(turnHostedActionPanelTsx, /alternativeOptions\.join\(" \/ "\)/);
  assert.match(turnHostedActionPanelTsx, /explanation\.choiceReason/);
  assert.match(turnHostedActionPanelTsx, /explanation\.rejectedAlternatives\.join\(" \/ "\)/);
  assert.match(turnHostedActionPanelTsx, /explanation\.risk/);
  assert.match(turnHostedActionPanelTsx, /explanation\.expectedBenefit/);
  assert.match(turnHostedActionPanelTsx, /currentTurnCard\.actionOptions\.map\(\(candidate\) => candidate\.label\)/);
  assert.match(turnHostedActionPanelTsx, /primaryHostedSession\.actionOptions\.map\(\(candidate\) => candidate\.label\)/);
  assert.match(agentExplorerCss, /\.agent-action-explanation\s*\{/);
  assert.match(agentExplorerCss, /\.agent-action-explanation dl\s*\{/);
});

test("Agent console progressively discloses explanations and auto-opens high-risk authorization details", () => {
  assert.match(turnHostedActionPanelTsx, /readonly autoOpen\?: boolean/);
  assert.match(turnHostedActionPanelTsx, /open=\{autoOpen \|\| undefined\}/);
  assert.match(turnHostedActionPanelTsx, /<summary>行动解释<\/summary>/);
  assert.match(turnHostedActionPanelTsx, /option\.explanation\.brief/);
  assert.match(turnHostedActionPanelTsx, /currentTurnCard\.resolution\.explanation\.brief/);
  assert.match(turnHostedActionPanelTsx, /autoOpen=\{option\.risk === "high"\}/);
  assert.match(turnHostedActionPanelTsx, /autoOpen=\{action\.risk === "high"\}/);
  assert.doesNotMatch(turnHostedActionPanelTsx, /<details className="agent-action-explanation"[^>]* open>/);
});

test("Agent console keeps S007 intervention controls resident and swaps to authorization for high risk", () => {
  assert.match(agentExplorerTsx, /type InterventionMode/);
  assert.match(agentExplorerTsx, /function pauseExploration/);
  assert.match(agentExplorerTsx, /function appendInterventionInstruction/);
  assert.match(agentExplorerTsx, /function takeOverCurrentTurn/);
  assert.match(agentExplorerTsx, /hasHighRiskAuthorization/);
  assert.match(agentExplorerTsx, /<TurnHostedActionPanel[\s\S]*hasHighRiskAuthorization=\{hasHighRiskAuthorization\}/);
  assert.match(turnHostedActionPanelTsx, /aria-label="常驻介入入口"/);
  assert.match(turnHostedActionPanelTsx, /hasHighRiskAuthorization \?/);
  assert.match(turnHostedActionPanelTsx, /agent-intervention-auth-panel/);
  assert.match(turnHostedActionPanelTsx, /高危授权/);
  assert.match(turnHostedActionPanelTsx, /暂停/);
  assert.match(turnHostedActionPanelTsx, /追加指令/);
  assert.match(turnHostedActionPanelTsx, /接管本轮/);
  assert.match(agentExplorerCss, /\.agent-intervention-bar\s*\{/);
  assert.match(agentExplorerCss, /\.agent-intervention-auth-panel\s*\{/);
});

test("Agent console enforces the S008 takeover budget and autonomy impact", () => {
  assert.match(agentExplorerTsx, /BASE_INTERVENTION_BUDGET\s*=\s*1/);
  assert.match(agentExplorerTsx, /function reputationInterventionBonus/);
  assert.match(agentExplorerTsx, /progress\?\.resources\.legend/);
  assert.match(agentExplorerTsx, /primarySeason\?\.agentStandings/);
  assert.match(agentExplorerTsx, /organization\.standing/);
  assert.match(agentExplorerTsx, /useState\(0\)/);
  assert.match(agentExplorerTsx, /const interventionBudget/);
  assert.match(agentExplorerTsx, /const interventionRemaining/);
  assert.match(agentExplorerTsx, /const autonomyEvaluation/);
  assert.match(agentExplorerTsx, /setInterventionTakeoversUsed\(\(count\) => count \+ 1\)/);
  assert.match(agentExplorerTsx, /<TurnHostedActionPanel[\s\S]*interventionRemaining=\{interventionRemaining\}/);
  assert.match(turnHostedActionPanelTsx, /disabled=\{isBusy \|\| interventionRemaining <= 0\}/);
  assert.match(turnHostedActionPanelTsx, /委托干预次数/);
  assert.match(agentExplorerTsx, /自主评价/);
  assert.match(agentExplorerCss, /\.agent-intervention-budget\s*\{/);
});

test("Agent console throttles high-risk requests into a single risk package", () => {
  assert.match(agentExplorerTsx, /HIGH_RISK_REQUEST_LIMIT\s*=\s*1/);
  assert.match(agentExplorerTsx, /interface HighRiskPackage/);
  assert.match(agentExplorerTsx, /useState<readonly HighRiskPackage\[\]>\(\[\]\)/);
  assert.match(agentExplorerTsx, /function stageHighRiskPackage/);
  assert.match(agentExplorerTsx, /packages\.find\(\(item\) => item\.kind === input\.kind\)/);
  assert.match(agentExplorerTsx, /packages\.length >= HIGH_RISK_REQUEST_LIMIT/);
  assert.match(agentExplorerTsx, /function authorizeHighRiskPackage/);
  assert.match(agentExplorerTsx, /function rejectHighRiskPackage/);
  assert.match(agentExplorerTsx, /function changeRiskStrategy/);
  assert.match(functionBody("requestResolveTurnConfirmation"), /option\.risk === "high"/);
  assert.match(functionBody("requestResolveTurnConfirmation"), /stageHighRiskPackage\(\{/);
  assert.match(agentExplorerTsx, /<TurnHostedActionPanel[\s\S]*highRiskPackages=\{highRiskPackages\}/);
  assert.match(turnHostedActionPanelTsx, /agent-risk-package-panel/);
  assert.match(turnHostedActionPanelTsx, /风险包/);
  assert.match(turnHostedActionPanelTsx, /授权/);
  assert.match(turnHostedActionPanelTsx, /拒绝/);
  assert.match(turnHostedActionPanelTsx, /改风险策略/);
  assert.match(agentExplorerCss, /\.agent-risk-package-panel\s*\{/);
});

test("Agent console player primary actions expose focus styles and disabled reasons", () => {
  const actionsStart = agentExplorerTsx.indexOf("agent-player-actions");
  const watchStart = agentExplorerTsx.indexOf("agent-player-watch");
  assert.ok(actionsStart >= 0, "player actions section not found");
  assert.ok(watchStart > actionsStart, "player watch board should follow player actions");
  const playerActions = agentExplorerTsx.slice(actionsStart, watchStart);

  assert.match(
    agentExplorerCss,
    /\.agent-player-actions button:focus-visible\s*\{[^}]*outline:\s*(?!auto\b|none\b)[^;]+;/s,
  );
  assert.match(agentExplorerCss, /\.agent-player-actions button:focus-visible\s*\{[^}]*outline-offset:\s*3px/s);
  assert.match(agentExplorerCss, /\.agent-player-actions button:focus-visible\s*\{[^}]*box-shadow:/s);
  assert.doesNotMatch(
    agentExplorerCss,
    /\.agent-player-actions button:focus-visible\s*\{[^}]*outline:\s*(?:auto|none)\b/s,
  );
  assert.match(playerActions, /agent-player-action-disabled-reason/);
  assert.match(playerActions, /playerIdentityActionDisabledReason/);
  assert.match(playerActions, /playerDowntimeActionDisabledReason/);
  assert.match(playerActions, /playerResultActionDisabledReason/);
  assert.match(playerActions, /playerInstallStatusActionDisabledReason/);
  assert.match(playerActions, /aria-describedby=\{playerIdentityActionDisabledReason/);
  assert.match(playerActions, /aria-describedby=\{playerDowntimeActionDisabledReason/);
  assert.match(playerActions, /aria-describedby=\{playerResultActionDisabledReason/);
  assert.match(playerActions, /aria-describedby=\{playerInstallStatusActionDisabledReason/);
  assert.match(agentExplorerTsx, /createAgentPlayerActionReadiness/);
  assert.match(agentPlayerActionReadinessControllerTs, /identity:\s*input\.busyReason/);
  assert.match(agentExplorerTsx, /PLAYER_PRIMARY_ACTION_BUSY_REASON/);
  assert.match(agentPlayerActionReadinessControllerTs, /身份槽已满/);
  assert.match(agentPlayerActionReadinessControllerTs, /需要先开始\/继续身份/);
  assert.match(packageJson.scripts["agent:ui-test"], /agentPlayerActionReadinessController\.test\.ts/);
  assert.doesNotMatch(agentExplorerTsx, /const playerDowntimeActionDisabledReason = isBusy/);
});

test("Agent console exposes downtime choices and claimable earnings in the player waiting mode", () => {
  const playerModeStart = agentExplorerTsx.indexOf("agent-player-mode");
  const operatorStart = agentExplorerTsx.indexOf("agent-operator-details");
  assert.ok(playerModeStart >= 0, "player mode section not found");
  assert.ok(operatorStart > playerModeStart, "operator section should follow player mode");
  const playerMode = agentExplorerTsx.slice(playerModeStart, operatorStart);
  assert.match(playerMode, /agent-player-downtime-modes/);
  assert.match(playerMode, /agent-player-downtime-card/);
  assert.match(playerMode, /PLAYER_DOWNTIME_OPTIONS\.map/);
  assert.match(agentExplorerTsx, /from "\.\/agentPlayerLabels"/);
  assert.match(agentPlayerLabelsTs, /冥想 \+专注点/);
  assert.match(agentPlayerLabelsTs, /修炼 \+灵质/);
  assert.match(agentPlayerLabelsTs, /锻炼 \+体力/);
  assert.match(agentPlayerLabelsTs, /看店 \+钱币/);
  assert.match(agentPlayerLabelsTs, /resource_granted:\s*"收获入账"/);
  assert.match(packageJson.scripts["agent:ui-test"], /agentPlayerLabels\.test\.ts/);
  assert.doesNotMatch(agentExplorerTsx, /const PLAYER_EVENT_LABELS/);
  assert.doesNotMatch(agentExplorerTsx, /function playerRegionLabel/);
  assert.match(playerMode, /领取托管收益/);
  assert.match(playerMode, /pendingDowntime/);
  assert.match(playerMode, /rewardSummary\(progress\.pendingDowntime\.rewards\)/);
  assert.match(agentExplorerCss, /\.agent-player-downtime-modes\s*\{/);
  assert.match(agentExplorerCss, /\.agent-player-downtime-card\s*\{/);
  assert.match(agentExplorerCss, /\.agent-player-earnings\s*\{/);
});

test("Agent console exposes private direct trades beside the public market", () => {
  const marketStart = agentExplorerTsx.indexOf("agent-market");
  const directStart = agentExplorerTsx.indexOf("<DirectTradePanel");
  const bountyStart = agentExplorerTsx.indexOf("<BountyPanel");
  assert.ok(existsSync(directTradePanelPath), "DirectTradePanel should own private direct trade controls");
  assert.ok(marketStart >= 0, "public market panel not found");
  assert.ok(directStart > marketStart, "direct trades panel should follow public market");
  assert.ok(bountyStart > directStart, "direct trades panel should stay before bounties");

  const directPanel = directTradePanelTsx;
  assert.match(agentExplorerTsx, /<DirectTradePanel/);
  assert.match(directPanel, /私下交易/);
  assert.match(directPanel, /刷新私下交易/);
  assert.match(directPanel, /创建私下交易/);
  assert.match(directPanel, /接受/);
  assert.match(directPanel, /撤回/);
  assert.match(directPanel, /过期扫描/);
  assert.match(directPanel, /hasOperatorKey\s*\?/);
  assert.match(directPanel, /directTradeCounterpartyAgentId/);
  assert.match(directPanel, /directTradeOfferMode/);
  assert.match(directPanel, /directTradeRequestMode/);
  assert.match(directPanel, /directTradeOfferItemId/);
  assert.match(directPanel, /directTradeRequestItemId/);
  assert.match(directPanel, /加载对方物品/);
  assert.match(directPanel, /directTradeDirectionFilter/);
  assert.match(directPanel, /收到/);
  assert.match(directPanel, /发出/);
  assert.match(directPanel, /directTradeOfferItemSearch/);
  assert.match(directPanel, /搜索我方物品/);
  assert.match(directPanel, /filteredDirectTradeOfferItems/);
  assert.match(directPanel, /directTradeRequestItemSearch/);
  assert.match(directPanel, /搜索对方物品/);
  assert.match(directPanel, /filteredDirectTradeCounterpartyItems/);
  assert.match(directPanel, /directTradeListSearch/);
  assert.match(directPanel, /搜索交易记录/);
  assert.match(directPanel, /setDirectTradeListSearch/);
  assert.match(directPanel, /交易审计/);
  assert.match(directPanel, /公开交易凭证/);
  assert.match(directPanel, /\/epoch\/direct-trade\//);
  assert.match(directPanel, /loadDirectTradeAudit/);
  assert.match(directPanel, /directTradeAuditEvents/);
  assert.match(directPanel, /\/epoch\/audit\//);
  assert.match(agentExplorerTsx, /function directTradeMatchesSearch/);
  assert.match(agentExplorerTsx, /directTradeMatchesSearch\(trade, directTradeListSearch\)/);
  assert.match(agentExplorerTsx, /direct_trade_created/);
  assert.match(agentExplorerTsx, /direct_trade_accepted/);
  assert.match(agentExplorerTsx, /direct_trade_cancelled/);
  assert.match(agentExplorerTsx, /direct_trade_expired/);
  assert.match(functionBody("loadDirectTradeAudit"), /aggregateId:\s*trade\.tradeId/);
  assert.match(functionBody("loadDirectTradeAudit"), /payload\.tradeId/);
  assert.match(functionBody("loadDirectTradeAudit"), /DIRECT_TRADE_AUDIT_EVENT_TYPES/);
  assert.match(directPanel, /DIRECT_TRADE_STATUS_LABELS\[trade\.status\]/);
  assert.match(directPanel, /MARKET_TRADE_RISK_LABELS\[flag\]/);
  assert.match(directPanel, /loadDirectTradeCounterpartyItems/);
  assert.match(functionBody("loadDirectTradeCounterpartyItems"), /tradable:\s*true/);
  assert.match(directPanel, /createDirectTrade/);
  assert.match(directPanel, /acceptDirectTrade/);
  assert.match(directPanel, /cancelDirectTrade/);
  assert.match(directPanel, /tickDirectTradeExpiry/);
  assert.match(functionBody("tickDirectTradeExpiry"), /if \(!operatorKey\.trim\(\)\) return/);
  assert.match(functionBody("tickDirectTradeExpiry"), /operatorKey:\s*operatorKey\.trim\(\)/);
  assert.match(functionBody("tickMarketExpiry"), /if \(!operatorKey\.trim\(\)\) return/);
  assert.match(functionBody("tickMarketExpiry"), /operatorKey:\s*operatorKey\.trim\(\)/);
  assert.doesNotMatch(agentExplorerTsx, /agent-panel agent-direct-trades/);
  assert.doesNotMatch(agentExplorerTsx, /visibleDirectTrades\.slice\(0,\s*5\)/);
  assert.match(agentExplorerCss, /\.agent-direct-trades\s*\{/);
});

test("Agent console delegates public market controls to a focused component", () => {
  assert.ok(existsSync(marketPanelPath), "MarketPanel should own public market controls");
  assert.match(agentExplorerTsx, /<MarketPanel/);
  assert.match(marketPanelTsx, /agent-panel agent-market/);
  assert.match(marketPanelTsx, /交易市场/);
  assert.match(marketPanelTsx, /刷新市场/);
  assert.match(marketPanelTsx, /创建卖单/);
  assert.match(marketPanelTsx, /卖物品/);
  assert.match(marketPanelTsx, /marketOrders\.slice\(0,\s*4\)/);
  assert.match(marketPanelTsx, /marketSellLabel\(order,\s*resourceLabels\)/);
  assert.match(marketPanelTsx, /MARKET_TRADE_RISK_LABELS/);
  assert.match(marketPanelTsx, /市场税/);
  assert.match(marketPanelTsx, /买入/);
  assert.match(marketPanelTsx, /撤单/);
  assert.doesNotMatch(agentExplorerTsx, /marketOrders\.slice\(0,\s*4\)/);
  assert.doesNotMatch(agentExplorerTsx, /agent-panel agent-market/);
});

test("Agent console places a player watch board before operator tools with live waiting facts", () => {
  const actionsStart = agentExplorerTsx.indexOf("agent-player-actions");
  const watchStart = agentExplorerTsx.indexOf("agent-player-watch");
  const operatorStart = agentExplorerTsx.indexOf("agent-operator-details");
  assert.ok(actionsStart >= 0, "player actions section not found");
  assert.ok(watchStart > actionsStart, "player watch board should follow player actions");
  assert.ok(watchStart < operatorStart, "player watch board should stay before operator tools");

  const watchBoard = agentExplorerTsx.slice(watchStart, operatorStart);
  assert.match(watchBoard, /aria-label="玩家等候看板"/);
  assert.match(watchBoard, /单句下一步/);
  assert.match(watchBoard, /安装/);
  assert.match(watchBoard, /身份/);
  assert.match(watchBoard, /托管/);
  assert.match(watchBoard, /公开结果/);
  assert.match(watchBoard, /installReadiness\.lastRequest/);
  assert.doesNotMatch(watchBoard, /installReadiness\.server/);
  assert.match(watchBoard, /lastAgentRequest/);
  assert.match(watchBoard, /actionEligibility\?\.canUseActiveTools/);
  assert.match(watchBoard, /progress\?\.pendingDowntime/);
  assert.match(watchBoard, /progress\?\.downtimeDiaryEntries/);
  assert.match(watchBoard, /progress\?\.latestEvents/);
  assert.match(watchBoard, /agentBriefing\?\.pendingActions/);
  assert.match(watchBoard, /agentBriefing\.regionalContext\?\.news/);
  assert.match(watchBoard, /agentBriefing\.regionalContext\?\.messages/);
  assert.match(watchBoard, /简报：/);
  assert.match(watchBoard, /agentBriefingSyncedAt/);
  assert.match(watchBoard, /自动刷新/);
  assert.match(watchBoard, /agentBriefing\?\.publicPages\.agent/);
  assert.match(watchBoard, /公开进度页/);
  assert.match(watchBoard, /pendingActions \|\| \[\]\)\.slice\(0,\s*2\)/);
  assert.match(watchBoard, /primaryHostedSession/);
  assert.match(watchBoard, /serverHostedJobs/);
  assert.match(agentExplorerTsx, /<TurnHostedActionPanel/);
  assert.match(turnHostedActionPanelTsx, /\/epoch\/hosted\//);
  assert.match(turnHostedActionPanelTsx, /公开观战页/);
  assert.match(turnHostedActionPanelTsx, /公开刷新已隐藏未结算选项/);
  assert.match(watchBoard, /agent-player-watch-lights/);
  assert.match(watchBoard, /agent-player-watch-glimpse/);
  assert.match(watchBoard, /agent-player-watch-live/);
  assert.match(agentExplorerTsx, /getEpochInstallStatus/);
  assert.match(agentExplorerTsx, /refreshAgentProgress/);
  assert.match(agentExplorerTsx, /defaultAgentProgressRefreshApi/);
  assert.match(agentProgressControllerTs, /getEpochAgentBriefing/);
  assert.match(agentExplorerTsx, /setAgentBriefing/);
  assert.match(agentExplorerTsx, /AGENT_BRIEFING_REFRESH_MS/);
  assert.match(agentExplorerTsx, /window\.setInterval/);
  assert.match(agentExplorerTsx, /refreshProgress\(currentAgentId,\s*\{\s*quiet:\s*true\s*\}\)/);
  assert.match(watchBoard, /installStatus\?\.ok/);
  assert.match(watchBoard, /连接失败/);
  assert.match(watchBoard, /installStatus\?\.package\.bytes/);
  assert.match(watchBoard, /installStatus\?\.smoke\.status/);
  assert.match(watchBoard, /安装链路已记录/);
  assert.doesNotMatch(watchBoard, /sha256|signingTrust|proofRequired/);
  assert.match(agentExplorerCss, /\.agent-player-watch\s*\{/);
  assert.match(agentExplorerCss, /\.agent-player-watch-link\s*\{/);
  assert.match(agentExplorerCss, /\.agent-player-watch-lights\s*\{/);
  assert.match(agentExplorerCss, /\.agent-player-watch-live\s*\{/);
});

test("Agent console keeps a compact live status summary visible across player and web bridge surfaces", () => {
  const liveStatusStart = agentExplorerTsx.indexOf("agent-live-status");
  const surfaceBranchStart = agentExplorerTsx.indexOf('initialSurface === "web-bridge"');
  assert.ok(liveStatusStart >= 0, "live status summary should exist");
  assert.ok(liveStatusStart < surfaceBranchStart, "live status summary should stay outside the surface branch");

  const liveStatus = agentExplorerTsx.slice(liveStatusStart, surfaceBranchStart);
  assert.match(liveStatus, /role="status"/);
  assert.match(liveStatus, /aria-live="polite"/);
  assert.match(liveStatus, /aria-atomic="true"/);
  assert.match(liveStatus, /当前身份/);
  assert.match(liveStatus, /liveIdentityValue/);
  assert.match(liveStatus, /安装连接/);
  assert.match(liveStatus, /installReadiness\.server/);
  assert.match(liveStatus, /busyAction \? "当前操作" : "托管状态"/);
  assert.match(liveStatus, /liveActivityValue/);
  assert.match(liveStatus, /最近请求/);
  assert.match(liveStatus, /lastAgentRequest/);

  assert.match(agentExplorerCss, /\.agent-live-status\s*\{[^}]*position:\s*sticky/s);
  assert.match(agentExplorerCss, /\.agent-live-status\s*\{[^}]*top:\s*0/s);
  assert.match(agentExplorerCss, /\.agent-live-status\s*\{[^}]*z-index:\s*20/s);
  assert.match(agentExplorerCss, /\.agent-live-status\s*\{[^}]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/s);
  assert.match(agentExplorerCss, /\.agent-live-status\s*\{[^}]*min-width:\s*0/s);
  assert.match(agentExplorerCss, /\.agent-live-status\s*\{[^}]*overflow:\s*hidden/s);
  assert.match(agentExplorerCss, /\.agent-live-status > span\s*\{[^}]*min-width:\s*0/s);
  assert.match(agentExplorerCss, /\.agent-live-status strong\s*\{[^}]*overflow:\s*hidden[^}]*text-overflow:\s*ellipsis/s);
  assert.match(
    agentExplorerCss,
    /@media \(max-width:\s*720px\)[\s\S]*?\.agent-live-status\s*\{[^}]*max-width:\s*calc\(100vw - 24px\)[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s,
  );
  assert.match(
    agentExplorerCss,
    /@media \(max-width:\s*720px\)[\s\S]*?\.agent-live-status > span\s*\{[^}]*min-height:\s*38px/s,
  );
  assert.doesNotMatch(agentExplorerTsx, /Running:\s*\{busyAction\}/);
});

test("Agent console delegates full region snapshot commits to a focused controller", () => {
  assert.match(agentExplorerTsx, /commitRegionSnapshot/);
  assert.match(agentExplorerTsx, /createAgentRegionSnapshot/);
  assert.match(agentExplorerTsx, /applyAgentRegionSnapshot/);
  assert.match(agentRegionControllerTs, /const regionMessages = options\.messages \|\| region\.messages/);
  assert.match(agentRegionControllerTs, /const resourceNodes = options\.resourceNodes \|\| region\.resourceNodes/);
  assert.match(agentRegionControllerTs, /const anomalies = options\.anomalies \|\| region\.anomalies/);
  assert.match(agentRegionControllerTs, /const seasons = options\.seasons \|\| region\.seasons/);
  assert.match(agentRegionControllerTs, /commit\.setObjectives\(snapshot\.objectives\)/);
  assert.match(agentRegionControllerTs, /commit\.setResourceNodes\(snapshot\.resourceNodes\)/);
  assert.match(agentRegionControllerTs, /commit\.setAnomalies\(snapshot\.anomalies\)/);
  assert.match(agentRegionControllerTs, /commit\.setSeasons\(snapshot\.seasons\)/);
  assert.match(agentRegionControllerTs, /commit\.setDiplomacy\?\.\(snapshot\.diplomacy\)/);
  assert.match(agentExplorerTsx, /setDiplomacy,/);
  assert.match(functionBody("loadRegion"), /commitRegionSnapshot\(nextRegion,\s*\{\s*messages:\s*messages\.regionMessages\s*\}\)/);
  assert.doesNotMatch(functionBody("loadRegion"), /setRegion\(\{\s*\.{3}nextRegion,\s*messages:/);
  assert.doesNotMatch(agentExplorerTsx, /setRegion\(await getEpochRegionInfo\(regionId\)\)/);
  assert.doesNotMatch(agentExplorerTsx, /setRegion\(nextRegion\);\s*\n\s*setDiplomacy\(nextRegion\.diplomacy\)/);
});

test("Agent console delegates async action status handling to a focused controller", () => {
  assert.match(agentExplorerTsx, /runAgentAction/);
  assert.match(agentActionControllerTs, /options\.setBusyAction\(label\)/);
  assert.match(agentActionControllerTs, /options\.setLastAgentRequest\(`\$\{actionLabel\} · 请求中`\)/);
  assert.match(agentActionControllerTs, /options\.setLastAgentRequest\(`\$\{actionLabel\} · 成功`\)/);
  assert.match(agentActionControllerTs, /options\.setLastAgentRequest\(`\$\{actionLabel\} · 失败：\$\{message\}`\)/);
  const runActionStart = agentExplorerTsx.indexOf("async function runAction");
  const runActionEnd = agentExplorerTsx.indexOf("\n  function setMarketState", runActionStart);
  assert.ok(runActionStart >= 0 && runActionEnd > runActionStart, "runAction wrapper should be present");
  const runActionWrapper = agentExplorerTsx.slice(runActionStart, runActionEnd);
  assert.match(runActionWrapper, /runAgentAction\(label,\s*action,/);
  assert.doesNotMatch(runActionWrapper, /try\s*\{/);
  assert.match(packageJson.scripts["agent:ui-test"], /agentActionController\.test\.ts/);
});

test("Agent console gives the revisit summary one primary action button", () => {
  const watchStart = agentExplorerTsx.indexOf("agent-player-watch");
  const operatorStart = agentExplorerTsx.indexOf("agent-operator-details");
  assert.ok(watchStart >= 0, "player watch board should exist");
  assert.ok(operatorStart > watchStart, "operator tools should follow player watch board");
  const watchBoard = agentExplorerTsx.slice(watchStart, operatorStart);

  assert.match(agentExplorerTsx, /type RevisitPrimaryActionKind/);
  assert.match(agentExplorerTsx, /const revisitPrimaryAction/);
  assert.match(agentExplorerTsx, /function runRevisitPrimaryAction/);
  assert.match(agentExplorerTsx, /审档/);
  assert.match(agentExplorerTsx, /修正/);
  assert.match(agentExplorerTsx, /接续/);
  assert.match(agentExplorerTsx, /找回/);
  assert.match(agentExplorerTsx, /领取/);
  assert.match(watchBoard, /aria-label="回访摘要"/);
  assert.match(watchBoard, /agent-revisit-primary-action/);
  assert.match(watchBoard, /onClick=\{runRevisitPrimaryAction\}/);
  assert.match(watchBoard, /revisitPrimaryAction\.label/);
  assert.match(watchBoard, /revisitPrimaryAction\.disabled/);
  assert.match(agentExplorerCss, /\.agent-revisit-primary-action/);
});

test("Agent console player watch board has automated desktop and mobile visual guards", () => {
  assert.match(agentExplorerCss, /\.agent-player-watch\s*\{[^}]*min-width:\s*0/s);
  assert.match(agentExplorerCss, /\.agent-player-watch\s*\{[^}]*overflow:\s*hidden/s);
  assert.match(agentExplorerCss, /\.agent-player-watch\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*\.9fr\)\s+minmax\(0,\s*1\.1fr\)/s);
  assert.match(agentExplorerCss, /\.agent-player-watch-lights\s*\{[^}]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/s);
  assert.match(agentExplorerCss, /\.agent-player-watch-lights\s*\{[^}]*align-items:\s*stretch/s);
  assert.match(agentExplorerCss, /\.agent-player-watch-lights span\s*\{[^}]*min-height:\s*76px/s);
  assert.match(
    agentExplorerCss,
    /\.agent-player-watch-lights b,[\s\S]*?\.agent-player-watch-live small\s*\{[^}]*overflow-wrap:\s*anywhere/s,
  );
  assert.match(
    agentExplorerCss,
    /@media \(max-width:\s*720px\)[\s\S]*?\.agent-player-watch,[\s\S]*?\.agent-player-watch-lights,[\s\S]*?\{[^}]*grid-template-columns:\s*1fr/s,
  );
});

test("Agent console has a repeatable browser visual QA command for the player watch board", () => {
  assert.equal(
    packageJson.scripts["agent:visual-qa"],
    "node --import tsx scripts/agent-console-visual-qa.ts",
  );
  const scriptUrl = new URL("../../scripts/agent-console-visual-qa.ts", import.meta.url);
  assert.equal(existsSync(scriptUrl), true);
  const visualQaScript = readFileSync(scriptUrl, "utf8");
  assert.match(visualQaScript, /127\.0\.0\.1:8787/);
  assert.match(visualQaScript, /agent-player-watch/);
  assert.match(visualQaScript, /live_lightweight/);
  assert.match(visualQaScript, /sha256/);
  assert.match(visualQaScript, /desktop/);
  assert.match(visualQaScript, /mobile/);
  assert.match(visualQaScript, /1280/);
  assert.match(visualQaScript, /390/);
  assert.match(visualQaScript, /scrollWidth/);
  assert.match(visualQaScript, /obsidian-epoch-agent-console-desktop-live-install\.png/);
  assert.match(visualQaScript, /obsidian-epoch-agent-console-mobile-live-install\.png/);
});

test("Agent console surfaces install-status failures in the player watch board", () => {
  const actionsStart = agentExplorerTsx.indexOf("agent-player-actions");
  const watchStart = agentExplorerTsx.indexOf("agent-player-watch");
  const operatorStart = agentExplorerTsx.indexOf("agent-operator-details");
  assert.ok(actionsStart >= 0, "player actions section not found");
  assert.ok(watchStart > actionsStart, "player watch board should follow player actions");
  const playerActions = agentExplorerTsx.slice(actionsStart, watchStart);
  const watchBoard = agentExplorerTsx.slice(watchStart, operatorStart);

  assert.match(agentExplorerTsx, /installStatusError/);
  assert.match(agentExplorerTsx, /setInstallStatusError/);
  assert.match(agentExplorerTsx, /catch\(\(.*\)\s*=>\s*\{[\s\S]*setInstallStatusError/);
  assert.match(playerActions, /检查安装状态/);
  assert.match(playerActions, /loadInstallStatus/);
  assert.match(watchBoard, /连接失败/);
  assert.match(watchBoard, /重试安装状态/);
  assert.match(watchBoard, /installStatusError \? "is-blocked"/);
  assert.match(agentExplorerCss, /\.agent-player-watch-lights button\s*\{/);
  assert.match(agentExplorerCss, /\.agent-player-watch-lights button\s*\{[^}]*width:\s*100%/s);
});

test("Agent console surfaces frontstage circuit-breaker announcements in the player watch board", () => {
  const watchStart = agentExplorerTsx.indexOf("agent-player-watch");
  const operatorStart = agentExplorerTsx.indexOf("agent-operator-details");
  assert.ok(watchStart >= 0, "player watch board should exist");
  assert.ok(operatorStart > watchStart, "operator section should follow player watch board");
  const watchBoard = agentExplorerTsx.slice(watchStart, operatorStart);

  assert.match(agentExplorerTsx, /frontstageStatus/);
  assert.match(agentExplorerTsx, /worldAnnouncement/);
  assert.match(agentExplorerTsx, /档案馆审档暂停\/只读维护/);
  assert.match(watchBoard, /frontstageStatus\?\.worldAnnouncement\.visible/);
  assert.match(watchBoard, /frontstageStatus\?\.worldAnnouncement\.title/);
  assert.match(watchBoard, /frontstageStatus\?\.worldAnnouncement\.body/);
  assert.match(watchBoard, /allowedActions\.localTrial/);
  assert.match(watchBoard, /allowedActions\.archiveLocalReport/);
  assert.match(watchBoard, /数据没有丢失/);
  assert.match(watchBoard, /本地试玩/);
  assert.match(watchBoard, /本地封存/);
  assert.match(agentExplorerCss, /\.agent-frontstage-announcement\s*\{/);
  assert.match(agentExplorerCss, /\.agent-frontstage-announcement\s+strong\s*\{/);
});

test("Agent console market forms use responsive columns that do not squeeze selects", () => {
  assert.match(
    agentExplorerCss,
    /\.agent-market-form\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(min\(132px,\s*100%\),\s*1fr\)\)/s,
  );
  assert.match(agentExplorerCss, /\.agent-market-form\s*>\s*\*\s*\{[^}]*min-width:\s*0/s);
  assert.doesNotMatch(agentExplorerCss, /grid-template-columns:\s*minmax\(0,\s*1fr\)\s+72px\s+minmax\(0,\s*1fr\)\s+72px/);
  assert.doesNotMatch(agentExplorerCss, /grid-template-columns:\s*1fr\s+88px/);
});

test("Agent console region panel surfaces the server-derived region leaderboard", () => {
  assert.ok(existsSync(regionOverviewPanelPath), "RegionOverviewPanel should own the large region summary");
  assert.match(agentExplorerTsx, /<RegionOverviewPanel/);
  assert.match(regionOverviewPanelTsx, /区域榜/);
  assert.match(regionOverviewPanelTsx, /region\?\.leaderboard/);
  assert.match(regionOverviewPanelTsx, /region\?\.media/);
  assert.match(regionOverviewPanelTsx, /agent-region-media-image/);
  assert.match(agentExplorerCss, /\.agent-region-media-image/);
  assert.match(regionOverviewPanelTsx, /region\?\.campaignKeyArt/);
  assert.match(regionOverviewPanelTsx, /campaignArt\.imageUrl/);
  assert.match(regionOverviewPanelTsx, /agent-campaign-key-art-image/);
  assert.match(agentExplorerCss, /\.agent-campaign-key-art-image/);
  assert.match(regionOverviewPanelTsx, /region\?\.ambienceScenes/);
  assert.match(regionOverviewPanelTsx, /ambienceScene\.imageUrl/);
  assert.match(regionOverviewPanelTsx, /agent-ambience-scene-image/);
  assert.match(agentExplorerCss, /\.agent-ambience-scene-image/);
  assert.match(regionOverviewPanelTsx, /region\?\.worldScenes/);
  assert.match(regionOverviewPanelTsx, /worldScene\.imageUrl/);
  assert.match(regionOverviewPanelTsx, /agent-world-scene-image/);
  assert.match(agentExplorerCss, /\.agent-world-scene-image/);
  assert.match(regionOverviewPanelTsx, /region\?\.sceneVariants/);
  assert.match(regionOverviewPanelTsx, /sceneVariant\.imageUrl/);
  assert.match(regionOverviewPanelTsx, /agent-scene-variant-image/);
  assert.match(agentExplorerCss, /\.agent-scene-variant-image/);
  assert.match(regionOverviewPanelTsx, /region\?\.eventStateMedia/);
  assert.match(regionOverviewPanelTsx, /eventState\.imageUrl/);
  assert.match(regionOverviewPanelTsx, /agent-event-state-image/);
  assert.match(agentExplorerCss, /\.agent-event-state-image/);
  assert.match(regionOverviewPanelTsx, /活动身份/);
  assert.match(regionOverviewPanelTsx, /region\?\.activeAgents/);
  assert.match(regionOverviewPanelTsx, /playerEventTypeLabel\(activeAgent\.lastActivity\.sourceEventType\)/);
  assert.match(regionOverviewPanelTsx, /activeAgent\.publicPages\.agent/);
  assert.match(regionOverviewPanelTsx, /influenceScore/);
  assert.match(regionOverviewPanelTsx, /anomalyScore/);
});

test("Agent console region panel surfaces server-derived open commissions", () => {
  assert.match(regionOverviewPanelTsx, /区域委托/);
  assert.match(regionOverviewPanelTsx, /region\?\.commissions/);
  assert.match(regionOverviewPanelTsx, /commission\.media/);
  assert.match(regionOverviewPanelTsx, /agent-activity-media-image/);
  assert.match(regionOverviewPanelTsx, /playerSourceTypeLabel\(commission\.sourceType\)/);
  assert.match(regionOverviewPanelTsx, /commission\.actionLabel/);
  assert.match(regionOverviewPanelTsx, /commission\.canonical/);
  assert.match(agentExplorerCss, /\.agent-activity-media-image/);
});

test("Agent console surfaces secret exposure tiers for commissions and starter runs", () => {
  assert.match(typesTs, /export type EpochSecretExposureTier/);
  assert.match(typesTs, /secretExposureTier: EpochSecretExposureTier/);
  assert.match(agentExplorerTsx, /STARTER_SECRET_EXPOSURE_POLICY/);
  assert.match(agentExplorerTsx, /T0_public/);
  assert.match(agentExplorerTsx, /T1_low_rumor/);
  assert.match(functionBody("startStarterCommission"), /STARTER_SECRET_EXPOSURE_POLICY\.mandate/);
  assert.match(regionOverviewPanelTsx, /playerSecretTierLabel\(commission\.secretExposureTier\)/);
  assert.match(agentPlayerLabelsTs, /T2_local_secret:\s*"隐藏线索"/);
  assert.match(agentExplorerCss, /\.agent-secret-tier-label/);
});

test("Agent console surfaces chapter locks for over-budget secret clues", () => {
  assert.match(typesTs, /export interface EpochSecretRevealBudget/);
  assert.match(typesTs, /secretRevealBudget: EpochSecretRevealBudget/);
  assert.match(regionOverviewPanelTsx, /SECRET_REVEAL_BUDGET_COPY/);
  assert.match(regionOverviewPanelTsx, /公开线索/);
  assert.match(regionOverviewPanelTsx, /commission\.secretRevealBudget\.chapterLocked/);
  assert.match(regionOverviewPanelTsx, /commission\.secretRevealBudget\.remaining/);
  assert.match(regionOverviewPanelTsx, /agent-secret-budget-lock/);
  assert.match(agentExplorerCss, /\.agent-secret-budget-lock/);
});

test("Agent console surfaces unopened chapter prefile isolation", () => {
  assert.match(typesTs, /export interface EpochPrefileIsolation/);
  assert.match(typesTs, /prefileIsolation: EpochPrefileIsolation/);
  assert.match(regionOverviewPanelTsx, /commission\.prefileIsolation/);
  assert.match(regionOverviewPanelTsx, /后续线索已整理/);
  assert.doesNotMatch(regionOverviewPanelTsx, /未来钩子/);
  assert.match(regionOverviewPanelTsx, /agent-prefile-isolation/);
  assert.match(agentExplorerCss, /\.agent-prefile-isolation/);
});

test("Agent console surfaces location motif quotas with dense aggregation", () => {
  assert.match(typesTs, /export type EpochLocationMotif/);
  assert.match(typesTs, /motifQuotas: readonly EpochLocationMotifQuota\[\]/);
  assert.match(regionOverviewPanelTsx, /LOCATION_MOTIF_LABELS/);
  for (const label of ["生态", "生物", "阵营", "异常", "资源", "人物"]) {
    assert.match(regionOverviewPanelTsx, new RegExp(label));
  }
  assert.match(regionOverviewPanelTsx, /region\?\.motifQuotas/);
  assert.match(regionOverviewPanelTsx, /motifQuota\.displayMode/);
  assert.match(regionOverviewPanelTsx, /agent-location-motif-quotas/);
  assert.match(agentExplorerCss, /\.agent-location-motif-quota\.is-dense/);
});

test("Agent console surfaces location motif commission reward bias", () => {
  assert.match(typesTs, /export interface EpochLocationMotifBias/);
  assert.match(typesTs, /locationMotifBias: EpochLocationMotifBias/);
  assert.match(regionOverviewPanelTsx, /commission\.locationMotifBias/);
  assert.match(regionOverviewPanelTsx, /奖励偏向/);
  assert.match(regionOverviewPanelTsx, /agent-location-motif-bias/);
  assert.match(agentExplorerCss, /\.agent-location-motif-bias/);
});

test("Agent console region panel surfaces multiplayer party runs", () => {
  assert.ok(existsSync(partyRunPanelPath), "PartyRunPanel should own party run controls");
  assert.match(agentExplorerTsx, /<PartyRunPanel/);
  assert.match(partyRunPanelTsx, /区域小队/);
  assert.match(agentExplorerTsx, /partyRuns/);
  assert.match(agentPlayerLabelsTs, /create_party_run/);
  assert.match(agentPlayerLabelsTs, /join_party_run/);
  assert.match(agentPlayerLabelsTs, /settle_party_run/);
  assert.match(agentExplorerTsx, /settleEpochPartyRun/);
  assert.match(partyRunPanelTsx, /participantRole/);
  assert.match(partyRunPanelTsx, /totalScore/);
  assert.match(partyRunPanelTsx, /members\.length/);
  assert.doesNotMatch(agentExplorerTsx, /agent-panel agent-party-runs/);
  assert.doesNotMatch(agentExplorerTsx, /\{partyRuns\.slice\(0, 4\)\.map/);
});

test("Agent console party runs expose join request approval controls", () => {
  assert.match(agentExplorerTsx, /requestEpochPartyJoin/);
  assert.match(agentExplorerTsx, /resolveEpochPartyJoinRequest/);
  assert.match(partyRunPanelTsx, /partyJoinRequestNote/);
  assert.match(partyRunPanelTsx, /pendingJoinRequests/);
  assert.match(partyRunPanelTsx, /joinRequests/);
  assert.match(partyRunPanelTsx, /申请加入/);
  assert.match(partyRunPanelTsx, /批准/);
  assert.match(partyRunPanelTsx, /拒绝/);
});

test("Agent console party runs show pending join request badges", () => {
  assert.match(agentExplorerTsx, /pendingPartyJoinRequestCount/);
  assert.match(partyRunPanelTsx, /待审批申请/);
  assert.match(partyRunPanelTsx, /待处理/);
});

test("Agent console party runs expose leader invite rotation controls", () => {
  assert.match(agentExplorerTsx, /updateEpochPartyInvite/);
  assert.match(partyRunPanelTsx, /partyInviteToken/);
  assert.match(partyRunPanelTsx, /partyInviteRecipientAgentId/);
  assert.match(partyRunPanelTsx, /partyInviteTokenUseLimit/);
  assert.match(agentExplorerTsx, /rotatePartyInvite/);
  assert.match(agentExplorerTsx, /revokePartyInvite/);
  assert.match(partyRunPanelTsx, /轮换邀请/);
  assert.match(partyRunPanelTsx, /撤销邀请/);
});

test("Agent console party runs expose invite audit history", () => {
  assert.match(agentExplorerTsx, /partyInviteAudit/);
  assert.match(agentExplorerTsx, /loadPartyInviteAudit/);
  assert.match(partyRunPanelTsx, /partyInviteAuditEvents/);
  assert.match(agentExplorerTsx, /eventType:\s*"party_invite_updated"/);
  assert.match(partyRunPanelTsx, /邀请审计/);
  assert.match(partyRunPanelTsx, /公开小队战报/);
  assert.match(partyRunPanelTsx, /\/epoch\/party-run\//);
  assert.match(partyRunPanelTsx, /公开审计/);
});

test("Agent console region panel surfaces settled region influence changes", () => {
  assert.match(regionOverviewPanelTsx, /影响变动/);
  assert.match(regionOverviewPanelTsx, /region\?\.influenceChanges/);
  assert.match(regionOverviewPanelTsx, /playerEventTypeLabel\(change\.sourceEventType\)/);
  assert.match(regionOverviewPanelTsx, /influenceDelta/);
});

test("Agent console region panel surfaces server-derived frontlines", () => {
  assert.match(regionOverviewPanelTsx, /区域前线/);
  assert.match(regionOverviewPanelTsx, /region\?\.frontlines/);
  assert.match(regionOverviewPanelTsx, /frontline\.attackerPressure/);
  assert.match(regionOverviewPanelTsx, /frontline\.defenderPressure/);
  assert.match(regionOverviewPanelTsx, /frontline\.pressureDelta/);
  assert.match(regionOverviewPanelTsx, /frontline\.attackerSideAgentIds/);
  assert.match(regionOverviewPanelTsx, /frontline\.defenderSideAgentIds/);
  assert.match(regionOverviewPanelTsx, /frontline\.openRetaliationIds/);
});

test("Agent console exposes server-authoritative anomaly chain controls", () => {
  assert.ok(existsSync(encounterPanelPath), "EncounterPanel should own objective resource node and anomaly controls");
  assert.match(agentExplorerTsx, /<EncounterPanel/);
  assert.match(encounterPanelTsx, /区域目标/);
  assert.match(encounterPanelTsx, /seedObjective/);
  assert.match(encounterPanelTsx, /contributeObjective/);
  assert.match(encounterPanelTsx, /settleObjective/);
  assert.match(encounterPanelTsx, /aria-label="区域目标贡献数量"/);
  assert.match(encounterPanelTsx, /agent-race-commission-row/);
  assert.match(encounterPanelTsx, /completion\.reward\.reason/);
  assert.match(encounterPanelTsx, /primaryObjective\.leaderboard\.slice\(0,\s*4\)/);
  assert.match(encounterPanelTsx, /区域异常链/);
  assert.match(agentExplorerTsx, /region\?\.anomalies/);
  assert.match(agentExplorerTsx, /primaryAnomaly/);
  assert.match(agentExplorerTsx, /getEpochAnomalies/);
  assert.match(agentExplorerTsx, /spawnEpochAnomaly/);
  assert.match(agentExplorerTsx, /contestEpochAnomaly/);
  assert.match(agentExplorerTsx, /resolveEpochAnomaly/);
  assert.match(encounterPanelTsx, /primaryAnomaly\.media/);
  assert.match(encounterPanelTsx, /primaryAnomaly\.media\.imageUrl/);
  assert.match(encounterPanelTsx, /agent-boss-media/);
  assert.match(encounterPanelTsx, /agent-boss-media-image/);
  assert.match(agentExplorerCss, /\.agent-boss-media-image/);
  assert.match(encounterPanelTsx, /scenePrompt/);
  assert.doesNotMatch(agentExplorerTsx, /primaryAnomaly\.leaderboard\.slice\(0,\s*4\)/);
  assert.match(functionBody("contestAnomaly"), /recoveryCode:\s*explorer\.recoveryCode/);
  assert.match(functionBody("spawnAnomaly"), /operatorKey:\s*operatorKey\.trim\(\)/);
  assert.match(functionBody("resolveAnomaly"), /operatorKey:\s*operatorKey\.trim\(\)/);
});

test("Agent console surfaces owner-confirmed personality drift proposals", () => {
  assert.match(agentExplorerTsx, /confirmEpochPersonalityDrift/);
  assert.match(agentExplorerTsx, /confirmPersonalityDrift/);
  assert.match(agentExplorerTsx, /personalityDrifts/);
  assert.match(agentExplorerTsx, /性格漂移/);
  assert.match(agentExplorerTsx, /待确认/);
  assert.match(agentExplorerTsx, /已写入/);
  assert.match(functionBody("confirmPersonalityDrift"), /recoveryCode:\s*explorer\.recoveryCode/);
  assert.match(functionBody("confirmPersonalityDrift"), /await refreshProgress\(\)/);
});

test("Agent console region panel surfaces server downtime activities", () => {
  assert.match(regionOverviewPanelTsx, /区域活动/);
  assert.match(regionOverviewPanelTsx, /region\?\.activities/);
});

test("Agent console surfaces server-computed pending downtime previews", () => {
  assert.match(agentPlayerLabelsTs, /value:\s*"steward"/);
  assert.match(agentPlayerLabelsTs, /value:\s*"socialize"/);
  assert.match(agentPlayerLabelsTs, /看店/);
  assert.match(agentPlayerLabelsTs, /社交/);
  assert.match(agentExplorerTsx, /pendingDowntime/);
  assert.match(agentExplorerTsx, /预计托管收益/);
  assert.match(agentExplorerTsx, /风险提示/);
  assert.match(agentExplorerTsx, /riskWarnings/);
});

test("Agent console renders server-packaged resource and downtime media", () => {
  assert.ok(existsSync(resourcePanelPath), "ResourcePanel should own resource balance media display");
  assert.match(agentExplorerTsx, /<ResourcePanel/);
  assert.match(agentExplorerTsx, /resourceMedia/);
  assert.match(agentPlayerLabelsTs, /PLAYER_RESOURCE_CAPTIONS/);
  assert.match(agentPlayerLabelsTs, /本局可用的行动注意力/);
  assert.match(agentExplorerTsx, /PLAYER_RESOURCE_LABELS/);
  assert.doesNotMatch(agentExplorerTsx, /const RESOURCE_LABELS/);
  assert.match(resourcePanelTsx, /agent-resource-media-image/);
  assert.match(resourcePanelTsx, /entry\.media\.imageUrl/);
  assert.match(resourcePanelTsx, /entry\.caption/);
  assert.match(agentExplorerCss, /\.agent-resource-grid small/);
  assert.doesNotMatch(agentExplorerTsx, /agent-resource-media-image/);
  assert.match(agentExplorerTsx, /downtimeMedia/);
  assert.match(agentExplorerTsx, /agent-downtime-media-image/);
});

test("Agent console routes player-visible internal labels through display helpers", () => {
  const visiblePanelSources = [
    agentExplorerTsx,
    encounterPanelTsx,
    directTradePanelTsx,
    marketPanelTsx,
    organizationPanelTsx,
    partyRunPanelTsx,
    publicWorldPanelTsx,
    raidRetaliationPanelTsx,
    relationshipDiplomacyPanelTsx,
    regionOverviewPanelTsx,
    resourcePanelTsx,
    seasonPanelTsx,
    turnHostedActionPanelTsx,
    worldOverviewPanelTsx,
  ].join("\n");

  assert.match(agentPlayerLabelsTs, /function playerSecretTierLabel/);
  assert.match(agentPlayerLabelsTs, /function playerTrustClassLabel/);
  assert.match(agentPlayerLabelsTs, /function playerChannelClassLabel/);
  assert.match(agentPlayerLabelsTs, /function playerCommonStatusLabel/);
  assert.match(agentPlayerLabelsTs, /function playerAgentLabel/);
  assert.match(agentPlayerLabelsTs, /function playerExplorerLabel/);
  assert.match(agentPlayerLabelsTs, /function playerRecordLabel/);
  assert.match(agentPlayerLabelsTs, /function playerRelationshipKindLabel/);
  assert.match(regionOverviewPanelTsx, /playerAgentLabel\(activeAgent\.agentId\)/);
  assert.match(regionOverviewPanelTsx, /playerExplorerLabel\(message\.explorerId\)/);
  assert.match(relationshipDiplomacyPanelTsx, /playerRelationshipKindLabel\(item\.kind\)/);
  assert.match(partyRunPanelTsx, /playerAgentLabel\(request\.agentId\)/);
  assert.match(encounterPanelTsx, /playerExplorerLabel\(standing\.explorerId\)/);
  assert.match(seasonPanelTsx, /playerFactionLabel\(standing\.factionId\)/);
  assert.match(marketPanelTsx, /playerRegionLabel\(order\.regionId\)/);
  assert.match(directTradePanelTsx, /playerRegionLabel\(trade\.regionId\)/);
  assert.doesNotMatch(visiblePanelSources, /<b>\{event\.eventType\}<\/b>/);
  assert.doesNotMatch(visiblePanelSources, /\{event\.eventType\}\s*·/);
  assert.doesNotMatch(visiblePanelSources, /\{(?:trace|change|activity)\.sourceEventType\}/);
  assert.doesNotMatch(visiblePanelSources, /label:\s*trace\.sourceEventType/);
  assert.doesNotMatch(visiblePanelSources, /\{(?:runner|item)\.trustClass\}/);
  assert.doesNotMatch(visiblePanelSources, /信任 \{standing\.dominantTrustClass\}/);
  assert.doesNotMatch(visiblePanelSources, /\{webBridgeTurn\.(?:channelClass|deliveryTrust)\}/);
  assert.doesNotMatch(visiblePanelSources, /\{lastWebBridgeAction\.deliveryTrust\}/);
  assert.doesNotMatch(visiblePanelSources, /SECRET_EXPOSURE_TIER_LABELS/);
  assert.doesNotMatch(visiblePanelSources, /秘密揭露预算|章节锁|未来钩子|确认 token|使用 token|邀请 token|社交钩子/);
});

test("Agent console surfaces server-derived claimable legend news", () => {
  assert.match(agentExplorerTsx, /claimableLegendNews/);
  assert.match(regionOverviewPanelTsx, /上新闻提醒/);
  assert.match(regionOverviewPanelTsx, /news\.media/);
  assert.match(regionOverviewPanelTsx, /agent-surface-media-image/);
  assert.match(agentExplorerCss, /\.agent-surface-media-image/);
  assert.match(agentExplorerTsx, /const isIdentityActive = identity\?\.status === "active";/);
  assert.match(regionOverviewPanelTsx, /disabled=\{isBusy \|\| activeIdentityDisabled \|\| !\(\(progress\?\.claimableLegendNews\.length \|\| 0\) > 0 \|\| region\?\.news\[0\]\)\}/);
  assert.match(regionOverviewPanelTsx, /disabled=\{isBusy \|\| activeIdentityDisabled\}/);
  assert.match(agentExplorerTsx, /async function claimNewsLegend\(newsId\?:\s*string\)/);
  assert.match(functionBody("claimNewsLegend"), /claimableLegendNews/);
});

test("Agent console disables active gameplay controls for archived identities", () => {
  assert.match(agentExplorerTsx, /const canUseActiveIdentity = Boolean\(currentAgentId && \(actionEligibility\?\.canUseActiveTools \?\? isIdentityActive\)\);/);
  assert.match(agentExplorerTsx, /const activeIdentityDisabled = !canUseActiveIdentity;/);
  for (const name of [
    "craftInventoryItem",
    "purchaseShopOffer",
    "startDowntime",
    "claimDowntime",
    "tickDowntime",
    "saveNpcNote",
    "postRegionMessage",
    "requestWorldConfirmation",
    "requestTurnCardConfirmation",
    "postWorldMessage",
    "contributeObjective",
    "contestResourceNode",
    "contestAnomaly",
    "contributeSeason",
    "createMarketOrder",
    "fillMarketOrder",
    "cancelMarketOrder",
    "createBounty",
    "claimBounty",
    "resolveRaid",
    "resolveRetaliation",
    "updateRelationship",
    "proposeDiplomacy",
    "respondDiplomacy",
    "startHostedSession",
    "submitHostedAction",
    "runServerHostedAction",
    "queueServerHostedAction",
    "startWebBridgeTurn",
    "submitWebBridgeAction",
    "createTurnCard",
    "createTurnCardWithConfirmation",
    "resolveTurnCard",
    "requestResolveTurnConfirmation",
    "resolveTurnCardWithConfirmation",
    "requestAttestationChallenge",
    "submitAttestedAction",
  ]) {
    assert.match(functionBody(name), /!canUseActiveIdentity/, `${name} must guard archived identities`);
  }
  for (const label of ["开始"]) {
    assert.match(agentExplorerTsx, new RegExp(`disabled=\\{[^}]*activeIdentityDisabled[^}]*\\}[\\s\\S]*?>\\s*${label}\\s*<`));
  }
  assert.match(agentExplorerTsx, /<TurnHostedActionPanel[\s\S]*activeIdentityDisabled=\{activeIdentityDisabled\}/);
  assert.match(turnHostedActionPanelTsx, /disabled=\{isBusy \|\| activeIdentityDisabled \|\| !explorer\}[\s\S]*?>\s*开局\s*</);
  assert.match(turnHostedActionPanelTsx, /disabled=\{isBusy \|\| activeIdentityDisabled \|\| !explorer\}[\s\S]*?>\s*网页桥接\s*</);
  assert.match(turnHostedActionPanelTsx, /disabled=\{isBusy \|\| activeIdentityDisabled \|\| !explorer\}[\s\S]*?>\s*生成\s*</);
  assert.match(agentExplorerTsx, /<RegionOverviewPanel[\s\S]*activeIdentityDisabled=\{activeIdentityDisabled\}/);
  assert.match(regionOverviewPanelTsx, /disabled=\{isBusy \|\| activeIdentityDisabled \|\| !npcName\.trim\(\)\}[\s\S]*?>\s*记录 NPC\s*</);
  assert.match(regionOverviewPanelTsx, /disabled=\{isBusy \|\| activeIdentityDisabled \|\| !messageBody\.trim\(\)\}[\s\S]*?>\s*区域发言\s*</);
  assert.match(regionOverviewPanelTsx, /disabled=\{isBusy \|\| activeIdentityDisabled\}[\s\S]*?>\s*领取传说\s*</);
  assert.match(agentExplorerTsx, /<RelationshipDiplomacyPanel[\s\S]*activeIdentityDisabled=\{activeIdentityDisabled\}/);
  assert.match(relationshipDiplomacyPanelTsx, /disabled=\{isBusy \|\| activeIdentityDisabled \|\| !relationshipTargetAgentId\.trim\(\)\}[\s\S]*?>\s*消耗专注点\s*</);
  assert.match(relationshipDiplomacyPanelTsx, /disabled=\{isBusy \|\| activeIdentityDisabled \|\| !relationshipTargetAgentId\.trim\(\) \|\| !hasExplorer\}[\s\S]*?>\s*发起提案\s*</);
  assert.match(agentExplorerTsx, /<BountyPanel[\s\S]*activeIdentityDisabled=\{activeIdentityDisabled\}/);
  assert.match(bountyPanelTsx, /disabled=\{[^}]*activeIdentityDisabled[^}]*\}[\s\S]*?>\s*发布悬赏\s*</);
  assert.match(agentExplorerTsx, /<RaidRetaliationPanel[\s\S]*activeIdentityDisabled=\{activeIdentityDisabled\}/);
  assert.match(raidRetaliationPanelTsx, /disabled=\{[^}]*activeIdentityDisabled[^}]*\}[\s\S]*?>\s*服务器结算\s*</);
  assert.match(encounterPanelTsx, /disabled=\{isBusy \|\| activeIdentityDisabled \|\| primaryObjective\.status !== "active"\} onClick=\{contributeObjective\}/);
  assert.match(encounterPanelTsx, /disabled=\{isBusy \|\| activeIdentityDisabled \|\| primaryResourceNode\.status !== "open"\} onClick=\{contestResourceNode\}/);
  assert.match(encounterPanelTsx, /disabled=\{isBusy \|\| activeIdentityDisabled \|\| primaryAnomaly\.status !== "open"\} onClick=\{contestAnomaly\}/);
  assert.match(marketPanelTsx, /disabled=\{[^}]*activeIdentityDisabled[^}]*\}[\s\S]*?>\s*创建卖单\s*</);
});

test("Agent console surfaces progress action eligibility guidance", () => {
  assert.match(agentExplorerTsx, /const actionEligibility = progress\?\.actionEligibility;/);
  assert.match(agentExplorerTsx, /行动权限/);
  assert.match(agentExplorerTsx, /canUseActiveTools/);
  assert.match(agentExplorerTsx, /recommendedTools/);
  assert.match(agentExplorerTsx, /blockedTools/);
  assert.match(agentExplorerTsx, /建议下一步/);
  assert.match(agentExplorerTsx, /暂不可用/);
  assert.match(agentExplorerTsx, /playerToolLabel/);
});

test("Agent console region panel surfaces regional market summary", () => {
  assert.match(regionOverviewPanelTsx, /region\?\.marketSummary/);
  assert.match(regionOverviewPanelTsx, /区域市场/);
  assert.match(regionOverviewPanelTsx, /filledVolume/);
  assert.match(regionOverviewPanelTsx, /collectedFees/);
});

test("Agent console region panel surfaces server-derived raid heat", () => {
  assert.match(regionOverviewPanelTsx, /区域热度/);
  assert.match(regionOverviewPanelTsx, /region\?\.raidHeat/);
  assert.match(regionOverviewPanelTsx, /raidHeat\.heatScore/);
  assert.match(regionOverviewPanelTsx, /raidHeat\.activePairCount/);
  assert.match(regionOverviewPanelTsx, /raidHeat\.repeatRaidCount/);
  assert.match(regionOverviewPanelTsx, /raidHeat\.latestRaidId/);
});

test("Agent console region panel surfaces server-derived raid target recommendations", () => {
  assert.match(regionOverviewPanelTsx, /推荐目标/);
  assert.match(regionOverviewPanelTsx, /region\?\.raidTargets/);
  assert.match(regionOverviewPanelTsx, /target\.recommendationScore/);
  assert.match(regionOverviewPanelTsx, /target\.targetSeasonScore/);
  assert.match(regionOverviewPanelTsx, /target\.targetDefensePower/);
  assert.match(regionOverviewPanelTsx, /target\.attackerFactionId/);
  assert.match(regionOverviewPanelTsx, /target\.targetFactionId/);
});

test("Agent console region panel surfaces server-derived faction pressure", () => {
  assert.match(regionOverviewPanelTsx, /阵营压力/);
  assert.match(regionOverviewPanelTsx, /region\?\.factionPressure/);
  assert.match(regionOverviewPanelTsx, /pressure\.controlStatus/);
  assert.match(regionOverviewPanelTsx, /pressure\.pressureScore/);
  assert.match(regionOverviewPanelTsx, /pressure\.seasonScore/);
  assert.match(regionOverviewPanelTsx, /pressure\.raidPressure/);
  assert.match(regionOverviewPanelTsx, /pressure\.activeRaidCount/);
});

test("Agent console region panel surfaces canonical conflict traces", () => {
  assert.match(regionOverviewPanelTsx, /冲突轨迹/);
  assert.match(regionOverviewPanelTsx, /region\?\.traces/);
  assert.match(regionOverviewPanelTsx, /sourceEventIds/);
  assert.match(regionOverviewPanelTsx, /participantAgentIds/);
});

test("Agent console region panel surfaces canonical NPC health states", () => {
  assert.match(regionOverviewPanelTsx, /健康/);
  assert.match(regionOverviewPanelTsx, /region\?\.healthStates/);
  assert.match(regionOverviewPanelTsx, /health\.npcDisplayName/);
  assert.match(regionOverviewPanelTsx, /health\.summary/);
  assert.match(regionOverviewPanelTsx, /health\.status/);
  assert.match(regionOverviewPanelTsx, /health\.severity/);
});

test("Agent console submits and surfaces server-reviewed NPC candidates", () => {
  assert.match(agentExplorerTsx, /submitEpochNpcCandidate/);
  assert.match(regionOverviewPanelTsx, /region\?\.npcCandidates/);
  assert.match(regionOverviewPanelTsx, /NPC候选/);
});

test("Agent console exposes operator-gated NPC candidate review", () => {
  assert.match(agentExplorerTsx, /reviewEpochNpcCandidate/);
  assert.match(functionBody("reviewRejectedNpcCandidate"), /operatorKey:\s*operatorKey\.trim\(\)/);
  assert.match(regionOverviewPanelTsx, /复核候选/);
});

test("Agent console surfaces NPC candidate lore review risk", () => {
  assert.match(regionOverviewPanelTsx, /reviewLevel/);
  assert.match(regionOverviewPanelTsx, /reviewScore/);
  assert.match(regionOverviewPanelTsx, /reviewFlags/);
  assert.match(regionOverviewPanelTsx, /审核风险/);
});

test("Agent console surfaces reality meme parody review policy for NPC candidates", () => {
  assert.match(typesTs, /real_world_mapping/);
  assert.match(typesTs, /internet_meme_trace/);
  assert.match(typesTs, /parody_trace/);
  assert.match(typesTs, /export type EpochNpcCandidateFlavorPublication/);
  assert.match(typesTs, /flavorPublication: EpochNpcCandidateFlavorPublication/);
  assert.match(regionOverviewPanelTsx, /NPC_CANDIDATE_FLAVOR_POLICY_LABELS/);
  assert.match(regionOverviewPanelTsx, /candidate\.flavorPublication/);
  assert.match(regionOverviewPanelTsx, /个人封存/);
  assert.match(agentExplorerCss, /\.agent-flavor-policy-label/);
});

test("Agent console surfaces rumor admission thresholds for NPC candidates", () => {
  assert.match(typesTs, /export interface EpochRumorAdmissionReview/);
  assert.match(typesTs, /rumorAdmissionReview: EpochRumorAdmissionReview/);
  assert.match(regionOverviewPanelTsx, /RUMOR_ADMISSION_LABELS/);
  assert.match(regionOverviewPanelTsx, /candidate\.rumorAdmissionReview/);
  assert.match(regionOverviewPanelTsx, /候选传闻门槛/);
  assert.match(agentExplorerCss, /\.agent-rumor-admission-label/);
});

test("Agent console surfaces ability effect clusters for NPC ability claims", () => {
  assert.match(typesTs, /export interface EpochAbilityEffectCluster/);
  assert.match(typesTs, /abilityEffectCluster\?: EpochAbilityEffectCluster/);
  assert.match(regionOverviewPanelTsx, /ABILITY_EFFECT_CLUSTER_LABELS/);
  assert.match(regionOverviewPanelTsx, /candidate\.abilityEffectCluster/);
  assert.match(regionOverviewPanelTsx, /candidate\.abilityEffectCluster\.clusterKey/);
  assert.match(regionOverviewPanelTsx, /效果聚类/);
  assert.match(agentExplorerCss, /\.agent-ability-cluster-label/);
});

test("Agent console surfaces creature behavior scope reviews for lore contributions", () => {
  assert.match(typesTs, /export interface EpochCreatureBehaviorScopeReview/);
  assert.match(typesTs, /creatureBehaviorScopeReview\?: EpochCreatureBehaviorScopeReview/);
  assert.match(worldOverviewPanelTsx, /CREATURE_BEHAVIOR_SCOPE_LABELS/);
  assert.match(worldOverviewPanelTsx, /recentLoreContribution\.creatureBehaviorScopeReview/);
  assert.match(worldOverviewPanelTsx, /行为范围/);
  assert.match(agentExplorerCss, /\.agent-creature-scope-label/);
});

test("Agent console surfaces fuzzy time interval occupancy for lore contributions", () => {
  assert.match(typesTs, /export interface EpochFuzzyTimeIntervalReview/);
  assert.match(typesTs, /fuzzyTimeIntervalReview\?: EpochFuzzyTimeIntervalReview/);
  assert.match(worldOverviewPanelTsx, /FUZZY_TIME_INTERVAL_LABELS/);
  assert.match(worldOverviewPanelTsx, /recentLoreContribution\.fuzzyTimeIntervalReview/);
  assert.match(worldOverviewPanelTsx, /时间区间/);
  assert.match(agentExplorerCss, /\.agent-fuzzy-time-label/);
});

test("Agent console surfaces cross-region mechanism reviews for lore contributions", () => {
  assert.match(typesTs, /export interface EpochCrossRegionMechanismReview/);
  assert.match(typesTs, /crossRegionMechanismReview\?: EpochCrossRegionMechanismReview/);
  assert.match(worldOverviewPanelTsx, /CROSS_REGION_MECHANISM_LABELS/);
  assert.match(worldOverviewPanelTsx, /recentLoreContribution\.crossRegionMechanismReview/);
  assert.match(worldOverviewPanelTsx, /跨区机制/);
  assert.match(agentExplorerCss, /\.agent-cross-region-label/);
});

test("Agent console region panel renders server-assigned NPC portraits", () => {
  assert.match(regionOverviewPanelTsx, /npc\.media/);
  assert.match(regionOverviewPanelTsx, /npc\.media\.imageUrl/);
  assert.match(regionOverviewPanelTsx, /agent-npc-media-image/);
  assert.match(agentExplorerCss, /\.agent-npc-media-image/);
  assert.match(regionOverviewPanelTsx, /形象已记录/);
  assert.doesNotMatch(regionOverviewPanelTsx, /npc\.media\.archetypeKey/);
});

test("Agent console region panel surfaces canonical NPC asset states", () => {
  assert.match(regionOverviewPanelTsx, /资产/);
  assert.match(regionOverviewPanelTsx, /region\?\.assetStates/);
  assert.match(regionOverviewPanelTsx, /asset\.npcDisplayName/);
  assert.match(regionOverviewPanelTsx, /asset\.summary/);
  assert.match(regionOverviewPanelTsx, /asset\.balanceAfter/);
  assert.match(regionOverviewPanelTsx, /asset\.delta/);
});

test("Agent console renders server-derived NPC living status summaries", () => {
  assert.match(organizationPanelTsx, /region\?\.careers/);
  assert.match(organizationPanelTsx, /career\.npcDisplayName/);
  assert.match(organizationPanelTsx, /career\.summary/);
  assert.match(regionOverviewPanelTsx, /region\?\.locations/);
  assert.match(regionOverviewPanelTsx, /location\.npcDisplayName/);
  assert.match(regionOverviewPanelTsx, /location\.summary/);
});

test("Agent console renders server-packaged social relationship media", () => {
  assert.ok(existsSync(relationshipDiplomacyPanelPath), "RelationshipDiplomacyPanel should own relationship and diplomacy controls");
  assert.match(agentExplorerTsx, /<RelationshipDiplomacyPanel/);
  assert.match(regionOverviewPanelTsx, /region\?\.relationships/);
  assert.match(regionOverviewPanelTsx, /region\?\.agentNpcBonds/);
  assert.match(regionOverviewPanelTsx, /bond\.media/);
  assert.match(regionOverviewPanelTsx, /羁绊/);
  assert.match(regionOverviewPanelTsx, /region\?\.households/);
  assert.match(regionOverviewPanelTsx, /household\.media/);
  assert.match(regionOverviewPanelTsx, /household\.summary/);
  assert.match(regionOverviewPanelTsx, /household\.memberNames/);
  assert.match(relationshipDiplomacyPanelTsx, /relationship\.media/);
  assert.match(relationshipDiplomacyPanelTsx, /relationships\.slice/);
  assert.match(relationshipDiplomacyPanelTsx, /agent-relationship-media-row/);
  assert.match(relationshipDiplomacyPanelTsx, /agent-relationship-media-image/);
  assert.doesNotMatch(agentExplorerTsx, /\{relationships\.slice\(0,\s*4\)\.map/);
  assert.match(agentExplorerCss, /\.agent-relationship-media-image/);
});

test("Agent console region panel surfaces server-owned organization politics", () => {
  assert.ok(existsSync(organizationPanelPath), "OrganizationPanel should own organization controls");
  assert.match(agentExplorerTsx, /<RegionOverviewPanel/);
  assert.match(regionOverviewPanelTsx, /<OrganizationPanel/);
  assert.match(organizationPanelTsx, /组织政治/);
  assert.match(organizationPanelTsx, /organizationPolitics\.slice/);
  assert.match(organizationPanelTsx, /politics\.standingAfter/);
  assert.match(organizationPanelTsx, /politics\.standingDelta/);
  assert.doesNotMatch(agentExplorerTsx, /visibleOrganizations\.slice\(0,\s*5\)/);
});

test("Agent console region panel distinguishes NPC and agent organization members", () => {
  assert.match(organizationPanelTsx, /organization\.memberNpcIds/);
  assert.match(organizationPanelTsx, /organization\.memberAgentIds/);
  assert.match(organizationPanelTsx, /organization\.upgradeKeys/);
  assert.match(organizationPanelTsx, /NPC/);
  assert.match(organizationPanelTsx, /Agent/);
  assert.match(organizationPanelTsx, /organization\.standing/);
  assert.match(organizationPanelTsx, /声望/);
  assert.match(organizationPanelTsx, /organization\.treasury/);
  assert.match(organizationPanelTsx, /金库/);
  assert.match(organizationPanelTsx, /升级/);
});

test("Agent console can search the full region organization directory", () => {
  assert.match(agentExplorerTsx, /organizationSearch/);
  assert.match(agentExplorerTsx, /setOrganizationSearch/);
  assert.match(agentExplorerTsx, /function organizationMatchesSearch/);
  assert.match(agentExplorerTsx, /visibleOrganizations/);
  assert.match(agentExplorerTsx, /region\?\.organizations\.filter/);
  assert.match(agentExplorerTsx, /organizationMatchesSearch\(organization, organizationSearch\)/);
  assert.match(organizationPanelTsx, /visibleOrganizations\.slice\(0,\s*5\)/);
  assert.match(organizationPanelTsx, /搜索组织/);
  assert.match(organizationPanelTsx, /组织目录/);
});

test("Agent console surfaces organization influence scores and faction review status", () => {
  assert.match(typesTs, /export interface EpochOrganizationInfluenceScore/);
  assert.match(typesTs, /influenceScore: EpochOrganizationInfluenceScore/);
  assert.match(organizationPanelTsx, /organization\.influenceScore/);
  assert.match(organizationPanelTsx, /组织影响力/);
  assert.match(organizationPanelTsx, /factionReviewRequired/);
  assert.match(agentExplorerCss, /\.agent-organization-influence-label/);
});

test("Agent console can create operator-seeded organizations from the region panel", () => {
  assert.match(agentExplorerTsx, /createEpochOrganization/);
  assert.match(agentExplorerTsx, /organizationCreateName/);
  assert.match(agentExplorerTsx, /async function createOrganization/);
  const body = functionBody("createOrganization");
  assert.match(body, /operatorKey\.trim\(\)/);
  assert.match(body, /organizationCreateName\.trim\(\)/);
  assert.match(body, /displayName: organizationCreateName\.trim\(\)/);
  assert.match(body, /idempotencyKey\("web_organization_create"\)/);
  assert.match(body, /createEpochOrganization/);
  assert.match(body, /getEpochRegionInfo\(regionId\)/);
  assert.match(body, /commitRegionSnapshot\(nextRegion\)/);
  assert.match(organizationPanelTsx, /组织名称/);
  assert.match(organizationPanelTsx, /创建组织/);
  assert.match(organizationPanelTsx, /createOrganization\(\)/);
});

test("Agent console can update owner-authorized organization membership from the region panel", () => {
  assert.match(agentExplorerTsx, /updateEpochOrganizationMembership/);
  assert.match(agentExplorerTsx, /async function updateOrganizationMembership/);
  const body = functionBody("updateOrganizationMembership");
  assert.match(body, /canUseActiveIdentity/);
  assert.match(body, /explorer\.recoveryCode/);
  assert.match(body, /idempotencyKey\("web_organization_membership"\)/);
  assert.match(body, /updateEpochOrganizationMembership/);
  assert.match(body, /getEpochRegionInfo\(regionId\)/);
  assert.match(body, /commitRegionSnapshot\(nextRegion\)/);
  assert.match(body, /refreshProgress/);
  assert.match(organizationPanelTsx, /organizationMembershipRole/);
  assert.match(organizationPanelTsx, /organizationMembershipRoleOptions\.map/);
  assert.match(organizationPanelTsx, /加入组织/);
  assert.match(organizationPanelTsx, /离开组织/);
  assert.match(organizationPanelTsx, /currentAgentOrganizationMembership/);
  assert.match(organizationPanelTsx, /membership\.agentId === currentAgentId/);
  assert.match(organizationPanelTsx, /membership\.status === "active"/);
  assert.match(organizationPanelTsx, /updateOrganizationMembership\(organization, "active"\)/);
  assert.match(organizationPanelTsx, /updateOrganizationMembership\(organization, "left"\)/);
});

test("Agent console can purchase owner-authorized organization upgrades from treasury", () => {
  assert.match(agentExplorerTsx, /purchaseEpochOrganizationUpgrade/);
  assert.match(agentExplorerTsx, /ORGANIZATION_UPGRADE_OPTIONS/);
  assert.match(agentExplorerTsx, /organizationUpgradeKey/);
  assert.match(agentExplorerTsx, /async function purchaseOrganizationUpgrade/);
  const body = functionBody("purchaseOrganizationUpgrade");
  assert.match(body, /canUseActiveIdentity/);
  assert.match(body, /explorer\.recoveryCode/);
  assert.match(body, /idempotencyKey\("web_organization_upgrade"\)/);
  assert.match(body, /purchaseEpochOrganizationUpgrade/);
  assert.match(body, /getEpochRegionInfo\(regionId\)/);
  assert.match(body, /commitRegionSnapshot\(nextRegion\)/);
  assert.match(body, /refreshProgress/);
  assert.match(organizationPanelTsx, /organizationUpgradeOptions\.map/);
  assert.match(agentExplorerTsx, /训练厅/);
  assert.match(agentExplorerTsx, /本区域赛季贡献 \+1 分/);
  assert.match(agentExplorerTsx, /只加分不产出资源/);
  assert.match(organizationPanelTsx, /购买升级/);
  assert.match(organizationPanelTsx, /organization\.upgradeKeys\.includes\(organizationUpgradeKey\)/);
  assert.match(organizationPanelTsx, /purchaseOrganizationUpgrade\(organization\)/);
});

test("Agent console can contribute owner-authorized resources to organization treasury", () => {
  assert.match(agentExplorerTsx, /contributeEpochOrganizationTreasury/);
  assert.match(agentExplorerTsx, /organizationContributionResourceId/);
  assert.match(agentExplorerTsx, /organizationContributionAmount/);
  assert.match(agentExplorerTsx, /async function contributeOrganizationTreasury/);
  const body = functionBody("contributeOrganizationTreasury");
  assert.match(body, /canUseActiveIdentity/);
  assert.match(body, /explorer\.recoveryCode/);
  assert.match(body, /idempotencyKey\("web_organization_contribution"\)/);
  assert.match(body, /contributeEpochOrganizationTreasury/);
  assert.match(body, /getEpochRegionInfo\(regionId\)/);
  assert.match(body, /commitRegionSnapshot\(nextRegion\)/);
  assert.match(body, /refreshProgress/);
  assert.match(organizationPanelTsx, /捐入金库/);
  assert.match(organizationPanelTsx, /organizationContributionResourceId/);
  assert.match(organizationPanelTsx, /organizationContributionAmount/);
  assert.match(organizationPanelTsx, /contributeOrganizationTreasury\(organization\)/);
});

test("Agent console exposes organization budget proposals and approvals", () => {
  assert.match(agentExplorerTsx, /proposeEpochOrganizationBudget/);
  assert.match(agentExplorerTsx, /resolveEpochOrganizationBudget/);
  assert.match(agentExplorerTsx, /organizationBudgetTitle/);
  assert.match(agentExplorerTsx, /organizationBudgetDescription/);
  assert.match(agentExplorerTsx, /organizationBudgetResourceId/);
  assert.match(agentExplorerTsx, /organizationBudgetAmount/);
  const proposeBody = functionBody("proposeOrganizationBudget");
  assert.match(proposeBody, /canUseActiveIdentity/);
  assert.match(proposeBody, /explorer\.recoveryCode/);
  assert.match(proposeBody, /idempotencyKey\("web_organization_budget_propose"\)/);
  assert.match(proposeBody, /proposeEpochOrganizationBudget/);
  const resolveBody = functionBody("resolveOrganizationBudget");
  assert.match(resolveBody, /canUseActiveIdentity/);
  assert.match(resolveBody, /explorer\.recoveryCode/);
  assert.match(resolveBody, /idempotencyKey\("web_organization_budget_resolve"\)/);
  assert.match(resolveBody, /resolveEpochOrganizationBudget/);
  assert.match(organizationPanelTsx, /组织预算提案/);
  assert.match(organizationPanelTsx, /organization\.budgets/);
  assert.match(organizationPanelTsx, /提交预算/);
  assert.match(organizationPanelTsx, /批准预算/);
  assert.match(organizationPanelTsx, /拒绝预算/);
  assert.match(organizationPanelTsx, /budget\.proposedByAgentId === currentAgentId/);
  assert.match(organizationPanelTsx, /organizationBudgetTitle\.trim/);
});

test("Agent console surfaces organization budget quorum and role-gated resolution", () => {
  assert.match(agentExplorerTsx, /ORGANIZATION_BUDGET_GOVERNANCE_ROLES/);
  assert.match(agentExplorerTsx, /vanguard/);
  assert.match(agentExplorerTsx, /scribe/);
  assert.match(agentExplorerTsx, /clerk/);
  assert.match(organizationPanelTsx, /currentAgentOrganizationMembership/);
  assert.match(organizationPanelTsx, /membership\.status === "active"/);
  assert.match(organizationPanelTsx, /currentAgentCanResolveOrganizationBudget/);
  assert.match(organizationPanelTsx, /!currentAgentCanResolveOrganizationBudget/);
  assert.match(organizationPanelTsx, /budget\.approvalCount/);
  assert.match(organizationPanelTsx, /budget\.approvalThreshold/);
  assert.match(organizationPanelTsx, /budget\.rejectionCount/);
  assert.match(organizationPanelTsx, /budget\.rejectionThreshold/);
  assert.match(organizationPanelTsx, /高价值预算需 2 票同向/);
  assert.match(organizationPanelTsx, /最近投票/);
  assert.match(organizationPanelTsx, /budget\.votes\.slice\(-3\)\.reverse/);
  assert.match(organizationPanelTsx, /预算治理需先锋\/书记\/办事员/);
});

test("Agent console exposes full organization budget history beyond the compact preview", () => {
  assert.match(organizationPanelTsx, /组织预算历史/);
  assert.match(organizationPanelTsx, /agent-organization-budget-history/);
  assert.match(organizationPanelTsx, /organization\.budgets\.map/);
  assert.match(organizationPanelTsx, /budget\.votes\.map/);
  assert.match(agentExplorerCss, /\.agent-organization-budget-history/);
  assert.match(agentExplorerCss, /\.agent-organization-budget-votes/);
});

test("Agent console surfaces organization treasury ledger evidence", () => {
  assert.match(organizationPanelTsx, /组织金库流水/);
  assert.match(organizationPanelTsx, /organization\.treasuryLedger/);
  assert.match(organizationPanelTsx, /agent-organization-ledger/);
  assert.match(organizationPanelTsx, /agent-organization-ledger-row/);
  assert.match(organizationPanelTsx, /amountDelta/);
  assert.match(organizationPanelTsx, /balanceAfter/);
  assert.match(organizationPanelTsx, /recordedAt/);
  assert.match(organizationPanelTsx, /playerEventTypeLabel\(entry\.sourceEventType\)/);
  assert.match(organizationPanelTsx, /依据/);
  assert.doesNotMatch(organizationPanelTsx, /entry\.sourceEventId/);
  assert.match(agentExplorerCss, /\.agent-organization-ledger/);
  assert.match(agentExplorerCss, /\.agent-organization-ledger-row/);
});

test("Agent console region panel surfaces server-derived retaliation opportunities", () => {
  assert.match(regionOverviewPanelTsx, /复仇契机/);
  assert.match(regionOverviewPanelTsx, /region\?\.retaliations/);
  assert.match(regionOverviewPanelTsx, /sourceRaidId/);
  assert.match(regionOverviewPanelTsx, /targetAgentId/);
});

test("Agent console exposes recovery-authorized retaliation resolution controls", () => {
  assert.ok(existsSync(raidRetaliationPanelPath), "RaidRetaliationPanel should own raid and retaliation controls");
  assert.match(agentExplorerTsx, /<RaidRetaliationPanel/);
  assert.match(agentExplorerTsx, /resolveEpochRetaliation/);
  assert.match(raidRetaliationPanelTsx, /执行复仇/);
  assert.match(raidRetaliationPanelTsx, /retaliationStamina/);
  assert.match(raidRetaliationPanelTsx, /raids\.slice\(0, 4\)/);
  assert.match(raidRetaliationPanelTsx, /playerCommonStatusLabel\(raid\.outcome\)/);
  assert.match(raidRetaliationPanelTsx, /playerCommonStatusLabel\(primaryRetaliation\.status\)/);
  assert.doesNotMatch(agentExplorerTsx, /agent-panel agent-raids/);
  assert.doesNotMatch(agentExplorerTsx, /\{raids\.slice\(0, 4\)\.map/);
  assert.match(functionBody("resolveRetaliation"), /recoveryCode:\s*explorer\.recoveryCode/);
});

test("Agent console region panel surfaces server-derived region control", () => {
  assert.match(regionOverviewPanelTsx, /区域控制/);
  assert.match(regionOverviewPanelTsx, /region\?\.regionControl/);
  assert.match(regionOverviewPanelTsx, /controllingFactionId/);
  assert.match(regionOverviewPanelTsx, /sourceReleaseId/);
  assert.match(regionOverviewPanelTsx, /claimingAgentId/);
  assert.match(regionOverviewPanelTsx, /playerFactionLabel/);
  assert.match(regionOverviewPanelTsx, /区域控制 · 暂无公开控制者/);
  assert.match(regionOverviewPanelTsx, /后续行动或赛季可能改变归属/);
  assert.match(raidRetaliationPanelTsx, /发动起义/);
  assert.match(raidRetaliationPanelTsx, /revoltStamina/);
});

test("Agent console region panel surfaces server-built monuments", () => {
  assert.match(regionOverviewPanelTsx, /纪念碑/);
  assert.match(regionOverviewPanelTsx, /region\?\.monuments/);
  assert.match(regionOverviewPanelTsx, /playerFactionLabel\(monument\.controllingFactionId\)/);
  assert.match(regionOverviewPanelTsx, /来源赛季已记录/);
});

test("Agent console links seasons to the public season archive page", () => {
  assert.ok(existsSync(seasonPanelPath), "SeasonPanel should own season campaign controls");
  assert.match(agentExplorerTsx, /<SeasonPanel/);
  assert.match(seasonPanelTsx, /赛季档案/);
  assert.match(seasonPanelTsx, /\/epoch\/season\/\$\{encodeURIComponent\(primarySeason\.seasonId\)\}/);
  assert.match(seasonPanelTsx, /target="_blank"/);
  assert.match(seasonPanelTsx, /primarySeason\.media/);
  assert.match(seasonPanelTsx, /primarySeason\.media\.banner/);
  assert.match(seasonPanelTsx, /agent-season-banner-image/);
  assert.match(seasonPanelTsx, /primarySeason\.media\.campaignKeyArt/);
  assert.match(seasonPanelTsx, /agent-season-campaign-key-art/);
  assert.match(seasonPanelTsx, /standing\.media/);
  assert.match(seasonPanelTsx, /standing\.trustedScore/);
  assert.match(seasonPanelTsx, /playerTrustClassLabel\(standing\.dominantTrustClass\)/);
  assert.match(seasonPanelTsx, /agent-faction-media-image/);
  assert.doesNotMatch(agentExplorerTsx, /agent-panel agent-objectives[\s\S]*赛季阵营战/);
  assert.match(agentExplorerCss, /\.agent-season-banner-image/);
  assert.match(agentExplorerCss, /\.agent-season-campaign-key-art/);
  assert.match(agentExplorerCss, /\.agent-faction-media-image/);
});

test("Agent console can seed multiple server season templates", () => {
  assert.match(agentExplorerTsx, /SEASON_TEMPLATE_OPTIONS/);
  assert.match(agentExplorerTsx, /gray_harbor_faction_season/);
  assert.match(agentExplorerTsx, /cinder_archive_season/);
  assert.match(agentExplorerTsx, /white_tower_compact_season/);
  assert.match(agentExplorerTsx, /seasonKey:\s*seasonTemplateKey/);
});

test("Agent console surfaces canonical season phase events", () => {
  assert.match(seasonPanelTsx, /赛季阶段/);
  assert.match(seasonPanelTsx, /phaseEvents/);
  assert.match(agentExplorerTsx, /season_started/);
  assert.match(agentExplorerTsx, /season_resolved/);
});

test("Agent console surfaces canonical season objectives", () => {
  assert.match(seasonPanelTsx, /赛季目标/);
  assert.match(seasonPanelTsx, /primarySeason\.objectives/);
  assert.match(agentExplorerTsx, /season_objective_completed/);
});

test("Agent console surfaces the latest season contribution score breakdown", () => {
  assert.match(typesTs, /interface EpochSeasonContribution/);
  assert.match(typesTs, /contributions:\s*readonly EpochSeasonContribution\[\]/);
  assert.match(agentExplorerTsx, /lastSeasonContribution/);
  assert.match(agentExplorerTsx, /seasonContributionHistory/);
  assert.match(agentExplorerTsx, /seasonContributionResultFromEvent/);
  assert.match(agentExplorerTsx, /seasonContributionReceipts/);
  assert.match(agentExplorerTsx, /primarySeason\.contributions/);
  const body = functionBody("contributeSeason");
  assert.match(body, /season_contribution_recorded/);
  assert.match(body, /setLastSeasonContribution/);
  assert.match(body, /setSeasonContributionHistory/);
  assert.match(seasonPanelTsx, /基础分/);
  assert.match(seasonPanelTsx, /组织加成/);
  assert.match(seasonPanelTsx, /控制加成/);
  assert.match(seasonPanelTsx, /最终分/);
  assert.match(seasonPanelTsx, /sourceOrganizationUpgradeIds/);
  assert.match(seasonPanelTsx, /regionControlBonusScore/);
  assert.match(seasonPanelTsx, /sourceRegionControlRegionIds/);
  assert.match(seasonPanelTsx, /赛季贡献历史/);
  assert.match(seasonPanelTsx, /agent-season-contribution-history/);
  assert.match(agentExplorerCss, /\.agent-season-contribution-history/);
});

test("Agent console exposes web-side high-value confirmation controls", () => {
  assert.match(agentExplorerTsx, /高价值确认/);
  assert.match(agentExplorerTsx, /requestEpochConfirmation/);
  assert.match(agentExplorerTsx, /confirmEpochAction/);
  assert.match(agentExplorerTsx, /getEpochConfirmations/);
  assert.match(agentExplorerTsx, /confirmationToken/);
  assert.match(agentExplorerTsx, /highValueConfirmations/);
  assert.match(agentExplorerTsx, /刷新待确认/);
  assert.match(agentExplorerTsx, /暂无外部待确认/);
  assert.match(agentExplorerTsx, /playerActionLabel\(confirmation\.action\)/);
  assert.match(agentExplorerTsx, /playerActionLabel\(highValueConfirmation\.action\)/);
  assert.match(agentExplorerTsx, /playerCommonStatusLabel\(highValueConfirmation\?\.status \|\| "none"\)/);
  assert.match(agentExplorerTsx, /playerCommonStatusLabel\(highValueConfirmation\.status\)/);
  assert.match(agentExplorerTsx, /发布世界发言/);
  assert.match(agentPlayerLabelsTs, /world_message:\s*"世界发言"/);
  assert.match(agentPlayerLabelsTs, /turn_card:\s*"生成回合卡"/);
  assert.match(agentPlayerLabelsTs, /resolve_turn:\s*"结算回合卡"/);
  assert.match(functionBody("refreshHighValueConfirmations"), /recoveryCode:\s*explorer\.recoveryCode/);
  assert.match(functionBody("loadHighValueConfirmations"), /await refreshHighValueConfirmations\(\)/);
  assert.match(functionBody("confirmHighValueAction"), /await refreshHighValueConfirmations\(\)/);
  assert.match(functionBody("postWorldMessage"), /scope:\s*"world"/);
  assert.match(functionBody("postWorldMessage"), /confirmationToken/);
  assert.match(functionBody("postWorldMessage"), /setConfirmationToken\(""\)/);
});

test("Agent console masks recovery code until explicitly revealed", () => {
  assert.match(agentExplorerTsx, /showRecoveryCode/);
  assert.match(agentExplorerTsx, /setShowRecoveryCode/);
  assert.match(agentExplorerTsx, /recoveryCodeRevealUsed/);
  assert.match(agentExplorerTsx, /setRecoveryCodeRevealUsed/);
  assert.match(agentExplorerTsx, /function revealRecoveryCodeOnce/);
  assert.match(functionBody("revealRecoveryCodeOnce"), /setShowRecoveryCode\(true\)/);
  assert.match(functionBody("revealRecoveryCodeOnce"), /setRecoveryCodeRevealUsed\(true\)/);
  assert.match(agentExplorerTsx, /agent-secret-value/);
  assert.match(agentExplorerTsx, /showRecoveryCode\s*\?\s*recoveryCode\s*:/);
  assert.match(agentExplorerTsx, /aria-label=\{showRecoveryCode\s*\?\s*"隐藏恢复码"\s*:\s*"显示恢复码"\}/);
  assert.match(agentExplorerTsx, /disabled=\{!showRecoveryCode && recoveryCodeRevealUsed\}/);
  assert.match(agentExplorerTsx, /已显示一次/);
  assert.match(agentExplorerTsx, /等待生成/);
  assert.match(agentExplorerCss, /\.agent-secret-row/);
  assert.match(agentExplorerCss, /\.agent-secret-value/);
  assert.doesNotMatch(agentExplorerTsx, /<div><dt>恢复码<\/dt><dd>\{recoveryCode \|\| "pending"\}<\/dd><\/div>/);
});

test("Agent console can rotate recovery code after server authorization", () => {
  assert.match(agentExplorerTsx, /rotateEpochRecovery/);
  assert.match(agentExplorerTsx, /createRotatedExplorerRecovery/);
  assert.match(agentExplorerTsx, /saveExplorerIdentity/);
  assert.match(agentExplorerTsx, /aria-label="轮换恢复码"/);
  assert.match(functionBody("rotateRecoveryCode"), /const nextExplorer = createRotatedExplorerRecovery\(explorer\)/);
  assert.match(functionBody("rotateRecoveryCode"), /completeRecoveryRotation\(rotation, false\)/);
  assert.match(functionBody("resumePendingRecoveryRotation"), /completeRecoveryRotation\(rotation, true\)/);
  assert.match(agentExplorerTsx, /recoveryRotationResumeRef/);
  assert.match(functionBody("completeRecoveryRotation"), /stagePending:\s*\(\) => savePendingExplorerRecoveryRotation\(rotation\)/);
  assert.match(functionBody("completeRecoveryRotation"), /newRecoveryCode:\s*rotation\.next\.recoveryCode/);
  assert.match(functionBody("completeRecoveryRotation"), /setExplorer\(rotation\.next\)[\s\S]*saveExplorerIdentity\(rotation\.next\)/);
  assert.match(functionBody("completeRecoveryRotation"), /clearPending:\s*clearPendingExplorerRecoveryRotation/);
  assert.match(recoveryRotationControllerTs, /recovery_rotated_local_save_failed/);
});

test("Agent console can export and import encrypted explorer archives without revealing recovery material", () => {
  assert.match(agentExplorerTsx, /exportEncryptedExplorerArchive/);
  assert.match(agentExplorerTsx, /importEncryptedExplorerArchive/);
  assert.match(agentExplorerTsx, /archivePassphrase/);
  assert.match(agentExplorerTsx, /archiveExportArmed/);
  assert.match(agentExplorerTsx, /setArchiveExportArmed/);
  assert.match(agentExplorerTsx, /archiveImportText/);
  assert.match(agentExplorerTsx, /downloadExplorerArchive/);
  assert.match(agentExplorerTsx, /importExplorerArchive/);
  assert.match(agentExplorerTsx, /aria-label=\{archiveExportArmed\s*\?\s*"确认下载加密身份档案"\s*:\s*"准备下载加密身份档案"\}/);
  assert.match(agentExplorerTsx, /aria-label="导入加密身份档案"/);
  assert.match(agentExplorerTsx, /优先下载加密备份，不要截图恢复码/);
  assert.match(agentExplorerTsx, /type="password"/);
  assert.match(functionBody("downloadExplorerArchive"), /if \(!archiveExportArmed\)/);
  assert.match(functionBody("downloadExplorerArchive"), /setArchiveExportArmed\(true\)/);
  assert.match(functionBody("downloadExplorerArchive"), /exportEncryptedExplorerArchive\(explorer,\s*archivePassphrase\)/);
  assert.match(functionBody("downloadExplorerArchive"), /setArchiveExportArmed\(false\)/);
  assert.match(functionBody("importExplorerArchive"), /saveExplorerIdentity\(imported\)/);
  assert.match(functionBody("importExplorerArchive"), /setRecoveryCodeRevealUsed\(false\)/);
  assert.doesNotMatch(functionBody("downloadExplorerArchive"), /exportRecoveryCode/);
});

test("Agent console warns after play starts until the encrypted explorer archive is backed up", () => {
  assert.match(agentExplorerTsx, /EXPLORER_BACKUP_KEY_PREFIX/);
  assert.match(agentExplorerTsx, /hasExplorerBackup/);
  assert.match(agentExplorerTsx, /showBackupRisk/);
  assert.match(agentExplorerTsx, /未备份风险/);
  assert.match(agentExplorerTsx, /完成首局后请导出加密档案/);
  assert.match(functionBody("downloadExplorerArchive"), /setHasExplorerBackup\(true\)/);
  assert.match(functionBody("importExplorerArchive"), /setHasExplorerBackup\(true\)/);
  assert.match(functionBody("completeRecoveryRotation"), /setHasExplorerBackup\(false\)/);
  assert.match(agentExplorerCss, /\.agent-backup-risk/);
}
);

test("Agent console exposes a persistent low-stimulation mode before high-stimulus play", () => {
  assert.match(agentExplorerTsx, /LOW_STIMULUS_PREFERENCE_KEY/);
  assert.match(agentExplorerTsx, /lowStimulusMode/);
  assert.match(agentExplorerTsx, /withLowStimulusGuidance/);
  assert.match(agentExplorerTsx, /低刺激模式/);
  assert.match(agentExplorerTsx, /避免惊吓、闪烁、身体异化、低语音效和过强恐怖描写/);
  assert.match(agentExplorerTsx, /localStorage\.setItem\(LOW_STIMULUS_PREFERENCE_KEY/);
  assert.match(agentExplorerTsx, /preferences:\s*\{[\s\S]*lowStimulusMode:\s*enabled/);
  assert.match(functionBody("updateLowStimulusMode"), /saveExplorerIdentity\(nextExplorer\)/);
  assert.match(agentExplorerTsx, /aria-label="低刺激模式"/);
  assert.match(agentExplorerTsx, /<TurnHostedActionPanel[\s\S]*lowStimulusMode=\{lowStimulusMode\}/);
  assert.match(turnHostedActionPanelTsx, /aria-label="高刺激委托前低刺激模式"/);
  assert.match(turnHostedActionPanelTsx, /checked=\{lowStimulusMode\}/);
  assert.match(turnHostedActionPanelTsx, /持久保存到本地档案/);
  assert.match(turnHostedActionPanelTsx, /agent-high-stimulus-preflight/);
  assert.match(agentExplorerTsx, /prompt:\s*withLowStimulusGuidance\(turnPrompt,\s*lowStimulusMode\)/);
  assert.match(agentExplorerTsx, /mandate:\s*withLowStimulusGuidance\(hostedMandate,\s*lowStimulusMode\)/);
  assert.match(agentExplorerTsx, /visibleText:\s*withLowStimulusGuidance\(hostedVisibleText,\s*lowStimulusMode\)/);
  assert.match(agentExplorerTsx, /visibleText:\s*withLowStimulusGuidance\(turnVisibleText,\s*lowStimulusMode\)/);
  assert.match(agentExplorerCss, /\.agent-comfort-mode/);
  assert.match(agentExplorerCss, /\.agent-high-stimulus-preflight/);
});

test("Agent console surfaces worldbuilding content safety boundary and appeal path", () => {
  assert.match(agentExplorerTsx, /CONTENT_SAFETY_BOUNDARY_COPY/);
  assert.match(agentExplorerTsx, /世界观允许/);
  assert.match(agentExplorerTsx, /黑暗幻想、异化、怪物、非写实恐怖氛围/);
  assert.match(agentExplorerTsx, /现实伤害指令、露骨性内容、仇恨骚扰、违法操作/);
  assert.match(agentExplorerTsx, /误伤申诉/);
  assert.match(agentExplorerTsx, /运营复核/);
  assert.doesNotMatch(agentExplorerTsx, /operator_moderation_appeal/);
  assert.match(agentExplorerTsx, /agent-content-safety-boundary/);
  assert.match(agentExplorerCss, /\.agent-content-safety-boundary/);
});

test("Agent console lists the MCP quickstart entrypoint", () => {
  assert.match(agentPlayerLabelsTs, /\["quickstart", "上手"\]/);
  assert.match(agentPlayerLabelsTs, /\["abuse_status", "冷却"\]/);
  assert.match(agentExplorerTsx, /installManifest\?\.playbooks\.oneTurn/);
  assert.match(agentExplorerTsx, /installManifest\?\.publicPages\.world/);
});

test("Agent console surfaces install and Agent connection readiness", () => {
  assert.match(agentExplorerTsx, /INSTALL_CHECK_IDEMPOTENCY_SCOPE/);
  assert.match(agentExplorerTsx, /installStatus/);
  assert.match(agentExplorerTsx, /installReadiness/);
  assert.match(agentExplorerTsx, /lastAgentRequest/);
  assert.match(agentExplorerTsx, /createAgentInstallReadiness/);
  assert.match(agentInstallReadinessControllerTs, /server:\s*input\.installStatusError/);
  assert.match(agentInstallReadinessControllerTs, /mcp:\s*status\s*\?/);
  assert.match(agentInstallReadinessControllerTs, /lastRequest:\s*input\.busyAction/);
  assert.match(packageJson.scripts["agent:ui-test"], /agentInstallReadinessController\.test\.ts/);
  assert.match(agentExplorerTsx, /检查安装状态/);
  assert.match(agentExplorerTsx, /aria-label="安装连接状态"/);
  assert.match(agentExplorerTsx, /服务器/);
  assert.match(agentExplorerTsx, /宿主工具/);
  assert.match(agentExplorerTsx, /运营密钥/);
  assert.match(agentExplorerTsx, /身份编号/);
  assert.match(agentExplorerTsx, /写入去重/);
  assert.match(agentExplorerTsx, /最近请求/);
  assert.match(agentExplorerTsx, /最近错误/);
  assert.match(agentExplorerTsx, /失败会同步显示在底部错误条/);
  assert.match(agentExplorerTsx, /actionLabel:\s*playerActionLabel/);
  assert.match(agentActionControllerTs, /const actionLabel = options\.actionLabel\(label\);/);
  assert.match(agentActionControllerTs, /options\.setLastAgentRequest\(`\$\{actionLabel\} · 请求中`\)/);
  assert.match(agentActionControllerTs, /options\.setLastAgentRequest\(`\$\{actionLabel\} · 成功`\)/);
  assert.match(agentActionControllerTs, /options\.setLastAgentRequest\(`\$\{actionLabel\} · 失败：\$\{message\}`\)/);
  assert.doesNotMatch(agentExplorerTsx, /server:\s*installStatusError\s*\?\s*"连接失败"/);
  assert.match(agentExplorerCss, /\.agent-install-check/);
});

test("Agent console exposes abuse cooldown status", () => {
  assert.match(agentExplorerTsx, /EpochAbuseStatus/);
  assert.match(agentExplorerTsx, /getEpochAbuseStatus/);
  assert.match(agentExplorerTsx, /loadAbuseStatus/);
  assert.match(agentExplorerTsx, /abuseStatus\?\.remaining/);
  assert.match(agentExplorerTsx, /abuseStatus\?\.abuseScore/);
  assert.match(agentExplorerTsx, /风险分/);
  assert.match(agentExplorerTsx, /abuseStatus\?\.resetAt/);
  assert.match(agentExplorerTsx, /滥用冷却/);
});

test("Agent console exposes operator abuse release controls", () => {
  assert.match(agentExplorerTsx, /releaseEpochAbuseRestriction/);
  assert.match(agentExplorerTsx, /releaseAbuseRestriction/);
  assert.match(agentExplorerTsx, /解除滥用限制/);
  assert.match(agentExplorerTsx, /abuseStatus\?\.abuseLevel\s*===\s*"restricted"/);
  assert.match(functionBody("releaseAbuseRestriction"), /operatorKey:\s*operatorKey\.trim\(\)/);
  assert.match(functionBody("releaseAbuseRestriction"), /actorKey:\s*abuseStatus\.actorKey/);
  assert.match(functionBody("releaseAbuseRestriction"), /eventType:\s*"abuse_score_released"/);
  assert.match(functionBody("releaseAbuseRestriction"), /setAbuseStatus\(await getEpochAbuseStatus/);
});

test("Agent console exposes operator abuse profile list", () => {
  assert.match(agentExplorerTsx, /getEpochAbuseProfiles/);
  assert.match(agentExplorerTsx, /abuseProfiles/);
  assert.match(agentExplorerTsx, /loadAbuseProfiles/);
  assert.match(agentExplorerTsx, /滥用画像/);
  assert.match(agentExplorerTsx, /刷新滥用画像/);
  assert.match(functionBody("loadAbuseProfiles"), /operatorKey:\s*operatorKey\.trim\(\)/);
  assert.match(functionBody("loadAbuseProfiles"), /level:\s*"restricted"/);
  assert.match(agentExplorerTsx, /profile\.reasons/);
  assert.match(agentExplorerTsx, /profile\.latestEventId/);
});

test("Agent console exposes operator overview panel", () => {
  assert.match(agentExplorerTsx, /getEpochOperatorOverview/);
  assert.match(agentExplorerTsx, /operatorOverview/);
  assert.match(agentExplorerTsx, /loadOperatorOverview/);
  assert.match(agentExplorerTsx, /runEpochMaintenance/);
  assert.match(agentExplorerTsx, /runMaintenance/);
  assert.match(agentExplorerTsx, /运营总览/);
  assert.match(agentExplorerTsx, /刷新总览/);
  assert.match(agentExplorerTsx, /运行维护/);
  assert.match(agentExplorerTsx, /近期见证/);
  assert.match(agentExplorerTsx, /本地指纹/);
  assert.match(agentExplorerTsx, /见证记录/);
  assert.doesNotMatch(agentExplorerTsx, /no attestation/);
  assert.doesNotMatch(agentExplorerTsx, /score \{restriction\.reviewScore\}/);
  assert.match(functionBody("loadOperatorOverview"), /operatorKey:\s*operatorKey\.trim\(\)/);
  assert.match(functionBody("runMaintenance"), /operatorKey:\s*operatorKey\.trim\(\)/);
  assert.match(functionBody("runMaintenance"), /idempotencyKey:\s*idempotencyKey\("web_maintenance_run"\)/);
  assert.match(functionBody("runMaintenance"), /resourceNodeRegionIds:\s*\[regionId\]/);
  assert.match(functionBody("runMaintenance"), /resourceNodeSettlementLimit:\s*3/);
  assert.match(functionBody("runMaintenance"), /anomalyRegionIds:\s*\[regionId\]/);
  assert.match(functionBody("runMaintenance"), /anomalyTemplateKey:\s*"obsidian_wyrm_boss"/);
  assert.match(functionBody("runMaintenance"), /seasonRegionIds:\s*\[regionId\]/);
  assert.match(functionBody("runMaintenance"), /seasonLimit:\s*1/);
  assert.match(functionBody("runMaintenance"), /seasonSettlementLimit:\s*3/);
  assert.match(functionBody("runMaintenance"), /serverHostedJobLimit:\s*3/);
  assert.match(functionBody("runMaintenance"), /abuseDecayLimit:\s*3/);
  assert.match(functionBody("runMaintenance"), /abuseDecayAmount:\s*1/);
  assert.match(agentExplorerTsx, /operatorOverview\.summary\.openModeration/);
  assert.match(agentExplorerTsx, /operatorOverview\.summary\.restrictedAbuseProfiles/);
  assert.match(agentExplorerTsx, /operatorOverview\.summary\.serverHostedJobsQueued/);
  assert.match(agentExplorerTsx, /operatorOverview\.summary\.attestedRunnersConfigured/);
  assert.match(agentExplorerTsx, /operatorOverview\.summary\.attestedRunnerRecentAttestations/);
  assert.match(agentExplorerTsx, /operatorOverview\.attestedRunners\.runners/);
  assert.match(agentExplorerTsx, /runner\.secretFingerprint/);
  assert.match(agentExplorerTsx, /runner\.latestAttestationId/);
  assert.match(agentExplorerTsx, /operatorOverview\.health\.queues\.serverHostedJobsQueued/);
  assert.match(agentExplorerTsx, /operatorOverview\.marketRiskRestrictions/);
  assert.match(agentExplorerTsx, /operatorOverview\.summary\.npcCandidateWatch/);
  assert.match(agentExplorerTsx, /operatorOverview\.summary\.npcCandidateBlocked/);
  assert.match(agentExplorerTsx, /operatorOverview\.summary\.loreTargetsPendingAdjudication/);
  assert.match(agentExplorerTsx, /operatorOverview\.health\.queues\.loreTargetsPendingAdjudication/);
  assert.match(agentExplorerTsx, /operatorOverview\.loreAdjudication\.pendingTargets/);
  assert.match(agentExplorerTsx, /setLoreAdjudicationTargetId\(target\.targetId\)/);
  assert.match(agentExplorerTsx, /setLoreAdjudicationSourceIds\(target\.latestContribution\.eventId\)/);
  assert.match(agentExplorerTsx, /setLoreAdjudicationSummary\(target\.latestContribution\.summary\)/);
  assert.match(agentExplorerTsx, /待裁决设定/);
  assert.match(agentExplorerTsx, /填入裁决/);
  assert.match(agentExplorerTsx, /operatorOverview\.npcCandidateReview\.recent/);
  assert.match(agentExplorerTsx, /候选风险/);
  assert.match(agentExplorerTsx, /candidate\.reviewFlags/);
  assert.match(agentExplorerTsx, /operatorOverview\.summary\.maintenanceEvents/);
  assert.match(agentExplorerTsx, /operatorOverview\.health\.status/);
  assert.match(agentExplorerTsx, /operatorOverview\.health\.attentionReasons/);
  assert.match(agentExplorerTsx, /operatorOverview\.maintenance\.health\.workers\.npcLifecycle\.status/);
  assert.match(agentExplorerTsx, /operatorOverview\.maintenance\.health\.workers\.organizationPolitics\.status/);
  assert.match(agentExplorerTsx, /operatorOverview\.maintenance\.counts\.npcLifecycle/);
  assert.match(agentExplorerTsx, /operatorOverview\.maintenance\.counts\.organizationPolitics/);
  assert.match(agentExplorerTsx, /operatorOverview\.maintenance\.counts\.resourceNodeSettled/);
  assert.match(agentExplorerTsx, /operatorOverview\.maintenance\.counts\.anomalySpawned/);
  assert.match(agentExplorerTsx, /operatorOverview\.maintenance\.counts\.seasonStarted/);
  assert.match(agentExplorerTsx, /operatorOverview\.maintenance\.counts\.seasonSettled/);
  assert.match(agentExplorerTsx, /operatorOverview\.maintenance\.counts\.serverHostedJobsCompleted/);
  assert.match(agentExplorerTsx, /operatorOverview\.maintenance\.counts\.serverHostedJobsSkipped/);
  assert.match(agentExplorerTsx, /operatorOverview\.maintenance\.counts\.abuseDecayed/);
  assert.match(agentExplorerTsx, /operatorOverview\.maintenance\.health\.workers\.anomalySpawn\.status/);
  assert.match(agentExplorerTsx, /operatorOverview\.maintenance\.health\.workers\.resourceNodeSettle\.status/);
  assert.match(agentExplorerTsx, /operatorOverview\.maintenance\.health\.workers\.seasonStart\.status/);
  assert.match(agentExplorerTsx, /operatorOverview\.maintenance\.health\.workers\.seasonSettle\.status/);
  assert.match(agentExplorerTsx, /operatorOverview\.maintenance\.health\.workers\.serverHostedJob\.status/);
  assert.match(agentExplorerTsx, /operatorOverview\.maintenance\.health\.workers\.abuseDecay\.status/);
  assert.match(agentExplorerTsx, /maintenanceRun\?\.resourceNodes\.spawned/);
  assert.match(agentExplorerTsx, /maintenanceRun\?\.resourceNodes\.settled/);
  assert.match(agentExplorerTsx, /maintenanceRun\?\.anomalies\.spawned/);
  assert.match(agentExplorerTsx, /maintenanceRun\?\.seasons\.started/);
  assert.match(agentExplorerTsx, /maintenanceRun\?\.seasons\.settled/);
  assert.match(agentExplorerTsx, /maintenanceRun\?\.serverHostedJobs\.completed/);
  assert.match(agentExplorerTsx, /maintenanceRun\?\.abuse\.decayed/);
  assert.match(agentExplorerTsx, /maintenanceRun\.organizationPolitics\.events/);
  assert.match(agentExplorerTsx, /运行健康/);
  assert.match(agentExplorerTsx, /维护健康/);
  assert.match(agentExplorerTsx, /维护状态/);
  assert.match(agentExplorerTsx, /跳过/);
});

test("Agent console exposes explorer profile dashboard", () => {
  assert.match(agentExplorerTsx, /getEpochExplorerProfile/);
  assert.match(agentExplorerTsx, /explorerProfile/);
  assert.match(agentExplorerTsx, /loadExplorerProfile/);
  assert.match(agentExplorerTsx, /玩家档案/);
  assert.match(agentExplorerTsx, /身份槽/);
  assert.match(agentExplorerTsx, /explorerProfile\.summary\.totalIdentities/);
  assert.match(agentExplorerTsx, /explorerProfile\.identitySlots\.legendToNextSlot/);
  assert.match(agentExplorerTsx, /explorerProfile\.identitySlots\.available/);
  assert.match(agentExplorerTsx, /explorerProfile\.publicPages\.explorer/);
  assert.match(functionBody("loadExplorerProfile"), /getEpochExplorerProfile\(explorer\.explorerId\)/);
});

test("Agent console gives the identity profile a narrative home page", () => {
  const narrativeStart = agentExplorerTsx.indexOf("agent-narrative-profile");
  const structuredStart = agentExplorerTsx.indexOf("agent-structured-fields");

  assert.match(agentExplorerTsx, /interface AgentNarrativeHomepage/);
  assert.match(agentExplorerTsx, /function agentNarrativeHomepage/);
  assert.ok(narrativeStart >= 0, "narrative profile home should render before structured fields");
  assert.ok(structuredStart > narrativeStart, "structured fields should move to the secondary profile surface");
  assert.match(agentExplorerTsx, /aria-label="身份叙事档案首页"/);
  assert.match(agentExplorerTsx, /经历年表/);
  assert.match(agentExplorerTsx, /最近伤痕/);
  assert.match(agentExplorerTsx, /关系变化/);
  assert.match(agentExplorerTsx, /身份自述/);
  assert.match(agentExplorerTsx, /progress\?\.latestEvents/);
  assert.match(agentExplorerTsx, /identity\.personality\?\.latestSourceEventId/);
  assert.match(agentExplorerTsx, /primaryRelationship/);
  assert.match(agentExplorerTsx, /<summary>结构化字段<\/summary>/);
  assert.match(agentExplorerCss, /\.agent-narrative-profile/);
  assert.match(agentExplorerCss, /\.agent-structured-fields/);
});

test("Agent console surfaces canonical world overview", () => {
  assert.ok(existsSync(worldOverviewPanelPath), "WorldOverviewPanel component should exist");
  assert.match(agentExplorerTsx, /getEpochWorldOverview/);
  assert.match(agentExplorerTsx, /worldOverview/);
  assert.match(agentExplorerTsx, /loadWorldOverview/);
  assert.match(agentExplorerTsx, /<WorldOverviewPanel/);
  assert.match(agentExplorerTsx, /worldOverview=\{worldOverview\}/);
  assert.match(agentExplorerTsx, /onLoadWorldOverview=\{loadWorldOverview\}/);
  assert.match(worldOverviewPanelTsx, /Epoch 世界总览/);
  assert.match(worldOverviewPanelTsx, /世界新闻/);
  assert.match(worldOverviewRecentResultsTsx, /最新结果页/);
  assert.match(worldOverviewPanelTsx, /活跃赛季/);
  assert.match(worldOverviewPanelTsx, /区域概况/);
  assert.match(worldOverviewPanelTsx, /分类荣誉/);
  assert.match(worldOverviewPanelTsx, /设定贡献/);
  assert.match(worldOverviewPanelTsx, /设定状态/);
  assert.match(worldOverviewPanelTsx, /worldOverview\.honorBoards/);
  assert.match(worldOverviewPanelTsx, /honorBoard\.entries/);
  assert.match(worldOverviewPanelTsx, /worldOverview\.recentLoreContributions/);
  assert.match(worldOverviewPanelTsx, /recentLoreContribution\.summary/);
  assert.match(worldOverviewPanelTsx, /recentLoreContribution\.claimHash/);
  assert.match(worldOverviewPanelTsx, /recentLoreContribution\.provenance\.evidenceHash/);
  assert.match(worldOverviewPanelTsx, /recentLoreContribution\.provenance\.sourceEventCount/);
  assert.match(worldOverviewPanelTsx, /playerLoreContributionCategoryLabel\(recentLoreContribution\.claimType\)/);
  assert.match(worldOverviewPanelTsx, /声明 \{shortHash\(recentLoreContribution\.claimHash\)\}/);
  assert.match(worldOverviewPanelTsx, /证据 \{shortHash\(recentLoreContribution\.provenance\.evidenceHash\)\}/);
  assert.match(worldOverviewPanelTsx, /来源 \{recentLoreContribution\.provenance\.sourceEventCount\} 条/);
  assert.match(worldOverviewPanelTsx, /威胁/);
  assert.match(worldOverviewPanelTsx, /阶位/);
  assert.match(worldOverviewPanelTsx, /重叠/);
  assert.match(worldOverviewPanelTsx, /权重/);
  assert.match(worldOverviewPanelTsx, /CROSS_REGION_MECHANISM_KIND_LABELS/);
  assert.match(worldOverviewPanelTsx, /CROSS_REGION_MECHANISM_SUPPORT_LABELS/);
  assert.doesNotMatch(worldOverviewPanelTsx, /claim \{shortHash\(recentLoreContribution\.claimHash\)\}/);
  assert.doesNotMatch(worldOverviewPanelTsx, /threat \}/);
  assert.doesNotMatch(worldOverviewPanelTsx, /overlap \}/);
  assert.match(worldOverviewPanelTsx, /recentLoreContribution\.publicPages\.audit/);
  assert.match(worldOverviewPanelTsx, /worldOverview\.loreTargetStatuses/);
  assert.match(worldOverviewPanelTsx, /loreTargetStatus\.status/);
  assert.match(worldOverviewPanelTsx, /loreTargetStatus\.latestContribution\.summary/);
  assert.match(worldOverviewPanelTsx, /loreTargetStatus\.latestContribution\.provenance\.evidenceHash/);
  assert.match(worldOverviewPanelTsx, /loreTargetStatus\.latestAdjudication\?\.provenance\.evidenceHash/);
  assert.match(worldOverviewPanelTsx, /loreTargetStatus\.statusSource/);
  assert.match(worldOverviewPanelTsx, /loreTargetStatus\.latestAdjudication\?\.summary/);
  assert.match(worldOverviewPanelTsx, /系统裁决/);
  assert.match(worldOverviewPanelTsx, /playerLoreAdjudicationStatusLabel\(loreTargetStatus\.status\)/);
  assert.match(worldOverviewPanelTsx, /证据 \{shortHash\(evidenceHash\)\}/);
  assert.match(worldOverviewPanelTsx, /来源 \{sourceCount\} 条/);
  assert.doesNotMatch(worldOverviewPanelTsx, /evidence \{shortHash\(evidenceHash\)\}/);
  assert.doesNotMatch(worldOverviewPanelTsx, /sources \{sourceCount\}/);
  assert.doesNotMatch(agentExplorerTsx, /worldOverview\.leaderboard/);
  assert.match(agentExplorerTsx, /worldOverview\.publicPages\.world/);
  assert.match(worldOverviewPanelTsx, /worldOverview\.recentResults/);
  assert.match(worldOverviewPanelTsx, /<WorldOverviewRecentResults/);
  assert.doesNotMatch(worldOverviewPanelTsx, /worldOverview\.recentResults\.slice\(0,\s*3\)\.map/);
  assert.match(worldOverviewRecentResultsTsx, /EpochWorldOverviewRecentResult/);
  assert.match(worldOverviewRecentResultsTsx, /page\.run\?\.title/);
  assert.match(worldOverviewRecentResultsTsx, /page\.run\?\.stepCount/);
  assert.match(worldOverviewRecentResultsTsx, /page\.expiresAt/);
  assert.match(worldOverviewRecentResultsTsx, /publicSummaryText\(page\.publicSafeSummary\.text\)/);
  assert.match(worldOverviewRecentResultsTsx, /有效至/);
  assert.doesNotMatch(worldOverviewPanelTsx, /page\.receiptHash/);
  assert.match(worldOverviewPanelTsx, /worldOverview\.regionHighlights/);
  assert.match(worldOverviewPanelTsx, /regionHighlight\.worldScene\?\.imageUrl/);
  assert.match(worldOverviewPanelTsx, /agent-world-overview-scene-image/);
  assert.match(agentExplorerCss, /\.agent-world-overview-list/);
  assert.match(agentExplorerCss, /\.agent-world-overview-link/);
  assert.match(agentExplorerCss, /\.agent-world-overview-scene-image/);
});

test("Agent console delegates public world summary display", () => {
  assert.ok(existsSync(publicWorldPanelPath), "PublicWorldPanel component should exist");
  assert.match(agentExplorerTsx, /getPublicWorld/);
  assert.match(agentExplorerTsx, /loadPublicWorld/);
  assert.match(agentExplorerTsx, /<PublicWorldPanel/);
  assert.match(agentExplorerTsx, /publicWorld=\{publicWorld\}/);
  assert.match(agentExplorerTsx, /onLoadPublicWorld=\{loadPublicWorld\}/);
  assert.doesNotMatch(agentExplorerTsx, /publicWorld\.sourceGraph\.nodes\.length/);
  assert.match(publicWorldPanelTsx, /公共大世界/);
  assert.match(publicWorldPanelTsx, /publicWorld\.summary\.canonicalClaims/);
  assert.match(publicWorldPanelTsx, /publicWorld\.summary\.disputedClaims/);
  assert.match(publicWorldPanelTsx, /publicWorld\.sourceGraph\.nodes\.length/);
  assert.match(publicWorldPanelTsx, /fallbackText/);
});

test("Agent console surfaces dispute archive value gates for lore targets", () => {
  assert.match(typesTs, /export interface EpochDisputeArchiveGate/);
  assert.match(typesTs, /disputeArchiveGate\?: EpochDisputeArchiveGate/);
  assert.match(worldOverviewPanelTsx, /DISPUTE_ARCHIVE_GATE_LABELS/);
  assert.match(worldOverviewPanelTsx, /loreTargetStatus\.disputeArchiveGate/);
  assert.match(worldOverviewPanelTsx, /争议门槛/);
  assert.match(worldOverviewPanelTsx, /yesNoLabel\(loreTargetStatus\.disputeArchiveGate\.bilateralEvidence\)/);
  assert.doesNotMatch(worldOverviewPanelTsx, /bilateralEvidence \? "yes" : "no"/);
  assert.match(agentExplorerCss, /\.agent-dispute-gate-label/);
});

test("Agent console surfaces MVP worldview gate minimum set", () => {
  assert.match(typesTs, /export interface EpochWorldviewGate/);
  assert.match(typesTs, /worldviewGate: EpochWorldviewGate/);
  assert.match(worldOverviewPanelTsx, /WORLDVIEW_GATE_LABELS/);
  assert.match(worldOverviewPanelTsx, /loreTargetStatus\.worldviewGate/);
  assert.match(worldOverviewPanelTsx, /MVP 守门/);
  assert.match(agentExplorerCss, /\.agent-worldview-gate-label/);
});

test("Agent console lore cards expose text layer labels in their title rows", () => {
  assert.match(worldOverviewPanelTsx, /type LoreCardLayer/);
  assert.match(worldOverviewPanelTsx, /LORE_CARD_LAYER_LABELS/);
  for (const label of ["正史", "共享", "证实", "传闻", "争议", "封存"]) {
    assert.match(worldOverviewPanelTsx, new RegExp(label));
  }
  assert.match(worldOverviewPanelTsx, /function loreTargetStatusLayer/);
  assert.match(worldOverviewPanelTsx, /agent-lore-card-title/);
  assert.match(worldOverviewPanelTsx, /agent-lore-layer-label/);
  assert.match(worldOverviewPanelTsx, /LORE_CARD_LAYER_LABELS\.shared/);
  assert.match(worldOverviewPanelTsx, /LORE_CARD_LAYER_LABELS\[loreTargetStatusLayer\(loreTargetStatus\.status\)\]/);
  assert.match(agentExplorerCss, /\.agent-lore-card-title/);
  assert.match(agentExplorerCss, /\.agent-lore-layer-label/);
});

test("Agent console exposes operator lore adjudication controls", () => {
  assert.match(agentExplorerTsx, /adjudicateEpochLoreTarget/);
  assert.match(agentExplorerTsx, /adjudicateLoreTarget/);
  assert.match(agentExplorerTsx, /loreAdjudicationTargetId/);
  assert.match(agentExplorerTsx, /loreAdjudicationStatus/);
  assert.match(agentExplorerTsx, /loreAdjudicationSummary/);
  assert.match(agentExplorerTsx, /loreAdjudicationSourceIds/);
  assert.match(agentExplorerTsx, /设定裁决/);
  assert.match(agentExplorerTsx, /贡献事件 ID/);
  assert.match(agentExplorerTsx, /裁决设定/);
  assert.match(functionBody("adjudicateLoreTarget"), /operatorKey:\s*operatorKey\.trim\(\)/);
  assert.match(functionBody("adjudicateLoreTarget"), /sourceContributionEventIds/);
  assert.match(functionBody("adjudicateLoreTarget"), /await getEpochWorldOverview\(\{ limit: 6 \}\)/);
});

test("Agent console exposes the canon candidate path for lore adjudication", () => {
  assert.match(typesTs, /export interface EpochCanonCandidatePath/);
  assert.match(typesTs, /export interface EpochCanonAdoptionAttribution/);
  assert.match(typesTs, /canonCandidate\?: EpochCanonCandidatePath/);
  assert.match(typesTs, /attribution: EpochCanonAdoptionAttribution/);
  assert.match(typesTs, /adoptedText\?: string/);
  assert.match(typesTs, /boundaryNote\?: string/);
  assert.match(agentExplorerTsx, /loreCanonCandidateRequested/);
  assert.match(agentExplorerTsx, /loreCanonChapterReviewId/);
  assert.match(agentExplorerTsx, /loreCanonCuratorApprovedBy/);
  assert.match(agentExplorerTsx, /loreCanonMigrationSummary/);
  assert.match(agentExplorerTsx, /loreCanonAdoptedText/);
  assert.match(agentExplorerTsx, /loreCanonBoundaryNote/);
  assert.match(agentExplorerTsx, /正史候选路径/);
  assert.match(agentExplorerTsx, /章节复审/);
  assert.match(agentExplorerTsx, /主理人批准/);
  assert.match(agentExplorerTsx, /迁移说明/);
  assert.match(agentExplorerTsx, /采纳文字/);
  assert.match(agentExplorerTsx, /边界说明/);
  assert.match(agentExplorerTsx, /源出战报/);
  assert.match(agentExplorerTsx, /探索者和 agent/);
  assert.match(functionBody("adjudicateLoreTarget"), /canonCandidate:\s*loreCanonCandidateRequested/);
  assert.match(functionBody("adjudicateLoreTarget"), /adoptedText:\s*loreCanonAdoptedText\.trim\(\)/);
  assert.match(functionBody("adjudicateLoreTarget"), /boundaryNote:\s*loreCanonBoundaryNote\.trim\(\)/);
  assert.match(agentExplorerCss, /\.agent-canon-candidate-path/);
});

test("Agent console surfaces result page verification proof without public receipt jargon", () => {
  assert.match(agentExplorerTsx, /<PublicReceiptDisclosure/);
  assert.match(publicReceiptDisclosureTsx, /resultPage\.receipt/);
  assert.match(publicReceiptDisclosureTsx, /校验证明/);
  assert.doesNotMatch(agentExplorerTsx, /服务器收据/);
  assert.doesNotMatch(publicReceiptDisclosureTsx, /payloadHash/);
  assert.doesNotMatch(agentExplorerTsx, /resultPage\.receipt\.channelClass/);
  assert.doesNotMatch(agentExplorerTsx, /resultPage\.receipt\.deliveryTrust/);
  assert.match(publicReceiptDisclosureTsx, /canonicalEvents/);
  assert.match(publicReceiptDisclosureTsx, /event\.auditUrl/);
  assert.match(publicReceiptDisclosureTsx, /校验记录/);
  assert.match(publicReceiptDisclosureTsx, /className="agent-inline-link"[\s\S]*href=\{`\$\{agentServerBase\}\$\{event\.auditUrl\}`\}/);
});

test("Agent console result share card shows lore status and provenance", () => {
  assert.match(agentExplorerTsx, /interface ShareCardStatus/);
  assert.match(agentExplorerTsx, /function shareCardStatusForResult/);
  assert.match(agentExplorerTsx, /const shareCardStatus/);
  assert.match(agentExplorerTsx, /aria-label="分享卡状态标识"/);
  assert.match(agentExplorerTsx, /设定层级/);
  assert.match(agentExplorerTsx, /来源记录/);
  assert.match(agentExplorerTsx, /是否已证实/);
  assert.match(agentExplorerTsx, /shareCardStatus\.level/);
  assert.match(agentExplorerTsx, /服务器已记录/);
  assert.match(agentExplorerTsx, /shareCardStatus\.confirmedLabel/);
  assert.match(agentExplorerTsx, /publicSafeSummary/);
  assert.match(agentExplorerTsx, /playerPublicSummaryText\(shareCardStatus\.publicSafeSummary\.text\)/);
  assert.match(agentExplorerTsx, /resultPage\.receipt\.focus\.kind/);
  assert.match(agentExplorerTsx, /resultPage\.receipt\?\.canonicalEvents/);
  assert.match(agentExplorerTsx, /is-provisional/);
  assert.match(agentExplorerTsx, /传闻\/争议只显示为未证实/);
  assert.doesNotMatch(agentExplorerTsx, /官方确认/);
  assert.match(agentExplorerCss, /\.agent-share-status-card/);
  assert.match(agentExplorerCss, /\.agent-share-status-card\.is-provisional/);
});

test("Agent console exposes recovery-authorized identity lifecycle controls", () => {
  assert.match(agentExplorerTsx, /archiveEpochIdentity/);
  assert.match(agentExplorerTsx, /reincarnateEpochIdentity/);
  assert.match(agentExplorerTsx, /身份定档/);
  assert.match(agentExplorerTsx, /领取下一世/);
  assert.match(agentExplorerTsx, /recoveryCode:\s*explorer\.recoveryCode/);
});

test("Agent console exposes identity slots and switching controls", () => {
  assert.match(agentExplorerTsx, /身份槽/);
  assert.match(agentExplorerTsx, /progress\?\.identitySlots\?\.available/);
  assert.match(agentExplorerTsx, /下一槽/);
  assert.match(agentExplorerTsx, /legendToNextSlot/);
  assert.match(agentExplorerTsx, /progress\.custody\.reason/);
  assert.match(agentExplorerTsx, /progress\.custody\.changedAt/);
  assert.match(agentExplorerTsx, /progress\?\.identities/);
  assert.match(functionBody("switchIdentity"), /localStorage\.setItem\(CURRENT_AGENT_KEY,\s*agentId\)/);
  assert.match(functionBody("switchIdentity"), /setCurrentAgentId\(agentId\)/);
  assert.match(agentExplorerTsx, /onClick=\{\(\) => switchIdentity\(item\.agentId\)\}/);
});

test("Agent console competitive ladder is responsive and accessible", () => {
  assert.ok(existsSync(competitiveLadderPanelPath), "CompetitiveLadderPanel should own ladder display");
  assert.match(competitiveLadderPanelTsx, /aria-label=\{`切换到\$\{MODE_LABELS\[item\]\}竞技梯`\}/);
  assert.match(competitiveLadderPanelTsx, /aria-label="刷新竞技梯"/);
  assert.match(competitiveLadderPanelTsx, /agent-ladder-summary/);
  assert.match(competitiveLadderPanelTsx, /entry\.canonicalScore/);
  assert.match(competitiveLadderPanelTsx, /entry\.eligibilityReasons\.join/);
  assert.match(agentExplorerCss, /\.agent-ladder-summary/);
  assert.match(agentExplorerCss, /\.agent-ladder-entry/);
  assert.match(agentExplorerCss, /agent-ladder-summary,[\s\S]*agent-abuse-status,[\s\S]*grid-template-columns:\s*1fr/);
});

test("Agent console surfaces stratified agent memory for server trust boundaries", () => {
  assert.match(agentProgressControllerTs, /getEpochAgentMemory/);
  assert.match(agentExplorerTsx, /agentMemory/);
  assert.match(agentExplorerTsx, /记忆分层/);
  assert.match(agentExplorerTsx, /confirmedMemory/);
  assert.match(agentExplorerTsx, /rumorMemory/);
  assert.match(agentExplorerTsx, /privateRunMemory/);
  assert.match(agentExplorerTsx, /服务器确认/);
  assert.match(agentExplorerTsx, /风险传闻/);
  assert.match(agentExplorerTsx, /私有经历/);
  assert.match(functionBody("refreshProgress"), /refreshAgentProgress\(\{/);
  assert.match(functionBody("refreshProgress"), /setAgentMemory\(memory\)/);
  assert.match(agentProgressControllerTs, /api\.getAgentMemory\(\{\s*agentId:\s*input\.agentId,\s*regionId:\s*requestRegionId/);
});

test("Agent console surfaces personal version migration summaries", () => {
  assert.match(typesTs, /export interface EpochPersonalMigrationSummary/);
  assert.match(typesTs, /export type EpochPersonalMigrationDisposition/);
  assert.match(agentProgressControllerTs, /getEpochPersonalMigrationSummary/);
  assert.match(agentExplorerTsx, /personalMigrationSummary/);
  assert.match(agentExplorerTsx, /个人版本迁移/);
  for (const label of ["保留", "降级", "需补证", "采纳", "封存"]) {
    assert.match(agentExplorerTsx, new RegExp(label));
  }
  assert.match(functionBody("refreshProgress"), /refreshAgentProgress\(\{/);
  assert.match(functionBody("refreshProgress"), /setPersonalMigrationSummary\(personalMigrationSummary\)/);
  assert.match(agentProgressControllerTs, /api\.getPersonalMigrationSummary\(\{\s*agentId:\s*input\.agentId,\s*explorerId:\s*input\.explorerId/);
});

test("Agent console sends recovery authorization for market writes", () => {
  assert.match(agentExplorerTsx, /createEpochMarketOrder\(\{[\s\S]*recoveryCode:\s*explorer\.recoveryCode/);
  assert.match(agentExplorerTsx, /fillEpochMarketOrder\(\{[\s\S]*recoveryCode:\s*explorer\.recoveryCode/);
  assert.match(agentExplorerTsx, /cancelEpochMarketOrder\(\{[\s\S]*recoveryCode:\s*explorer\.recoveryCode/);
});

test("Agent console scopes market reads and orders to the selected region", () => {
  assert.match(functionBody("loadMarket"), /getEpochMarket\(\{\s*regionId\s*\}\)/);
  assert.match(functionBody("createMarketOrder"), /createEpochMarketOrder\(\{[\s\S]*\bregionId\b/);
  assert.match(marketPanelTsx, /order\.regionId/);
});

test("Agent console can create server-settled item market orders", () => {
  assert.match(agentExplorerTsx, /marketSellMode/);
  assert.match(agentExplorerTsx, /sellItemId/);
  assert.match(agentExplorerTsx, /sellItemId:\s*sellItemId/);
  assert.match(marketPanelTsx, /order\.sellKind\s*===\s*"item"/);
  assert.match(agentExplorerTsx, /sellItemDisplayName/);
  assert.match(marketPanelTsx, /卖物品/);
});

test("Agent console surfaces server-calculated market fees", () => {
  assert.match(marketPanelTsx, /市场税/);
  assert.match(marketPanelTsx, /marketFeeAmount/);
  assert.match(marketPanelTsx, /sellerProceedsAmount/);
});

test("Agent console surfaces server market risk flags", () => {
  assert.match(marketPanelTsx, /交易风险/);
  assert.match(marketPanelTsx, /tradeRiskFlags/);
  assert.match(marketPanelTsx, /repeat_counterparty_trade/);
  assert.match(marketPanelTsx, /suspicious_low_price/);
  assert.match(marketPanelTsx, /suspicious_high_price/);
});

test("Agent console exposes risk-only audit review controls", () => {
  assert.match(agentExplorerTsx, /风险审计/);
  assert.match(agentExplorerTsx, /拒绝审计/);
  assert.match(agentExplorerTsx, /风险画像/);
  assert.match(agentExplorerTsx, /loadRiskAudit/);
  assert.match(agentExplorerTsx, /loadRejectedCommandAudit/);
  assert.match(agentExplorerTsx, /riskOnly:\s*true/);
  assert.match(agentExplorerTsx, /eventType:\s*"command_rejected"/);
  assert.match(agentExplorerTsx, /reviewFlags/);
  assert.match(agentExplorerTsx, /riskProfile/);
  assert.match(agentExplorerTsx, /recordEpochRiskReview/);
  assert.match(agentExplorerTsx, /recordRiskReview/);
  assert.match(agentExplorerTsx, /riskReviewNote/);
  assert.match(agentExplorerTsx, /cleared/);
  assert.match(agentExplorerTsx, /watchlisted/);
  assert.match(agentExplorerTsx, /escalated/);
});

test("Agent console surfaces escalated market restrictions", () => {
  assert.match(agentExplorerTsx, /marketRiskRestrictions/);
  assert.match(agentExplorerTsx, /currentMarketRestriction/);
  assert.match(agentExplorerTsx, /市场限制/);
  assert.match(agentExplorerTsx, /risk_review_escalated/);
  assert.match(agentExplorerTsx, /releaseEpochMarketRiskRestriction/);
  assert.match(agentExplorerTsx, /releaseMarketRiskRestriction/);
  assert.match(agentPlayerLabelsTs, /解除限制/);
});

test("Agent console sends recovery authorization for downtime writes", () => {
  assert.match(functionBody("startDowntime"), /setEpochDowntime\(\{[\s\S]*recoveryCode:\s*explorer\.recoveryCode/);
  assert.match(functionBody("claimDowntime"), /claimEpochDowntime\(\{[\s\S]*recoveryCode:\s*explorer\.recoveryCode/);
  assert.match(agentExplorerTsx, /托管日志/);
  assert.match(agentExplorerTsx, /downtimeDiaryEntries/);
});

test("Agent console sends recovery authorization for news legend claims", () => {
  assert.match(functionBody("claimNewsLegend"), /claimEpochNewsLegend\(\{[\s\S]*recoveryCode:\s*explorer\.recoveryCode/);
});

test("Agent console sends recovery authorization for resource-spending writes", () => {
  assert.match(agentExplorerTsx, /contributeEpochObjective\(\{[\s\S]*recoveryCode:\s*explorer\.recoveryCode/);
  assert.match(agentExplorerTsx, /contributeEpochSeason\(\{[\s\S]*recoveryCode:\s*explorer\.recoveryCode/);
  assert.match(agentExplorerTsx, /resolveEpochRaid\(\{[\s\S]*recoveryCode:\s*explorer\.recoveryCode/);
  assert.match(agentExplorerTsx, /resolveEpochRegionRevolt\(\{[\s\S]*recoveryCode:\s*explorer\.recoveryCode/);
  assert.match(agentExplorerTsx, /updateEpochRelationship\(\{[\s\S]*recoveryCode:\s*explorer\.recoveryCode/);
});

test("Agent console exposes recovery-authorized diplomacy chain controls", () => {
  assert.match(agentExplorerTsx, /getEpochDiplomacy/);
  assert.match(agentExplorerTsx, /proposeEpochDiplomacy/);
  assert.match(agentExplorerTsx, /respondEpochDiplomacy/);
  assert.match(agentExplorerTsx, /<RelationshipDiplomacyPanel/);
  assert.match(agentExplorerTsx, /diplomacyTerms=\{diplomacyTerms\}/);
  assert.match(agentExplorerTsx, /diplomacyResponseFocus=\{diplomacyResponseFocus\}/);
  assert.match(relationshipDiplomacyPanelTsx, /外交链/);
  assert.match(relationshipDiplomacyPanelTsx, /diplomacyTerms/);
  assert.match(relationshipDiplomacyPanelTsx, /diplomacyResponseFocus/);
  assert.match(functionBody("proposeDiplomacy"), /proposeEpochDiplomacy\(\{[\s\S]*recoveryCode:\s*explorer\.recoveryCode/);
  assert.match(functionBody("respondDiplomacy"), /respondEpochDiplomacy\(\{[\s\S]*recoveryCode:\s*explorer\.recoveryCode/);
  assert.match(functionBody("respondDiplomacy"), /response,/);
  assert.match(relationshipDiplomacyPanelTsx, /respondDiplomacy\("accepted"\)/);
});

test("Agent console sends recovery authorization for hosted and web bridge writes", () => {
  assert.match(functionBody("startHostedSession"), /startEpochHostedSession\(\{[\s\S]*recoveryCode:\s*explorer\.recoveryCode/);
  assert.match(functionBody("submitHostedAction"), /submitEpochHostedAction\(\{[\s\S]*recoveryCode:\s*explorer\.recoveryCode/);
  assert.match(functionBody("startWebBridgeTurn"), /startEpochWebBridgeTurn\(\{[\s\S]*recoveryCode:\s*explorer\.recoveryCode/);
  assert.match(functionBody("submitWebBridgeAction"), /submitEpochWebBridgeAction\(\{[\s\S]*recoveryCode:\s*explorer\.recoveryCode/);
  assert.match(functionBody("submitWebBridgeAction"), /setLastWebBridgeAction/);
  assert.match(functionBody("publishWebBridgeResultPage"), /const preview = await getEpochResultPage\(\{[\s\S]*hostedSessionId:\s*lastWebBridgeAction\.action\.sessionId/);
  assert.match(functionBody("publishWebBridgeResultPage"), /createEpochResultPage\(\{[\s\S]*hostedSessionId:\s*lastWebBridgeAction\.action\.sessionId/);
  assert.match(functionBody("publishWebBridgeResultPage"), /publishToken:\s*preview\.publishToken/);
  assert.match(functionBody("publishWebBridgeResultPage"), /recoveryCode:\s*explorer\.recoveryCode/);
  assert.match(agentExplorerTsx, /lastWebBridgeAction/);
  assert.match(agentExplorerTsx, /<TurnHostedActionPanel/);
  assert.match(turnHostedActionPanelTsx, /发布桥接结果/);
  assert.match(turnHostedActionPanelTsx, /桥接结算/);
});

test("Agent console exposes operator-gated server-hosted action controls", () => {
  assert.ok(existsSync(turnHostedActionPanelPath), "TurnHostedActionPanel should own hosted and turn controls");
  assert.match(agentExplorerTsx, /runEpochServerHostedAction/);
  assert.match(agentExplorerTsx, /queueEpochServerHostedAction/);
  assert.match(agentExplorerTsx, /getEpochServerHostedJobs/);
  assert.match(agentExplorerTsx, /runEpochServerHostedJob/);
  assert.match(agentExplorerTsx, /serverHostedOptionKey/);
  assert.match(agentExplorerTsx, /serverHostedJobs/);
  assert.match(agentExplorerTsx, /lastServerHostedRun/);
  assert.match(agentExplorerTsx, /<TurnHostedActionPanel/);
  assert.match(turnHostedActionPanelTsx, /服务器权威行动/);
  assert.match(turnHostedActionPanelTsx, /服务器作业队列/);
  assert.match(turnHostedActionPanelTsx, /option\.explanation\.expectedBenefit/);
  assert.match(turnHostedActionPanelTsx, /action\.explanation\.brief/);
  assert.doesNotMatch(turnHostedActionPanelTsx, /server_hosted_agent/);
  assert.match(turnHostedActionPanelTsx, /服务器已结算/);
  assert.match(turnHostedActionPanelTsx, /job\.skipReason/);
  assert.match(turnHostedActionPanelTsx, /job\.skippedAt/);
  assert.match(turnHostedActionPanelTsx, /托管区域发言/);
  assert.match(turnHostedActionPanelTsx, /托管世界发言/);
  assert.match(functionBody("runServerHostedAction"), /operatorKey:\s*operatorKey\.trim\(\)/);
  assert.match(functionBody("runServerHostedAction"), /optionKey:\s*serverHostedOptionKey/);
  assert.match(functionBody("runServerHostedAction"), /idempotencyKey:\s*idempotencyKey\("web_server_hosted_action"\)/);
  assert.doesNotMatch(functionBody("runServerHostedAction"), /recoveryCode:\s*explorer\.recoveryCode/);
  assert.match(functionBody("queueServerHostedAction"), /operatorKey:\s*operatorKey\.trim\(\)/);
  assert.match(functionBody("queueServerHostedAction"), /optionKey:\s*serverHostedOptionKey/);
  assert.match(functionBody("queueServerHostedAction"), /idempotencyKey:\s*idempotencyKey\("web_server_hosted_queue"\)/);
  assert.doesNotMatch(functionBody("queueServerHostedAction"), /recoveryCode:\s*explorer\.recoveryCode/);
  assert.match(functionBody("loadServerHostedJobs"), /getEpochServerHostedJobs\(\{[\s\S]*operatorKey:\s*operatorKey\.trim\(\)/);
  assert.match(functionBody("runServerHostedJob"), /runEpochServerHostedJob\(\{[\s\S]*operatorKey:\s*operatorKey\.trim\(\)/);
  assert.match(functionBody("runServerHostedJob"), /idempotencyKey:\s*idempotencyKey\("web_server_hosted_job"\)/);
  assert.doesNotMatch(functionBody("runServerHostedJob"), /recoveryCode:\s*explorer\.recoveryCode/);
  assert.match(functionBody("postServerHostedRegionMessage"), /operatorKey:\s*operatorKey\.trim\(\)/);
  assert.match(functionBody("postServerHostedRegionMessage"), /scope:\s*"region"/);
  assert.match(functionBody("postServerHostedRegionMessage"), /idempotencyKey:\s*idempotencyKey\("web_server_hosted_region_message"\)/);
  assert.doesNotMatch(functionBody("postServerHostedRegionMessage"), /recoveryCode:\s*explorer\.recoveryCode/);
  assert.match(functionBody("postServerHostedWorldMessage"), /operatorKey:\s*operatorKey\.trim\(\)/);
  assert.match(functionBody("postServerHostedWorldMessage"), /scope:\s*"world"/);
  assert.match(functionBody("postServerHostedWorldMessage"), /idempotencyKey:\s*idempotencyKey\("web_server_hosted_world_message"\)/);
  assert.doesNotMatch(functionBody("postServerHostedWorldMessage"), /confirmationToken/);
});

test("Agent console exposes recovery-authorized and web-confirmed turn-card controls", () => {
  assert.match(agentExplorerTsx, /<TurnHostedActionPanel/);
  assert.match(turnHostedActionPanelTsx, /服务器回合卡/);
  assert.match(agentExplorerTsx, /currentTurnCard/);
  assert.match(turnHostedActionPanelTsx, /请求回合卡确认/);
  assert.match(turnHostedActionPanelTsx, /使用确认凭证生成/);
  assert.match(turnHostedActionPanelTsx, /currentTurnCard\.expiresAt/);
  assert.match(turnHostedActionPanelTsx, /formatDate\(currentTurnCard\.expiresAt\)/);
  assert.match(turnHostedActionPanelTsx, /currentTurnCard\.sequence/);
  assert.match(turnHostedActionPanelTsx, /currentTurnCard\.nonce/);
  assert.match(turnHostedActionPanelTsx, /currentTurnCard\.signedEnvelope/);
  assert.match(turnHostedActionPanelTsx, /signedEnvelope\.contentHash/);
  assert.match(turnHostedActionPanelTsx, /signedEnvelope\.signature/);
  assert.match(turnHostedActionPanelTsx, /agent-inline-proof/);
  assert.match(turnHostedActionPanelTsx, /校验证明/);
  assert.match(turnHostedActionPanelTsx, /随机标记/);
  assert.doesNotMatch(turnHostedActionPanelTsx, /Nonce/);
  assert.match(functionBody("requestTurnCardConfirmation"), /action:\s*"turn_card"/);
  assert.match(functionBody("requestTurnCardConfirmation"), /regionId/);
  assert.match(functionBody("requestTurnCardConfirmation"), /prompt:\s*withLowStimulusGuidance\(turnPrompt,\s*lowStimulusMode\)/);
  assert.match(functionBody("createTurnCardWithConfirmation"), /confirmationToken/);
  assert.doesNotMatch(functionBody("createTurnCardWithConfirmation"), /recoveryCode:\s*explorer\.recoveryCode/);
  assert.match(turnHostedActionPanelTsx, /请求结算确认/);
  assert.match(turnHostedActionPanelTsx, /使用确认凭证结算/);
  assert.match(turnHostedActionPanelTsx, /currentTurnCard\.resolution\.signedEnvelope/);
  assert.match(turnHostedActionPanelTsx, /resolution\.signedEnvelope\.contentHash/);
  assert.match(turnHostedActionPanelTsx, /resolution\.signedEnvelope\.signature/);
  assert.match(turnHostedActionPanelTsx, /结算校验证明/);
  assert.match(turnHostedActionPanelTsx, /行动解释/);
  assert.match(turnHostedActionPanelTsx, /option\.explanation\.brief/);
  assert.match(turnHostedActionPanelTsx, /explanation=\{option\.explanation\}/);
  assert.match(turnHostedActionPanelTsx, /alternativeOptions=\{currentTurnCard\.actionOptions\.map\(\(candidate\) => candidate\.label\)\}/);
  assert.match(turnHostedActionPanelTsx, /currentTurnCard\.resolution\.explanation\.brief/);
  assert.match(turnHostedActionPanelTsx, /playerChannelClassLabel\(currentTurnCard\.resolution\.channelClass\)/);
  assert.match(turnHostedActionPanelTsx, /currentTurnCard\.resolution\.envelopeId/);
  assert.match(functionBody("requestResolveTurnConfirmation"), /action:\s*"resolve_turn"/);
  assert.match(functionBody("requestResolveTurnConfirmation"), /turnCardId:\s*currentTurnCard\.turnCardId/);
  assert.match(functionBody("requestResolveTurnConfirmation"), /sequence:\s*currentTurnCard\.sequence/);
  assert.match(functionBody("requestResolveTurnConfirmation"), /nonce:\s*currentTurnCard\.nonce/);
  assert.match(functionBody("requestResolveTurnConfirmation"), /actionOptionId:\s*option\.actionOptionId/);
  assert.match(functionBody("requestResolveTurnConfirmation"), /visibleText:\s*withLowStimulusGuidance\(turnVisibleText,\s*lowStimulusMode\)/);
  assert.match(functionBody("resolveTurnCardWithConfirmation"), /confirmationToken/);
  assert.match(functionBody("resolveTurnCardWithConfirmation"), /sequence:\s*currentTurnCard\.sequence/);
  assert.match(functionBody("resolveTurnCardWithConfirmation"), /nonce:\s*currentTurnCard\.nonce/);
  assert.doesNotMatch(functionBody("resolveTurnCardWithConfirmation"), /recoveryCode:\s*explorer\.recoveryCode/);
  assert.match(functionBody("createTurnCard"), /createEpochTurnCard\(\{[\s\S]*recoveryCode:\s*explorer\.recoveryCode/);
  assert.match(functionBody("resolveTurnCard"), /resolveEpochTurn\(\{[\s\S]*recoveryCode:\s*explorer\.recoveryCode/);
  assert.match(functionBody("resolveTurnCard"), /sequence:\s*currentTurnCard\.sequence/);
  assert.match(functionBody("resolveTurnCard"), /nonce:\s*currentTurnCard\.nonce/);
  assert.match(turnHostedActionPanelTsx, /agent-turn-card/);
});

test("Browser Web LLM play has a dedicated first-screen route and complete relay loop", () => {
  assert.ok(existsSync(webBridgePlaySurfacePath), "WebBridgePlaySurface should own the dedicated browser relay flow");
  assert.match(appTsx, /\/epoch\/web-play/);
  assert.match(appTsx, /initialSurface=\{isWebPlayPath \? "web-bridge" : undefined\}/);
  assert.match(agentExplorerTsx, /<WebBridgePlaySurface/);
  assert.match(agentExplorerTsx, /initialSurface === "web-bridge"/);
  assert.match(webBridgePlaySurfaceTsx, /网页大模型接力/);
  assert.match(webBridgePlaySurfaceTsx, /签发行动身份/);
  assert.match(webBridgePlaySurfaceTsx, /生成接力回合/);
  assert.match(webBridgePlaySurfaceTsx, /复制提示/);
  assert.match(webBridgePlaySurfaceTsx, /网页模型输出/);
  assert.match(webBridgePlaySurfaceTsx, /onSubmitAction/);
  assert.match(webBridgePlaySurfaceTsx, /服务器结算/);
  assert.match(webBridgePlaySurfaceTsx, /发布结果/);
  assert.match(webBridgePlaySurfaceTsx, /下一回合/);
  assert.match(agentExplorerCss, /\.agent-web-play-surface\s*\{/);
  assert.match(agentExplorerCss, /\.agent-web-play-columns\s*\{/);
});

test("Agent console exposes recovery-authorized bounty controls", () => {
  assert.ok(existsSync(bountyPanelPath), "BountyPanel should own bounty controls");
  assert.match(agentExplorerTsx, /<BountyPanel/);
  assert.match(agentExplorerTsx, /getEpochBounties/);
  assert.match(agentExplorerTsx, /createEpochBounty/);
  assert.match(agentExplorerTsx, /claimEpochBounty/);
  assert.match(bountyPanelTsx, /区域悬赏/);
  assert.match(bountyPanelTsx, /刷新悬赏/);
  assert.match(bountyPanelTsx, /发布悬赏/);
  assert.match(bountyPanelTsx, /bountyRequiredItemKey/);
  assert.match(agentExplorerTsx, /requiredItemKey:\s*bountyRequiredItemKey\.trim\(\)/);
  assert.match(bountyPanelTsx, /bountyFulfillmentItemId/);
  assert.match(bountyPanelTsx, /自动选择可交付物品/);
  assert.match(bountyPanelTsx, /bounties\.slice\(0,\s*4\)/);
  assert.match(bountyPanelTsx, /claimBounty\(bounty\)/);
  assert.match(bountyPanelTsx, /领取证据/);
  assert.match(functionBody("claimBounty"), /fulfillmentItemId:\s*bounty\.requiredItemKey/);
  assert.match(functionBody("createBounty"), /createEpochBounty\(\{[\s\S]*recoveryCode:\s*explorer\.recoveryCode/);
  assert.match(functionBody("claimBounty"), /claimEpochBounty\(\{[\s\S]*recoveryCode:\s*explorer\.recoveryCode/);
  assert.doesNotMatch(agentExplorerTsx, /agent-panel agent-bounties/);
  assert.doesNotMatch(agentExplorerTsx, /bounties\.slice\(0,\s*4\)/);
});

test("Agent console exposes recovery-authorized resource node controls", () => {
  assert.match(agentExplorerTsx, /getEpochResourceNodes/);
  assert.match(agentExplorerTsx, /spawnEpochResourceNode/);
  assert.match(agentExplorerTsx, /contestEpochResourceNode/);
  assert.match(agentExplorerTsx, /settleEpochResourceNode/);
  assert.match(encounterPanelTsx, /资源点/);
  assert.match(encounterPanelTsx, /primaryResourceNode/);
  assert.match(encounterPanelTsx, /resourceNodeStamina/);
  assert.match(encounterPanelTsx, /contestResourceNode/);
  assert.match(encounterPanelTsx, /settleResourceNode/);
  assert.match(encounterPanelTsx, /primaryResourceNode\.leaderboard\.slice\(0,\s*4\)/);
  assert.match(functionBody("contestResourceNode"), /contestEpochResourceNode\(\{[\s\S]*recoveryCode:\s*explorer\.recoveryCode/);
});

test("Agent console surfaces server-authoritative inventory items", () => {
  assert.ok(existsSync(inventoryPanelPath), "InventoryPanel should own inventory item display and shop controls");
  assert.match(agentExplorerTsx, /<InventoryPanel/);
  assert.match(agentExplorerTsx, /CRAFT_RECIPE_OPTIONS/);
  assert.match(agentExplorerTsx, /getEpochShop/);
  assert.match(agentExplorerTsx, /purchaseEpochShopOffer/);
  assert.match(agentExplorerTsx, /shopOfferId/);
  assert.match(agentExplorerTsx, /craftEpochInventoryItem/);
  assert.match(agentExplorerTsx, /craftInventoryItem/);
  assert.match(agentExplorerTsx, /purchaseShopOffer/);
  assert.match(inventoryPanelTsx, /背包/);
  assert.match(inventoryPanelTsx, /制作/);
  assert.match(inventoryPanelTsx, /商店/);
  assert.match(inventoryPanelTsx, /progress\?\.inventoryItems/);
  assert.match(inventoryPanelTsx, /inventoryItems\.slice\(0,\s*6\)/);
  assert.match(inventoryPanelTsx, /progress\?\.equipmentEffects/);
  assert.match(inventoryPanelTsx, /equipmentEffects\.map/);
  assert.match(inventoryPanelTsx, /item\.displayName/);
  assert.match(inventoryPanelTsx, /item\.rarity/);
  assert.match(inventoryPanelTsx, /item\.media/);
  assert.match(inventoryPanelTsx, /item\.media\.imageUrl/);
  assert.match(inventoryPanelTsx, /agent-item-media-image/);
  assert.match(agentExplorerCss, /\.agent-item-media-image/);
  assert.match(agentExplorerTsx, /selectedShopOffer/);
  assert.match(inventoryPanelTsx, /selectedShopOffer\?\.media/);
  assert.match(inventoryPanelTsx, /agent-shop-offer-media/);
  assert.match(agentExplorerCss, /\.agent-shop-offer-media/);
  assert.match(inventoryPanelTsx, /item\.bound\s*\?\s*"已绑定"\s*:\s*"未绑定"/);
  assert.match(inventoryPanelTsx, /effect\.displayName/);
  assert.match(inventoryPanelTsx, /effect\.label/);
  assert.match(inventoryPanelTsx, /暂无绑定装备效果/);
  assert.match(inventoryPanelTsx, /暂无服务器发放物品/);
  assert.doesNotMatch(agentExplorerTsx, /inventoryItems\.slice\(0,\s*6\)/);
  assert.doesNotMatch(agentExplorerTsx, /equipmentEffects\.map/);
  assert.match(functionBody("craftInventoryItem"), /recipeId:\s*craftRecipeId/);
  assert.match(functionBody("craftInventoryItem"), /recoveryCode:\s*explorer\.recoveryCode/);
  assert.match(functionBody("purchaseShopOffer"), /offerId:\s*shopOfferId/);
  assert.match(functionBody("purchaseShopOffer"), /regionId:\s*regionId/);
  assert.match(functionBody("purchaseShopOffer"), /recoveryCode:\s*explorer\.recoveryCode/);
  assert.match(functionBody("craftInventoryItem"), /setProgress\(nextProgress\)|refreshProgress/);
});

test("Agent console treats global world pacing controls as operator actions", () => {
  assert.match(functionBody("seedObjective"), /seedEpochObjective\(\{[\s\S]*operatorKey:\s*operatorKey\.trim\(\)/);
  assert.match(functionBody("settleObjective"), /settleEpochObjective\(\{[\s\S]*operatorKey:\s*operatorKey\.trim\(\)/);
  assert.match(functionBody("spawnResourceNode"), /spawnEpochResourceNode\(\{[\s\S]*operatorKey:\s*operatorKey\.trim\(\)/);
  assert.match(functionBody("settleResourceNode"), /settleEpochResourceNode\(\{[\s\S]*operatorKey:\s*operatorKey\.trim\(\)/);
  assert.match(functionBody("seedSeason"), /seedEpochSeason\(\{[\s\S]*operatorKey:\s*operatorKey\.trim\(\)/);
  assert.match(functionBody("settleSeason"), /settleEpochSeason\(\{[\s\S]*operatorKey:\s*operatorKey\.trim\(\)/);
  assert.match(encounterPanelTsx, /disabled=\{isBusy \|\| !operatorKey\.trim\(\)\} onClick=\{seedObjective\}/);
  assert.match(encounterPanelTsx, /disabled=\{isBusy \|\| !operatorKey\.trim\(\)\} onClick=\{spawnResourceNode\}/);
  assert.match(agentExplorerTsx, /<SeasonPanel[\s\S]*hasOperatorKey=\{Boolean\(operatorKey\.trim\(\)\)\}/);
  assert.match(seasonPanelTsx, /disabled=\{isBusy \|\| !hasOperatorKey\} onClick=\{seedSeason\}/);
});

test("Agent console can publish resolved turn-card result pages", () => {
  assert.match(agentExplorerTsx, /<TurnHostedActionPanel/);
  assert.match(turnHostedActionPanelTsx, /发布本回合/);
  assert.match(functionBody("publishTurnResultPage"), /const preview = await getEpochResultPage\(\{[\s\S]*turnCardId:\s*currentTurnCard\.turnCardId/);
  assert.match(functionBody("publishTurnResultPage"), /createEpochResultPage\(\{[\s\S]*turnCardId:\s*currentTurnCard\.turnCardId/);
  assert.match(functionBody("publishTurnResultPage"), /publishToken:\s*preview\.publishToken/);
  assert.match(functionBody("publishTurnResultPage"), /recoveryCode:\s*explorer\.recoveryCode/);
  assert.match(functionBody("publishTurnResultPage"), /setSharedResultPage\(created\.page\)/);
  assert.match(turnHostedActionPanelTsx, /currentTurnCard\.status === "resolved"/);
  assert.match(agentExplorerTsx, /resultPage\.focusTurnCard/);
});

test("Agent console places short authorship confirmation beside publish buttons", () => {
  assert.match(agentExplorerTsx, /const RESULT_PUBLISH_AUTHORIZATION_COPY = "故事署名归你；入档发现会成为共享世界资料，可被他人引用。"/);
  assert.match(agentExplorerTsx, /resultPublishAuthorizationCopy=\{RESULT_PUBLISH_AUTHORIZATION_COPY\}/);
  assert.match(turnHostedActionPanelTsx, /发布本回合<\/button>\s*<small>\{resultPublishAuthorizationCopy\}<\/small>/);
  assert.match(turnHostedActionPanelTsx, /发布桥接结果<\/button>\s*<small>\{resultPublishAuthorizationCopy\}<\/small>/);
  assert.match(agentExplorerTsx, /创建链接<\/button>\s*<small>\{RESULT_PUBLISH_AUTHORIZATION_COPY\}<\/small>/);
});

test("Agent console uses a one-time publish credential for generic result pages", () => {
  assert.match(functionBody("publishResultPage"), /const preview = await getEpochResultPage\(currentAgentId\)/);
  assert.match(functionBody("publishResultPage"), /publishToken:\s*preview\.publishToken/);
  assert.match(functionBody("publishResultPage"), /recoveryCode:\s*explorer\.recoveryCode/);
  assert.match(functionBody("publishResultPage"), /setSharedResultPage\(created\.page\)/);
});

test("Agent console can revoke shared result pages from the web UI", () => {
  assert.match(agentExplorerTsx, /revokeEpochResultPage/);
  assert.match(agentExplorerTsx, /revokeSharedResultPage/);
  assert.match(agentExplorerTsx, /隐藏链接/);
  assert.match(functionBody("revokeSharedResultPage"), /pageId:\s*sharedResultPage\.pageId/);
  assert.match(functionBody("revokeSharedResultPage"), /recoveryCode:\s*explorer\.recoveryCode/);
  assert.match(functionBody("revokeSharedResultPage"), /reason:\s*"owner_hidden_from_console"/);
  assert.match(functionBody("revokeSharedResultPage"), /setSharedResultPage\(revoked\.page\)/);
  assert.match(functionBody("revokeSharedResultPage"), /await loadWorldOverview\(\)/);
});

test("Agent console result panel surfaces next actions and regional context", () => {
  assert.match(agentExplorerTsx, /<ResultNavigation/);
  assert.match(resultNavigationTsx, /resultPage\.nextActions/);
  assert.match(resultNavigationTsx, /action\.media/);
  assert.match(agentExplorerTsx, /resultPage\.regionalContext/);
  assert.match(agentExplorerTsx, /resultPage\.regionalContext\.regionControl/);
  assert.match(resultNavigationTsx, /下一步/);
  assert.match(agentExplorerTsx, /区域上下文/);
  assert.match(agentExplorerTsx, /区域控制/);
  assert.match(agentExplorerTsx, /暂无公开控制者/);
  assert.doesNotMatch(agentExplorerTsx, /控制位开放/);
  assert.match(resultNavigationTsx, /agent-activity-media-row/);
});

test("Agent console splits settlement into four single-action screens", () => {
  assert.match(agentExplorerTsx, /type ResultSettlementScreenKey/);
  assert.match(agentExplorerTsx, /RESULT_SETTLEMENT_SCREENS/);
  assert.match(agentExplorerTsx, /resultSettlementScreen/);
  assert.match(agentExplorerTsx, /activeSettlementScreen/);
  assert.match(agentExplorerTsx, /function runSettlementPrimaryAction/);
  assert.match(agentExplorerTsx, /结局/);
  assert.match(agentExplorerTsx, /评分/);
  assert.match(agentExplorerTsx, /掉落/);
  assert.match(agentExplorerTsx, /下一步/);
  assert.match(agentExplorerTsx, /aria-label="四屏结算"/);
  assert.match(agentExplorerTsx, /role="tablist"/);
  assert.match(agentExplorerTsx, /RESULT_SETTLEMENT_SCREENS\.map/);
  assert.match(agentExplorerTsx, /setResultSettlementScreen\(screen\.key\)/);
  assert.match(agentExplorerTsx, /agent-settlement-screen/);
  assert.match(agentExplorerTsx, /agent-settlement-primary-action/);
  assert.match(agentExplorerCss, /\.agent-settlement-flow/);
  assert.match(agentExplorerCss, /\.agent-settlement-primary-action/);
});

test("Agent console shows a static minimap impact slice on the drop settlement screen", () => {
  assert.match(agentExplorerTsx, /interface ResultImpactMapItem/);
  assert.match(agentExplorerTsx, /function resultImpactMapItems/);
  assert.match(agentExplorerTsx, /const resultImpactItems/);
  assert.match(agentExplorerTsx, /activeSettlementScreen\.key === "drop"/);
  assert.match(agentExplorerTsx, /aria-label="小地图影响切片"/);
  assert.match(agentExplorerTsx, /agent-impact-minimap/);
  assert.match(agentExplorerTsx, /resultPage\.regionalContext\.regionId/);
  assert.match(agentExplorerTsx, /context\.regionControl/);
  assert.match(agentExplorerTsx, /context\.commissions/);
  assert.match(agentExplorerTsx, /context\.raids/);
  assert.match(agentExplorerTsx, /context\.retaliations/);
  assert.match(agentExplorerTsx, /context\.traces/);
  assert.match(agentExplorerCss, /\.agent-impact-minimap/);
  assert.match(agentExplorerCss, /\.agent-impact-minimap span/);
});

test("Agent console result panel surfaces regional conflict context", () => {
  assert.match(agentExplorerTsx, /resultPage\.regionalContext\.raids/);
  assert.match(agentExplorerTsx, /resultPage\.regionalContext\.retaliations/);
  assert.match(agentExplorerTsx, /resultPage\.regionalContext\.traces/);
  assert.match(agentExplorerTsx, /对抗战报/);
  assert.match(agentExplorerTsx, /playerCommonStatusLabel\(raid\.outcome\)/);
  assert.match(agentExplorerTsx, /playerCommonStatusLabel\(retaliation\.status\)/);
  assert.match(agentExplorerTsx, /进攻方 \{shortHash\(raid\.attackerAgentId\)\} 对防守方/);
  assert.doesNotMatch(agentExplorerTsx, /raid\.attackerAgentId\} \{" -> "\}/);
});
