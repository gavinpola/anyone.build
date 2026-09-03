import type { ReactNode } from "react";

/** Plain reading pages (rules, FAQ, terms, privacy). One column, generous type. */
export function Prose({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  return (
    <article className="mx-auto max-w-[680px] px-4 py-12 sm:px-6">
      <h1 className="font-display text-4xl sm:text-5xl">{title}</h1>
      {intro ? <p className="mt-4 text-[17px] leading-relaxed text-ink-2">{intro}</p> : null}
      <div className="mt-8 flex flex-col gap-6 text-[16px] leading-relaxed text-ink-2 [&_h2]:mt-4 [&_h2]:text-[22px] [&_h2]:font-bold [&_h2]:text-ink [&_strong]:text-ink">{children}</div>
    </article>
  );
}
