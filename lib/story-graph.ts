import type { BranchStoryStructure } from "./story";

export const MAX_STORY_CHOICES = 2;

export type StoryGraphIssueCode =
  | "DUPLICATE_NODE_ID"
  | "INVALID_NODE_CHOICES"
  | "DUPLICATE_CHOICE_ID"
  | "MISSING_START_NODE"
  | "MISSING_NEXT_NODE"
  | "INSUFFICIENT_ENDINGS"
  | "NO_REACHABLE_ENDING"
  | "CYCLE_DETECTED"
  | "UNREACHABLE_NODE"
  | "INVALID_PATH_LENGTH";

export type StoryGraphIssue = {
  code: StoryGraphIssueCode;
  message: string;
  path: PropertyKey[];
};

export function validateStoryGraph(story: BranchStoryStructure): StoryGraphIssue[] {
  const issues: StoryGraphIssue[] = [];
  const nodeIds = new Set<string>();

  story.nodes.forEach((node, nodeIndex) => {
    if (nodeIds.has(node.id)) {
      issues.push({
        code: "DUPLICATE_NODE_ID",
        message: `节点 id 重复：${node.id}`,
        path: ["nodes", nodeIndex, "id"],
      });
    }
    nodeIds.add(node.id);

    if (node.endingType === null && node.choices.length !== 2) {
      issues.push({
        code: "INVALID_NODE_CHOICES",
        message: "普通节点必须且只能包含两个选择",
        path: ["nodes", nodeIndex, "choices"],
      });
    }

    if (node.endingType !== null && node.choices.length !== 0) {
      issues.push({
        code: "INVALID_NODE_CHOICES",
        message: "结局节点不能再包含选择",
        path: ["nodes", nodeIndex, "choices"],
      });
    }

    const choiceIds = new Set<string>();
    node.choices.forEach((choice, choiceIndex) => {
      if (choiceIds.has(choice.id)) {
        issues.push({
          code: "DUPLICATE_CHOICE_ID",
          message: `选择 id 重复：${choice.id}`,
          path: ["nodes", nodeIndex, "choices", choiceIndex, "id"],
        });
      }
      choiceIds.add(choice.id);
    });
  });

  if (!nodeIds.has(story.startNodeId)) {
    issues.push({
      code: "MISSING_START_NODE",
      message: "起始节点不存在",
      path: ["startNodeId"],
    });
  }

  story.nodes.forEach((node, nodeIndex) => {
    node.choices.forEach((choice, choiceIndex) => {
      if (!nodeIds.has(choice.nextNodeId)) {
        issues.push({
          code: "MISSING_NEXT_NODE",
          message: `选择指向不存在的节点：${choice.nextNodeId}`,
          path: ["nodes", nodeIndex, "choices", choiceIndex, "nextNodeId"],
        });
      }
    });
  });

  const endingNodes = story.nodes.filter((node) => node.endingType !== null);
  const endingTypes = new Set(endingNodes.map((node) => node.endingType));
  if (endingNodes.length < 2 || endingTypes.size < 2) {
    issues.push({
      code: "INSUFFICIENT_ENDINGS",
      message: "故事必须至少包含两个不同类型的结局",
      path: ["nodes"],
    });
  }

  const hasBlockingReferenceIssue = issues.some(
    (issue) =>
      issue.code === "DUPLICATE_NODE_ID" ||
      issue.code === "MISSING_START_NODE" ||
      issue.code === "MISSING_NEXT_NODE",
  );
  if (hasBlockingReferenceIssue) return issues;

  const nodesById = new Map(story.nodes.map((node) => [node.id, node]));
  const visited = new Set<string>();
  const visiting = new Set<string>();
  let hasCycle = false;
  let reachableEndingCount = 0;
  let hasInvalidPathLength = false;

  const visit = (nodeId: string, choiceCount: number) => {
    if (visiting.has(nodeId)) {
      hasCycle = true;
      return;
    }

    const node = nodesById.get(nodeId);
    if (!node) return;

    visited.add(nodeId);

    if (node.endingType !== null) {
      reachableEndingCount += 1;
      if (choiceCount !== MAX_STORY_CHOICES) hasInvalidPathLength = true;
      return;
    }

    if (choiceCount >= MAX_STORY_CHOICES) {
      hasInvalidPathLength = true;
    }

    visiting.add(nodeId);
    node.choices.forEach((choice) => visit(choice.nextNodeId, choiceCount + 1));
    visiting.delete(nodeId);
  };

  visit(story.startNodeId, 0);

  if (reachableEndingCount === 0) {
    issues.push({
      code: "NO_REACHABLE_ENDING",
      message: "从起始节点无法到达任何结局",
      path: ["nodes"],
    });
  }

  if (hasCycle) {
    issues.push({
      code: "CYCLE_DETECTED",
      message: "故事分支不能包含循环",
      path: ["nodes"],
    });
  }

  if (visited.size !== story.nodes.length) {
    issues.push({
      code: "UNREACHABLE_NODE",
      message: "所有节点都必须能从起始节点到达",
      path: ["nodes"],
    });
  }

  if (hasInvalidPathLength) {
    issues.push({
      code: "INVALID_PATH_LENGTH",
      message: `每条故事路径必须经过 ${MAX_STORY_CHOICES} 次选择到达结局`,
      path: ["nodes"],
    });
  }

  return issues;
}
