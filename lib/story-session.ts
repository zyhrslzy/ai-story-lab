import { z } from "zod";

import { branchStorySchema, type BranchStory } from "./story";

export const STORY_SESSION_KEY = "ai-story-lab.session.v1";
const STORY_SESSION_EVENT = "ai-story-lab:session-change";

export const storySessionSchema = z
  .object({
    story: branchStorySchema,
    currentNodeId: z.string().min(1),
  })
  .superRefine((session, context) => {
    if (!session.story.nodes.some((node) => node.id === session.currentNodeId)) {
      context.addIssue({
        code: "custom",
        message: "当前节点不存在于故事中",
        path: ["currentNodeId"],
      });
    }
  });

export type StorySession = z.infer<typeof storySessionSchema>;

export interface StoryStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function serializeStorySession(session: StorySession): string {
  return JSON.stringify(storySessionSchema.parse(session));
}

export function parseStorySession(raw: string | null): StorySession | null {
  if (!raw) return null;

  try {
    return storySessionSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveStorySession(
  storage: StoryStorage,
  story: BranchStory,
  currentNodeId = story.startNodeId,
): StorySession {
  const session = storySessionSchema.parse({ story, currentNodeId });
  storage.setItem(STORY_SESSION_KEY, serializeStorySession(session));
  return session;
}

export function loadStorySession(storage: StoryStorage): StorySession | null {
  return parseStorySession(storage.getItem(STORY_SESSION_KEY));
}

export function clearStorySession(storage: StoryStorage): void {
  storage.removeItem(STORY_SESSION_KEY);
}

function notifyBrowserSessionChange(): void {
  window.dispatchEvent(new Event(STORY_SESSION_EVENT));
}

export function saveBrowserStorySession(
  story: BranchStory,
  currentNodeId = story.startNodeId,
): StorySession {
  const session = saveStorySession(window.localStorage, story, currentNodeId);
  notifyBrowserSessionChange();
  return session;
}

export function clearBrowserStorySession(): void {
  clearStorySession(window.localStorage);
  notifyBrowserSessionChange();
}

export function getBrowserStorySessionSnapshot(): string | null {
  return window.localStorage.getItem(STORY_SESSION_KEY);
}

export function subscribeToBrowserStorySession(callback: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORY_SESSION_KEY) callback();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(STORY_SESSION_EVENT, callback);

  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(STORY_SESSION_EVENT, callback);
  };
}
