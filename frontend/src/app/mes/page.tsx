"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { MonthlyView } from "@/components/monthly-view";
import { type AuthenticatedUser, getCurrentUser, logout } from "@/lib/api";

export default function MonthPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [authError, setAuthError] = useState("");

  const loadUser = useCallback(async () => {
    try {
      const response = await getCurrentUser();
      if (response.status === 401) {
        router.replace("/login");
        return;
      }
      if (!response.ok) {
        setAuthError("Não foi possível confirmar seu acesso. Tente novamente.");
        return;
      }
      setUser((await response.json()) as AuthenticatedUser);
    } catch {
      setAuthError("Não foi possível conectar ao sistema. Verifique sua conexão.");
    }
  }, [router]);

  useEffect(() => {
    const request = window.setTimeout(() => void loadUser(), 0);
    return () => window.clearTimeout(request);
  }, [loadUser]);

  async function handleLogout() {
    try {
      await logout();
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  if (authError) {
    return <main className="flex min-h-screen items-center justify-center bg-[#f6f3ee] p-6"><section className="w-full max-w-md rounded-2xl border border-[#e3ddd4] bg-white p-6 text-center"><h1 className="text-xl font-semibold">Acesso indisponível</h1><p className="mt-2 text-sm text-[#727870]">{authError}</p><button className="primary-button mt-5 px-4 py-2" onClick={() => { setAuthError(""); void loadUser(); }} type="button">Tentar novamente</button></section></main>;
  }

  if (!user) {
    return <main aria-busy="true" aria-label="Carregando aplicação" className="flex min-h-screen items-center justify-center bg-[#f6f3ee]"><div className="loading-dot" /></main>;
  }

  return <AppShell user={user} onLogout={handleLogout}><MonthlyView onSessionExpired={() => router.replace("/login")} /></AppShell>;
}
