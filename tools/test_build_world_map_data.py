from __future__ import annotations

import importlib.util
import json
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = ROOT / "tools" / "build_world_map_data.py"
SPEC = importlib.util.spec_from_file_location("build_world_map_data", MODULE_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError("could not load build_world_map_data")
world_map = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(world_map)


class BuildWorldMapDataTests(unittest.TestCase):
    @staticmethod
    def _minimal_map(*entities: dict[str, object]) -> dict[str, object]:
        return {
            "layers": [{}] * 7,
            "sourceStats": {"creatureUnits": 1000},
            "entities": list(entities),
            "regions": [],
            "routes": [],
        }

    @staticmethod
    def _creature(entity_id: str, **details: object) -> dict[str, object]:
        required = {
            "serial": entity_id.split("_", 1)[0],
            "habitat": "湿谷",
            "threat": "C",
            "rank_role": "普通",
            "alignment": "中立",
            "visual_tendency": "诡异",
            "visual_style": "档案",
            "image_ready": True,
        }
        required.update(details)
        return {"id": entity_id, "sourceKind": "creature_unit", "details": required}

    def test_validate_world_map_checks_every_canonical_creature_unit(self) -> None:
        errors = world_map.validate_world_map(self._minimal_map(
            self._creature("B0001_云墓低语螺"),
            self._creature("B0002_缺少风格", visual_style=""),
        ))
        self.assertIn("B0002_缺少风格 missing details.visual_style", errors)
        self.assertNotIn("B0001_云墓低语螺 missing details.visual_style", errors)

    def test_image_ready_is_a_boolean_authoring_readiness_flag(self) -> None:
        errors = world_map.validate_world_map(self._minimal_map(
            self._creature("B0001_云墓低语螺", image_ready="true"),
        ))
        self.assertTrue(any("details.image_ready must be boolean" in error for error in errors))

    def test_unserialised_hand_authored_notes_remain_legacy_creatures(self) -> None:
        data = world_map.build_world_map()
        self.assertEqual(data["sourceStats"]["creatureUnits"], 1000)
        self.assertEqual(data["sourceStats"]["legacyCreatures"], 79)
        self.assertEqual(
            sum(entity.get("sourceKind") == "legacy_creature" for entity in data["entities"]),
            79,
        )

    def test_default_generated_at_is_stable_and_canonical(self) -> None:
        self.assertEqual(world_map.normalized_generated_at(world_map.DEFAULT_GENERATED_AT), "1970-01-01T00:00:00Z")
        self.assertEqual(world_map.normalized_generated_at("2026-07-17T08:00:00+08:00"), "2026-07-17T00:00:00Z")

    def test_serialized_output_has_a_stable_final_newline(self) -> None:
        data = {"schemaVersion": 1, "generatedAt": world_map.DEFAULT_GENERATED_AT}
        expected = '{\n  "schemaVersion": 1,\n  "generatedAt": "1970-01-01T00:00:00Z"\n}\n'
        self.assertEqual(world_map.serialized_world_map(data), expected)

    def test_generated_output_check_detects_stale_or_missing_file(self) -> None:
        expected = "{\"current\": true}\n"
        with tempfile.TemporaryDirectory() as directory:
            output_path = Path(directory) / "world-map-data.json"
            self.assertFalse(world_map.generated_output_matches(expected, output_path))
            output_path.write_text(expected, encoding="utf-8")
            self.assertTrue(world_map.generated_output_matches(expected, output_path))
            output_path.write_text(json.dumps({"current": False}) + "\n", encoding="utf-8")
            self.assertFalse(world_map.generated_output_matches(expected, output_path))

    def test_image_index_uses_versioned_object_storage_manifest(self) -> None:
        manifest = json.loads(world_map.OBJECT_STORAGE_MANIFEST.read_text(encoding="utf-8"))
        index = world_map.image_index()
        expected_images = [entry["path"] for entry in manifest["objects"] if Path(entry["path"]).suffix.lower() in world_map.IMAGE_EXTENSIONS]
        self.assertEqual(len(index), len(expected_images))
        self.assertEqual(
            index["万眼躁动小蛇_档案卡.png"],
            world_map.OBJECT_STORAGE_ASSET_ROOT / "万眼躁动小蛇_档案卡.png",
        )


if __name__ == "__main__":
    unittest.main()
