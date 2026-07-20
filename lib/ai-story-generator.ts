import "server-only";

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";

import {
  MOCK_STORY_PROMPT_VERSION,
  MockStoryGenerator,
} from "./mock-story-generator";
import { ObservedStoryGenerator, type StoryGenerationLogger } from "./story-generation-observability";
import {
  branchStoryStructureSchema,
  storyInputSchema,
  type StoryInput,
} from "./story";
import {
  createStoryGenerationContext,
  normalizeStoryGenerationError,
  StoryGenerationError,
  withAttemptCount,
  type StoryGenerationContext,
  type StoryGenerationErrorCode,
  type StoryGenerationResult,
  type StoryGenerator,
} from "./story-generator";
import { parseAndValidateGeneratedStory } from "./story-validation";

const DEFAULT_MODEL = "gpt-5.6-terra";
const DEFAULT_TOTAL_BUDGET_MS = 15_000;
const DEFAULT_ATTEMPT_TIMEOUT_MS = 7_000;
const MAX_ATTEMPTS = 2;

export const OPENAI_STORY_PROMPT_VERSION = "story-v1";

type StoryModelRequestOptions = {
  signal: AbortSignal;
  attempt: number;
  previousErrorCode: StoryGenerationErrorCode | null;
};

type StoryModelRequest = (
  input: StoryInput,
  options: StoryModelRequestOptions,
) => Promise<string>;

type AIStoryGeneratorOptions = {
  requestStory: StoryModelRequest;
  fallbackGenerator?: StoryGenerator;
  totalBudgetMs?: number;
  attemptTimeoutMs?: number;
  now?: () => number;
};

type OpenAIStoryGeneratorOptions = {
  apiKey: string;
  model?: string;
  fallbackGenerator?: StoryGenerator;
  totalBudgetMs?: number;
  attemptTimeoutMs?: number;
};

type StoryGeneratorEnvironment = {
  NODE_ENV?: string;
  STORY_GENERATOR_MODE?: string;
  STORY_GENERATOR_FALLBACK?: string;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
};

type StoryGeneratorFactoryOptions = {
  logger?: StoryGenerationLogger;
};

export class AIStoryGenerator implements StoryGenerator {
  private readonly requestStory: StoryModelRequest;
  private readonly fallbackGenerator?: StoryGenerator;
  private readonly totalBudgetMs: number;
  private readonly attemptTimeoutMs: number;
  private readonly now: () => number;

  constructor({
    requestStory,
    fallbackGenerator,
    totalBudgetMs = DEFAULT_TOTAL_BUDGET_MS,
    attemptTimeoutMs = DEFAULT_ATTEMPT_TIMEOUT_MS,
    now = Date.now,
  }: AIStoryGeneratorOptions) {
    this.requestStory = requestStory;
    this.fallbackGenerator = fallbackGenerator;
    this.totalBudgetMs = totalBudgetMs;
    this.attemptTimeoutMs = attemptTimeoutMs;
    this.now = now;
  }

  async generate(
    input: StoryInput,
    context: StoryGenerationContext = createStoryGenerationContext(),
  ): Promise<StoryGenerationResult> {
    const inputResult = storyInputSchema.safeParse(input);
    if (!inputResult.success) {
      throw new StoryGenerationError("INVALID_INPUT", {
        technicalCause: inputResult.error,
      });
    }

    const startedAt = this.now();
    let attemptCount = 0;
    let previousError: StoryGenerationError | null = null;

    while (attemptCount < MAX_ATTEMPTS) {
      const remainingBudget = this.totalBudgetMs - (this.now() - startedAt);
      if (remainingBudget <= 0) {
        previousError = new StoryGenerationError("TIMEOUT", {
          retryable: true,
          attemptCount: Math.max(1, attemptCount),
        });
        break;
      }

      attemptCount += 1;

      try {
        const rawOutput = await this.requestWithTimeout(inputResult.data, {
          attempt: attemptCount,
          previousErrorCode: previousError?.code ?? null,
          timeoutMs: Math.min(this.attemptTimeoutMs, remainingBudget),
        });
        const story = parseAndValidateGeneratedStory(rawOutput);

        return {
          story,
          metadata: {
            requestId: context.requestId,
            source: "openai",
            fallbackUsed: false,
            attemptCount,
            fallbackReason: null,
          },
        };
      } catch (error) {
        previousError = withAttemptCount(normalizeStoryGenerationError(error), attemptCount);
        if (!previousError.retryable || attemptCount >= MAX_ATTEMPTS) break;
      }
    }

    const finalError = previousError ?? new StoryGenerationError("UNKNOWN_ERROR");

    if (this.fallbackGenerator) {
      const fallbackResult = await this.fallbackGenerator.generate(inputResult.data, context);
      return {
        story: fallbackResult.story,
        metadata: {
          requestId: context.requestId,
          source: "mock",
          fallbackUsed: true,
          attemptCount: Math.max(1, attemptCount),
          fallbackReason: finalError.code,
        },
      };
    }

    throw withAttemptCount(finalError, Math.max(1, attemptCount));
  }

