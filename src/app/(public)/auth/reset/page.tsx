"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { useLang } from "@/lib/i18n/LanguageProvider";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const { t } = useLang();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
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
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t("profile.password.changed"));
    router.push("/dashboard");
    router.refresh();
  };

  return (
    <AuthShell>
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-royal-50 text-royal-700">
        <Lock className="h-6 w-6" aria-hidden />
      </span>
      <h2 className="mt-4 text-center text-xl font-extrabold text-slate-900">
        {t("profile.password.title")}
      </h2>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <Input
          required
          type="password"
          label={t("profile.password.new")}
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
          {t("common.save")}
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-500">
        <Link href="/signin" className="font-bold text-royal-700 hover:underline">
          {t("auth.signIn")}
        </Link>
      </p>
    </AuthShell>
  );
}