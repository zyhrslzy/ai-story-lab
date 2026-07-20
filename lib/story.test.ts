import { describe, expect, it } from "vitest";

import { generateMockStory } from "./mock-story-generator";
import { validateStoryGraph } from "./story-graph";
import {
  STORY_SESSION_KEY,
  loadStorySession,
  saveStorySession,
  type StoryStorage,
} from "./story-session";
import {
  branchStorySchema,
  chooseStoryPath,
  type BranchStoryStructure,
} from "./story";

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

  it("rejects duplicate node ids", () => {
    const story = generateMockStory(input);
    story.nodes[1].id = story.nodes[0].id;

    expect(validateStoryGraph(story)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "DUPLICATE_NODE_ID" }),
      ]),
    );
  });

  it("rejects a story without endings", () => {
    const story = generateMockStory(input);
    story.nodes.forEach((node) => {
      node.endingType = null;
    });

    expect(validateStoryGraph(story)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "INSUFFICIENT_ENDINGS" }),
      ]),
    );
  });

  it("rejects a story with only one ending", () => {
    const story = generateMockStory(input);
    const onlyEndingId = "ending-home";
    story.nodes.forEach((node) => {
      if (node.endingType === null) {
        node.choices.forEach((choice) => {
          if (choice.nextNodeId.startsWith("ending-")) choice.nextNodeId = onlyEndingId;
        });
      }
    });
    story.nodes = story.nodes.filter(
      (node) => node.endingType === null || node.id === onlyEndingId,
    );

    expect(validateStoryGraph(story)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "INSUFFICIENT_ENDINGS" }),
      ]),
    );
  });

  it("rejects an ending node that still contains choices", () => {
    const story = generateMockStory(input);
    story.nodes[3].choices = [
      { id: "continue", text: "继续前进", nextNodeId: story.startNodeId },
    ];

    expect(validateStoryGraph(story)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "INVALID_NODE_CHOICES" }),
      ]),
    );
  });

  it("rejects a reachable cycle", () => {
    const story = generateMockStory(input);
    story.nodes[1].choices[0].nextNodeId = story.startNodeId;

    expect(validateStoryGraph(story)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "CYCLE_DETECTED" }),
      ]),
    );
  });

  it("rejects an unreachable isolated node", () => {
    const story = generateMockStory(input);
    story.nodes[1].choices[1].nextNodeId = story.nodes[1].choices[0].nextNodeId;

    expect(validateStoryGraph(story)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "UNREACHABLE_NODE" }),
      ]),
    );
  });

  it("rejects paths that need more than two choices", () => {
    const story: BranchStoryStructure = {
      id: "too-deep",
      title: "过深的故事",
      premise: "这条路径需要三次选择。",
      theme: "选择",
      style: "治愈",
      protagonist: { name: "林夏", identity: "记者" },
      startNodeId: "start",
      nodes: [
        {
          id: "start",
          content: "开始",
          endingType: null,
          choices: [
            { id: "a", text: "左", nextNodeId: "middle-a" },
            { id: "b", text: "右", nextNodeId: "middle-b" },
          ],
        },
        {
          id: "middle-a",
          content: "左路",
          endingType: null,
          choices: [
            { id: "a1", text: "继续", nextNodeId: "third" },
            { id: "a2", text: "仍继续", nextNodeId: "third" },
          ],
        },
        {
          id: "middle-b",
          content: "右路",
          endingType: null,
          choices: [
            { id: "b1", text: "继续", nextNodeId: "third" },
            { id: "b2", text: "仍继续", nextNodeId: "third" },
          ],
        },
        {
          id: "third",
          content: "第三次选择",
          endingType: null,
          choices: [
            { id: "end-a", text: "希望", nextNodeId: "hope" },
            { id: "end-b", text: "余味", nextNodeId: "bitter" },
          ],
        },
        { id: "hope", content: "希望结局", endingType: "hopeful", choices: [] },
        {
          id: "bitter",
          content: "余味结局",
          endingType: "bittersweet",
          choices: [],
        },
      ],
    };

    expect(validateStoryGraph(story)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "INVALID_PATH_LENGTH" }),
      ]),
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
