"use client";

import { Suspense, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Chrome, LogIn } from "lucide-react";
import { useLang } from "@/lib/i18n/LanguageProvider";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { createClient, supabaseConfigured } from "@/lib/supabase/client";

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <AuthShell>
          <p className="py-8 text-center text-sm text-slate-400">…</p>
        </AuthShell>
      }
    >
      <SignInForm />
    </Suspense>
  );
}

function SignInForm() {
  const { t, lang } = useLang();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/dashboard";
  const needsSetup = searchParams.get("configured") === "0";
  const configured = supabaseConfigured();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const getRedirect = () => {
    const base = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    return `${base}/auth/callback`;
  };

  const signIn = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();
    if (!supabase) {
      setLoading(false);
      toast.error(t("common.error"));
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);

    if (error) {
      toast.error(error.message === "Invalid login credentials"
        ? t("auth.err.unknown")
        : error.message);
      return;
    }
    toast.success(t("auth.signInTitle"));
    router.push(next);
    router.refresh();
  };

  const googleSignIn = async () => {
    setGoogleLoading(true);
    const supabase = createClient();
    if (!supabase) {
      setGoogleLoading(false);
      toast.error(t("common.error"));
      return;
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: getRedirect() },
    });
    setGoogleLoading(false);
    if (error) {
      toast.error(t("auth.err.unknown"));
    }
  };

  const forgotPassword = async () => {
    if (!email) {
      toast.error(t("auth.err.emailInvalid"));
      return;
    }
    const supabase = createClient();
    if (!supabase) {
      toast.error(t("common.error"));
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${getRedirect()}?mode=reset`,
    });
    if (error) toast.error(error.message);
    else toast.success(t("auth.resetSent"));
  };

  return (
    <AuthShell>
      <h2 className="text-xl font-extrabold text-slate-900">{t("auth.signInTitle")}</h2>
      <p className="mt-1 text-sm text-slate-500">{t("auth.signInSub")}</p>

      {(needsSetup || !configured) && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">
          {lang === "en"
            ? "Supabase is not configured yet. Copy .env.example to .env.local and add your project URL and anon key to enable sign-in."
            : "ሱፓቤዝ እስካሁን አልተዋቀረም። .env.exampleን ወደ .env.local ቀዳ እና የመግቢያ ዩአርኤልና ቁልፍ ጨምር።"}
        </div>
      )}

      <form onSubmit={signIn} className="mt-6 space-y-4">
        <Input
          required
          type="email"
          label={t("auth.email")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
        <div>
          <Input
            required
            type="password"
            label={t("auth.password")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          <button
            type="button"
            onClick={forgotPassword}
            className="mt-1.5 text-xs font-semibold text-royal-700 hover:underline"
          >
            {t("auth.forgot")}
          </button>
        </div>
        <Button type="submit" loading={loading} className="w-full">
          <LogIn className="h-4 w-4" aria-hidden />
          {t("auth.signIn")}
        </Button>
      </form>

      <div className="my-5 flex items-center gap-3 text-xs text-slate-400">
        <span className="h-px flex-1 bg-slate-200" />
        {t("auth.or")}
        <span className="h-px flex-1 bg-slate-200" />
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full"
        loading={googleLoading}
        onClick={googleSignIn}
      >
        <Chrome className="h-4 w-4" aria-hidden />
        {t("auth.google")}
      </Button>

      <p className="mt-6 text-center text-sm text-slate-500">
        {t("auth.noAccount")}{" "}
        <Link href="/signup" className="font-bold text-royal-700 hover:underline">
          {t("auth.signUp")}
        </Link>
      </p>
    </AuthShell>
  );
}