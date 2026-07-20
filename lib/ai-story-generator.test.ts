import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  AIStoryGenerator,
  createStoryGeneratorFromEnvironment,
} from "./ai-story-generator";
import { MockStoryGenerator, generateMockStory } from "./mock-story-generator";
import {
  ObservedStoryGenerator,
  type StoryGenerationRecord,
} from "./story-generation-observability";
import { branchStorySchema, type StoryInput } from "./story";
import { StoryGenerationError } from "./story-generator";

const input: StoryInput = {
  theme: "遗忘与重逢",
  protagonistName: "林夏",
  protagonistIdentity: "城市夜班记者",
  storyStyle: "温柔治愈",
};

function validRawStory() {
  return JSON.stringify(generateMockStory(input));
}

describe("story generator contract", () => {
  it("MockStoryGenerator returns a marked valid story", async () => {
    const result = await new MockStoryGenerator().generate(input, {
      requestId: "mock-request",
    });

    expect(branchStorySchema.safeParse(result.story).success).toBe(true);
    expect(result.metadata).toEqual({
      requestId: "mock-request",
      source: "mock",
      fallbackUsed: false,
      attemptCount: 1,
      fallbackReason: null,
    });
  });

  it("AIStoryGenerator returns a marked valid story", async () => {
    const generator = new AIStoryGenerator({
      requestStory: async () => validRawStory(),
    });

    const result = await generator.generate(input, { requestId: "ai-request" });

    expect(branchStorySchema.safeParse(result.story).success).toBe(true);
    expect(result.metadata).toMatchObject({
      requestId: "ai-request",
      source: "openai",
      fallbackUsed: false,
      attemptCount: 1,
    });
  });
});

describe("AIStoryGenerator retry and fallback", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("retries invalid JSON once and succeeds", async () => {
    const requestStory = vi
      .fn()
      .mockResolvedValueOnce("not-json")
      .mockResolvedValueOnce(validRawStory());
    const generator = new AIStoryGenerator({ requestStory });

    const result = await generator.generate(input);

    expect(requestStory).toHaveBeenCalledTimes(2);
    expect(requestStory.mock.calls[1]?.[1]).toMatchObject({
      attempt: 2,
      previousErrorCode: "INVALID_JSON",
    });
    expect(result.metadata).toMatchObject({
      source: "openai",
      fallbackUsed: false,
      attemptCount: 2,
    });
  });

  it("retries a recoverable network error", async () => {
    const requestStory = vi
      .fn()
      .mockRejectedValueOnce(
        new StoryGenerationError("NETWORK_ERROR", { retryable: true }),
      )
      .mockResolvedValueOnce(validRawStory());
    const generator = new AIStoryGenerator({ requestStory });

    const result = await generator.generate(input);

    expect(requestStory).toHaveBeenCalledTimes(2);
    expect(result.metadata.attemptCount).toBe(2);
  });

  it("does not retry unknown errors", async () => {
    const requestStory = vi.fn().mockRejectedValue(new Error("unexpected"));
    const generator = new AIStoryGenerator({ requestStory });

    await expect(generator.generate(input)).rejects.toMatchObject({
      code: "UNKNOWN_ERROR",
      attemptCount: 1,
    });
    expect(requestStory).toHaveBeenCalledTimes(1);
  });

  it("retries timeouts once and then returns a timeout error", async () => {
    vi.useFakeTimers();
    const signals: AbortSignal[] = [];
    const generator = new AIStoryGenerator({
      attemptTimeoutMs: 20,
      totalBudgetMs: 100,
      requestStory: async (_, { signal }) => {
        signals.push(signal);
        return new Promise(() => undefined);
      },
    });

    const rejection = expect(generator.generate(input)).rejects.toMatchObject({
      code: "TIMEOUT",
      attemptCount: 2,
    });
    await vi.advanceTimersByTimeAsync(40);

    await rejection;
    expect(signals).toHaveLength(2);
    expect(signals.every((signal) => signal.aborted)).toBe(true);
  });

  it("falls back to Mock after two recoverable failures", async () => {
    const requestStory = vi.fn().mockResolvedValue("not-json");
    const generator = new AIStoryGenerator({
      requestStory,
      fallbackGenerator: new MockStoryGenerator(),
    });

    const result = await generator.generate(input, { requestId: "fallback-request" });

    expect(requestStory).toHaveBeenCalledTimes(2);
    expect(branchStorySchema.safeParse(result.story).success).toBe(true);
    expect(result.metadata).toEqual({
      requestId: "fallback-request",
      source: "mock",
      fallbackUsed: true,
      attemptCount: 2,
      fallbackReason: "INVALID_JSON",
    });
  });

  it("returns the final error when fallback is disabled", async () => {
    const requestStory = vi.fn().mockResolvedValue("not-json");
    const generator = new AIStoryGenerator({ requestStory });

    await expect(generator.generate(input)).rejects.toMatchObject({
      code: "INVALID_JSON",
      attemptCount: 2,
    });
    expect(requestStory).toHaveBeenCalledTimes(2);
  });

  it("rejects invalid input before calling the model", async () => {
    const requestStory = vi.fn();
    const generator = new AIStoryGenerator({ requestStory });

    await expect(
      generator.generate({ ...input, theme: "" }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(requestStory).not.toHaveBeenCalled();
  });
});

describe("generator environment and observability", () => {
  it("defaults to Mock mode and records only safe structured fields", async () => {
    const records: StoryGenerationRecord[] = [];
    const generator = createStoryGeneratorFromEnvironment(
      {},
      { logger: { record: (entry) => records.push(entry) } },
    );

    const result = await generator.generate(input, { requestId: "observed-request" });

    expect(result.metadata.source).toBe("mock");
    expect(records).toEqual([
      expect.objectContaining({
        requestId: "observed-request",
        generatorType: "mock",
        promptVersion: "mock-v1",
        success: true,
        retried: false,
        fallbackUsed: false,
        finalErrorType: null,
      }),
    ]);
    expect(JSON.stringify(records)).not.toContain(input.theme);
  });

  it("does not create a real model client in the test environment", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const generator = createStoryGeneratorFromEnvironment({
      NODE_ENV: "test",
      STORY_GENERATOR_MODE: "ai",
      OPENAI_API_KEY: "test-key-that-must-not-be-used",
    });

    await expect(generator.generate(input)).rejects.toMatchObject({
      code: "NOT_CONFIGURED",
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("records retry and fallback without logging story content", async () => {
    const records: StoryGenerationRecord[] = [];
    const inner = new AIStoryGenerator({
      requestStory: async () => "not-json",
      fallbackGenerator: new MockStoryGenerator(),
    });
    const generator = new ObservedStoryGenerator({
      generator: inner,
      generatorType: "openai",
      promptVersion: "story-v1",
      logger: { record: (entry) => records.push(entry) },
    });

    const result = await generator.generate(input, { requestId: "fallback-log" });

    expect(result.metadata.fallbackUsed).toBe(true);
    expect(records).toEqual([
      expect.objectContaining({
        success: true,
        retried: true,
        fallbackUsed: true,
        finalErrorType: "INVALID_JSON",
      }),
    ]);
    expect(JSON.stringify(records)).not.toContain(input.protagonistName);
  });
});
