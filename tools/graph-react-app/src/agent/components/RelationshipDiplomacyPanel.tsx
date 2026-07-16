import type {
  EpochDiplomacyRecord,
  EpochDiplomacyResponse,
  EpochRelationshipEdge,
  EpochRelationshipKind,
} from "../../types";
import {
  playerAgentLabel,
  playerCommonStatusLabel,
  playerRelationshipKindLabel,
} from "../agentPlayerLabels";

const RELATIONSHIP_OPTIONS: { value: EpochRelationshipKind; label: string }[] = [
  { value: "alliance", label: "结盟" },
  { value: "hostility", label: "敌对" },
  { value: "reputation", label: "声望" },
];

interface RelationshipDiplomacyPanelProps {
  readonly activeIdentityDisabled: boolean;
  readonly currentAgentId?: string;
  readonly diplomacy: readonly EpochDiplomacyRecord[];
  readonly diplomacyResponseFocus: number;
  readonly diplomacyTerms: string;
  readonly epochAssetUrl: (pathOrUrl: string) => string;
  readonly hasExplorer: boolean;
  readonly isBusy: boolean;
  readonly loadDiplomacy: () => void;
  readonly loadRelationships: () => void;
  readonly primaryDiplomacy?: EpochDiplomacyRecord | null;
  readonly primaryRelationship?: EpochRelationshipEdge | null;
  readonly proposeDiplomacy: () => void;
  readonly regionDiplomacy: readonly EpochDiplomacyRecord[];
  readonly relationshipFocus: number;
  readonly relationshipKind: EpochRelationshipKind;
  readonly relationships: readonly EpochRelationshipEdge[];
  readonly relationshipTargetAgentId: string;
  readonly respondDiplomacy: (response: EpochDiplomacyResponse) => void;
  readonly setDiplomacyResponseFocus: (focus: number) => void;
  readonly setDiplomacyTerms: (terms: string) => void;
  readonly setRelationshipFocus: (focus: number) => void;
  readonly setRelationshipKind: (kind: EpochRelationshipKind) => void;
  readonly setRelationshipTargetAgentId: (agentId: string) => void;
  readonly updateRelationship: () => void;
}

export function RelationshipDiplomacyPanel({
  activeIdentityDisabled,
  currentAgentId,
  diplomacy,
  diplomacyResponseFocus,
  diplomacyTerms,
  epochAssetUrl,
  hasExplorer,
  isBusy,
  loadDiplomacy,
  loadRelationships,
  primaryDiplomacy,
  primaryRelationship,
  proposeDiplomacy,
  regionDiplomacy,
  relationshipFocus,
  relationshipKind,
  relationships,
  relationshipTargetAgentId,
  respondDiplomacy,
  setDiplomacyResponseFocus,
  setDiplomacyTerms,
  setRelationshipFocus,
  setRelationshipKind,
  setRelationshipTargetAgentId,
  updateRelationship,
}: RelationshipDiplomacyPanelProps) {
  const visibleDiplomacy = diplomacy.length ? diplomacy : regionDiplomacy;

  return (
    <>
      <article className="agent-panel agent-relationships">
        <div className="agent-panel-head">
          <span>关系图</span>
          <b>{primaryRelationship ? `${playerRelationshipKindLabel(primaryRelationship.kind)} ${primaryRelationship.score}` : "暂无"}</b>
        </div>
        <input value={relationshipTargetAgentId} onChange={(event) => setRelationshipTargetAgentId(event.target.value)} placeholder="目标身份编号" />
        <div className="agent-market-form">
          <select value={relationshipKind} onChange={(event) => setRelationshipKind(event.target.value as EpochRelationshipKind)}>
            {RELATIONSHIP_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <input type="number" min="1" value={relationshipFocus} onChange={(event) => setRelationshipFocus(Math.max(1, Number(event.target.value || 1)))} />
        </div>
        <div className="agent-action-row">
          <button type="button" disabled={isBusy} onClick={loadRelationships}>刷新关系</button>
          <button type="button" disabled={isBusy || activeIdentityDisabled || !relationshipTargetAgentId.trim()} onClick={updateRelationship}>消耗专注点</button>
        </div>
        <div className="agent-mini-list">
          {relationships.slice(0, 4).map((relationship) => (
            <span className={relationship.media ? "agent-relationship-media-row" : undefined} key={relationship.relationshipId}>
              {relationship.media ? (
                <img
                  className="agent-relationship-media-image"
                  src={epochAssetUrl(relationship.media.imageUrl)}
                  alt={relationship.media.publicAlt}
                  loading="lazy"
                />
              ) : null}
              <span>{playerRelationshipKindLabel(relationship.kind)} · {relationship.score > 0 ? "+" : ""}{relationship.score} · {relationship.reason}</span>
            </span>
          ))}
        </div>
        {!relationships.length ? <p>结盟、敌对与声望边会消耗专注点，关系分数只由服务器规则写入。</p> : null}
      </article>

      <article className="agent-panel agent-relationships">
        <div className="agent-panel-head">
          <span>外交链</span>
          <b>{primaryDiplomacy ? playerCommonStatusLabel(primaryDiplomacy.status) : "暂无"}</b>
        </div>
        <input value={diplomacyTerms} onChange={(event) => setDiplomacyTerms(event.target.value)} placeholder="外交条款" />
        <div className="agent-market-form">
          <input type="number" min="1" value={diplomacyResponseFocus} onChange={(event) => setDiplomacyResponseFocus(Math.max(1, Number(event.target.value || 1)))} />
          <button type="button" disabled={isBusy} onClick={loadDiplomacy}>刷新外交</button>
          <button type="button" disabled={isBusy || activeIdentityDisabled || !relationshipTargetAgentId.trim() || !hasExplorer} onClick={proposeDiplomacy}>发起提案</button>
        </div>
        <div className="agent-action-row">
          <button type="button" disabled={isBusy || activeIdentityDisabled || !primaryDiplomacy || primaryDiplomacy.status !== "pending" || primaryDiplomacy.targetAgentId !== currentAgentId} onClick={() => respondDiplomacy("accepted")}>接受</button>
          <button type="button" disabled={isBusy || activeIdentityDisabled || !primaryDiplomacy || primaryDiplomacy.status !== "pending" || primaryDiplomacy.targetAgentId !== currentAgentId} onClick={() => respondDiplomacy("rejected")}>拒绝</button>
        </div>
        <div className="agent-mini-list">
          {visibleDiplomacy.slice(0, 4).map((item) => (
            <span key={item.diplomacyId}>
              {playerRelationshipKindLabel(item.kind)} · {playerCommonStatusLabel(item.status)} · {playerAgentLabel(item.sourceAgentId)} 对 {playerAgentLabel(item.targetAgentId)}
            </span>
          ))}
        </div>
        {!diplomacy.length && !regionDiplomacy.length ? <p>外交链需要双方确认自己的档案，接受后才会写入关系边和区域轨迹。</p> : null}
      </article>
    </>
  );
}
