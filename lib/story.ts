import { z } from "zod";

import { validateStoryGraph } from "./story-graph";

export const storyInputSchema = z.object({
  theme: z.string().trim().min(2, "故事主题至少需要 2 个字").max(40),
  protagonistName: z.string().trim().min(1, "请填写主角名字").max(20),
  protagonistIdentity: z.string().trim().min(2, "主角身份至少需要 2 个字").max(30),
  storyStyle: z.string().trim().min(2, "故事风格至少需要 2 个字").max(20),
});

export type StoryInput = z.infer<typeof storyInputSchema>;

export const endingTypeSchema = z.enum(["hopeful", "bittersweet"]);

export const storyChoiceSchema = z.object({
  id: z.string().trim().min(1),
  text: z.string().trim().min(1).max(80),
  nextNodeId: z.string().trim().min(1),
});

export const storyNodeSchema = z.object({
  id: z.string().trim().min(1),
  content: z.string().trim().min(1).max(600),
  choices: z.array(storyChoiceSchema).max(2),
  endingType: endingTypeSchema.nullable(),
});

export const branchStoryStructureSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(1).max(100),
  premise: z.string().trim().min(1).max(300),
  theme: z.string().trim().min(1).max(40),
  style: z.string().trim().min(1).max(20),
  protagonist: z.object({
    name: z.string().trim().min(1).max(20),
    identity: z.string().trim().min(1).max(30),
  }),
  startNodeId: z.string().trim().min(1),
  nodes: z.array(storyNodeSchema).min(3).max(7),
});

export type BranchStoryStructure = z.infer<typeof branchStoryStructureSchema>;

export const branchStorySchema = branchStoryStructureSchema.superRefine((story, context) => {
  validateStoryGraph(story).forEach((issue) => {
    context.addIssue({
      code: "custom",
      message: issue.message,
      path: issue.path,
    });
  });
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
