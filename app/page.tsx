import { StoryCreator } from "@/components/story-creator";

export default function Home() {
  return (
    <main className="min-h-screen px-5 py-10 sm:px-8 sm:py-16">
      <section className="mx-auto w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-950/80 p-6 shadow-xl sm:p-9">
        <p className="text-xs font-semibold tracking-[0.24em] text-amber-200 uppercase">
          AI Story Lab
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          创作一段属于你的故事
        </h1>
        <p className="mt-4 leading-7 text-slate-400">
          填写四项设定，生成一段包含两次选择和多个结局的互动故事。
        </p>

        <StoryCreator />
      </section>
    </main>
  );
}
