import { z } from "zod";

import { branchStorySchema, type StoryInput } from "./story";

export const storyGenerationErrorCodeSchema = z.enum([
  "INVALID_INPUT",
  "NOT_CONFIGURED",
  "TIMEOUT",
  "NETWORK_ERROR",
  "MODEL_ERROR",
  "INVALID_JSON",
  "SCHEMA_VALIDATION_ERROR",
  "STORY_GRAPH_ERROR",
  "UNKNOWN_ERROR",
]);

export type StoryGenerationErrorCode = z.infer<typeof storyGenerationErrorCodeSchema>;
export type StoryGeneratorType = "mock" | "openai";

export const storyGenerationMetadataSchema = z.object({
  requestId: z.string().min(1),
  source: z.enum(["mock", "openai"]),
  fallbackUsed: z.boolean(),
  attemptCount: z.number().int().min(1).max(2),
  fallbackReason: storyGenerationErrorCodeSchema.nullable(),
});

export type StoryGenerationMetadata = z.infer<typeof storyGenerationMetadataSchema>;

export const storyGenerationResultSchema = z.object({
  story: branchStorySchema,
  metadata: storyGenerationMetadataSchema,
});

export type StoryGenerationResult = z.infer<typeof storyGenerationResultSchema>;

export type StoryGenerationContext = {
  requestId: string;
};

export interface StoryGenerator {
  generate(
    input: StoryInput,
    context?: StoryGenerationContext,
  ): Promise<StoryGenerationResult>;
}

export const safeErrorMessageByCode: Record<StoryGenerationErrorCode, string> = {
  INVALID_INPUT: "请检查故事设定后再试",
  NOT_CONFIGURED: "AI 故事生成暂未配置，请稍后再试",
  TIMEOUT: "故事生成时间有点久，请重新试一次",
  NETWORK_ERROR: "网络暂时不稳定，请重新试一次",
  MODEL_ERROR: "故事生成服务暂时不可用，请稍后再试",
  INVALID_JSON: "生成的故事格式异常，请重新生成",
  SCHEMA_VALIDATION_ERROR: "生成的故事结构不完整，请重新生成",
  STORY_GRAPH_ERROR: "生成的故事分支不完整，请重新生成",
  UNKNOWN_ERROR: "故事暂时无法生成，请稍后再试",
};

export const storyGenerationErrorResponseSchema = z.object({
  error: z.object({
    code: storyGenerationErrorCodeSchema,
    message: z.string().min(1),
    requestId: z.string().min(1),
  }),
});

type StoryGenerationErrorOptions = {
  retryable?: boolean;
  attemptCount?: number;
  technicalCause?: unknown;
};

export class StoryGenerationError extends Error {
  readonly retryable: boolean;
  readonly attemptCount: number;
  readonly technicalCause?: unknown;

  constructor(
    readonly code: StoryGenerationErrorCode,
    {
      retryable = false,
      attemptCount = 1,
      technicalCause,
    }: StoryGenerationErrorOptions = {},
  ) {
    super(code);
    this.name = "StoryGenerationError";
    this.retryable = retryable;
    this.attemptCount = attemptCount;
    this.technicalCause = technicalCause;
  }
}

export function isStoryGenerationError(error: unknown): error is StoryGenerationError {
  return error instanceof StoryGenerationError;
}

export function normalizeStoryGenerationError(error: unknown): StoryGenerationError {
  if (isStoryGenerationError(error)) return error;
  return new StoryGenerationError("UNKNOWN_ERROR", { technicalCause: error });
}

export function withAttemptCount(
  error: StoryGenerationError,
  attemptCount: number,
): StoryGenerationError {
  return new StoryGenerationError(error.code, {
    retryable: error.retryable,
    attemptCount,
    technicalCause: error.technicalCause ?? error,
  });
}

export function createStoryGenerationContext(): StoryGenerationContext {
  return { requestId: crypto.randomUUID() };
}
