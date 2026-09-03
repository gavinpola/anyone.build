import type { ButtonHTMLAttributes, InputHTMLAttributes, TextareaHTMLAttributes, HTMLAttributes } from "react";
import { cn } from "@/core/lib/cn";

/**
 * Kit primitives. Every component spreads `...rest` onto its root so the build-time
 * `data-ab` source stamp (see scripts/vite-plugin-stamp.ts) reaches the DOM and the picker
 * can point at kit-rendered elements inside a block.
 */
type Div = HTMLAttributes<HTMLDivElement>;
type Gap = 1 | 2 | 3 | 4 | 6;
const GAP: Record<Gap, string> = { 1: "gap-1", 2: "gap-2", 3: "gap-3", 4: "gap-4", 6: "gap-6" };

export function Stack({ children, className, gap = 3, ...rest }: Div & { gap?: Gap }) {
  return (
    <div className={cn("flex flex-col", GAP[gap], className)} {...rest}>
      {children}
    </div>
  );
}

export function Row({ children, className, gap = 3, ...rest }: Div & { gap?: Gap }) {
  return (
    <div className={cn("flex flex-row flex-wrap items-center", GAP[gap], className)} {...rest}>
      {children}
    </div>
  );
}

export function Heading({ children, className, level = 2, ...rest }: HTMLAttributes<HTMLHeadingElement> & { level?: 1 | 2 | 3 }) {
  const cls = cn(
    "font-display tracking-tight text-ink",
    level === 1 ? "text-4xl leading-[1.05] sm:text-5xl" : level === 2 ? "text-2xl" : "text-lg",
    className,
  );
  if (level === 1)
    return (
      <h1 className={cls} {...rest}>
        {children}
      </h1>
    );
  if (level === 3)
    return (
      <h3 className={cls} {...rest}>
        {children}
      </h3>
    );
  return (
    <h2 className={cls} {...rest}>
      {children}
    </h2>
  );
}

export function Text({ children, className, muted, ...rest }: HTMLAttributes<HTMLParagraphElement> & { muted?: boolean }) {
  return (
    <p className={cn("text-[15px] leading-relaxed", muted ? "text-muted" : "text-ink-2", className)} {...rest}>
      {children}
    </p>
  );
}

export function Label({ children, className, ...rest }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={cn("placard smallcaps", className)} {...rest}>
      {children}
    </span>
  );
}

export function Card({ children, className, ...rest }: Div) {
  return (
    <div className={cn("rounded-lg border border-line bg-paper-2/60 p-4", className)} {...rest}>
      {children}
    </div>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost"; size?: "sm" | "md" | "lg" };
export function Button({ variant = "secondary", size = "md", className, ...rest }: ButtonProps) {
  const base = "inline-flex items-center justify-center gap-2 rounded-md font-medium transition active:translate-y-px disabled:pointer-events-none disabled:opacity-50";
  const v = {
    primary: "bg-accent text-accent-ink hover:brightness-95",
    secondary: "border border-line bg-card text-ink hover:border-line-2",
    ghost: "text-ink-2 hover:bg-paper-2",
  }[variant];
  const s = { sm: "h-8 px-3 text-[13px]", md: "h-10 px-4 text-[14px]", lg: "h-12 px-6 text-[16px]" }[size];
  return <button type="button" className={cn(base, v, s, className)} {...rest} />;
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn("h-10 w-full rounded-md border border-line bg-card px-3 text-[14px] text-ink placeholder:text-muted focus:border-line-2", className)} {...rest} />;
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn("w-full rounded-md border border-line bg-card px-3 py-2 text-[14px] text-ink placeholder:text-muted focus:border-line-2", className)} {...rest} />;
}

export function Divider(props: HTMLAttributes<HTMLHRElement>) {
  return <hr className="border-0 border-t border-line" {...props} />;
}
