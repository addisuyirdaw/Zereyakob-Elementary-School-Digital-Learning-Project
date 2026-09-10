"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CalendarCheck2,
  GraduationCap,
  HeartHandshake,
  LayoutGrid,
  LogOut,
  Menu,
  Settings,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";
import { useLang } from "@/lib/i18n/LanguageProvider";
import { LanguageToggle } from "@/components/language-toggle";
import { useDashboard } from "@/lib/dashboard-context";
import { cn, initials } from "@/lib/utils";

export function DashboardShell({
  children,
}: {
  children: ReactNode;
}) {
  const { t } = useLang();
  const { profile, signOut, user } = useDashboard();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const displayName =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    user?.email ||
    "—";

  const nav = [
    { href: "/dashboard", label: t("dash.overview"), icon: <LayoutGrid className="h-4 w-4" aria-hidden /> },
    { href: "/dashboard/students", label: t("dash.students"), icon: <Users className="h-4 w-4" aria-hidden /> },
    { href: "/dashboard/attendance", label: t("dash.attendance"), icon: <CalendarCheck2 className="h-4 w-4" aria-hidden /> },
    { href: "/dashboard/directory", label: t("dash.directory"), icon: <BarChart3 className="h-4 w-4" aria-hidden /> },
    { href: "/dashboard/reports", label: t("dash.reports"), icon: <GraduationCap className="h-4 w-4" aria-hidden /> },
    { href: "/dashboard/support", label: t("dash.support"), icon: <HeartHandshake className="h-4 w-4" aria-hidden /> },
    { href: "/dashboard/settings", label: t("dash.profile"), icon: <Settings className="h-4 w-4" aria-hidden /> },
  ];

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-royal-600 to-royal-800 text-white shadow-lg shadow-royal-700/30">
          <GraduationCap className="h-5 w-5" aria-hidden />
        </span>
        <div className="leading-tight">
          <p className="text-sm font-extrabold tracking-tight text-slate-900">
            {t("brand.short")}
          </p>
          <p className="text-[11px] text-slate-400">{t("brand.tagline")}</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {nav.map((item) => {
          const active =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition",
                active
                  ? "bg-royal-700 text-white shadow-lg shadow-royal-700/25"
                  : "text-slate-600 hover:bg-royal-50 hover:text-royal-700"
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-slate-200/70 p-3">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-royal-100 text-sm font-bold text-royal-800">
            {initials(profile?.first_name ?? "", profile?.last_name ?? "")}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-slate-900">{displayName}</p>
            <p className="text-xs text-royal-700">{t(`role.${profile?.role}`)}</p>
          </div>
          <button
            onClick={signOut}
            title={t("nav.signOut")}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600"
          >
            <LogOut className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-slate-200/70 bg-white/80 backdrop-blur-xl lg:block">
        {sidebar}
      </aside>

      {/* Mobile topbar */}
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-slate-200/70 bg-white/80 px-4 backdrop-blur-xl lg:hidden">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setOpen(true)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-700"
            aria-label="Menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <p className="text-sm font-extrabold text-slate-900">{t("brand.short")}</p>
        </div>
        <LanguageToggle />
      </header>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-72 bg-white shadow-2xl">
            <button
              onClick={() => setOpen(false)}
              className="absolute right-3 top-4 inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
            {sidebar}
          </div>
        </div>
      )}

      {/* Topbar (desktop) */}
      <div className="hidden h-16 items-center justify-between border-b border-slate-200/70 bg-white/70 px-8 backdrop-blur-xl lg:flex lg:pl-72">
        <p className="text-sm font-semibold text-slate-500">
          <span className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-500" />
          {t("dash.welcome")}, {displayName.split(" ")[0]}
        </p>
        <LanguageToggle />
      </div>

      <main className="lg:pl-72">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
}