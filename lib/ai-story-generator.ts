import "server-only";

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

import { MockStoryGenerator } from "./mock-story-generator";
import {
  branchStorySchema,
  branchStoryStructureSchema,
  storyInputSchema,
  type BranchStory,
  type StoryInput,
} from "./story";
import { StoryGenerationError, type StoryGenerator } from "./story-generator";

const DEFAULT_MODEL = "gpt-5.6-terra";
const DEFAULT_TIMEOUT_MS = 20_000;

type StoryModelRequest = (input: StoryInput, signal: AbortSignal) => Promise<unknown>;

type AIStoryGeneratorOptions = {
  requestStory: StoryModelRequest;
  timeoutMs?: number;
};

type OpenAIStoryGeneratorOptions = {
  apiKey: string;
  model?: string;
  timeoutMs?: number;
};

type StoryGeneratorEnvironment = {
  STORY_GENERATOR_MODE?: string;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
};

export class AIStoryGenerator implements StoryGenerator {
  private readonly requestStory: StoryModelRequest;
  private readonly timeoutMs: number;

  constructor({ requestStory, timeoutMs = DEFAULT_TIMEOUT_MS }: AIStoryGeneratorOptions) {
    this.requestStory = requestStory;
    this.timeoutMs = timeoutMs;
  }

  async generate(input: StoryInput): Promise<BranchStory> {
    const inputResult = storyInputSchema.safeParse(input);
    if (!inputResult.success) {
      throw new StoryGenerationError("INVALID_INPUT");
    }

    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const timeout = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        controller.abort();
        reject(new StoryGenerationError("TIMEOUT"));
      }, this.timeoutMs);
    });

    try {
      const output = await Promise.race([
        this.requestStory(inputResult.data, controller.signal),
        timeout,
      ]);
      const storyResult = branchStorySchema.safeParse(output);

      if (!storyResult.success) {
        throw new StoryGenerationError("INVALID_OUTPUT");
      }

      return storyResult.data;
    } catch (error) {
      if (error instanceof StoryGenerationError) throw error;
      if (error instanceof z.ZodError || error instanceof SyntaxError) {
        throw new StoryGenerationError("INVALID_OUTPUT");
      }
      if (controller.signal.aborted) {
        throw new StoryGenerationError("TIMEOUT");
      }
      throw new StoryGenerationError("PROVIDER_ERROR");
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }
}

export function createOpenAIStoryGenerator({
  apiKey,
  model = DEFAULT_MODEL,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: OpenAIStoryGeneratorOptions): AIStoryGenerator {
  const client = new OpenAI({
    apiKey,
    timeout: timeoutMs,
    maxRetries: 0,
    logLevel: "off",
  });

  return new AIStoryGenerator({
    timeoutMs,
    requestStory: async (input, signal) => {
      const response = await client.responses.parse(
        {
          model,
          input: [
            {
              role: "system",
              content:
                "你是互动故事设计师。根据用户设定创作一个中文轻量分支故事。普通节点必须有两个选择，结局节点不能有选择；每条路径恰好经过两次选择到达结局；总节点不超过 7 个，所有节点从起点可达、无循环，并至少包含 hopeful 和 bittersweet 两种不同结局。",
            },
            {
              role: "user",
              content: JSON.stringify(input),
            },
          ],
          text: {
            format: zodTextFormat(branchStoryStructureSchema, "branch_story"),
          },
        },
        { signal },
      );

      if (!response.output_parsed) {
        throw new StoryGenerationError("INVALID_OUTPUT");
      }

      return response.output_parsed;
    },
  });
}

export function createStoryGeneratorFromEnvironment(
  environment: StoryGeneratorEnvironment = {
    STORY_GENERATOR_MODE: process.env.STORY_GENERATOR_MODE,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_MODEL: process.env.OPENAI_MODEL,
  },
): StoryGenerator {
  if (environment.STORY_GENERATOR_MODE !== "ai") {
    return new MockStoryGenerator();
  }

  const apiKey = environment.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new StoryGenerationError("NOT_CONFIGURED");
  }

  return createOpenAIStoryGenerator({
    apiKey,
    model: environment.OPENAI_MODEL?.trim() || DEFAULT_MODEL,
  });
}
