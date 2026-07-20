import { createStoryGeneratorFromEnvironment } from "@/lib/ai-story-generator";
import { storyInputSchema } from "@/lib/story";
import {
  isStoryGenerationError,
  type StoryGenerationErrorCode,
} from "@/lib/story-generator";

export const runtime = "nodejs";

const statusByErrorCode: Record<StoryGenerationErrorCode, number> = {
  INVALID_INPUT: 400,
  NOT_CONFIGURED: 503,
  TIMEOUT: 504,
  PROVIDER_ERROR: 502,
  INVALID_OUTPUT: 502,
};

function errorResponse(code: StoryGenerationErrorCode) {
  return Response.json({ error: { code } }, { status: statusByErrorCode[code] });
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return errorResponse("INVALID_INPUT");
  }

  const inputResult = storyInputSchema.safeParse(body);
  if (!inputResult.success) {
    return errorResponse("INVALID_INPUT");
  }

  try {
    const generator = createStoryGeneratorFromEnvironment();
    const story = await generator.generate(inputResult.data);
    return Response.json(story);
  } catch (error) {
    if (isStoryGenerationError(error)) {
      return errorResponse(error.code);
    }

    return errorResponse("PROVIDER_ERROR");
  }
}
