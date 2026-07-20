import { z } from "zod";

import type { BranchStory, StoryInput } from "./story";

export interface StoryGenerator {
  generate(input: StoryInput): Promise<BranchStory>;
}

export const storyGenerationErrorCodeSchema = z.enum([
  "INVALID_INPUT",
  "NOT_CONFIGURED",
  "TIMEOUT",
  "PROVIDER_ERROR",
  "INVALID_OUTPUT",
]);

export type StoryGenerationErrorCode = z.infer<typeof storyGenerationErrorCodeSchema>;

export const storyGenerationErrorResponseSchema = z.object({
  error: z.object({
    code: storyGenerationErrorCodeSchema,
  }),
});

export class StoryGenerationError extends Error {
  constructor(readonly code: StoryGenerationErrorCode) {
    super(code);
    this.name = "StoryGenerationError";
  }
}

export function isStoryGenerationError(error: unknown): error is StoryGenerationError {
  return error instanceof StoryGenerationError;
}
