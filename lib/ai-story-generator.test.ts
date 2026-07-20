import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  AIStoryGenerator,
  createStoryGeneratorFromEnvironment,
} from "./ai-story-generator";
import { MockStoryGenerator, generateMockStory } from "./mock-story-generator";
import { branchStorySchema, type StoryInput } from "./story";

const input: StoryInput = {
  theme: "遗忘与重逢",
  protagonistName: "林夏",
  protagonistIdentity: "城市夜班记者",
  storyStyle: "温柔治愈",
};

describe("story generator contract", () => {
  it("MockStoryGenerator returns a valid BranchStory", async () => {
    const story = await new MockStoryGenerator().generate(input);

    expect(branchStorySchema.safeParse(story).success).toBe(true);
  });

  it("AIStoryGenerator returns a valid BranchStory", async () => {
    const generator = new AIStoryGenerator({
      requestStory: async (requestInput) => generateMockStory(requestInput),
    });

    const story = await generator.generate(input);

    expect(branchStorySchema.safeParse(story).success).toBe(true);
  });
});

describe("AIStoryGenerator errors", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("rejects invalid model output", async () => {
    const generator = new AIStoryGenerator({
      requestStory: async () => ({ title: "不完整的故事" }),
    });

    await expect(generator.generate(input)).rejects.toMatchObject({
      code: "INVALID_OUTPUT",
    });
  });

  it("maps provider failures to a recognizable error", async () => {
    const generator = new AIStoryGenerator({
      requestStory: async () => {
        throw new Error("upstream unavailable");
      },
    });

    await expect(generator.generate(input)).rejects.toMatchObject({
      code: "PROVIDER_ERROR",
    });
  });

  it("aborts and rejects requests that exceed the timeout", async () => {
    vi.useFakeTimers();
    let requestSignal: AbortSignal | undefined;
    const generator = new AIStoryGenerator({
      timeoutMs: 20,
      requestStory: async (_, signal) => {
        requestSignal = signal;
        return new Promise(() => undefined);
      },
    });

    const rejection = expect(generator.generate(input)).rejects.toMatchObject({
      code: "TIMEOUT",
    });
    await vi.advanceTimersByTimeAsync(20);

    await rejection;
    expect(requestSignal?.aborted).toBe(true);
  });

  it("rejects invalid input before calling the provider", async () => {
    const requestStory = vi.fn();
    const generator = new AIStoryGenerator({ requestStory });

    await expect(
      generator.generate({ ...input, theme: "" }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(requestStory).not.toHaveBeenCalled();
  });
});

describe("generator environment selection", () => {
  it("defaults to Mock mode without an API key", () => {
    const generator = createStoryGeneratorFromEnvironment({});

    expect(generator).toBeInstanceOf(MockStoryGenerator);
  });

  it("reports missing configuration only when AI mode is selected", () => {
    expect(() =>
      createStoryGeneratorFromEnvironment({ STORY_GENERATOR_MODE: "ai" }),
    ).toThrow(expect.objectContaining({ code: "NOT_CONFIGURED" }));
  });
});
