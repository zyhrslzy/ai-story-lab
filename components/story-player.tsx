"use client";

import { useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";

import {
  clearBrowserStorySession,
  getBrowserStorySessionSnapshot,
  parseStorySession,
  saveBrowserStorySession,
  subscribeToBrowserStorySession,
} from "@/lib/story-session";
import { chooseStoryPath, getStoryNode } from "@/lib/story";

const endingLabels = {
  hopeful: "希望结局",
  bittersweet: "余味结局",
} as const;

export function StoryPlayer() {
  const router = useRouter();
  const rawSession = useSyncExternalStore<string | null | undefined>(
    subscribeToBrowserStorySession,
    getBrowserStorySessionSnapshot,
    () => undefined,
  );

  if (rawSession === undefined) {
    return <StatusCard message="正在载入故事…" />;
  }

  const session = parseStorySession(rawSession);

  if (!session) {
    return (
      <StatusCard
        action={() => router.replace("/")}
        actionLabel="开始创作"
        message="还没有可游玩的故事"
      />
    );
  }

  const currentNode = getStoryNode(session.story, session.currentNodeId);

  function choose(choiceId: string) {
    if (!session) return;
    const nextNode = chooseStoryPath(session.story, session.currentNodeId, choiceId);
    saveBrowserStorySession(session.story, nextNode.id);
  }

  function createAgain() {
    clearBrowserStorySession();
    router.push("/");
  }

  return (
    <article className="mx-auto w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-950/80 p-6 shadow-xl sm:p-8">
      <header className="border-b border-slate-800 pb-5">
        <p className="text-xs font-semibold tracking-[0.24em] text-amber-200 uppercase">
          {currentNode.endingType ? endingLabels[currentNode.endingType] : session.story.style}
        </p>
        <h1 className="mt-3 text-2xl font-semibold text-white sm:text-3xl">
          {session.story.title}
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          主角：{session.story.protagonist.name} · {session.story.protagonist.identity}
        </p>
      </header>

      <p className="mt-7 text-base leading-8 text-slate-200">{currentNode.content}</p>

      {currentNode.endingType ? (
        <button
          className="mt-8 w-full rounded-xl bg-amber-200 px-6 py-3.5 font-semibold text-slate-950 hover:bg-amber-100"
          onClick={createAgain}
          type="button"
        >
          重新创作
        </button>
      ) : (
        <div className="mt-8 space-y-3" aria-label="故事选择">
          {currentNode.choices.map((choice) => (
            <button
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-5 py-4 text-left text-sm leading-6 text-slate-100 transition hover:border-amber-200 hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200"
              key={choice.id}
              onClick={() => choose(choice.id)}
              type="button"
            >
              {choice.text}
            </button>
          ))}
        </div>
      )}
    </article>
  );
}

function StatusCard({
  message,
  action,
  actionLabel,
}: {
  message: string;
  action?: () => void;
  actionLabel?: string;
}) {
  return (
    <div className="mx-auto w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950/80 p-8 text-center">
      <p className="text-slate-300">{message}</p>
      {action && actionLabel ? (
        <button
          className="mt-6 rounded-xl bg-amber-200 px-6 py-3 font-semibold text-slate-950"
          onClick={action}
          type="button"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
