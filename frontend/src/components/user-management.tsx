"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { getErrorMessage, getUsers, resendUserInvitation, updateUser, type AuthenticatedUser } from "@/lib/api";

export function UserManagement() {
  const router = useRouter();
  const [users, setUsers] = useState<AuthenticatedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [editing, setEditing] = useState<AuthenticatedUser | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    try {
      const response = await getUsers();
      if (response.status === 401) return router.replace("/login");
      if (response.status === 403) return router.replace("/");
      if (!response.ok) return setError(await getErrorMessage(response));
      setUsers((await response.json()) as AuthenticatedUser[]);
    } catch {
      setError("Não foi possível carregar os usuários.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { const request = window.setTimeout(() => void loadUsers(), 0); return () => window.clearTimeout(request); }, [loadUsers]);

  async function toggleActive(user: AuthenticatedUser) {
    if (pendingId) return;
    setPendingId(user.id); setError(""); setFeedback("");
    try {
      const response = await updateUser(user.id, { active: !user.active });
      if (response.status === 401) return router.replace("/login");
      if (!response.ok) return setError(await getErrorMessage(response));
      const updated = (await response.json()) as AuthenticatedUser;
      setUsers((current) => current.map((item) => item.id === updated.id ? updated : item));
      setFeedback(updated.active ? "Usuário ativado com sucesso." : "Usuário desativado com sucesso.");
    } catch { setError("Não foi possível atualizar o acesso."); } finally { setPendingId(null); }
  }

  async function resend(user: AuthenticatedUser) {
    if (pendingId) return;
    setPendingId(user.id); setError(""); setFeedback("");
    try {
      const response = await resendUserInvitation(user.id);
      if (response.status === 401) return router.replace("/login");
      if (!response.ok) return setError(await getErrorMessage(response));
      setFeedback(`Convite reenviado para ${user.email}.`);
    } catch { setError("Não foi possível reenviar o convite."); } finally { setPendingId(null); }
  }

  const pendingCount = users.filter((user) => user.invitation_pending).length;
  const activeCount = users.filter((user) => user.active).length;
  return <div className="px-4 pb-10 pt-4 lg:px-9 lg:py-8"><header className="flex min-h-[72px] items-start justify-between gap-3 lg:items-center"><div><h1 className="text-2xl font-semibold lg:text-[28px]">Usuários</h1><p className="mt-1 text-xs text-[#727870] lg:text-[13px]">Gerencie quem pode acessar o sistema de reservas.</p></div><Link className="primary-button focus-ring flex h-8 w-[140px] shrink-0 items-center justify-center text-xs lg:h-10 lg:w-auto lg:px-4 lg:text-sm" href="/usuarios/novo">+ Novo usuário</Link></header>
    <div className="mt-1 rounded-[13px] border border-[#e3ddd4] bg-white px-3 py-2.5 lg:mt-4 lg:flex lg:border-0 lg:bg-transparent lg:px-0"><p className="text-[13px] font-semibold lg:text-[17px]">{activeCount} ativos • {pendingCount} {pendingCount === 1 ? "convite pendente" : "convites pendentes"}</p><p className="mt-1 text-[11px] text-[#727870] lg:ml-auto">Somente administradores podem gerenciar acessos.</p></div>
    {feedback ? <p className="mt-3 rounded-xl border border-[#b8d3bf] bg-[#e9f3eb] px-4 py-3 text-sm text-[#2f6240]" role="status">{feedback}</p> : null}{error ? <p className="mt-3 rounded-xl border border-[#e4b3b3] bg-[#fff1f1] px-4 py-3 text-sm text-[#8b3030]" role="alert">{error}</p> : null}
    <section aria-busy={loading} className="mt-4">{loading ? <div className="space-y-2.5">{[1,2,3].map((item) => <div className="h-32 animate-pulse rounded-[14px] bg-white lg:h-[74px]" key={item} />)}</div> : <><div className="mb-2 hidden grid-cols-[1.1fr_1.2fr_120px_120px_210px] gap-4 px-4 text-xs text-[#727870] lg:grid"><span>Nome</span><span>E-mail</span><span>Perfil</span><span>Status</span><span>Ação</span></div><div className="space-y-2.5">{users.map((user) => <UserRow key={user.id} onEdit={setEditing} onResend={() => void resend(user)} onToggle={() => void toggleActive(user)} pending={pendingId === user.id} user={user} />)}</div></>}</section>
    {editing ? <EditUserDialog onClose={() => setEditing(null)} onUpdated={(updated) => { setUsers((current) => current.map((item) => item.id === updated.id ? updated : item)); setEditing(null); setFeedback("Usuário atualizado com sucesso."); }} user={editing} /> : null}</div>;
}

function UserRow({ user, pending, onEdit, onToggle, onResend }: { user: AuthenticatedUser; pending: boolean; onEdit: (user: AuthenticatedUser) => void; onToggle: () => void; onResend: () => void }) {
  return <article className="rounded-[14px] border border-[#e3ddd4] bg-white p-4 lg:grid lg:min-h-[74px] lg:grid-cols-[1.1fr_1.2fr_120px_120px_210px] lg:items-center lg:gap-4"><div><h2 className="text-[15px] font-semibold lg:text-[13px]">{user.name}</h2><p className="mt-1 truncate text-[11px] text-[#727870] lg:hidden">{user.email}</p></div><p className="hidden truncate text-[13px] text-[#727870] lg:block">{user.email}</p><div className="mt-3 lg:mt-0"><span className={`inline-flex rounded-full px-2.5 py-1.5 text-[11px] font-semibold ${user.role === "admin" ? "bg-[#eee9f8] text-[#5d477f]" : "bg-[#f4f2ed]"}`}>{user.role === "admin" ? "Administrador" : "Operador"}</span></div><div className="mt-2 lg:mt-0"><span className={`inline-flex rounded-full px-2.5 py-1.5 text-[11px] font-semibold ${user.invitation_pending ? "bg-[#fff1d8] text-[#7a5a16]" : user.active ? "bg-[#e7f2ea] text-[#39704b]" : "bg-[#eee9e4] text-[#756c64]"}`}>{user.invitation_pending ? "Convite pendente" : user.active ? "Ativo" : "Inativo"}</span></div><div className="mt-3 flex justify-end gap-2 lg:mt-0"><button className="secondary-button h-9 px-3 text-xs" onClick={() => onEdit(user)} type="button">Editar</button>{user.invitation_pending ? <button className="secondary-button h-9 px-3 text-xs text-[#a64f43]" disabled={pending} onClick={onResend} type="button">{pending ? "Enviando…" : "Reenviar convite"}</button> : <button className="secondary-button h-9 px-3 text-xs text-[#a64f43]" disabled={pending} onClick={onToggle} type="button">{pending ? "Salvando…" : user.active ? "Desativar" : "Ativar"}</button>}</div></article>;
}

function EditUserDialog({ user, onClose, onUpdated }: { user: AuthenticatedUser; onClose: () => void; onUpdated: (user: AuthenticatedUser) => void }) {
  const [name, setName] = useState(user.name); const [email, setEmail] = useState(user.email); const [role, setRole] = useState(user.role); const [error, setError] = useState(""); const [pending, setPending] = useState(false); const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); function escape(event: KeyboardEvent) { if (event.key === "Escape" && !pending) onClose(); } document.addEventListener("keydown", escape); return () => document.removeEventListener("keydown", escape); }, [onClose, pending]);
  async function submit(event: React.FormEvent) { event.preventDefault(); if (pending) return; setPending(true); setError(""); try { const response = await updateUser(user.id, { name, email, role }); if (!response.ok) return setError(await getErrorMessage(response)); onUpdated((await response.json()) as AuthenticatedUser); } catch { setError("Não foi possível atualizar o usuário."); } finally { setPending(false); } }
  return <div className="fixed inset-0 z-40 flex items-end bg-black/40 p-0 lg:items-center lg:justify-center lg:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget && !pending) onClose(); }}><section aria-describedby="edit-user-description" aria-labelledby="edit-user-title" aria-modal="true" className="w-full rounded-t-2xl bg-white p-5 lg:max-w-lg lg:rounded-2xl lg:p-7" role="dialog"><h2 className="text-xl font-semibold" id="edit-user-title">Editar usuário</h2><p className="mt-1 text-sm text-[#727870]" id="edit-user-description">Atualize os dados de acesso. A senha não é exibida nem alterada aqui.</p><form className="mt-5 space-y-4" onSubmit={(event) => void submit(event)}><label className="block text-xs font-semibold">Nome<input className="form-control mt-2" maxLength={120} onChange={(event) => setName(event.target.value)} ref={inputRef} required value={name} /></label><label className="block text-xs font-semibold">E-mail<input className="form-control mt-2" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} /></label><label className="block text-xs font-semibold">Perfil<select className="form-control mt-2" onChange={(event) => setRole(event.target.value as AuthenticatedUser["role"])} value={role}><option value="operator">Operador</option><option value="admin">Administrador</option></select></label>{error ? <p className="text-sm text-[#9a3434]" role="alert">{error}</p> : null}<div className="flex justify-end gap-2 pt-2"><button className="secondary-button h-10 px-4 text-sm" disabled={pending} onClick={onClose} type="button">Cancelar</button><button className="primary-button h-10 px-4 text-sm" disabled={pending} type="submit">{pending ? "Salvando…" : "Salvar"}</button></div></form></section></div>;
}
