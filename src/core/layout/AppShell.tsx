import type { ReactNode } from "react";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { ClaimPrompt } from "@/core/auth/ClaimPrompt";
import { Picker } from "@/core/picker/Picker";
import { Composer } from "@/core/composer/Composer";
import { usePageview } from "@/core/lib/usePageview";

export function AppShell({ children }: { children: ReactNode }) {
  usePageview();
  return (
    <div className="flex min-h-dvh flex-col pb-20">
      <Header />
      <ClaimPrompt />
      <main className="flex-1">{children}</main>
      <Footer />
      <Picker />
      <Composer />
    </div>
  );
}
