import type { JourneySceneType } from "./journeySceneCatalog.ts";
import type { JourneyAvailableWorldObject } from "./journeySceneRules.ts";

export type JourneyTaskRisk = "low" | "medium" | "high";

export type JourneyTaskEffectKind =
  | "commission_offer"
  | "journey_progress"
  | "resource_delta"
  | "clue_created"
  | "relationship_signal"
  | "world_reference";

export interface JourneyTaskActionDefinition {
  readonly optionKey: string;
  readonly label: string;
  readonly intent: string;
  readonly risk: JourneyTaskRisk;
  readonly allowedEffectKinds: readonly JourneyTaskEffectKind[];
  readonly targetObjectIds: readonly string[];
  readonly outcomeSummary: string;
  readonly completesMission: boolean;
  readonly chapterTitle: string;
  readonly actionNarrative: string;
}

export interface JourneyTaskMissionDefinition {
  readonly briefing: string;
  readonly primaryObjective: string;
  readonly completionCriteria: string;
  readonly successResult: string;
}

export interface JourneyTaskRoute {
  readonly routeKey: string;
  readonly regionId: string;
  readonly sceneType: Exclude<JourneySceneType, "travel" | "relationship">;
  readonly title: string;
  readonly premise: string;
  readonly locationId: string;
  readonly participantIds: readonly string[];
  readonly worldObjects: readonly JourneyAvailableWorldObject[];
  readonly actions: readonly JourneyTaskActionDefinition[];
  readonly safeFallbackOptionKey: string;
  readonly mission: JourneyTaskMissionDefinition;
}

interface RouteObjectSeed {
  readonly id: string;
  readonly type: string;
  readonly label: string;
  readonly primary?: boolean;
  readonly participant?: boolean;
  readonly tags?: readonly string[];
}

interface RouteSeed extends Omit<JourneyTaskRoute, "locationId" | "participantIds" | "worldObjects"> {
  readonly objects: readonly RouteObjectSeed[];
}

function route(seed: RouteSeed): JourneyTaskRoute {
  const routeTag = `journey_route:${seed.routeKey}`;
  const location = seed.objects.find((object) => object.primary);
  if (!location) throw new Error(`journey_task_location_missing:${seed.routeKey}`);
  const worldObjects = seed.objects.map((object): JourneyAvailableWorldObject => ({
    id: object.id,
    type: object.type,
    label: object.label,
    regionId: seed.regionId,
    sourceFactIds: [`world:catalog:${seed.routeKey}:${object.id}`],
    tags: [routeTag, object.primary ? "journey_task_primary" : "journey_task_support", ...(object.tags ?? [])],
    participantIds: object.participant ? [object.id] : [],
    sceneTypes: object.primary ? [seed.sceneType] : [],
  }));
  return {
    routeKey: seed.routeKey,
    regionId: seed.regionId,
    sceneType: seed.sceneType,
    title: seed.title,
    premise: seed.premise,
    locationId: location.id,
    participantIds: seed.objects.filter((object) => object.participant).map((object) => object.id),
    worldObjects,
    actions: seed.actions,
    safeFallbackOptionKey: seed.safeFallbackOptionKey,
    mission: seed.mission,
  };
}

const PROGRESS = ["journey_progress", "world_reference"] as const;
const PROGRESS_AND_CLUE = ["journey_progress", "clue_created", "world_reference"] as const;

