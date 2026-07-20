import type { StoryInput } from "./story";
import {
  createStoryGenerationContext,
  normalizeStoryGenerationError,
  type StoryGenerationContext,
  type StoryGenerationErrorCode,
  type StoryGenerationResult,
  type StoryGenerator,
  type StoryGeneratorType,
} from "./story-generator";

export type StoryGenerationRecord = {
  requestId: string;
  generatorType: StoryGeneratorType;
  promptVersion: string;
  startedAt: string;
  durationMs: number;
  success: boolean;
  retried: boolean;
  fallbackUsed: boolean;
  finalErrorType: StoryGenerationErrorCode | null;
};

export interface StoryGenerationLogger {
  record(entry: StoryGenerationRecord): void;
}

export const consoleStoryGenerationLogger: StoryGenerationLogger = {
  record(entry) {
    console.info(JSON.stringify({ event: "story_generation", ...entry }));
  },
};

type ObservedStoryGeneratorOptions = {
  generator: StoryGenerator;
  generatorType: StoryGeneratorType;
  promptVersion: string;
  logger?: StoryGenerationLogger;
  now?: () => number;
};

export class ObservedStoryGenerator implements StoryGenerator {
  private readonly generator: StoryGenerator;
  private readonly generatorType: StoryGeneratorType;
  private readonly promptVersion: string;
  private readonly logger: StoryGenerationLogger;
  private readonly now: () => number;

  constructor({
    generator,
    generatorType,
    promptVersion,
    logger = consoleStoryGenerationLogger,
    now = Date.now,
  }: ObservedStoryGeneratorOptions) {
    this.generator = generator;
    this.generatorType = generatorType;
    this.promptVersion = promptVersion;
    this.logger = logger;
    this.now = now;
  }

  async generate(
    input: StoryInput,
    context: StoryGenerationContext = createStoryGenerationContext(),
  ): Promise<StoryGenerationResult> {
    const startedAtMs = this.now();
    const startedAt = new Date(startedAtMs).toISOString();

    try {
      const result = await this.generator.generate(input, context);
      this.logger.record({
        requestId: context.requestId,
        generatorType: this.generatorType,
        promptVersion: this.promptVersion,
        startedAt,
        durationMs: Math.max(0, this.now() - startedAtMs),
        success: true,
        retried: result.metadata.attemptCount > 1,
        fallbackUsed: result.metadata.fallbackUsed,
        finalErrorType: result.metadata.fallbackReason,
      });
      return result;
    } catch (error) {
      const generationError = normalizeStoryGenerationError(error);
      this.logger.record({
        requestId: context.requestId,
        generatorType: this.generatorType,
        promptVersion: this.promptVersion,
        startedAt,
        durationMs: Math.max(0, this.now() - startedAtMs),
        success: false,
        retried: generationError.attemptCount > 1,
        fallbackUsed: false,
        finalErrorType: generationError.code,
      });
      throw generationError;
    }
  }
}
