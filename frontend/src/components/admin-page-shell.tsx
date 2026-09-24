"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { type AuthenticatedUser, getCurrentUser, logout } from "@/lib/api";

export function AdminPageShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [error, setError] = useState("");

  const loadUser = useCallback(async () => {
    try {
      const response = await getCurrentUser();
      if (response.status === 401) return router.replace("/login");
      if (!response.ok) return setError("Não foi possível confirmar seu acesso.");
      const current = (await response.json()) as AuthenticatedUser;
      if (current.role !== "admin") return router.replace("/");
      setUser(current);
    } catch {
      setError("Não foi possível conectar ao sistema.");
    }
  }, [router]);

  useEffect(() => {
    const request = window.setTimeout(() => void loadUser(), 0);
    return () => window.clearTimeout(request);
  }, [loadUser]);

  async function handleLogout() {
    try { await logout(); } finally { router.replace("/login"); router.refresh(); }
  }

  if (error) return <main className="flex min-h-screen items-center justify-center bg-[#f6f3ee] p-6"><section className="rounded-2xl border border-[#e3ddd4] bg-white p-6 text-center"><h1 className="text-xl font-semibold">Acesso indisponível</h1><p className="mt-2 text-sm text-[#727870]">{error}</p><button className="secondary-button mt-4 px-4 py-2" onClick={() => { setError(""); void loadUser(); }} type="button">Tentar novamente</button></section></main>;
  if (!user) return <main aria-busy="true" aria-label="Carregando aplicação" className="flex min-h-screen items-center justify-center bg-[#f6f3ee]"><div className="loading-dot" /></main>;
  return <AppShell user={user} onLogout={handleLogout}>{children}</AppShell>;
}
