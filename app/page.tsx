import { storyPreview } from "@/lib/story";

const experienceSteps = ["进入故事", "做出两次选择", "获得专属结局"];

export default function Home() {
  return (
    <main className="relative flex min-h-screen items-center overflow-hidden px-6 py-16 sm:px-10">
      <div
        aria-hidden="true"
        className="absolute left-1/2 top-0 h-96 w-96 -translate-x-1/2 rounded-full bg-amber-200/20 blur-3xl"
      />

      <section className="relative mx-auto w-full max-w-3xl rounded-[2rem] border border-white/10 bg-slate-950/65 p-7 shadow-2xl shadow-black/30 backdrop-blur sm:p-12">
        <p className="mb-6 text-xs font-semibold tracking-[0.32em] text-amber-200 uppercase">
          AI Story Lab · MVP
        </p>

        <h1 className="max-w-2xl text-4xl leading-tight font-semibold tracking-tight text-white sm:text-6xl">
          {storyPreview.title}
        </h1>

        <p className="mt-6 max-w-xl text-base leading-8 text-slate-300 sm:text-lg">
          {storyPreview.premise}
        </p>

        <ol className="mt-10 grid gap-3 sm:grid-cols-3">
          {experienceSteps.map((step, index) => (
            <li
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-200"
              key={step}
            >
              <span className="mr-2 text-amber-200">0{index + 1}</span>
              {step}
            </li>
          ))}
        </ol>

        <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
          <button
            className="rounded-full bg-amber-200 px-7 py-3.5 text-sm font-semibold text-slate-950 transition hover:bg-amber-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-200"
            type="button"
          >
            故事正在准备中
          </button>
          <p className="text-sm text-slate-400">免登录 · 约 3 分钟 · 手机网页</p>
        </div>
      </section>
    </main>
  );
}
