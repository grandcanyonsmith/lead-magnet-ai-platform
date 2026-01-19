import {
  normalizePromptOverrides,
  resolvePromptOverride,
} from "../../services/promptOverrides";

describe("promptOverrides", () => {
  it("normalizes override payloads and drops empty strings", () => {
    const raw = {
      workflow_generation: {
        instructions: "   ",
        prompt: "Use {{description}}",
      },
      ignored: "nope",
    };

    const normalized = normalizePromptOverrides(raw);
    expect(normalized).toEqual({
      workflow_generation: { prompt: "Use {{description}}" },
    });
  });

  it("resolves overrides and applies template variables", () => {
    const overrides = {
      workflow_generation: {
        instructions: "Custom instructions",
        prompt: "Hello {{name}}",
      },
    };

    const resolved = resolvePromptOverride({
      key: "workflow_generation",
      defaults: {
        instructions: "Default instructions",
        prompt: "Default prompt",
      },
      overrides,
      variables: { name: "Sam" },
    });

    expect(resolved.instructions).toBe("Custom instructions");
    expect(resolved.prompt).toBe("Hello Sam");
  });

  it("falls back to defaults when override is disabled", () => {
    const overrides = {
      workflow_generation: {
        enabled: false,
        instructions: "Custom instructions",
      },
    };

    const resolved = resolvePromptOverride({
      key: "workflow_generation",
      defaults: {
        instructions: "Default instructions",
        prompt: "Default prompt",
      },
      overrides,
      variables: { name: "Sam" },
    });

    expect(resolved.instructions).toBe("Default instructions");
    expect(resolved.prompt).toBe("Default prompt");
  });
});
