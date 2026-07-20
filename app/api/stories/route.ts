import { createStoryGeneratorFromEnvironment } from "@/lib/ai-story-generator";
import { storyInputSchema } from "@/lib/story";
import {
  createStoryGenerationContext,
  isStoryGenerationError,
  safeErrorMessageByCode,
  type StoryGenerationErrorCode,
} from "@/lib/story-generator";

export const runtime = "nodejs";

const statusByErrorCode: Record<StoryGenerationErrorCode, number> = {
  INVALID_INPUT: 400,
  NOT_CONFIGURED: 503,
  TIMEOUT: 504,
  NETWORK_ERROR: 502,
  MODEL_ERROR: 502,
  INVALID_JSON: 502,
  SCHEMA_VALIDATION_ERROR: 502,
  STORY_GRAPH_ERROR: 502,
  UNKNOWN_ERROR: 500,
};

function errorResponse(code: StoryGenerationErrorCode, requestId: string) {
  return Response.json(
    {
      error: {
        code,
        message: safeErrorMessageByCode[code],
        requestId,
      },
    },
    { status: statusByErrorCode[code] },
  );
}

export async function POST(request: Request) {
  const context = createStoryGenerationContext();
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return errorResponse("INVALID_INPUT", context.requestId);
  }

  const inputResult = storyInputSchema.safeParse(body);
  if (!inputResult.success) {
    return errorResponse("INVALID_INPUT", context.requestId);
  }

  try {
    const generator = createStoryGeneratorFromEnvironment();
    const result = await generator.generate(inputResult.data, context);
    return Response.json(result);
  } catch (error) {
    if (isStoryGenerationError(error)) {
      return errorResponse(error.code, context.requestId);
    }

    return errorResponse("UNKNOWN_ERROR", context.requestId);
  }
}
