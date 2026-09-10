"use client";

import { Toaster } from "sonner";
import type { ReactNode } from "react";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <LanguageProvider>
      {children}
      <Toaster
        position="top-center"
        richColors
        toastOptions={{
          style: {
            borderRadius: "0.9rem",
            border: "1px solid rgba(226,232,240,0.6)",
            boxShadow: "0 12px 32px rgba(15,23,42,0.12)",
          },
        }}
      />
    </LanguageProvider>
  );
}