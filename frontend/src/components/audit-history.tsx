"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { getAuditEvents, getErrorMessage, getUsers, type AuditEvent, type AuditEventPage, type AuthenticatedUser } from "@/lib/api";

const actions = ["CREATE", "UPDATE", "CONFIRM", "CHECK_IN", "UNDO_CHECK_IN", "CANCEL", "TABLE_CHANGE"] as const;
const pageSize = 25;
const actionLabels: Record<AuditEvent["action"], string> = { CREATE: "Criada", UPDATE: "Editada", CONFIRM: "Confirmada", CHECK_IN: "Check-in", UNDO_CHECK_IN: "Chegada desfeita", CANCEL: "Cancelada", TABLE_CHANGE: "Mesa alterada" };

function localDateValue(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function formatTime(value: string) { return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }
function describe(event: AuditEvent) {
  const descriptions: Record<AuditEvent["action"], string> = { CREATE: "Reserva criada.", UPDATE: "Dados da reserva atualizados.", CONFIRM: "Reserva confirmada.", CHECK_IN: "Cliente marcado como chegou.", UNDO_CHECK_IN: "Chegada desfeita.", CANCEL: "Reserva cancelada.", TABLE_CHANGE: "Mesa da reserva alterada." };
  return descriptions[event.action];
}

export function AuditHistory() {
  const router = useRouter();
  const [date, setDate] = useState(localDateValue(new Date()));
  const [userId, setUserId] = useState("");
  const [action, setAction] = useState("");
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [users, setUsers] = useState<AuthenticatedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadEvents = useCallback(async () => {
    try {
      const response = await getAuditEvents({ date, userId, action, page, pageSize });
      if (response.status === 401) return router.replace("/login");
      if (response.status === 403) return router.replace("/");
      if (!response.ok) return setError(await getErrorMessage(response));
      const result = (await response.json()) as AuditEventPage;
      setEvents(result.items);
      setTotal(result.total);
      setTotalPages(result.total_pages);
    } catch { setError("Não foi possível carregar o histórico."); }
    finally { setLoading(false); }
  }, [action, date, page, router, userId]);

  useEffect(() => { void getUsers().then(async (response) => { if (response.ok) setUsers((await response.json()) as AuthenticatedUser[]); }); }, []);
  useEffect(() => { const request = window.setTimeout(() => { setLoading(true); setError(""); void loadEvents(); }, 0); return () => window.clearTimeout(request); }, [loadEvents]);

  function clearFilters() { setDate(""); setUserId(""); setAction(""); setPage(1); }
  return <div className="px-4 pb-10 pt-4 lg:px-9 lg:py-8"><header className="min-h-[72px]"><h1 className="text-2xl font-semibold lg:text-[28px]">Histórico<span className="hidden lg:inline"> de alterações</span></h1><p className="mt-1 text-xs text-[#727870] lg:text-[13px]">Consulte as principais ações realizadas nas reservas.</p></header><section className="mt-1 grid gap-3 rounded-[13px] border border-[#e3ddd4] bg-white p-3 lg:mt-4 lg:grid-cols-[170px_260px_260px_1fr] lg:items-end"><label className="text-[11px] font-semibold text-[#727870]">Data<input className="form-control mt-1" onChange={(event) => { setDate(event.target.value); setPage(1); }} type="date" value={date} /></label><label className="text-[11px] font-semibold text-[#727870]">Usuário<select className="form-control mt-1" onChange={(event) => { setUserId(event.target.value); setPage(1); }} value={userId}><option value="">Todos os usuários</option>{users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label><label className="text-[11px] font-semibold text-[#727870]">Ação<select className="form-control mt-1" onChange={(event) => { setAction(event.target.value); setPage(1); }} value={action}><option value="">Todas as ações</option>{actions.map((item) => <option key={item} value={item}>{actionLabels[item]}</option>)}</select></label><button className="secondary-button h-10 justify-self-end px-4 text-xs" onClick={clearFilters} type="button">Limpar filtros</button></section><div className="mt-5 flex items-center justify-between"><h2 className="text-lg font-semibold">Eventos {date ? "do dia" : "encontrados"}</h2><p className="text-xs text-[#727870]">{total} {total === 1 ? "evento encontrado" : "eventos encontrados"}</p></div>{error ? <p className="mt-3 rounded-xl bg-[#fff1f1] p-4 text-sm text-[#8b3030]" role="alert">{error}</p> : null}<section aria-busy={loading} className="mt-3 space-y-2.5">{loading ? [1,2,3].map((item) => <div className="h-28 animate-pulse rounded-[14px] bg-white lg:h-20" key={item} />) : events.length ? events.map((event) => <AuditRow event={event} key={event.id} />) : <div className="rounded-[14px] border border-[#e3ddd4] bg-white px-5 py-10 text-center text-sm text-[#727870]">Nenhum evento encontrado para os filtros selecionados.</div>}</section>{totalPages > 1 ? <nav aria-label="Paginação do histórico" className="mt-4 flex items-center justify-between gap-3"><button className="secondary-button h-10 px-4 text-xs disabled:cursor-not-allowed disabled:opacity-50" disabled={loading || page === 1} onClick={() => setPage((current) => current - 1)} type="button">Anterior</button><span className="text-xs text-[#727870]">Página {page} de {totalPages}</span><button className="secondary-button h-10 px-4 text-xs disabled:cursor-not-allowed disabled:opacity-50" disabled={loading || page === totalPages} onClick={() => setPage((current) => current + 1)} type="button">Próxima</button></nav> : null}<p className="mt-4 rounded-xl bg-[#f0ece6] px-4 py-4 text-xs text-[#727870]">Esta área é administrativa e serve para rastreabilidade. Ela não aparece na operação diária dos atendentes.</p></div>;
}

function AuditRow({ event }: { event: AuditEvent }) {
  return <article className="rounded-[14px] border border-[#e3ddd4] bg-white p-4 lg:grid lg:min-h-20 lg:grid-cols-[70px_220px_160px_190px_1fr] lg:items-center lg:gap-3"><time className="font-semibold text-[#727870] lg:text-[#202421]">{formatTime(event.created_at)}</time><div className="ml-3 inline-block max-w-[250px] align-top lg:ml-0 lg:max-w-none"><h3 className="font-semibold">{event.reservation_customer_name}</h3><p className="hidden text-[11px] text-[#727870] lg:block">{new Intl.DateTimeFormat("pt-BR").format(new Date(`${event.reservation_date}T12:00:00`))}</p></div><span className={`mt-3 flex w-fit rounded-full px-2.5 py-1.5 text-[11px] font-semibold lg:mt-0 lg:inline-flex ${event.action === "CANCEL" ? "bg-[#fde3e3] text-[#8b3030]" : event.action === "CHECK_IN" ? "bg-[#e7f2ea] text-[#39704b]" : event.action === "CONFIRM" ? "bg-[#eee9f8] text-[#5d477f]" : "bg-[#f4f2ed]"}`}>{actionLabels[event.action]}</span><p className="mt-3 text-xs text-[#727870] lg:mt-0">por {event.user_name}</p><p className="mt-3 text-xs text-[#727870] lg:mt-0">{describe(event)}</p></article>;
}
