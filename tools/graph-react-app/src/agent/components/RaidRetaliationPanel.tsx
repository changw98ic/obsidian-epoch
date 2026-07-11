import type {
  EpochRaidResult,
  EpochRetaliationOpportunity,
} from "../../types";
import { playerAgentLabel, playerCommonStatusLabel } from "../agentPlayerLabels";

interface RaidRetaliationPanelProps {
  readonly activeIdentityDisabled: boolean;
  readonly canResolveRegionRevolt: boolean;
  readonly currentAgentId?: string;
  readonly defenderAgentId: string;
  readonly isBusy: boolean;
  readonly loadRaids: () => void;
  readonly primaryRaid?: EpochRaidResult | null;
  readonly primaryRetaliation?: EpochRetaliationOpportunity | null;
  readonly raidStamina: number;
  readonly raids: readonly EpochRaidResult[];
  readonly resolveRaid: () => void;
  readonly resolveRegionRevolt: () => void;
  readonly resolveRetaliation: () => void;
  readonly retaliationStamina: number;
  readonly revoltStamina: number;
  readonly setDefenderAgentId: (agentId: string) => void;
  readonly setRaidStamina: (stamina: number) => void;
  readonly setRetaliationStamina: (stamina: number) => void;
  readonly setRevoltStamina: (stamina: number) => void;
}

export function RaidRetaliationPanel({
  activeIdentityDisabled,
  canResolveRegionRevolt,
  currentAgentId,
  defenderAgentId,
  isBusy,
  loadRaids,
  primaryRaid,
  primaryRetaliation,
  raidStamina,
  raids,
  resolveRaid,
  resolveRegionRevolt,
  resolveRetaliation,
  retaliationStamina,
  revoltStamina,
  setDefenderAgentId,
  setRaidStamina,
  setRetaliationStamina,
  setRevoltStamina,
}: RaidRetaliationPanelProps) {
  return (
    <article className="agent-panel agent-raids">
      <div className="agent-panel-head">
        <span>对抗结算</span>
        <b>{primaryRaid ? primaryRaid.outcome : "empty"}</b>
      </div>
      <input value={defenderAgentId} onChange={(event) => setDefenderAgentId(event.target.value)} placeholder="defender agent id" />
      <input type="number" min="1" value={raidStamina} onChange={(event) => setRaidStamina(Math.max(1, Number(event.target.value || 1)))} />
      <div className="agent-action-row">
        <button type="button" disabled={isBusy} onClick={loadRaids}>刷新对抗</button>
        <button type="button" disabled={isBusy || activeIdentityDisabled || !defenderAgentId.trim()} onClick={resolveRaid}>服务器结算</button>
      </div>
      <div className="agent-market-form">
        <input type="number" min="1" value={revoltStamina} onChange={(event) => setRevoltStamina(Math.max(1, Number(event.target.value || 1)))} />
        <button
          type="button"
          disabled={isBusy || activeIdentityDisabled || !canResolveRegionRevolt}
          onClick={resolveRegionRevolt}
        >
          发动起义
        </button>
      </div>
      <div className="agent-market-form">
        <input type="number" min="1" value={retaliationStamina} onChange={(event) => setRetaliationStamina(Math.max(1, Number(event.target.value || 1)))} />
        <button
          type="button"
          disabled={isBusy || activeIdentityDisabled || !primaryRetaliation || primaryRetaliation.opportunityAgentId !== currentAgentId}
          onClick={resolveRetaliation}
        >
          执行复仇
        </button>
      </div>
      <div className="agent-mini-list">
        {raids.slice(0, 4).map((raid) => (
          <span key={raid.raidId}>
            {playerCommonStatusLabel(raid.outcome)} · 攻 {raid.attackerPower} / 防 {raid.defenderPower}
          </span>
        ))}
        {primaryRetaliation ? (
          <span>
            复仇契机 · {playerAgentLabel(primaryRetaliation.opportunityAgentId)}
            <b>目标 {playerAgentLabel(primaryRetaliation.targetAgentId)} / {playerCommonStatusLabel(primaryRetaliation.status)}</b>
          </span>
        ) : null}
      </div>
      {!raids.length ? <p>攻击方消耗体力，防守强度来自服务器资源余额，胜负不能由叙事声明。</p> : null}
    </article>
  );
}
