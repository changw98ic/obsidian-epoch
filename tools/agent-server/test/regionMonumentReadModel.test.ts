import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import type { EpochProjection } from "../lib/epoch/gameCore.ts";

const modulePath = new URL("../lib/epoch/regionMonumentReadModel.ts", import.meta.url);

function projectionFixture(): EpochProjection {
  return {
    regionMonuments: {
      monument_old: {
        monumentId: "monument_old",
        regionId: "region_gray_harbor",
        title: "旧潮汐碑",
        description: "较早建成的纪念碑。",
        controllingFactionId: "gray_watch",
        winnerAgentId: "agent_a",
        winnerExplorerId: "explorer_a",
        sourceSeasonId: "season_old",
        controlScore: 3,
        builtAt: "2026-07-07T01:00:00.000Z",
      },
      monument_new: {
        monumentId: "monument_new",
        regionId: "region_gray_harbor",
        title: "新潮汐碑",
        description: "较晚建成的纪念碑。",
        controllingFactionId: "gray_watch",
        winnerAgentId: "agent_b",
        winnerExplorerId: "explorer_b",
        sourceSeasonId: "season_new",
        controlScore: 7,
        builtAt: "2026-07-07T03:00:00.000Z",
      },
      monument_other: {
        monumentId: "monument_other",
        regionId: "region_salt_gate",
        title: "盐门碑",
        description: "其他区域的纪念碑。",
        controllingFactionId: "salt_compact",
        winnerAgentId: "agent_c",
        winnerExplorerId: "explorer_c",
        sourceSeasonId: "season_other",
        controlScore: 5,
        builtAt: "2026-07-07T02:00:00.000Z",
      },
    },
    regionMonumentIdsByRegion: {
      region_gray_harbor: ["monument_old", "missing_monument", "monument_new"],
      region_salt_gate: ["monument_other"],
    },
  } as unknown as EpochProjection;
}

test("region monument read model filters missing ids and sorts newest first", async () => {
  assert.ok(existsSync(modulePath), "regionMonumentReadModel.ts should own monument projection");
  const readModel = await import("../lib/epoch/regionMonumentReadModel.ts");
  const projection = projectionFixture();

  assert.deepEqual(
    readModel.monumentsView(projection, { regionId: "region_gray_harbor" }).map((monument) => monument.monumentId),
    ["monument_new", "monument_old"],
  );
});

test("region monument read model supports global monument views", async () => {
  assert.ok(existsSync(modulePath), "regionMonumentReadModel.ts should expose global monument projection");
  const readModel = await import("../lib/epoch/regionMonumentReadModel.ts");
  const projection = projectionFixture();

  assert.deepEqual(
    readModel.monumentsView(projection).map((monument) => monument.monumentId),
    ["monument_new", "monument_other", "monument_old"],
  );
});
