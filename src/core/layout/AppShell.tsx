import { useEffect, type ReactNode } from "react";
import { useLocation } from "@tanstack/react-router";
import { trackPageview } from "@/core/lib/analytics";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { ClaimPrompt } from "@/core/auth/ClaimPrompt";
import { Picker } from "@/core/picker/Picker";
import { Composer } from "@/core/composer/Composer";
import { pickerStore } from "@/core/picker/pickerStore";
import { usePageview } from "@/core/lib/usePageview";

export function AppShell({ children }: { children: ReactNode }) {
  usePageview();
  // Navigating away closes the picker and any open composer (it's a portal that would otherwise
  // float over the new page).
  const { pathname } = useLocation();
  useEffect(() => {
    pickerStore.clear();
    trackPageview(pathname);
  }, [pathname]);
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
