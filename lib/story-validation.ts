import { branchStoryStructureSchema, type BranchStory } from "./story";
import { validateStoryGraph } from "./story-graph";
import { StoryGenerationError } from "./story-generator";

export function parseAndValidateGeneratedStory(rawOutput: string): BranchStory {
  let candidate: unknown;

  try {
    candidate = JSON.parse(rawOutput);
  } catch (error) {
    throw new StoryGenerationError("INVALID_JSON", {
      retryable: true,
      technicalCause: error,
    });
  }

  const structureResult = branchStoryStructureSchema.safeParse(candidate);
  if (!structureResult.success) {
    throw new StoryGenerationError("SCHEMA_VALIDATION_ERROR", {
      retryable: true,
      technicalCause: structureResult.error,
    });
  }

  const graphIssues = validateStoryGraph(structureResult.data);
  if (graphIssues.length > 0) {
    throw new StoryGenerationError("STORY_GRAPH_ERROR", {
      retryable: true,
      technicalCause: graphIssues,
    });
  }

  return structureResult.data;
}
