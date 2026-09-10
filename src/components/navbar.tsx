"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { GraduationCap, Menu, X, LogOut, LayoutGrid } from "lucide-react";
import { useLang } from "@/lib/i18n/LanguageProvider";
import { LanguageToggle } from "./language-toggle";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { cn } from "@/lib/utils";

export function Navbar() {
  const { t } = useLang();
  const [user, setUser] = useState<User | null>(null);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const isPublic = pathname.startsWith("/signin") || pathname.startsWith("/signup");

  const signOut = useCallback(async () => {
    const supabase = createClient();
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
    setOpen(false);
    router.push("/");
    router.refresh();
  }, [router]);

  const links = [
    { href: "/", label: t("nav.home") },
    { href: "/about", label: t("nav.about") },
    { href: "/#contact", label: t("nav.contact") },
  ];

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-slate-200/60 bg-white/70 backdrop-blur-xl">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-royal-600 to-royal-800 text-white shadow-lg shadow-royal-700/30">
            <GraduationCap className="h-5 w-5" aria-hidden />
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-extrabold tracking-tight text-slate-900">
              {t("brand.short")}
            </span>
            <span className="block text-[11px] font-medium text-slate-400">
              {t("brand.tagline")}
            </span>
          </span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-royal-50 hover:text-royal-700"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <LanguageToggle className="hidden sm:flex" />
          {user ? (
            <div className="hidden items-center gap-2 md:flex">
              <Link
                href="/dashboard"
                className="inline-flex h-9 items-center gap-2 rounded-xl bg-royal-700 px-4 text-sm font-semibold text-white shadow-lg shadow-royal-700/25 transition hover:bg-royal-600"
              >
                <LayoutGrid className="h-4 w-4" aria-hidden />
                {t("nav.dashboard")}
              </Link>
              <button
                onClick={signOut}
                className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-600 transition hover:border-royal-300 hover:text-royal-700"
              >
                <LogOut className="h-4 w-4" aria-hidden />
              </button>
            </div>
          ) : !isPublic ? (
            <div className="hidden items-center gap-2 md:flex">
              <Link
                href="/signin"
                className="inline-flex h-9 items-center rounded-xl border border-slate-200 bg-white/70 px-4 text-sm font-semibold text-slate-700 transition hover:border-royal-400 hover:text-royal-700"
              >
                {t("nav.signIn")}
              </Link>
              <Link
                href="/signup"
                className="inline-flex h-9 items-center gap-2 rounded-xl bg-royal-700 px-4 text-sm font-semibold text-white shadow-lg shadow-royal-700/25 transition hover:bg-royal-600"
              >
                <GraduationCap className="h-4 w-4" aria-hidden />
                {t("nav.signUp")}
              </Link>
            </div>
          ) : null}

          <button
            onClick={() => setOpen((value) => !value)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white/70 text-slate-700 md:hidden"
            aria-label="Menu"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      <div
        className={cn(
          "overflow-hidden border-t border-slate-200/60 bg-white/95 backdrop-blur transition-all md:hidden",
          open ? "max-h-96" : "max-h-0 border-t-0"
        )}
      >
        <div className="space-y-1 px-4 py-4">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-royal-50 hover:text-royal-700"
            >
              {link.label}
            </Link>
          ))}
          <div className="flex items-center justify-between gap-3 pt-2">
            <LanguageToggle />
            {user ? (
              <div className="flex items-center gap-2">
                <Link
                  href="/dashboard"
                  onClick={() => setOpen(false)}
                  className="inline-flex h-9 items-center rounded-xl bg-royal-700 px-4 text-sm font-semibold text-white"
                >
                  {t("nav.dashboard")}
                </Link>
                <button
                  onClick={signOut}
                  className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/signin"
                  onClick={() => setOpen(false)}
                  className="inline-flex h-9 items-center rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700"
                >
                  {t("nav.signIn")}
                </Link>
                <Link
                  href="/signup"
                  onClick={() => setOpen(false)}
                  className="inline-flex h-9 items-center rounded-xl bg-royal-700 px-4 text-sm font-semibold text-white"
                >
                  {t("nav.signUp")}
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}