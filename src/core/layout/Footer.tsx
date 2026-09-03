import { Link } from "@tanstack/react-router";

const link = "text-accent hover:underline underline-offset-2";

/** Centered, two lines, like a colophon. */
export function Footer() {
  return (
    <footer className="mt-20 px-4 pb-14 pt-10 text-center text-[15px] text-ink-2">
      <p>
        Built by{" "}
        <a href="https://github.com/gavinpola" target="_blank" rel="noopener noreferrer" className={link}>
          @gavinpola
        </a>{" "}
        and{" "}
        <a href="https://github.com/ybshah02" target="_blank" rel="noopener noreferrer" className={link}>
          @ybshah02
        </a>{" "}
        · and by everyone who clicked ·{" "}
        <a href="https://github.com/gavinpola/anyone.build" target="_blank" rel="noopener noreferrer" className={link}>
          open source
        </a>
      </p>
      <p className="mt-2">
        <Link to="/rules" className={link}>Rules</Link>
        <span className="mx-2">·</span>
        <Link to="/faq" className={link}>FAQ</Link>
        <span className="mx-2">·</span>
        <Link to="/terms" className={link}>Terms</Link>
        <span className="mx-2">·</span>
        <Link to="/privacy" className={link}>Privacy</Link>
        <span className="mx-2">·</span>
        <Link to="/for-your-site" className={link}>For your site</Link>
        <span className="mx-2">·</span>
        <a href="https://github.com/gavinpola/anyone.build/blob/main/docs/CONSTITUTION.md" target="_blank" rel="noopener noreferrer" className={link}>
          The judge's rules
        </a>
      </p>
    </footer>
  );
}
