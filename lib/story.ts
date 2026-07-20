import { z } from "zod";

export const storyInputSchema = z.object({
  theme: z.string().trim().min(2, "故事主题至少需要 2 个字").max(40),
  protagonistName: z.string().trim().min(1, "请填写主角名字").max(20),
  protagonistIdentity: z.string().trim().min(2, "主角身份至少需要 2 个字").max(30),
  storyStyle: z.string().trim().min(2, "故事风格至少需要 2 个字").max(20),
});

export type StoryInput = z.infer<typeof storyInputSchema>;

export const endingTypeSchema = z.enum(["hopeful", "bittersweet"]);

export const storyChoiceSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1).max(80),
  nextNodeId: z.string().min(1),
});

export const storyNodeSchema = z.object({
  id: z.string().min(1),
  content: z.string().min(1).max(600),
  choices: z.array(storyChoiceSchema).max(2),
  endingType: endingTypeSchema.nullable(),
});

export const branchStoryStructureSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(100),
  premise: z.string().min(1).max(300),
  theme: z.string().min(1).max(40),
  style: z.string().min(1).max(20),
  protagonist: z.object({
    name: z.string().min(1).max(20),
    identity: z.string().min(1).max(30),
  }),
  startNodeId: z.string().min(1),
  nodes: z.array(storyNodeSchema).min(3).max(7),
});

export const branchStorySchema = branchStoryStructureSchema.superRefine((story, context) => {
    const nodeIds = new Set<string>();

    story.nodes.forEach((node, index) => {
      if (nodeIds.has(node.id)) {
        context.addIssue({
          code: "custom",
          message: `节点 id 重复：${node.id}`,
          path: ["nodes", index, "id"],
        });
      }
      nodeIds.add(node.id);

      if (node.endingType === null && node.choices.length !== 2) {
        context.addIssue({
          code: "custom",
          message: "普通节点必须且只能包含两个选择",
          path: ["nodes", index, "choices"],
        });
      }

      if (node.endingType !== null && node.choices.length !== 0) {
        context.addIssue({
          code: "custom",
          message: "结局节点不能再包含选择",
          path: ["nodes", index, "choices"],
        });
      }
    });

    if (!nodeIds.has(story.startNodeId)) {
      context.addIssue({
        code: "custom",
        message: "起始节点不存在",
        path: ["startNodeId"],
      });
    }

    story.nodes.forEach((node, nodeIndex) => {
      const choiceIds = new Set<string>();

      node.choices.forEach((choice, choiceIndex) => {
        if (choiceIds.has(choice.id)) {
          context.addIssue({
            code: "custom",
            message: `选择 id 重复：${choice.id}`,
            path: ["nodes", nodeIndex, "choices", choiceIndex, "id"],
          });
        }
        choiceIds.add(choice.id);

        if (!nodeIds.has(choice.nextNodeId)) {
          context.addIssue({
            code: "custom",
            message: `选择指向不存在的节点：${choice.nextNodeId}`,
            path: ["nodes", nodeIndex, "choices", choiceIndex, "nextNodeId"],
          });
        }
      });
    });

    const endingNodes = story.nodes.filter((node) => node.endingType !== null);
    const endingTypes = new Set(endingNodes.map((node) => node.endingType));

    if (endingNodes.length < 2 || endingTypes.size < 2) {
      context.addIssue({
        code: "custom",
        message: "故事必须至少包含两个不同类型的结局",
        path: ["nodes"],
      });
    }

    const nodesById = new Map(story.nodes.map((node) => [node.id, node]));
    const visited = new Set<string>();
    const visiting = new Set<string>();
    let hasCycle = false;

    const visit = (nodeId: string) => {
      if (visiting.has(nodeId)) {
        hasCycle = true;
        return;
      }
      if (visited.has(nodeId)) return;

      const node = nodesById.get(nodeId);
      if (!node) return;

      visiting.add(nodeId);
      node.choices.forEach((choice) => visit(choice.nextNodeId));
      visiting.delete(nodeId);
      visited.add(nodeId);
    };

    visit(story.startNodeId);

    if (hasCycle) {
      context.addIssue({
        code: "custom",
        message: "故事分支不能包含循环",
        path: ["nodes"],
      });
    }

    if (visited.size !== story.nodes.length) {
      context.addIssue({
        code: "custom",
        message: "所有节点都必须能从起始节点到达",
        path: ["nodes"],
      });
    }
});

export type BranchStory = z.infer<typeof branchStorySchema>;
export type StoryNode = z.infer<typeof storyNodeSchema>;

export function getStoryNode(story: BranchStory, nodeId: string): StoryNode {
  const node = story.nodes.find((candidate) => candidate.id === nodeId);
  if (!node) throw new Error(`Story node not found: ${nodeId}`);
  return node;
}

export function chooseStoryPath(
  story: BranchStory,
  currentNodeId: string,
  choiceId: string,
): StoryNode {
  const currentNode = getStoryNode(story, currentNodeId);
  const choice = currentNode.choices.find((candidate) => candidate.id === choiceId);

  if (!choice) throw new Error(`Story choice not found: ${choiceId}`);
  return getStoryNode(story, choice.nextNodeId);
}
