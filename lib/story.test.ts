import { describe, expect, it } from "vitest";

import { generateMockStory } from "./mock-story-generator";
import {
  STORY_SESSION_KEY,
  loadStorySession,
  saveStorySession,
  type StoryStorage,
} from "./story-session";
import { branchStorySchema, chooseStoryPath } from "./story";

const input = {
  theme: "遗忘的车站",
  protagonistName: "林夏",
  protagonistIdentity: "城市夜班记者",
  storyStyle: "温柔治愈",
};

class MemoryStorage implements StoryStorage {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

describe("branchStorySchema", () => {
  it("accepts the seven-node mock story", () => {
    const story = generateMockStory(input);

    expect(branchStorySchema.parse(story)).toEqual(story);
    expect(story.nodes).toHaveLength(7);
    expect(story.nodes.filter((node) => node.endingType)).toHaveLength(4);
  });

  it("rejects a normal node with anything other than two choices", () => {
    const story = generateMockStory(input);
    story.nodes[0].choices = story.nodes[0].choices.slice(0, 1);

    expect(() => branchStorySchema.parse(story)).toThrow(
      "普通节点必须且只能包含两个选择",
    );
  });

  it("rejects a story with more than seven nodes", () => {
    const story = generateMockStory(input);
    story.nodes.push({
      id: "ending-extra",
      content: "这个额外结局会让故事超过 MVP 节点上限。",
      endingType: "hopeful",
      choices: [],
    });

    expect(branchStorySchema.safeParse(story).success).toBe(false);
  });

  it("rejects a choice that points to a missing node", () => {
    const story = generateMockStory(input);
    story.nodes[0].choices[0].nextNodeId = "missing";

    expect(() => branchStorySchema.parse(story)).toThrow(
      "选择指向不存在的节点",
    );
  });

  it("rejects a story with fewer than two ending types", () => {
    const story = generateMockStory(input);
    story.nodes.forEach((node) => {
      if (node.endingType) node.endingType = "hopeful";
    });

    expect(() => branchStorySchema.parse(story)).toThrow(
      "故事必须至少包含两个不同类型的结局",
    );
  });
});

describe("story progression", () => {
  it("reaches an ending after two valid choices", () => {
    const story = generateMockStory(input);
    const secondNode = chooseStoryPath(story, story.startNodeId, "open");
    const endingNode = chooseStoryPath(story, secondNode.id, "board");

    expect(secondNode.endingType).toBeNull();
    expect(endingNode.endingType).toBe("hopeful");
    expect(endingNode.choices).toHaveLength(0);
  });
});

describe("story session persistence", () => {
  it("restores a validated story and current node", () => {
    const storage = new MemoryStorage();
    const story = generateMockStory(input);
    const nextNode = chooseStoryPath(story, story.startNodeId, "wait");

    saveStorySession(storage, story, nextNode.id);

    expect(loadStorySession(storage)).toMatchObject({
      story: { id: story.id },
      currentNodeId: nextNode.id,
    });
  });

  it("rejects corrupted persisted data", () => {
    const storage = new MemoryStorage();
    storage.setItem(STORY_SESSION_KEY, "{not-json}");

    expect(loadStorySession(storage)).toBeNull();
  });
});
