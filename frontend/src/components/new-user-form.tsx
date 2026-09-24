"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { createUser, getErrorMessage, type AuthenticatedUser } from "@/lib/api";

export function NewUserForm() {
  const router = useRouter();
  const pendingRef = useRef(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AuthenticatedUser["role"]>("operator");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pendingRef.current) return;
    pendingRef.current = true; setPending(true); setError("");
    try {
      const response = await createUser({ name, email, role });
      if (response.status === 401) return router.replace("/login");
      if (response.status === 403) return router.replace("/");
      if (!response.ok) return setError(await getErrorMessage(response));
      router.push("/usuarios?created=1");
    } catch { setError("Não foi possível criar o usuário. Verifique sua conexão."); }
    finally { pendingRef.current = false; setPending(false); }
  }

  return <div className="px-4 pb-10 pt-4 lg:px-9 lg:py-8"><header className="flex min-h-[72px] items-start justify-between gap-3 lg:items-center"><div><h1 className="text-2xl font-semibold lg:text-[28px]">Novo usuário</h1><p className="mt-1 text-xs text-[#727870] lg:text-[13px]">Cadastre um novo acesso para a equipe da Cristal.</p></div><Link className="secondary-button focus-ring flex h-8 items-center px-4 text-xs lg:h-10 lg:text-sm" href="/usuarios">Voltar</Link></header><form className="mt-1 lg:mt-4 lg:max-w-[820px]" onSubmit={(event) => void submit(event)}><section className="rounded-2xl border border-[#e3ddd4] bg-white p-4 lg:p-6"><h2 className="text-lg font-semibold">Dados do usuário</h2><p className="mt-1 text-xs text-[#727870]">Defina os dados de acesso e o perfil da pessoa.</p><div className="mt-6 grid gap-4 lg:grid-cols-2"><label className="text-xs font-semibold text-[#4a504b]">Nome *<input autoFocus className="form-control mt-2" maxLength={120} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Patrícia Souza" required value={name} /></label><label className="text-xs font-semibold text-[#4a504b]">E-mail *<input className="form-control mt-2" onChange={(event) => setEmail(event.target.value)} placeholder="patricia@cristalpizza.com.br" required type="email" value={email} /></label><label className="text-xs font-semibold text-[#4a504b]">Perfil *<select className="form-control mt-2" onChange={(event) => setRole(event.target.value as AuthenticatedUser["role"])} value={role}><option value="operator">Operador</option><option value="admin">Administrador</option></select></label><label className="text-xs font-semibold text-[#4a504b]">Status<input className="form-control mt-2 text-[#727870]" disabled value="Ativo" /></label></div><p className="mt-5 rounded-xl bg-[#f0ece6] px-3.5 py-4 text-xs text-[#727870]">Administrador gerencia usuários e histórico. Operador trabalha com as reservas.</p>{error ? <p className="mt-4 rounded-lg bg-[#fff1f1] px-3 py-2 text-sm text-[#8b3030]" role="alert">{error}</p> : null}</section><div className="mt-4 flex justify-end gap-2"><Link className="secondary-button focus-ring flex h-10 items-center px-4 text-sm" href="/usuarios">Cancelar</Link><button className="primary-button h-10 px-4 text-sm" disabled={pending} type="submit">{pending ? "Criando…" : "Criar usuário"}</button></div></form></div>;
}
