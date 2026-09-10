"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Chrome, UserPlus } from "lucide-react";
import { useLang } from "@/lib/i18n/LanguageProvider";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { createClient, supabaseConfigured } from "@/lib/supabase/client";

export default function SignUpPage() {
  const { t, lang } = useLang();
  const router = useRouter();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const getRedirect = () => {
    const base = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    return `${base}/auth/callback`;
  };

  const signUp = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error(t("auth.err.passwordShort"));
      return;
    }
    if (password !== confirm) {
      toast.error(t("auth.err.mismatch"));
      return;
    }
    setLoading(true);
    const supabase = createClient();
    if (!supabase) {
      setLoading(false);
      toast.error(t("common.error"));
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: getRedirect(),
        data: { first_name: firstName, last_name: lastName },
      },
    });
    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    if (data.session) {
      toast.success(t("auth.signUpTitle"));
      router.push("/dashboard");
      router.refresh();
    } else {
      setSent(true);
      toast.success(t("auth.resetSent"));
    }
  };

  const googleSignUp = async () => {
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
    if (error) toast.error(t("auth.err.unknown"));
  };

  if (sent) {
    return (
      <AuthShell>
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
            <UserPlus className="h-7 w-7" aria-hidden />
          </span>
          <h2 className="text-xl font-extrabold text-slate-900">{t("auth.signUpTitle")}</h2>
          <p className="text-sm text-slate-500">{t("auth.resetSent")}</p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      {!supabaseConfigured() && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">
          {lang === "en"
            ? "Supabase is not configured yet. Copy .env.example to .env.local and add your project URL and anon key to enable sign-up."
            : "ሱፓቤዝ እስካሁን አልተዋቀረም። .env.exampleን ወደ .env.local ቀዳ እና ቁልፎችን ጨምር።"}
        </div>
      )}
      <h2 className="text-xl font-extrabold text-slate-900">{t("auth.signUpTitle")}</h2>
      <p className="mt-1 text-sm text-slate-500">{t("auth.signUpSub")}</p>

      <form onSubmit={signUp} className="mt-6 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input
            required
            label={t("auth.firstName")}
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
          <Input
            required
            label={t("auth.lastName")}
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
        </div>
        <Input
          required
          type="email"
          label={t("auth.email")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
        <Input
          required
          type="password"
          label={t("auth.password")}
          hint={t("auth.err.passwordShort")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />
        <Input
          required
          type="password"
          label={t("profile.password.confirm")}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
        />
        <Button type="submit" loading={loading} className="w-full">
          <UserPlus className="h-4 w-4" aria-hidden />
          {t("auth.signUp")}
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
        onClick={googleSignUp}
      >
        <Chrome className="h-4 w-4" aria-hidden />
        {t("auth.google")}
      </Button>

      <p className="mt-6 text-center text-sm text-slate-500">
        {t("auth.hasAccount")}{" "}
        <Link href="/signin" className="font-bold text-royal-700 hover:underline">
          {t("auth.signIn")}
        </Link>
      </p>
    </AuthShell>
  );
}