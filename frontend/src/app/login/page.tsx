"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { AuthCard, buttonClassName, inputClassName } from "@/components/auth-card";
import { AuthShell } from "@/components/auth-shell";
import { apiRequest, getErrorMessage } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const data = new FormData(event.currentTarget);
    const response = await apiRequest("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: data.get("email"), password: data.get("password") }),
    });
    setLoading(false);
    if (!response.ok) {
      setError(await getErrorMessage(response));
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <AuthShell>
      <AuthCard title="Entrar" description="Use seu e-mail e senha para acessar o sistema.">
        <form className="mt-6" onSubmit={submit}>
          <label className="block text-sm font-semibold">
            E-mail
            <input className={inputClassName} name="email" type="email" required />
          </label>
          <label className="mt-5 block text-sm font-semibold">
            Senha
            <input className={inputClassName} name="password" type="password" required />
          </label>
          <div className="mt-4 text-right">
            <Link className="text-sm font-semibold text-[#b05043]" href="/recuperar-acesso">
              Esqueci minha senha
            </Link>
          </div>
          {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
          <button className={buttonClassName} disabled={loading} type="submit">
            {loading ? "Entrando..." : "Entrar"}
          </button>
          <p className="mt-5 rounded-xl bg-[#f0ede8] p-4 text-xs text-stone-600">
            Acesso restrito à equipe da Cristal. Não há cadastro público.
          </p>
        </form>
      </AuthCard>
    </AuthShell>
  );
}
