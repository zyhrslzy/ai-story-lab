import { describe, expect, it } from "vitest";

import { generateMockStory } from "./mock-story-generator";
import { parseAndValidateGeneratedStory } from "./story-validation";

const input = {
  theme: "遗忘的车站",
  protagonistName: "林夏",
  protagonistIdentity: "城市夜班记者",
  storyStyle: "温柔治愈",
};

describe("generated story validation pipeline", () => {
  it("accepts valid JSON, schema and story graph data", () => {
    const story = generateMockStory(input);

    expect(parseAndValidateGeneratedStory(JSON.stringify(story))).toEqual(story);
  });

  it("rejects non-JSON text", () => {
    expect(() => parseAndValidateGeneratedStory("这不是 JSON")).toThrow(
      expect.objectContaining({ code: "INVALID_JSON" }),
    );
  });

  it("rejects JSON missing required fields", () => {
    expect(() =>
      parseAndValidateGeneratedStory(JSON.stringify({ id: "incomplete" })),
    ).toThrow(expect.objectContaining({ code: "SCHEMA_VALIDATION_ERROR" }));
  });

  it("separates story graph errors from schema errors", () => {
    const story = generateMockStory(input);
    story.nodes[0].choices[0].nextNodeId = "missing";

    expect(() => parseAndValidateGeneratedStory(JSON.stringify(story))).toThrow(
      expect.objectContaining({ code: "STORY_GRAPH_ERROR" }),
    );
  });
});
