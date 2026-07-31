import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateToolInput, McpInputValidationError } from "../lib/mcpInputValidation.ts";
import { AGENT_WORLD_TOOLS } from "../lib/mcpToolDefinitions.ts";

describe("MCP input validation", () => {
  const strictSchema = {
    type: "object",
    properties: {
      name: { type: "string" },
      count: { type: "integer", minimum: 0, maximum: 100 },
      enabled: { type: "boolean" },
      tags: { type: "array", items: { type: "string" } },
    },
    required: ["name"],
    additionalProperties: false,
  };

  const openSchema = {
    type: "object",
    properties: {
      name: { type: "string" },
    },
    additionalProperties: true,
  };

  it("accepts valid input with strict schema", () => {
    assert.doesNotThrow(() => {
      validateToolInput("test", { name: "hello", count: 5 }, strictSchema);
    });
  });

  it("rejects unknown field with strict schema", () => {
    assert.throws(
      () => {
        validateToolInput("test", { name: "hello", unknownField: true }, strictSchema);
      },
      (err: unknown) => {
        assert.ok(err instanceof McpInputValidationError);
        assert.equal(err.errors.length, 1);
        assert.equal(err.errors[0]!.rule, "additionalProperties");
        assert.equal(err.errors[0]!.path, "unknownField");
        return true;
      },
    );
  });

  it("accepts unknown field with open schema (additionalProperties: true)", () => {
    assert.doesNotThrow(() => {
      validateToolInput("test", { name: "hello", extra: true }, openSchema);
    });
  });

  it("accepts input when no schema is provided", () => {
    assert.doesNotThrow(() => {
      validateToolInput("test", { anything: true }, undefined);
    });
  });

  it("rejects multiple unknown fields", () => {
    assert.throws(
      () => {
        validateToolInput("test", { name: "hello", bad1: 1, bad2: 2 }, strictSchema);
      },
      (err: unknown) => {
        assert.ok(err instanceof McpInputValidationError);
        assert.equal(err.errors.length, 2);
        return true;
      },
    );
  });

  it("rejects nested unknown fields", () => {
    const nestedSchema = {
      type: "object",
      properties: {
        outer: {
          type: "object",
          properties: { inner: { type: "string" } },
          additionalProperties: false,
        },
      },
      additionalProperties: false,
    };
    assert.throws(
      () => {
        validateToolInput("test", { outer: { inner: "ok", bad: true } }, nestedSchema);
      },
      (err: unknown) => {
        assert.ok(err instanceof McpInputValidationError);
        assert.equal(err.errors[0]!.path, "outer.bad");
        return true;
      },
    );
  });

  it("McpInputValidationError has correct code", () => {
    try {
      validateToolInput("test", { name: "x", unknown: 1 }, strictSchema);
      assert.fail("should have thrown");
    } catch (err) {
      assert.ok(err instanceof McpInputValidationError);
      assert.equal(err.code, -32602);
    }
  });
});

describe("result_page schema validation", () => {
  const resultPageDef = AGENT_WORLD_TOOLS.find((t) => t.name === "obsidian_epoch.result_page");
  assert.ok(resultPageDef, "obsidian_epoch.result_page tool definition must exist");
  const resultPageSchema = resultPageDef.inputSchema;

  it("result_page schema has additionalProperties: true (objectSchema default)", () => {
    assert.equal(resultPageSchema.additionalProperties, true);
  });

  it("result_page does not reject client-provided roleplay field", () => {
    assert.doesNotThrow(() => {
      validateToolInput("obsidian_epoch.result_page", {
        explorerId: "ex_1",
        roleplay: { narrative: "player wrote this" },
      }, resultPageSchema);
    });
  });

  it("result_page does not reject client-provided viability field", () => {
    assert.doesNotThrow(() => {
      validateToolInput("obsidian_epoch.result_page", {
        explorerId: "ex_1",
        viability: { score: 0.9 },
      }, resultPageSchema);
    });
  });

  it("result_page does not reject client-provided strategyConsistency field", () => {
    assert.doesNotThrow(() => {
      validateToolInput("obsidian_epoch.result_page", {
        explorerId: "ex_1",
        strategyConsistency: { consistent: true },
      }, resultPageSchema);
    });
  });

  it("result_page does not reject all three fields together", () => {
    assert.doesNotThrow(() => {
      validateToolInput("obsidian_epoch.result_page", {
        explorerId: "ex_1",
        roleplay: { narrative: "crafted" },
        viability: { score: 0.5 },
        strategyConsistency: { consistent: false },
      }, resultPageSchema);
    });
  });
});