export const JOURNEY_TASK_ROUTES: readonly JourneyTaskRoute[] = [
  route({
    routeKey: "phase_experiment",
    regionId: "region_quantum_laboratory",
    sceneType: "commission",
    title: "相位样本协助实验",
    premise: "量子实验组正在相位实验舱执行第七码样本测试，首席实验员林铎需要一名助手按步骤校准传感器并稳定样本匣。",
    objects: [
      { id: "location_quantum_phase_chamber", type: "location", label: "相位实验舱", primary: true, tags: ["commission", "experiment"] },
      { id: "organization_quantum_research_group", type: "organization", label: "量子实验组" },
      { id: "npc_chief_researcher_linduo", type: "npc", label: "首席实验员林铎", participant: true },
      { id: "device_phase_stabilizer", type: "device", label: "相位稳定器" },
      { id: "container_sample_seven", type: "container", label: "第七码样本匣" },
    ],
    actions: [
      { optionKey: "assist_phase_experiment", label: "协助林铎校准相位稳定器并完成第七码测试", intent: "依照实验步骤读出三组传感数据，在林铎确认后调整相位稳定器。", risk: "medium", allowedEffectKinds: PROGRESS_AND_CLUE, targetObjectIds: ["npc_chief_researcher_linduo", "device_phase_stabilizer", "container_sample_seven"], outcomeSummary: "身份按林铎给出的顺序读出三组传感数据，校准相位稳定器，并在第七码样本匣保持稳定后完成测试；实验结果进入量子实验组记录。", completesMission: true, chapterTitle: "协助相位实验", actionNarrative: "你站到相位稳定器前，依次读出三组传感数据，并按林铎的确认调整校准环。" },
      { optionKey: "monitor_sample_seven", label: "监测第七码样本匣并记录相位波动", intent: "不操作主设备，只持续记录样本匣的相位波动并提交观测表。", risk: "low", allowedEffectKinds: PROGRESS_AND_CLUE, targetObjectIds: ["container_sample_seven", "npc_chief_researcher_linduo"], outcomeSummary: "身份连续记录第七码样本匣的相位波动，把完整观测表交给林铎；样本测试获得了可复核的监测记录。", completesMission: true, chapterTitle: "监测样本", actionNarrative: "你守在第七码样本匣旁，逐次记录相位波动，没有越过权限操作主设备。" },
      { optionKey: "withdraw_from_phase_test", label: "向林铎说明后退出第七码测试", intent: "在尚未操作设备前退出，不留下未经培训的实验改动。", risk: "low", allowedEffectKinds: ["journey_progress"], targetObjectIds: ["npc_chief_researcher_linduo", "location_quantum_phase_chamber"], outcomeSummary: "身份在操作设备前向林铎说明退出，量子实验组取消了本次助手安排；实验任务没有完成。", completesMission: false, chapterTitle: "退出实验", actionNarrative: "你在操作设备前向林铎说明自己不参加这次测试，随后离开操作位。" },
    ],
    safeFallbackOptionKey: "withdraw_from_phase_test",
    mission: { briefing: "量子实验组需要一名现场助手完成第七码样本测试。", primaryObjective: "在相位实验舱协助完成第七码样本测试，并确认实验记录已提交归档。", completionCriteria: "完成设备校准或完整样本监测，取得量子实验组的可追溯记录。", successResult: "第七码样本测试记录" },
  }),
  route({
    routeKey: "cathedral_entry_trial",
    regionId: "region_orbital_cathedral",
    sceneType: "commission",
    title: "圣堂入门试炼",
    premise: "圣堂见习院开放本期入门试炼，试炼官弥赛负责在三段试炼庭核验参与者的通过记录。",
    objects: [
      { id: "location_cathedral_trial_court", type: "location", label: "三段试炼庭", primary: true, tags: ["commission", "trial"] },
      { id: "organization_cathedral_novitiate", type: "organization", label: "圣堂见习院" },
      { id: "npc_trial_officer_misai", type: "npc", label: "试炼官弥赛", participant: true },
      { id: "device_trial_beacon", type: "device", label: "试炼信标" },
    ],
    actions: [
      { optionKey: "complete_entry_trial", label: "依次完成弥赛主持的三段入门试炼", intent: "按顺序完成平衡桥、信标辨识和负重折返，逐一完成核验点。", risk: "medium", allowedEffectKinds: PROGRESS, targetObjectIds: ["npc_trial_officer_misai", "location_cathedral_trial_court", "device_trial_beacon"], outcomeSummary: "身份依次通过平衡桥、辨认正确的试炼信标并完成负重折返；弥赛核验三处记录后签发了入门试炼通过凭证。", completesMission: true, chapterTitle: "完成入门试炼", actionNarrative: "你依次踏上平衡桥、辨认试炼信标，再背起配重完成折返。" },
      { optionKey: "complete_trial_assessment", label: "接受弥赛的基础能力评定", intent: "完成基础动作与信标辨识评定，取得下一次正式试炼所需的记录。", risk: "low", allowedEffectKinds: PROGRESS_AND_CLUE, targetObjectIds: ["npc_trial_officer_misai", "device_trial_beacon"], outcomeSummary: "身份完成基础动作与信标辨识评定；弥赛记录了合格项目并给出正式试炼的准入编号。", completesMission: true, chapterTitle: "接受能力评定", actionNarrative: "你按照弥赛的口令完成基础动作，并逐一辨认亮起的试炼信标。" },
      { optionKey: "leave_trial_queue", label: "在弥赛点名前退出试炼队列", intent: "在试炼开始前退出，不生成虚假的通过记录。", risk: "low", allowedEffectKinds: ["journey_progress"], targetObjectIds: ["npc_trial_officer_misai", "location_cathedral_trial_court"], outcomeSummary: "身份在点名前退出试炼队列，没有进入任何试炼环节，也没有取得准入记录。", completesMission: false, chapterTitle: "退出试炼", actionNarrative: "你在点名前离开队列，没有踏入三段试炼庭。" },
    ],
    safeFallbackOptionKey: "leave_trial_queue",
    mission: { briefing: "圣堂见习院正在核验本期见习者的入门资格。", primaryObjective: "完成三段入门试炼或基础能力评定，取得试炼官签发的准入记录。", completionCriteria: "弥赛签发通过凭证或正式试炼准入编号。", successResult: "圣堂试炼准入记录" },
  }),
  route({
    routeKey: "forest_mutant_bounty",
    regionId: "region_forest",
    sceneType: "conflict",
    title: "腐林变异兽悬赏",
    premise: "腐林猎团悬赏清除外缘的甲壳变异兽；向导岑野已标出活动范围，猎团只按带回的甲壳标记核验任务。",
    objects: [
      { id: "location_forest_outer_hunt", type: "location", label: "腐林外缘猎区", primary: true, tags: ["conflict", "bounty"] },
      { id: "organization_forest_hunters", type: "organization", label: "腐林猎团" },
      { id: "npc_guide_cenye", type: "npc", label: "向导岑野", participant: true },
      { id: "creature_carapace_mutant", type: "creature", label: "甲壳变异兽" },
      { id: "item_hunter_marking_knife", type: "item", label: "猎团标记刀" },
    ],
    actions: [
      { optionKey: "hunt_carapace_mutant", label: "跟随岑野猎杀甲壳变异兽并取得标记甲壳", intent: "只在已标定猎区行动，击倒目标后用猎团标记刀取得可核验甲壳。", risk: "high", allowedEffectKinds: ["journey_progress", "world_reference", "resource_delta"], targetObjectIds: ["npc_guide_cenye", "creature_carapace_mutant", "item_hunter_marking_knife"], outcomeSummary: "身份跟随岑野在腐林外缘找到甲壳变异兽，避开正面冲撞后从侧面击倒目标，并用猎团标记刀取得一片带编号的甲壳作为悬赏凭证。", completesMission: true, chapterTitle: "猎杀变异兽", actionNarrative: "你跟着岑野进入标定猎区，绕开变异兽的冲撞路线，从侧面发动攻击。" },
      { optionKey: "set_mutant_trap", label: "与岑野布设诱捕索并活捉甲壳变异兽", intent: "利用既有兽道布设诱捕索，限制目标行动后交由猎团处置。", risk: "medium", allowedEffectKinds: PROGRESS, targetObjectIds: ["npc_guide_cenye", "creature_carapace_mutant", "location_forest_outer_hunt"], outcomeSummary: "身份与岑野沿兽道布好诱捕索，把甲壳变异兽限制在猎区边缘；猎团接手目标并登记了活捉记录。", completesMission: true, chapterTitle: "布设诱捕索", actionNarrative: "你和岑野沿兽道固定诱捕索，再把变异兽引向已经收紧的套索。" },
      { optionKey: "abort_mutant_hunt", label: "向岑野示意终止本次变异兽狩猎", intent: "在未接触目标前撤出猎区，不伪造猎获或悬赏凭证。", risk: "low", allowedEffectKinds: ["journey_progress"], targetObjectIds: ["npc_guide_cenye", "location_forest_outer_hunt"], outcomeSummary: "身份在接触目标前与岑野撤出猎区，没有猎获，也没有取得悬赏凭证。", completesMission: false, chapterTitle: "终止狩猎", actionNarrative: "你向岑野示意终止行动，两人沿来路退出腐林外缘猎区。" },
    ],
    safeFallbackOptionKey: "abort_mutant_hunt",
    mission: { briefing: "腐林猎团按可核验猎获结算甲壳变异兽悬赏。", primaryObjective: "在腐林外缘清除或活捉一只甲壳变异兽，带回猎团认可的凭证。", completionCriteria: "取得带编号的甲壳，或由猎团登记活捉记录。", successResult: "变异兽悬赏核验凭证" },
  }),
  route({
    routeKey: "mine_rescue",
    regionId: "region_abandoned_mine",
    sceneType: "world_event",
    title: "废弃矿井救援",
    premise: "北三号勘探队被困在废弃矿区下层，救援队长洛芜已定位升降井故障，必须先恢复制动再引导人员上井。",
    objects: [
      { id: "location_mine_north_three_shaft", type: "location", label: "北三号升降井", primary: true, tags: ["world_event", "rescue"] },
      { id: "npc_rescue_captain_luowu", type: "npc", label: "救援队长洛芜", participant: true },
      { id: "group_mine_survey_team", type: "group", label: "北三号勘探队" },
      { id: "device_shaft_brake", type: "device", label: "升降井制动器" },
    ],
    actions: [
      { optionKey: "repair_shaft_and_rescue", label: "协助洛芜修复制动器并接应北三号勘探队", intent: "先锁定井架，再更换制动销，确认空载测试后接应被困人员。", risk: "high", allowedEffectKinds: PROGRESS, targetObjectIds: ["npc_rescue_captain_luowu", "device_shaft_brake", "group_mine_survey_team"], outcomeSummary: "身份协助洛芜锁定井架、更换制动销并完成空载测试；升降井恢复后，北三号勘探队全员依次上井并完成点名。", completesMission: true, chapterTitle: "修井救人", actionNarrative: "你和洛芜先锁定井架，再拆下断裂的制动销，装好替换件后进行空载测试。" },
      { optionKey: "guide_team_through_service_tunnel", label: "从维护隧道引导北三号勘探队撤离", intent: "沿救援队已确认的维护路线设置路标并逐段接应。", risk: "medium", allowedEffectKinds: PROGRESS, targetObjectIds: ["npc_rescue_captain_luowu", "group_mine_survey_team", "location_mine_north_three_shaft"], outcomeSummary: "身份沿维护隧道布置路标，与洛芜分段接应北三号勘探队；队员全部从侧向出口撤离并完成点名。", completesMission: true, chapterTitle: "引导撤离", actionNarrative: "你沿维护隧道逐段放下路标，再把勘探队员分组引向侧向出口。" },
      { optionKey: "leave_mine_rescue", label: "向洛芜报备后退出矿井救援", intent: "不进入不熟悉的井下路线，把位置让给受训救援员。", risk: "low", allowedEffectKinds: ["journey_progress"], targetObjectIds: ["npc_rescue_captain_luowu", "location_mine_north_three_shaft"], outcomeSummary: "身份向洛芜报备后退出救援区，没有参与制动器修复或人员撤离；救援任务未由该身份完成。", completesMission: false, chapterTitle: "退出救援", actionNarrative: "你向洛芜说明后退出警戒线，把井口位置让给受训救援员。" },
    ],
    safeFallbackOptionKey: "leave_mine_rescue",
    mission: { briefing: "北三号勘探队仍在矿井下层等待接应。", primaryObjective: "恢复北三号升降井或开辟维护隧道撤离路线，把勘探队带出矿井。", completionCriteria: "北三号勘探队全员离井并完成点名。", successResult: "北三号勘探队撤离记录" },
  }),
  route({
    routeKey: "coast_medicine_escort",
    regionId: "region_salt_mirror_coast",
    sceneType: "commission",
    title: "盐镜海岸药品护送",
    premise: "潮汐诊所急需一箱冷藏药剂，护送员槐舟准备沿白盐堤送货，药箱必须在温度封签有效时交到诊所。",
    objects: [
      { id: "location_white_salt_causeway", type: "location", label: "白盐堤", primary: true, tags: ["commission", "escort"] },
      { id: "npc_escort_huaizhou", type: "npc", label: "护送员槐舟", participant: true },
      { id: "organization_tide_clinic", type: "organization", label: "潮汐诊所" },
      { id: "container_chilled_medicine", type: "container", label: "冷藏药剂箱" },
    ],
    actions: [
      { optionKey: "escort_chilled_medicine", label: "与槐舟护送冷藏药剂箱穿过白盐堤", intent: "按潮位标记行进，途中核验温度封签，直接交付潮汐诊所。", risk: "medium", allowedEffectKinds: PROGRESS, targetObjectIds: ["npc_escort_huaizhou", "container_chilled_medicine", "organization_tide_clinic"], outcomeSummary: "身份与槐舟按潮位标记穿过白盐堤，两次核验冷藏药剂箱的温度封签，并在封签有效时把药箱交给潮汐诊所。", completesMission: true, chapterTitle: "护送冷藏药剂", actionNarrative: "你和槐舟抬起冷藏药剂箱，沿白盐堤的潮位标记前进，并在中途复核封签。" },
      { optionKey: "repair_medicine_cooler", label: "为槐舟更换药剂箱冷却芯后继续护送", intent: "在堤上补给点更换冷却芯，复核温度后继续交付。", risk: "low", allowedEffectKinds: PROGRESS, targetObjectIds: ["npc_escort_huaizhou", "container_chilled_medicine", "organization_tide_clinic"], outcomeSummary: "身份在补给点为药剂箱更换冷却芯，温度恢复合格后与槐舟完成剩余路程；潮汐诊所签收了药箱。", completesMission: true, chapterTitle: "更换冷却芯", actionNarrative: "你在堤上补给点拆下耗尽的冷却芯，换上备用件并等到温度读数恢复。" },
      { optionKey: "return_medicine_to_depot", label: "与槐舟把药剂箱退回海岸补给站", intent: "不冒险越过错误潮位，把药箱退回补给站保管。", risk: "low", allowedEffectKinds: ["journey_progress"], targetObjectIds: ["npc_escort_huaizhou", "container_chilled_medicine"], outcomeSummary: "身份与槐舟把冷藏药剂箱退回海岸补给站；药品没有损坏，但本次交付没有完成。", completesMission: false, chapterTitle: "退回药箱", actionNarrative: "你和槐舟停止前进，把冷藏药剂箱送回海岸补给站。" },
    ],
    safeFallbackOptionKey: "return_medicine_to_depot",
    mission: { briefing: "潮汐诊所正在等待温度封签仍有效的冷藏药剂。", primaryObjective: "护送冷藏药剂箱穿过白盐堤并交给潮汐诊所。", completionCriteria: "潮汐诊所在温度封签有效时完成签收。", successResult: "潮汐诊所药品签收单" },
  }),
  route({
    routeKey: "greenhouse_sample_containment",
    regionId: "region_probability_greenhouse",
    sceneType: "world_event",
    title: "概率温室样本收容",
    premise: "概率温室的分枝藤样本突破培养槽，管理员阮禾封闭了东区，需要把主根引回收容框并恢复环境锁。",
    objects: [
      { id: "location_greenhouse_east_wing", type: "location", label: "概率温室东区", primary: true, tags: ["world_event", "containment"] },
      { id: "npc_greenhouse_keeper_ruanhe", type: "npc", label: "管理员阮禾", participant: true },
      { id: "organism_branching_vine", type: "organism", label: "分枝藤样本" },
      { id: "device_probability_frame", type: "device", label: "概率收容框" },
    ],
    actions: [
      { optionKey: "contain_branching_vine", label: "协助阮禾把分枝藤样本引回概率收容框", intent: "关闭侧向光源，按阮禾标记的顺序收拢主根并锁定收容框。", risk: "high", allowedEffectKinds: PROGRESS, targetObjectIds: ["npc_greenhouse_keeper_ruanhe", "organism_branching_vine", "device_probability_frame"], outcomeSummary: "身份关闭侧向光源，按阮禾标记的顺序收拢分枝藤主根，并在样本进入概率收容框后恢复环境锁；温室东区解除封闭。", completesMission: true, chapterTitle: "收容分枝藤", actionNarrative: "你先关闭侧向光源，再按阮禾标出的次序收拢分枝藤的主根。" },
      { optionKey: "seal_greenhouse_growth_nodes", label: "与阮禾封闭分枝藤的三个生长节点", intent: "不移动主根，先封闭扩散节点并恢复东区环境隔离。", risk: "medium", allowedEffectKinds: PROGRESS_AND_CLUE, targetObjectIds: ["npc_greenhouse_keeper_ruanhe", "organism_branching_vine", "location_greenhouse_east_wing"], outcomeSummary: "身份与阮禾依次封闭三个生长节点，分枝藤停止向外扩展；东区环境隔离恢复，样本进入后续收容流程。", completesMission: true, chapterTitle: "封闭生长节点", actionNarrative: "你跟着阮禾逐一找到三个生长节点，用隔离罩截断继续扩展的枝条。" },
      { optionKey: "leave_greenhouse_lockdown", label: "服从阮禾指令退出温室东区", intent: "不在缺少防护时接近样本，保持东区封闭。", risk: "low", allowedEffectKinds: ["journey_progress"], targetObjectIds: ["npc_greenhouse_keeper_ruanhe", "location_greenhouse_east_wing"], outcomeSummary: "身份服从阮禾的撤离指令退出东区，封锁继续维持；分枝藤收容任务没有完成。", completesMission: false, chapterTitle: "退出封锁区", actionNarrative: "你按照阮禾的指令退出东区，并在隔离门外等待。" },
    ],
    safeFallbackOptionKey: "leave_greenhouse_lockdown",
    mission: { briefing: "失控的分枝藤样本正在占据概率温室东区。", primaryObjective: "收容分枝藤主根或封闭全部生长节点，使东区恢复隔离。", completionCriteria: "样本进入收容框，或三个生长节点全部封闭。", successResult: "概率温室东区解除封闭记录" },
  }),
  route({
    routeKey: "data_tower_relay_repair",
    regionId: "region_data_tower",
    sceneType: "commission",
    title: "废弃数据塔中继修复",
    premise: "拾波站与外界失联，工程师索零确定故障位于数据塔第七码中继层，需要更换烧毁的耦合器并恢复测试信号。",
    objects: [
      { id: "location_data_tower_relay_seven", type: "location", label: "第七码中继层", primary: true, tags: ["commission", "repair"] },
      { id: "npc_engineer_suoling", type: "npc", label: "工程师索零", participant: true },
      { id: "device_burned_coupler", type: "device", label: "烧毁的信号耦合器" },
      { id: "organization_wave_station", type: "organization", label: "拾波站" },
    ],
    actions: [
      { optionKey: "repair_relay_coupler", label: "协助索零更换信号耦合器并恢复中继", intent: "切断中继层电源，更换耦合器，再用拾波站测试码验证链路。", risk: "medium", allowedEffectKinds: PROGRESS, targetObjectIds: ["npc_engineer_suoling", "device_burned_coupler", "organization_wave_station"], outcomeSummary: "身份协助索零切断电源并更换烧毁的信号耦合器；重启后，第七码中继层收到拾波站测试码，通信链路恢复。", completesMission: true, chapterTitle: "修复数据中继", actionNarrative: "你协助索零切断电源，拆下烧毁的耦合器，装好替换件后重新接通信号线。" },
      { optionKey: "bypass_relay_layer", label: "与索零架设临时旁路线连接拾波站", intent: "绕过损坏耦合器建立低带宽旁路线，并验证测试码。", risk: "low", allowedEffectKinds: PROGRESS, targetObjectIds: ["npc_engineer_suoling", "location_data_tower_relay_seven", "organization_wave_station"], outcomeSummary: "身份与索零架设临时旁路线，拾波站成功收发低带宽测试码；正式耦合器仍待更换，但通信已经恢复。", completesMission: true, chapterTitle: "架设旁路线", actionNarrative: "你和索零沿中继架铺开旁路线，把拾波站信号绕过损坏的耦合器。" },
      { optionKey: "leave_relay_offline", label: "记录故障位置后离开第七码中继层", intent: "不在无法断电时拆卸设备，只留下故障定位记录。", risk: "low", allowedEffectKinds: PROGRESS_AND_CLUE, targetObjectIds: ["npc_engineer_suoling", "location_data_tower_relay_seven"], outcomeSummary: "身份与索零记录了故障位置后离开中继层；通信链路仍未恢复，修复任务没有完成。", completesMission: false, chapterTitle: "保留故障记录", actionNarrative: "你把耦合器故障位置写入检修表，随后与索零离开中继层。" },
    ],
    safeFallbackOptionKey: "leave_relay_offline",
    mission: { briefing: "拾波站因第七码中继层故障而与外界失联。", primaryObjective: "修复或绕过损坏的信号耦合器，恢复拾波站通信。", completionCriteria: "拾波站成功收发测试码。", successResult: "拾波站链路恢复记录" },
  }),
  route({
    routeKey: "starship_core_salvage",
    regionId: "region_starship_graveyard",
    sceneType: "discovery",
    title: "星舰墓场动力芯打捞",
    premise: "打捞队在沉默号残骸里定位到一枚尚可回收的辅助动力芯，队长骆砂需要有人解除固定栓并完成封存。",
    objects: [
      { id: "location_silent_wreck_engine_room", type: "location", label: "沉默号残骸动力舱", primary: true, tags: ["discovery", "salvage"] },
      { id: "npc_salvage_captain_luosha", type: "npc", label: "打捞队长骆砂", participant: true },
      { id: "device_auxiliary_power_core", type: "device", label: "辅助动力芯" },
      { id: "container_shielded_salvage_case", type: "container", label: "屏蔽打捞箱" },
    ],
    actions: [
      { optionKey: "salvage_auxiliary_core", label: "协助骆砂拆取辅助动力芯并装入屏蔽箱", intent: "确认残余电压归零，按对角顺序解除固定栓，立即完成屏蔽封存。", risk: "high", allowedEffectKinds: PROGRESS_AND_CLUE, targetObjectIds: ["npc_salvage_captain_luosha", "device_auxiliary_power_core", "container_shielded_salvage_case"], outcomeSummary: "身份确认残余电压归零，按对角顺序解除四枚固定栓，与骆砂把辅助动力芯装入屏蔽打捞箱并完成封存编号。", completesMission: true, chapterTitle: "拆取动力芯", actionNarrative: "你确认残余电压归零后，按对角顺序松开固定栓，与骆砂共同托住动力芯。" },
      { optionKey: "recover_core_control_module", label: "从动力舱回收辅助动力芯控制模块", intent: "在主芯无法安全拆取时，断开控制模块并装入证物袋。", risk: "medium", allowedEffectKinds: PROGRESS_AND_CLUE, targetObjectIds: ["npc_salvage_captain_luosha", "device_auxiliary_power_core", "location_silent_wreck_engine_room"], outcomeSummary: "身份在骆砂监护下断开辅助动力芯控制模块，将模块装袋并记录残骸舱位；打捞队取得了可复用的控制部件。", completesMission: true, chapterTitle: "回收控制模块", actionNarrative: "你没有强拆主芯，而是断开侧面的控制模块，将接口封好后装入证物袋。" },
      { optionKey: "abandon_unsafe_salvage", label: "标记动力舱风险后放弃本次打捞", intent: "不在残余电压异常时拆取设备，只保留舱位标记。", risk: "low", allowedEffectKinds: PROGRESS_AND_CLUE, targetObjectIds: ["npc_salvage_captain_luosha", "location_silent_wreck_engine_room"], outcomeSummary: "身份与骆砂标记了动力舱风险后撤离，没有拆取动力芯或控制模块；本次打捞任务未完成。", completesMission: false, chapterTitle: "放弃危险打捞", actionNarrative: "你和骆砂在舱门留下风险标记，随后退出沉默号动力舱。" },
    ],
    safeFallbackOptionKey: "abandon_unsafe_salvage",
    mission: { briefing: "沉默号残骸内有一枚可回收的辅助动力芯。", primaryObjective: "安全拆取辅助动力芯或其控制模块，完成编号封存。", completionCriteria: "动力芯装入屏蔽箱，或控制模块完成装袋登记。", successResult: "沉默号打捞封存单" },
  }),
  route({
    routeKey: "subway_passage_clearance",
    regionId: "region_abandoned_subway",
    sceneType: "commission",
    title: "废弃地铁通道清障",
    premise: "旧环线救援通道被塌落护板堵住，巡线员周砾需要恢复一条能让担架通过的安全通道。",
    objects: [
      { id: "location_subway_old_ring_tunnel", type: "location", label: "旧环线救援通道", primary: true, tags: ["commission", "clearance"] },
      { id: "npc_line_patroller_zhouli", type: "npc", label: "巡线员周砾", participant: true },
      { id: "obstacle_collapsed_panels", type: "obstacle", label: "塌落护板" },
      { id: "device_tunnel_beacon", type: "device", label: "隧道信标" },
    ],
    actions: [
      { optionKey: "clear_subway_passage", label: "与周砾移除塌落护板并恢复救援通道", intent: "先支撑上方结构，再分段切割护板，最后用担架尺寸模板复核通道。", risk: "high", allowedEffectKinds: PROGRESS, targetObjectIds: ["npc_line_patroller_zhouli", "obstacle_collapsed_panels", "location_subway_old_ring_tunnel"], outcomeSummary: "身份与周砾架好临时支撑，分段移除塌落护板，并用担架尺寸模板通过全段；旧环线救援通道恢复开放。", completesMission: true, chapterTitle: "清理救援通道", actionNarrative: "你和周砾先撑住上方结构，再把塌落护板分段切开并移出通道。" },
      { optionKey: "install_subway_detour_beacons", label: "与周砾架设绕行信标开通备用通道", intent: "封闭塌落区，在已勘测的侧道连续架设信标。", risk: "medium", allowedEffectKinds: PROGRESS, targetObjectIds: ["npc_line_patroller_zhouli", "device_tunnel_beacon", "location_subway_old_ring_tunnel"], outcomeSummary: "身份与周砾封闭塌落区，在侧道架设连续隧道信标；担架尺寸模板顺利通过备用通道。", completesMission: true, chapterTitle: "架设绕行信标", actionNarrative: "你跟着周砾进入侧道，每隔一段距离固定一枚隧道信标。" },
      { optionKey: "close_subway_passage", label: "协助周砾封闭旧环线救援通道", intent: "在结构持续落灰时停止清障，设立封闭标志。", risk: "low", allowedEffectKinds: ["journey_progress"], targetObjectIds: ["npc_line_patroller_zhouli", "location_subway_old_ring_tunnel"], outcomeSummary: "身份协助周砾封闭旧环线救援通道；没有形成可通行路线，清障任务未完成。", completesMission: false, chapterTitle: "封闭通道", actionNarrative: "你和周砾停止清障，在旧环线救援通道两端设下封闭标志。" },
    ],
    safeFallbackOptionKey: "close_subway_passage",
    mission: { briefing: "旧环线缺少一条能让担架通过的救援路线。", primaryObjective: "清除塌落护板或开通备用通道，恢复担架通行。", completionCriteria: "担架尺寸模板完整通过已标记路线。", successResult: "旧环线救援通道验收记录" },
  }),
  route({
    routeKey: "trench_anomaly_survey",
    regionId: "region_trench",
    sceneType: "discovery",
    title: "深沟异常勘测",
    premise: "深沟东壁出现周期性蓝光，测绘员海珀需要在三个固定点取得同步读数，确认蓝光源的位置。",
    objects: [
      { id: "location_trench_east_wall", type: "location", label: "深沟东壁观测线", primary: true, tags: ["discovery", "survey"] },
      { id: "npc_surveyor_haipo", type: "npc", label: "测绘员海珀", participant: true },
      { id: "anomaly_blue_pulse", type: "anomaly", label: "周期性蓝光源" },
      { id: "device_trench_rangefinder", type: "device", label: "深沟测距仪" },
    ],
    actions: [
      { optionKey: "triangulate_blue_pulse", label: "协助海珀从三个固定点测定蓝光源", intent: "按同步时标记录方位和距离，不离开已固定的观测线。", risk: "medium", allowedEffectKinds: PROGRESS_AND_CLUE, targetObjectIds: ["npc_surveyor_haipo", "anomaly_blue_pulse", "device_trench_rangefinder"], outcomeSummary: "身份与海珀在三个固定点取得同步方位和距离读数，完成三角定位；周期性蓝光源的位置被标进深沟东壁测绘图。", completesMission: true, chapterTitle: "三点定位蓝光", actionNarrative: "你携带测距仪依次到达三个固定点，按照海珀的时标记录蓝光方位和距离。" },
      { optionKey: "recover_trench_sensor", label: "为海珀回收蓝光源附近的旧测量传感器", intent: "沿安全绳抵达已标记位置，取回传感器并保留本地读数。", risk: "high", allowedEffectKinds: PROGRESS_AND_CLUE, targetObjectIds: ["npc_surveyor_haipo", "anomaly_blue_pulse", "device_trench_rangefinder"], outcomeSummary: "身份沿安全绳到达标记位置，回收旧测量传感器并保留其中的连续读数；海珀据此确认了蓝光源的活动周期。", completesMission: true, chapterTitle: "回收测量传感器", actionNarrative: "你扣好安全绳下降到标记点，拆下旧测量传感器并封存它的本地读数。" },
      { optionKey: "end_trench_survey", label: "与海珀结束东壁观测并撤回", intent: "在测距仪无法同步时结束观测，不伪造定位结果。", risk: "low", allowedEffectKinds: ["journey_progress"], targetObjectIds: ["npc_surveyor_haipo", "location_trench_east_wall"], outcomeSummary: "身份与海珀结束观测并撤回；没有取得三点同步数据，也没有完成蓝光源定位。", completesMission: false, chapterTitle: "结束观测", actionNarrative: "你收起测距仪，与海珀沿观测线撤回。" },
    ],
    safeFallbackOptionKey: "end_trench_survey",
    mission: { briefing: "深沟东壁的周期性蓝光仍没有精确位置记录。", primaryObjective: "通过三点读数或旧传感器数据确认蓝光源的位置与周期。", completionCriteria: "蓝光源位置进入测绘图，或活动周期得到连续数据支持。", successResult: "深沟蓝光勘测记录" },
  }),
  route({
    routeKey: "glass_archive_restoration",
    regionId: "region_glass_archive",
    sceneType: "livelihood",
    title: "玻璃档案页修复",
    premise: "玻璃档案馆的一页航路档案出现裂纹，修复师闻笙需要助手完成清洁、拼合与光谱复核。",
    objects: [
      { id: "location_glass_archive_restoration_room", type: "workplace", label: "玻璃档案修复室", primary: true, tags: ["livelihood", "restoration"] },
      { id: "npc_restorer_wensheng", type: "npc", label: "修复师闻笙", participant: true },
      { id: "document_cracked_route_page", type: "document", label: "裂纹航路档案页" },
      { id: "device_spectral_table", type: "device", label: "光谱复核台" },
    ],
    actions: [
      { optionKey: "restore_cracked_archive_page", label: "协助闻笙修复裂纹航路档案页", intent: "依次完成无尘清洁、边缘拼合和光谱复核，不补写缺失内容。", risk: "medium", allowedEffectKinds: PROGRESS_AND_CLUE, targetObjectIds: ["npc_restorer_wensheng", "document_cracked_route_page", "device_spectral_table"], outcomeSummary: "身份完成无尘清洁并协助闻笙拼合裂纹边缘；光谱复核显示原有航路线连续，修复页被重新编号归档。", completesMission: true, chapterTitle: "修复航路档案", actionNarrative: "你先清除档案页表面的微尘，再与闻笙逐段对齐裂纹边缘。" },
      { optionKey: "digitize_archive_fragments", label: "在光谱复核台扫描裂纹档案碎片", intent: "保持碎片原位，逐片扫描并建立可复核的数字拼图。", risk: "low", allowedEffectKinds: PROGRESS_AND_CLUE, targetObjectIds: ["npc_restorer_wensheng", "document_cracked_route_page", "device_spectral_table"], outcomeSummary: "身份逐片扫描裂纹档案碎片，建立了边缘可对照的数字拼图；闻笙将数据登记为后续实体修复依据。", completesMission: true, chapterTitle: "扫描档案碎片", actionNarrative: "你把每块档案碎片固定在光谱复核台上，依次完成扫描和边缘编号。" },
      { optionKey: "leave_archive_page_unrestored", label: "封存裂纹档案页并结束修复", intent: "在材料状态不稳时封存原件，不强行拼合。", risk: "low", allowedEffectKinds: ["journey_progress"], targetObjectIds: ["npc_restorer_wensheng", "document_cracked_route_page"], outcomeSummary: "身份与闻笙把裂纹档案页重新封存；原件没有进一步受损，但本次修复任务没有完成。", completesMission: false, chapterTitle: "重新封存档案", actionNarrative: "你和闻笙把裂纹档案页放回封存盒，没有继续拼合。" },
    ],
    safeFallbackOptionKey: "leave_archive_page_unrestored",
    mission: { briefing: "一页裂纹航路档案需要在玻璃档案馆完成修复或数字化。", primaryObjective: "修复裂纹航路档案页，或建立完整的数字拼图。", completionCriteria: "修复页重新归档，或数字拼图登记为修复依据。", successResult: "航路档案修复记录" },
  }),
  route({
    routeKey: "moonwell_lumen_sampling",
    regionId: "region_moonwell_hollow",
    sceneType: "discovery",
    title: "月井微光样本采集",
    premise: "月井空壳底部出现新的微光沉积层，采样员唐雾需要在不混入上层粉尘的情况下取得三管分层样本。",
    objects: [
      { id: "location_moonwell_lower_ring", type: "location", label: "月井下环采样台", primary: true, tags: ["discovery", "sampling"] },
      { id: "npc_sampler_tangwu", type: "npc", label: "采样员唐雾", participant: true },
      { id: "resource_lumen_sediment", type: "resource_node", label: "微光沉积层" },
      { id: "container_layered_sample_tubes", type: "container", label: "分层采样管" },
    ],
    actions: [
      { optionKey: "collect_lumen_samples", label: "协助唐雾采集三管微光沉积样本", intent: "从下至上依次取样，每管单独封口并记录深度。", risk: "medium", allowedEffectKinds: PROGRESS_AND_CLUE, targetObjectIds: ["npc_sampler_tangwu", "resource_lumen_sediment", "container_layered_sample_tubes"], outcomeSummary: "身份按深度从下至上取得三管微光沉积样本，逐管封口并记录采样深度；唐雾核对后完成样本入箱。", completesMission: true, chapterTitle: "采集微光样本", actionNarrative: "你把采样管伸入下层沉积，从最深处开始逐管取样并立即封口。" },
      { optionKey: "map_lumen_layers", label: "与唐雾测绘微光沉积层边界", intent: "不取走样本，沿下环标记厚度变化并提交分层图。", risk: "low", allowedEffectKinds: PROGRESS_AND_CLUE, targetObjectIds: ["npc_sampler_tangwu", "resource_lumen_sediment", "location_moonwell_lower_ring"], outcomeSummary: "身份与唐雾沿下环标记沉积厚度，完成一张连续分层图；新的微光沉积边界进入月井采样记录。", completesMission: true, chapterTitle: "测绘沉积边界", actionNarrative: "你沿下环采样台逐点读取沉积厚度，唐雾在分层图上连接每个标记。" },
      { optionKey: "stop_moonwell_sampling", label: "封好采样管并退出月井下环", intent: "在粉尘封闭失效时停止采样，不提交受污染样本。", risk: "low", allowedEffectKinds: ["journey_progress"], targetObjectIds: ["npc_sampler_tangwu", "container_layered_sample_tubes"], outcomeSummary: "身份与唐雾停止采样并退出下环；没有提交受污染样本，但三管采样任务未完成。", completesMission: false, chapterTitle: "停止采样", actionNarrative: "你封好尚未使用的采样管，与唐雾退出月井下环。" },
    ],
    safeFallbackOptionKey: "stop_moonwell_sampling",
    mission: { briefing: "月井下环出现一层尚未记录的微光沉积。", primaryObjective: "取得三管分层样本，或完成连续沉积边界图。", completionCriteria: "三管样本完成封存入箱，或分层图进入采样记录。", successResult: "月井微光沉积记录" },
  }),
  route({
    routeKey: "cave_exit_mapping",
    regionId: "region_non_euclidean_cave",
    sceneType: "discovery",
    title: "非欧洞穴出口测绘",
    premise: "非欧洞穴的旧救援路线发生折返错位，领路员祝遥需要用三枚定向锚重新确认一条可重复通过的出口路线。",
    objects: [
      { id: "location_cave_folded_gallery", type: "location", label: "折叠回廊", primary: true, tags: ["discovery", "mapping"] },
      { id: "npc_pathfinder_zhuyao", type: "npc", label: "领路员祝遥", participant: true },
      { id: "device_directional_anchors", type: "device", label: "三枚定向锚" },
      { id: "route_cave_rescue_exit", type: "route", label: "洞穴救援出口线" },
    ],
    actions: [
      { optionKey: "map_cave_exit", label: "与祝遥布设定向锚并测通救援出口线", intent: "每通过一个折返节点就固定一枚锚，完成往返验证后再提交路线。", risk: "high", allowedEffectKinds: PROGRESS_AND_CLUE, targetObjectIds: ["npc_pathfinder_zhuyao", "device_directional_anchors", "route_cave_rescue_exit"], outcomeSummary: "身份与祝遥在三个折返节点固定定向锚，沿标记路线抵达出口并原路返回；洞穴救援出口线通过往返验证。", completesMission: true, chapterTitle: "测通洞穴出口", actionNarrative: "你跟着祝遥穿过折叠回廊，在每个折返节点固定一枚定向锚。" },
      { optionKey: "recover_lost_cave_anchor", label: "为祝遥找回失联的第三枚定向锚", intent: "沿前两枚锚的稳定区间搜索，只记录可重复的转向。", risk: "medium", allowedEffectKinds: PROGRESS_AND_CLUE, targetObjectIds: ["npc_pathfinder_zhuyao", "device_directional_anchors", "location_cave_folded_gallery"], outcomeSummary: "身份沿前两枚定向锚的稳定区间找到失联的第三枚锚，并记录它与出口之间的重复转向；祝遥据此补全救援出口线。", completesMission: true, chapterTitle: "找回定向锚", actionNarrative: "你以第二枚锚为起点反复验证转向，最终在稳定区间末端找到失联锚。" },
      { optionKey: "retreat_from_folded_gallery", label: "与祝遥沿现有锚点退出折叠回廊", intent: "不越过最后一个稳定锚点，保留现有路线记录。", risk: "low", allowedEffectKinds: ["journey_progress"], targetObjectIds: ["npc_pathfinder_zhuyao", "device_directional_anchors"], outcomeSummary: "身份与祝遥沿现有锚点退出折叠回廊；没有确认新的出口路线，本次测绘任务未完成。", completesMission: false, chapterTitle: "退出折叠回廊", actionNarrative: "你和祝遥不再越过最后一个稳定锚点，沿现有标记退出回廊。" },
    ],
    safeFallbackOptionKey: "retreat_from_folded_gallery",
    mission: { briefing: "非欧洞穴缺少一条经过往返验证的救援出口线。", primaryObjective: "布设定向锚测通出口，或找回失联锚补全路线。", completionCriteria: "出口线通过往返验证，或缺失转向得到稳定锚支持。", successResult: "洞穴救援出口线测绘记录" },
  }),
  route({
    routeKey: "pipe_city_filter_repair",
    regionId: "region_city_pipes",
    sceneType: "health",
    title: "管城净水阀修复",
    premise: "管城第六滤水段检出污染回流，维护员简澜需要关闭回流阀、更换滤芯并完成两次水样复核。",
    objects: [
      { id: "location_pipe_city_filter_six", type: "clinic", label: "第六滤水段", primary: true, tags: ["health", "repair"] },
      { id: "npc_maintenance_jianlan", type: "npc", label: "维护员简澜", participant: true },
      { id: "device_backflow_valve", type: "device", label: "污染回流阀" },
      { id: "device_filter_cartridge", type: "device", label: "净水滤芯" },
    ],
    actions: [
      { optionKey: "repair_water_filter", label: "协助简澜关闭回流阀并更换净水滤芯", intent: "先隔离第六段，再关闭回流阀、更换滤芯并连续检测两份水样。", risk: "medium", allowedEffectKinds: PROGRESS, targetObjectIds: ["npc_maintenance_jianlan", "device_backflow_valve", "device_filter_cartridge"], outcomeSummary: "身份协助简澜隔离第六滤水段，关闭污染回流阀并更换净水滤芯；连续两份水样通过复核，第六段恢复供水。", completesMission: true, chapterTitle: "修复滤水段", actionNarrative: "你和简澜先隔离第六滤水段，再关闭回流阀，拆下旧滤芯换上新件。" },
      { optionKey: "flush_pipe_section", label: "与简澜冲洗第六滤水段并复核水样", intent: "保持回流阀关闭，完成规定时长冲洗并取得两份合格水样。", risk: "low", allowedEffectKinds: PROGRESS, targetObjectIds: ["npc_maintenance_jianlan", "device_backflow_valve", "location_pipe_city_filter_six"], outcomeSummary: "身份与简澜保持回流阀关闭，完成整段冲洗；冲洗后的两份水样通过复核，第六滤水段恢复供水。", completesMission: true, chapterTitle: "冲洗滤水段", actionNarrative: "你保持回流阀关闭，按简澜的计时冲洗整段管路，再分别装取两份水样。" },
      { optionKey: "keep_filter_section_closed", label: "协助简澜维持第六滤水段停供", intent: "在无法取得合格水样时维持隔离，不恢复供水。", risk: "low", allowedEffectKinds: ["journey_progress"], targetObjectIds: ["npc_maintenance_jianlan", "location_pipe_city_filter_six"], outcomeSummary: "身份协助简澜维持第六滤水段隔离；污染没有进入供水网，但滤水段未能恢复，修复任务没有完成。", completesMission: false, chapterTitle: "维持停供", actionNarrative: "你和简澜保持隔离阀锁定，没有让第六滤水段重新供水。" },
    ],
    safeFallbackOptionKey: "keep_filter_section_closed",
    mission: { briefing: "管城第六滤水段因污染回流而停止供水。", primaryObjective: "关闭污染回流并完成滤芯更换或管段冲洗，使水样复核合格。", completionCriteria: "连续两份水样通过复核并恢复供水。", successResult: "第六滤水段水样复核单" },
  }),
  route({
    routeKey: "prism_buoy_calibration",
    regionId: "region_prism_waters",
    sceneType: "commission",
    title: "棱镜水域导航浮标校准",
    premise: "棱镜水域的三号导航浮标发生光谱偏移，船务员鹿汐需要在下一班船到达前恢复正确航向光。",
    objects: [
      { id: "location_prism_buoy_three", type: "location", label: "三号导航浮标平台", primary: true, tags: ["commission", "calibration"] },
      { id: "npc_boatmaster_luxi", type: "npc", label: "船务员鹿汐", participant: true },
      { id: "device_prism_beacon", type: "device", label: "棱镜航向灯" },
      { id: "device_spectral_calibrator", type: "device", label: "光谱校准器" },
    ],
    actions: [
      { optionKey: "calibrate_prism_buoy", label: "协助鹿汐校准三号浮标的棱镜航向灯", intent: "锁定浮标平台，用校准器逐色修正航向灯并完成岸基回读。", risk: "medium", allowedEffectKinds: PROGRESS, targetObjectIds: ["npc_boatmaster_luxi", "device_prism_beacon", "device_spectral_calibrator"], outcomeSummary: "身份协助鹿汐锁定浮标平台，逐色校准棱镜航向灯；岸基回读显示航向光恢复到标准角度，三号浮标重新启用。", completesMission: true, chapterTitle: "校准导航浮标", actionNarrative: "你固定好光谱校准器，按鹿汐报出的顺序逐色调整棱镜航向灯。" },
      { optionKey: "replace_buoy_prism", label: "与鹿汐更换三号浮标的偏移棱镜片", intent: "拆下偏移棱镜片，安装备件并完成岸基回读。", risk: "high", allowedEffectKinds: PROGRESS, targetObjectIds: ["npc_boatmaster_luxi", "device_prism_beacon", "location_prism_buoy_three"], outcomeSummary: "身份与鹿汐拆下偏移棱镜片并安装备件；岸基回读确认航向光准确，三号浮标重新启用。", completesMission: true, chapterTitle: "更换棱镜片", actionNarrative: "你扶稳灯架，鹿汐解除旧棱镜片固定，你随后装上备件并重新锁紧。" },
      { optionKey: "mark_buoy_offline", label: "与鹿汐把三号浮标标记为停用", intent: "在平台不稳时关闭航向灯并发布停用标记。", risk: "low", allowedEffectKinds: ["journey_progress"], targetObjectIds: ["npc_boatmaster_luxi", "location_prism_buoy_three"], outcomeSummary: "身份与鹿汐关闭三号浮标并发布停用标记；误导航风险被隔离，但浮标校准任务没有完成。", completesMission: false, chapterTitle: "标记浮标停用", actionNarrative: "你和鹿汐关闭航向灯，把三号浮标状态改为停用。" },
    ],
    safeFallbackOptionKey: "mark_buoy_offline",
    mission: { briefing: "三号导航浮标无法提供准确的棱镜航向光。", primaryObjective: "校准航向灯或更换偏移棱镜片，使三号浮标恢复导航。", completionCriteria: "岸基回读确认航向光达到标准角度。", successResult: "三号导航浮标复航记录" },
  }),
  route({
    routeKey: "ash_outpost_convoy_guard",
    regionId: "region_ash_outpost",
    sceneType: "conflict",
    title: "灰烬哨站补给车护卫",
    premise: "灰烬哨站的净水滤料即将耗尽，车队长闻拓需要护送两辆补给车穿过落灰峡道并完成哨站交接。",
    objects: [
      { id: "location_ashfall_pass", type: "location", label: "落灰峡道", primary: true, tags: ["conflict", "escort"] },
      { id: "npc_convoy_leader_wentuo", type: "npc", label: "车队长闻拓", participant: true },
      { id: "vehicle_water_filter_convoy", type: "vehicle", label: "净水滤料补给车" },
      { id: "organization_ash_outpost", type: "organization", label: "灰烬哨站" },
    ],
    actions: [
      { optionKey: "escort_ash_convoy", label: "协助闻拓护送净水滤料补给车穿过落灰峡道", intent: "在前后车之间巡查，清理落石并按哨声收拢车距。", risk: "high", allowedEffectKinds: PROGRESS, targetObjectIds: ["npc_convoy_leader_wentuo", "vehicle_water_filter_convoy", "organization_ash_outpost"], outcomeSummary: "身份在两辆补给车之间巡查，与闻拓清理两处落石并收拢车距；车队完整穿过落灰峡道，灰烬哨站完成净水滤料交接。", completesMission: true, chapterTitle: "护送补给车", actionNarrative: "你在两辆补给车之间往返巡查，发现落石后与闻拓先清出一条车轮宽的通道。" },
      { optionKey: "scout_ash_convoy_route", label: "为闻拓勘查落灰峡道并引导车队绕开塌段", intent: "提前标记可通行路面，再用哨声引导车队通过绕行段。", risk: "medium", allowedEffectKinds: PROGRESS_AND_CLUE, targetObjectIds: ["npc_convoy_leader_wentuo", "vehicle_water_filter_convoy", "location_ashfall_pass"], outcomeSummary: "身份提前勘查落灰峡道，标出一处塌段并找到可通行绕线；闻拓按标记带领两辆补给车抵达灰烬哨站。", completesMission: true, chapterTitle: "勘查峡道", actionNarrative: "你先于车队进入峡道，标出塌段边界，再沿稳定路面留下连续路标。" },
      { optionKey: "return_ash_convoy_to_depot", label: "与闻拓把补给车撤回起点", intent: "在峡道无法通过时保持车队完整撤回，不虚构交接。", risk: "low", allowedEffectKinds: ["journey_progress"], targetObjectIds: ["npc_convoy_leader_wentuo", "vehicle_water_filter_convoy"], outcomeSummary: "身份与闻拓把两辆补给车完整撤回起点；滤料没有损失，但灰烬哨站交接任务没有完成。", completesMission: false, chapterTitle: "车队撤回", actionNarrative: "你协助闻拓调转车队，两辆补给车沿原路撤回起点。" },
    ],
    safeFallbackOptionKey: "return_ash_convoy_to_depot",
    mission: { briefing: "灰烬哨站正在等待两辆净水滤料补给车。", primaryObjective: "护送补给车穿过落灰峡道并完成哨站交接。", completionCriteria: "两辆补给车完整抵达，灰烬哨站签收净水滤料。", successResult: "灰烬哨站补给交接单" },
  }),
  route({
    routeKey: "prophecy_server_verification",
    regionId: "region_prophecy_server",
    sceneType: "discovery",
    title: "预言服务器输出核验",
    premise: "预言服务器连续生成一组时间戳错位的航班输出，审计员迦蓝需要把输出与原始时钟日志逐条对照。",
    objects: [
      { id: "location_prophecy_audit_console", type: "location", label: "预言服务器审计台", primary: true, tags: ["discovery", "audit"] },
      { id: "npc_auditor_jialan", type: "npc", label: "审计员迦蓝", participant: true },
      { id: "document_prophecy_flight_output", type: "document", label: "错位航班输出" },
      { id: "document_clock_origin_log", type: "document", label: "原始时钟日志" },
    ],
    actions: [
      { optionKey: "verify_prophecy_output", label: "协助迦蓝核对航班输出与原始时钟日志", intent: "逐条对齐输出时间戳，只标记能够由原始日志证实的错位。", risk: "low", allowedEffectKinds: PROGRESS_AND_CLUE, targetObjectIds: ["npc_auditor_jialan", "document_prophecy_flight_output", "document_clock_origin_log"], outcomeSummary: "身份与迦蓝逐条对齐航班输出和原始时钟日志，确认七条输出存在固定偏移；偏移量和对应条目进入审计记录。", completesMission: true, chapterTitle: "核验预言输出", actionNarrative: "你把航班输出与原始时钟日志并排展开，逐条对齐时间戳并标出固定偏移。" },
      { optionKey: "replay_prophecy_clock", label: "与迦蓝重放时钟日志定位偏移起点", intent: "在隔离环境重放日志，不修改预言服务器当前状态。", risk: "medium", allowedEffectKinds: PROGRESS_AND_CLUE, targetObjectIds: ["npc_auditor_jialan", "document_clock_origin_log", "location_prophecy_audit_console"], outcomeSummary: "身份与迦蓝在隔离环境重放时钟日志，定位到偏移开始的具体记录点；审计台保存了可复现的重放结果。", completesMission: true, chapterTitle: "重放时钟日志", actionNarrative: "你在隔离审计台加载时钟日志，与迦蓝逐段重放直到偏移首次出现。" },
      { optionKey: "quarantine_prophecy_output", label: "协助迦蓝隔离错位航班输出", intent: "停止分发未核验输出，只保留隔离副本。", risk: "low", allowedEffectKinds: ["journey_progress"], targetObjectIds: ["npc_auditor_jialan", "document_prophecy_flight_output"], outcomeSummary: "身份协助迦蓝隔离错位航班输出；未核验内容停止分发，但偏移原因和范围仍未核实，任务没有完成。", completesMission: false, chapterTitle: "隔离错位输出", actionNarrative: "你把错位航班输出移入隔离区，停止它继续分发。" },
    ],
    safeFallbackOptionKey: "quarantine_prophecy_output",
    mission: { briefing: "预言服务器的航班输出存在未核实的时间戳错位。", primaryObjective: "核对输出与原始日志，确认偏移范围或定位偏移起点。", completionCriteria: "审计记录包含可验证的偏移条目或可复现的起点。", successResult: "预言服务器时间戳审计记录" },
  }),
  route({
    routeKey: "holographic_theater_rehearsal",
    regionId: "region_holographic_theater",
    sceneType: "livelihood",
    title: "全息剧场联排协助",
    premise: "全息剧场晚场联排缺少一名场务，舞台监督苏棠需要有人校准三处投影锚并按提示切换场景。",
    objects: [
      { id: "location_holographic_main_stage", type: "workplace", label: "全息剧场主舞台", primary: true, tags: ["livelihood", "rehearsal"] },
      { id: "npc_stage_manager_sutang", type: "npc", label: "舞台监督苏棠", participant: true },
      { id: "device_projection_anchors", type: "device", label: "三处投影锚" },
      { id: "document_rehearsal_cue_sheet", type: "document", label: "晚场提示单" },
    ],
    actions: [
      { optionKey: "run_holographic_rehearsal", label: "协助苏棠校准投影锚并完成晚场联排", intent: "逐一校准投影锚，严格按晚场提示单切换场景。", risk: "medium", allowedEffectKinds: PROGRESS, targetObjectIds: ["npc_stage_manager_sutang", "device_projection_anchors", "document_rehearsal_cue_sheet"], outcomeSummary: "身份协助苏棠校准三处投影锚，并按晚场提示单完成全部场景切换；联排无中断结束，提示单取得通过标记。", completesMission: true, chapterTitle: "完成晚场联排", actionNarrative: "你逐一校准三处投影锚，随后守在控制台前按苏棠的提示切换场景。" },
      { optionKey: "repair_projection_anchor", label: "与苏棠修复偏移的第三投影锚", intent: "暂停对应场景，更换定位片后重新完成校准测试。", risk: "low", allowedEffectKinds: PROGRESS, targetObjectIds: ["npc_stage_manager_sutang", "device_projection_anchors", "location_holographic_main_stage"], outcomeSummary: "身份与苏棠更换第三投影锚的定位片，重新校准后场景边缘对齐；晚场联排完成剩余段落。", completesMission: true, chapterTitle: "修复投影锚", actionNarrative: "你暂停对应场景，拆下第三投影锚的旧定位片，再装入备件重新校准。" },
      { optionKey: "cancel_rehearsal_assistance", label: "向苏棠交还提示单并退出联排", intent: "在无法准确执行提示时退出控制位，不制造错误切场。", risk: "low", allowedEffectKinds: ["journey_progress"], targetObjectIds: ["npc_stage_manager_sutang", "document_rehearsal_cue_sheet"], outcomeSummary: "身份向苏棠交还晚场提示单并退出控制位；本次联排协助没有完成。", completesMission: false, chapterTitle: "退出联排", actionNarrative: "你把晚场提示单交还苏棠，离开主舞台控制位。" },
    ],
    safeFallbackOptionKey: "cancel_rehearsal_assistance",
    mission: { briefing: "全息剧场需要在晚场前完成一次不中断的联排。", primaryObjective: "校准投影锚并按提示单完成联排，或修复偏移锚后完成剩余段落。", completionCriteria: "晚场提示单取得通过标记。", successResult: "全息剧场联排通过记录" },
  }),
  route({
    routeKey: "salt_gate_caravan_inspection",
    regionId: "region_salt_gate",
    sceneType: "commission",
    title: "盐门商队检验",
    premise: "盐门入城前积压了一支粮食商队，检验员乌青需要核对封签、抽检三车粮袋并签发通行记录。",
    objects: [
      { id: "location_salt_gate_inspection_lane", type: "location", label: "盐门商队检验道", primary: true, tags: ["commission", "inspection"] },
      { id: "npc_inspector_wuqing", type: "npc", label: "检验员乌青", participant: true },
      { id: "vehicle_grain_caravan", type: "vehicle", label: "粮食商队" },
      { id: "document_caravan_seals", type: "document", label: "商队货封" },
    ],
    actions: [
      { optionKey: "inspect_grain_caravan", label: "协助乌青核对商队货封并抽检三车粮袋", intent: "先逐车核对货封编号，再按指定位置抽检粮袋并记录结果。", risk: "low", allowedEffectKinds: PROGRESS_AND_CLUE, targetObjectIds: ["npc_inspector_wuqing", "vehicle_grain_caravan", "document_caravan_seals"], outcomeSummary: "身份协助乌青逐车核对货封编号，并完成三车粮袋抽检；编号与货物相符，乌青签发了盐门通行记录。", completesMission: true, chapterTitle: "检验粮食商队", actionNarrative: "你沿车队逐一核对货封编号，再按乌青指定的位置打开三袋粮食抽检。" },
      { optionKey: "reseal_caravan_cargo", label: "与乌青复核异常货封并重新封签", intent: "隔离编号异常车辆，核对清单后重新封签并记录旧编号。", risk: "medium", allowedEffectKinds: PROGRESS_AND_CLUE, targetObjectIds: ["npc_inspector_wuqing", "document_caravan_seals", "vehicle_grain_caravan"], outcomeSummary: "身份与乌青隔离一辆货封编号异常的粮车，核对清单后重新封签并保留旧编号；商队完成复核后取得通行记录。", completesMission: true, chapterTitle: "复核异常货封", actionNarrative: "你把编号异常的粮车引到侧道，与乌青对照清单并换上新的货封。" },
      { optionKey: "hold_caravan_at_gate", label: "协助乌青暂扣粮食商队等待复检", intent: "在清单无法核实时不签发通行记录，保持货物封存。", risk: "low", allowedEffectKinds: ["journey_progress"], targetObjectIds: ["npc_inspector_wuqing", "vehicle_grain_caravan"], outcomeSummary: "身份协助乌青把粮食商队暂扣在检验道；货物保持封存，但通行记录没有签发，检验任务未完成。", completesMission: false, chapterTitle: "暂扣商队", actionNarrative: "你协助乌青把商队引入等待区，没有签发通行记录。" },
    ],
    safeFallbackOptionKey: "hold_caravan_at_gate",
    mission: { briefing: "一支粮食商队正在盐门等待货封核验与抽检。", primaryObjective: "完成货封核对和粮袋抽检，或复核异常货封后签发通行记录。", completionCriteria: "检验员乌青签发盐门通行记录。", successResult: "粮食商队盐门通行记录" },
  }),
];

const ROUTES_BY_REGION = new Map(JOURNEY_TASK_ROUTES.map((item) => [item.regionId, item]));
const ACTIONS_BY_KEY = new Map(JOURNEY_TASK_ROUTES.flatMap((item) =>
  item.actions.map((action) => [action.optionKey, action] as const)));

export function journeyTaskRoutes(): readonly JourneyTaskRoute[] {
  return JOURNEY_TASK_ROUTES;
}

export function journeyTaskRouteForRegion(regionId: string | undefined): JourneyTaskRoute | undefined {
  return regionId ? ROUTES_BY_REGION.get(regionId) : undefined;
}

export function journeyTaskActionForOptionKey(
  optionKey: string | undefined,
): JourneyTaskActionDefinition | undefined {
  return optionKey ? ACTIONS_BY_KEY.get(optionKey) : undefined;
}

export function isJourneyTaskCompletionAction(optionKey: string | undefined): boolean {
  return journeyTaskActionForOptionKey(optionKey)?.completesMission === true;
}