  private async requestWithTimeout(
    input: StoryInput,
    {
      attempt,
      previousErrorCode,
      timeoutMs,
    }: {
      attempt: number;
      previousErrorCode: StoryGenerationErrorCode | null;
      timeoutMs: number;
    },
  ): Promise<string> {
    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const timeout = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        controller.abort();
        reject(new StoryGenerationError("TIMEOUT", { retryable: true }));
      }, timeoutMs);
    });

    try {
      return await Promise.race([
        this.requestStory(input, {
          signal: controller.signal,
          attempt,
          previousErrorCode,
        }),
        timeout,
      ]);
    } catch (error) {
      if (error instanceof StoryGenerationError) throw error;
      if (controller.signal.aborted) {
        throw new StoryGenerationError("TIMEOUT", {
          retryable: true,
          technicalCause: error,
        });
      }
      throw normalizeStoryGenerationError(error);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }
}

export function createOpenAIStoryGenerator({
  apiKey,
  model = DEFAULT_MODEL,
  fallbackGenerator,
  totalBudgetMs = DEFAULT_TOTAL_BUDGET_MS,
  attemptTimeoutMs = DEFAULT_ATTEMPT_TIMEOUT_MS,
}: OpenAIStoryGeneratorOptions): AIStoryGenerator {
  const client = new OpenAI({
    apiKey,
    timeout: attemptTimeoutMs,
    maxRetries: 0,
    logLevel: "off",
  });

  return new AIStoryGenerator({
    fallbackGenerator,
    totalBudgetMs,
    attemptTimeoutMs,
    requestStory: async (input, { signal, attempt, previousErrorCode }) => {
      try {
        const retryInstruction =
          attempt > 1 && previousErrorCode
            ? `上一次生成未通过校验，错误类别为 ${previousErrorCode}。请重新生成完整故事，不要解释错误。`
            : null;
        const response = await client.responses.create(
          {
            model,
            store: false,
            input: [
              {
                role: "system",
                content:
                  "你是互动故事设计师。根据用户设定创作一个中文轻量分支故事。普通节点必须有两个选择，结局节点不能有选择；每条路径恰好经过两次选择到达结局；总节点不超过 7 个，所有节点从起点可达、无循环，并至少包含 hopeful 和 bittersweet 两种不同结局。只返回符合指定结构的故事。",
              },
              ...(retryInstruction
                ? [{ role: "system" as const, content: retryInstruction }]
                : []),
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

        const refused = response.output.some(
          (item) =>
            item.type === "message" &&
            item.content.some((content) => content.type === "refusal"),
        );
        if (refused) {
          throw new StoryGenerationError("MODEL_ERROR");
        }

        if (response.status !== "completed" || response.error || !response.output_text) {
          throw new StoryGenerationError("MODEL_ERROR", { retryable: true });
        }

        return response.output_text;
      } catch (error) {
        throw classifyOpenAIError(error);
      }
    },
  });
}

function classifyOpenAIError(error: unknown): StoryGenerationError {
  if (error instanceof StoryGenerationError) return error;

  if (error instanceof OpenAI.APIConnectionTimeoutError) {
    return new StoryGenerationError("TIMEOUT", {
      retryable: true,
      technicalCause: error,
    });
  }

  if (error instanceof OpenAI.APIConnectionError) {
    return new StoryGenerationError("NETWORK_ERROR", {
      retryable: true,
      technicalCause: error,
    });
  }

  if (error instanceof OpenAI.APIError) {
    const status = error.status;
    const retryable =
      status === 408 ||
      status === 409 ||
      status === 429 ||
      (typeof status === "number" && status >= 500);
    return new StoryGenerationError("MODEL_ERROR", {
      retryable,
      technicalCause: error,
    });
  }

  return new StoryGenerationError("UNKNOWN_ERROR", { technicalCause: error });
}

export function createStoryGeneratorFromEnvironment(
  environment: StoryGeneratorEnvironment = {
    NODE_ENV: process.env.NODE_ENV,
    STORY_GENERATOR_MODE: process.env.STORY_GENERATOR_MODE,
    STORY_GENERATOR_FALLBACK: process.env.STORY_GENERATOR_FALLBACK,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_MODEL: process.env.OPENAI_MODEL,
  },
  { logger }: StoryGeneratorFactoryOptions = {},
): StoryGenerator {
  const mode = environment.STORY_GENERATOR_MODE === "ai" ? "ai" : "mock";

  if (mode === "mock") {
    return new ObservedStoryGenerator({
      generator: new MockStoryGenerator(),
      generatorType: "mock",
      promptVersion: MOCK_STORY_PROMPT_VERSION,
      logger,
    });
  }

  const apiKey = environment.OPENAI_API_KEY?.trim();
  if (!apiKey || environment.NODE_ENV === "test") {
    return new ObservedStoryGenerator({
      generator: {
        async generate() {
          throw new StoryGenerationError("NOT_CONFIGURED");
        },
      },
      generatorType: "openai",
      promptVersion: OPENAI_STORY_PROMPT_VERSION,
      logger,
    });
  }

  const fallbackEnabled = environment.STORY_GENERATOR_FALLBACK !== "none";
  const generator = createOpenAIStoryGenerator({
    apiKey,
    model: environment.OPENAI_MODEL?.trim() || DEFAULT_MODEL,
    fallbackGenerator: fallbackEnabled ? new MockStoryGenerator() : undefined,
  });

  return new ObservedStoryGenerator({
    generator,
    generatorType: "openai",
    promptVersion: OPENAI_STORY_PROMPT_VERSION,
    logger,
  });
}
