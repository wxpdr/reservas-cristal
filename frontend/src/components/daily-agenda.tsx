"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ReservationActionDialog } from "@/components/reservation-action-dialog";
import { ReservationDateBlockDialog } from "@/components/reservation-date-block-dialog";
import { blockReservationDate, checkInReservation, getErrorMessage, getReservationDateBlock, getReservations, unblockReservationDate, undoReservationCheckIn, type AuthenticatedUser, type Reservation, type ReservationDateBlockStatus } from "@/lib/api";

type DailyAgendaProps = { initialDate?: string; onSessionExpired: () => void; reservationCreated?: boolean; userRole: AuthenticatedUser["role"] };

const dateValuePattern = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateValue(value: string | undefined): value is string {
  if (!value || !dateValuePattern.test(value)) return false;
  const date = dateFromValue(value);
  return !Number.isNaN(date.getTime()) && localDateValue(date) === value;
}

function localDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateFromValue(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function moveDate(value: string, amount: number) {
  const date = dateFromValue(value);
  date.setDate(date.getDate() + amount);
  return localDateValue(date);
}

function formatDate(value: string) {
  const formatted = new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "numeric", month: "long" }).format(dateFromValue(value));
  return formatted.charAt(0).toUpperCase() + formatted.slice(1).replace(".", "");
}

const formatTime = (value: string) => value.slice(0, 5);
const peopleLabel = (count: number) => `${count} ${count === 1 ? "pessoa" : "pessoas"}`;
const statusOrder: Record<Reservation["status"], number> = {
  AGENDADA: 0,
  CHEGOU: 1,
  CANCELADA: 2,
};

export function DailyAgenda({ initialDate, onSessionExpired, reservationCreated = false, userRole }: DailyAgendaProps) {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(() => isValidDateValue(initialDate) ? initialDate : localDateValue(new Date()));
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeReservation, setActiveReservation] = useState<Reservation | null>(null);
  const [action, setAction] = useState<"check-in" | "undo-check-in">("check-in");
  const [actionError, setActionError] = useState("");
  const [actionPending, setActionPending] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{ message: string; reservation?: Reservation } | null>(null);
  const actionPendingRef = useRef(false);
  const actionTriggerRef = useRef<HTMLButtonElement>(null);
  const blockTriggerRef = useRef<HTMLButtonElement>(null);
  const [dateBlock, setDateBlock] = useState<ReservationDateBlockStatus | null>(null);
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [blockPending, setBlockPending] = useState(false);
  const [blockError, setBlockError] = useState("");

  const loadAgenda = useCallback(async () => {
    try {
      const [reservationsResponse, blockResponse] = await Promise.all([
        getReservations(selectedDate),
        getReservationDateBlock(selectedDate),
      ]);
      if (reservationsResponse.status === 401 || blockResponse.status === 401) {
        onSessionExpired();
        return;
      }
      if (!reservationsResponse.ok || !blockResponse.ok) {
        setError(await getErrorMessage(!reservationsResponse.ok ? reservationsResponse : blockResponse));
        return;
      }
      setReservations((await reservationsResponse.json()) as Reservation[]);
      setDateBlock((await blockResponse.json()) as ReservationDateBlockStatus);
    } catch {
      setError("Não foi possível carregar a agenda. Verifique sua conexão.");
    } finally {
      setLoading(false);
    }
  }, [onSessionExpired, selectedDate]);

  useEffect(() => {
    const request = window.setTimeout(() => void loadAgenda(), 0);
    return () => window.clearTimeout(request);
  }, [loadAgenda]);
  const peopleCount = useMemo(() => reservations.reduce((total, item) => total + item.party_size, 0), [reservations]);
  const isToday = selectedDate === localDateValue(new Date());
  function selectDate(date: string) {
    setLoading(true);
    setError("");
    setDateBlock(null);
    setSelectedDate(date);
    router.replace(`/?date=${encodeURIComponent(date)}`, { scroll: false });
  }
  function retry() {
    setLoading(true);
    setError("");
    void loadAgenda();
  }

  function openAction(reservation: Reservation, nextAction: "check-in" | "undo-check-in", trigger: HTMLButtonElement) {
    actionTriggerRef.current = trigger;
    setActionError("");
    setAction(nextAction);
    setActiveReservation(reservation);
  }

  const closeAction = useCallback(() => {
    if (actionPendingRef.current) return;
    setActiveReservation(null);
  }, []);

  async function submitAction() {
    if (!activeReservation || actionPendingRef.current) return;
    actionPendingRef.current = true;
    setActionPending(true);
    setActionError("");
    try {
      const response = action === "check-in"
        ? await checkInReservation(activeReservation.id)
        : await undoReservationCheckIn(activeReservation.id);
      if (response.status === 401) {
        onSessionExpired();
        return;
      }
      if (response.status === 404) {
        setActionError("Esta reserva não foi encontrada. Atualize a agenda e tente novamente.");
        return;
      }
      if (response.status === 409) {
        setActionError("O estado desta reserva mudou. Atualize a agenda antes de tentar novamente.");
        void loadAgenda();
        return;
      }
      if (!response.ok) {
        setActionError("Não foi possível concluir a ação. Tente novamente.");
        return;
      }
      const updated = (await response.json()) as Reservation;
      setReservations((current) => current.map((item) => item.id === updated.id ? updated : item));
      setActionFeedback(action === "check-in" ? { message: "Chegada registrada", reservation: updated } : { message: "Chegada desfeita com sucesso." });
      setActiveReservation(null);
    } catch {
      setActionError("Não foi possível concluir a ação. Verifique sua conexão e tente novamente.");
    } finally {
      actionPendingRef.current = false;
      setActionPending(false);
    }
  }

  async function submitBlock(reason: string | null) {
    if (blockPending) return;
    setBlockPending(true);
    setBlockError("");
    try {
      const response = await blockReservationDate(selectedDate, reason);
      if (response.status === 401) { onSessionExpired(); return; }
      if (!response.ok) { setBlockError(await getErrorMessage(response)); return; }
      const result = await response.json() as ReservationDateBlockStatus;
      setDateBlock({ date: result.date, blocked: true, reason: result.reason });
      setBlockDialogOpen(false);
    } catch {
      setBlockError("Não foi possível bloquear a data. Verifique sua conexão.");
    } finally {
      setBlockPending(false);
    }
  }

  async function submitUnblock() {
    if (blockPending) return;
    setBlockPending(true);
    setBlockError("");
    try {
      const response = await unblockReservationDate(selectedDate);
      if (response.status === 401) { onSessionExpired(); return; }
      if (!response.ok) { setError(await getErrorMessage(response)); return; }
      setDateBlock({ date: selectedDate, blocked: false, reason: null });
    } catch {
      setError("Não foi possível desbloquear a data. Verifique sua conexão.");
    } finally {
      setBlockPending(false);
    }
  }

  return (
    <div className="px-4 pb-10 pt-4 lg:px-9 lg:py-8">
      <header className="flex min-h-[72px] items-start justify-between gap-4 lg:items-center">
        <div>
          <h1 className="text-2xl font-semibold lg:text-[28px]"><span className="lg:hidden">{isToday ? "Reservas de hoje" : "Reservas do dia"}</span><span className="hidden lg:inline">Reservas</span></h1>
          <p className="mt-1 text-xs text-[#727870] lg:text-[13px]"><span className="lg:hidden">{reservations.length} {reservations.length === 1 ? "reserva" : "reservas"} • {peopleCount} {peopleCount === 1 ? "pessoa" : "pessoas"}</span><span className="hidden lg:inline">Acompanhe e organize o atendimento do dia.</span></p>
        </div>
        <Link className="primary-button focus-ring flex h-8 items-center px-4 text-xs lg:h-10 lg:px-3.5 lg:text-sm" href={`/reservas/nova?date=${selectedDate}`}><span className="lg:hidden">+ Nova</span><span className="hidden lg:inline">+ Nova reserva</span></Link>
      </header>

      {reservationCreated ? <p className="mt-3 rounded-xl border border-[#b8d3bf] bg-[#e9f3eb] px-4 py-3 text-sm font-medium text-[#2f6240]" role="status">Reserva criada com sucesso.</p> : null}
      {actionFeedback ? <div className="mt-3 flex items-center justify-between rounded-xl border border-[#b8d3bf] bg-[#e9f3eb] px-4 py-3 text-sm font-medium text-[#2f6240]" role="status"><span>✓ {actionFeedback.message}</span>{actionFeedback.reservation ? <button className="focus-ring rounded px-2 py-1 text-xs font-semibold" onClick={(event) => openAction(actionFeedback.reservation!, "undo-check-in", event.currentTarget)} type="button">Desfazer</button> : <button aria-label="Fechar mensagem" className="focus-ring rounded px-2 py-1 text-xs font-semibold" onClick={() => setActionFeedback(null)} type="button">Fechar</button>}</div> : null}

      <DateControls blockControl={userRole === "admin" ? <button className={`focus-ring h-8 rounded-[9px] border px-3 text-xs font-semibold lg:h-10 lg:px-4 lg:text-sm ${dateBlock?.blocked ? "border-[#78a486] text-[#3f7450]" : "border-[#d78379] text-[#a64f43]"}`} disabled={blockPending} onClick={(event) => { blockTriggerRef.current = event.currentTarget; if (dateBlock?.blocked) void submitUnblock(); else setBlockDialogOpen(true); }} type="button">{blockPending ? "Aguarde…" : dateBlock?.blocked ? "Desbloquear dia" : "Bloquear dia"}</button> : null} selectedDate={selectedDate} onChange={selectDate} onPrevious={() => selectDate(moveDate(selectedDate, -1))} onNext={() => selectDate(moveDate(selectedDate, 1))} onToday={() => selectDate(localDateValue(new Date()))} />

      {dateBlock?.blocked ? <div className="mt-3 rounded-xl border border-[#e7b9b5] bg-[#fff1f1] px-4 py-3 text-sm text-[#8f3935]" role="status"><p className="font-semibold">Dia bloqueado para novas reservas</p>{dateBlock.reason ? <p className="mt-0.5 text-xs">Motivo: {dateBlock.reason}</p> : <p className="mt-0.5 text-xs">Novas reservas não são aceitas nesta data.</p>}</div> : null}

      <section aria-busy={loading} aria-live="polite" className="mt-6 lg:mt-4">
        <div className="mb-3 hidden h-10 items-center justify-between lg:flex"><h2 className="text-lg font-semibold">Reservas do dia</h2><p className="rounded-full bg-[#efeae3] px-2.5 py-1.5 text-xs text-[#727870]">{reservations.length} {reservations.length === 1 ? "reserva" : "reservas"} • {peopleCount} {peopleCount === 1 ? "pessoa" : "pessoas"}</p></div>
        {loading ? <AgendaLoading /> : null}
        {!loading && error ? <AgendaMessage title="Não foi possível carregar a agenda" description={error}><button className="secondary-button mt-4 px-4 py-2" onClick={retry} type="button">Tentar novamente</button></AgendaMessage> : null}
        {!loading && !error && reservations.length === 0 ? <AgendaMessage title="Nenhuma reserva neste dia" description="Quando uma reserva for cadastrada para esta data, ela aparecerá aqui." /> : null}
        {!loading && !error && reservations.length > 0 ? <ReservationList agendaDate={selectedDate} onAction={openAction} reservations={reservations} /> : null}
      </section>
      {activeReservation ? <ReservationActionDialog action={action} error={actionError} onClose={closeAction} onSubmit={() => void submitAction()} pending={actionPending} reservation={activeReservation} triggerRef={actionTriggerRef} /> : null}
      {blockDialogOpen ? <ReservationDateBlockDialog dateLabel={dateFromValue(selectedDate).toLocaleDateString("pt-BR")} error={blockError} onClose={() => { if (!blockPending) setBlockDialogOpen(false); }} onSubmit={(reason) => void submitBlock(reason)} pending={blockPending} triggerRef={blockTriggerRef} /> : null}
    </div>
  );
}

type DateControlsProps = { blockControl: ReactNode; selectedDate: string; onChange: (date: string) => void; onPrevious: () => void; onNext: () => void; onToday: () => void };

function DateControls({ blockControl, selectedDate, onChange, onPrevious, onNext, onToday }: DateControlsProps) {
  return (
    <div className="mt-1 lg:mt-4">
      <div className="flex h-[50px] items-center gap-1.5 rounded-[13px] border border-[#e3ddd4] bg-white p-1.5 lg:h-14 lg:gap-2.5 lg:px-3 lg:py-2">
        <button aria-label="Dia anterior" className="date-button" onClick={onPrevious} type="button">‹</button>
        <label className="relative flex h-10 min-w-0 flex-1 items-center justify-center text-center text-xs font-semibold lg:max-w-[248px] lg:text-sm"><span>{formatDate(selectedDate)}</span><input aria-label="Escolher data da agenda" className="absolute inset-0 cursor-pointer opacity-0" onChange={(event) => event.target.value && onChange(event.target.value)} type="date" value={selectedDate} /></label>
        <button aria-label="Próximo dia" className="date-button" onClick={onNext} type="button">›</button>
        <button className="secondary-button h-8 px-3 text-xs lg:h-10 lg:px-3.5 lg:text-sm" onClick={onToday} type="button">Hoje</button>
        <div className="hidden lg:block">{blockControl}</div>
        <div className="ml-auto hidden h-10 w-[180px] rounded-[10px] bg-[#f0ece6] p-1 lg:flex"><span className="flex flex-1 items-center justify-center rounded-lg bg-white text-[13px] font-semibold">Dia</span><Link className="focus-ring flex flex-1 items-center justify-center rounded-lg text-[13px] text-[#8d918b]" href="/mes">Mês</Link></div>
      </div>
      <div className="mt-2 flex h-[42px] rounded-[13px] bg-[#f0ece6] p-1 lg:hidden"><span className="flex flex-1 items-center justify-center rounded-[9px] bg-white text-xs font-semibold shadow-sm">Dia</span><Link className="focus-ring flex flex-1 items-center justify-center rounded-[9px] text-xs font-semibold text-[#777c75]" href="/mes">Mês</Link></div>
      {blockControl ? <div className="mt-2 flex justify-end lg:hidden">{blockControl}</div> : null}
    </div>
  );
}

function ReservationList({ agendaDate, onAction, reservations }: { agendaDate: string; onAction: (reservation: Reservation, action: "check-in" | "undo-check-in", trigger: HTMLButtonElement) => void; reservations: Reservation[] }) {
  const orderedReservations = useMemo(
    () => [...reservations].sort((left, right) => statusOrder[left.status] - statusOrder[right.status]
      || left.reservation_time.localeCompare(right.reservation_time)),
    [reservations],
  );
  return <><div className="hidden lg:block"><div className="reservation-grid h-8 items-center px-4 text-[13px] font-medium text-[#727870]"><span>Pessoas</span><span>Nome</span><span>Horário</span><span>Mesa</span><span>Telefone</span><span>Observação</span><span className="text-right">Ações</span></div><div className="space-y-2.5">{orderedReservations.map((item) => <DesktopReservation agendaDate={agendaDate} key={item.id} onAction={onAction} reservation={item} />)}</div></div><div className="space-y-2.5 lg:hidden">{orderedReservations.map((item) => <MobileReservation agendaDate={agendaDate} key={item.id} onAction={onAction} reservation={item} />)}</div></>;
}

function DesktopReservation({ agendaDate, onAction, reservation }: { agendaDate: string; onAction: (reservation: Reservation, action: "check-in" | "undo-check-in", trigger: HTMLButtonElement) => void; reservation: Reservation }) {
  const cancelled = reservation.status === "CANCELADA";
  const arrived = reservation.status === "CHEGOU";
  const largeGroup = reservation.party_size >= 20;
  const stateClass = cancelled ? "reservation-cancelled" : arrived ? "reservation-arrived" : "";
  return <article className={`reservation-grid reservation-row ${stateClass}`}><span className="font-semibold">{reservation.party_size}{largeGroup ? "  • grupo" : ""}</span><span className="truncate font-semibold">{reservation.customer_name}</span><time className={largeGroup ? "font-semibold text-[#9a5b22]" : ""}>{formatTime(reservation.reservation_time)}</time><span className={largeGroup ? "truncate font-semibold text-[#9a5b22]" : "truncate"}>Mesa {reservation.table_label || "—"}</span><span className="truncate text-[#727870]">{reservation.phone}</span><span className="truncate font-medium">{reservation.notes || "—"}</span><div className="flex items-center justify-end gap-2"><Link className="focus-ring rounded-lg px-2 py-2 font-semibold" href={`/reservas/${reservation.id}?date=${agendaDate}`}>Abrir</Link>{!arrived && !cancelled ? <button className="focus-ring h-8 rounded-[9px] bg-[#3f7450] px-3 text-xs font-semibold text-white" onClick={(event) => onAction(reservation, "check-in", event.currentTarget)} type="button">Chegada</button> : null}{arrived || cancelled ? <span aria-hidden="true" className={`state-divider ${cancelled ? "bg-[#cf5f5f]" : "bg-[#3f7450]"}`} /> : null}{arrived ? <span className="arrived-badge">✓ Chegou</span> : null}{cancelled ? <span className="cancelled-badge">✕ Cancelada</span> : null}</div></article>;
}

function MobileReservation({ agendaDate, onAction, reservation }: { agendaDate: string; onAction: (reservation: Reservation, action: "check-in" | "undo-check-in", trigger: HTMLButtonElement) => void; reservation: Reservation }) {
  const cancelled = reservation.status === "CANCELADA";
  const largeGroup = reservation.party_size >= 20;
  const arrived = reservation.status === "CHEGOU";
  const stateClass = cancelled ? "reservation-cancelled" : arrived ? "reservation-arrived" : "";
  return <article className={`mobile-reservation ${stateClass}`}>{arrived ? <span className="arrived-badge absolute right-4 top-3">✓ Chegou</span> : null}{cancelled ? <span className="cancelled-badge absolute right-4 top-3">✕ Cancelada</span> : null}<time className="block text-lg font-semibold leading-tight">{formatTime(reservation.reservation_time)}</time><h2 className={`mt-1 font-semibold ${arrived || cancelled ? "pr-28" : ""}`}>{reservation.customer_name}</h2><div className="mt-2.5 grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-3"><span className={`meta-chip truncate ${largeGroup ? "bg-[#fff1d8] text-[#9a5b22]" : ""}`}>{peopleLabel(reservation.party_size)} • Mesa {reservation.table_label || "—"}</span><span className="meta-chip truncate">{reservation.phone}</span></div><p className={`mt-2 rounded-lg border px-2.5 py-2 text-[11px] text-[#727870] ${cancelled ? "border-[#ebb0b0] bg-[#fde3e3]" : arrived ? "border-[#b8d3bf] bg-[#edf6ef]" : "border-[#e3ddd4] bg-[#faf9f6]"}`}>Obs. {reservation.notes || "Sem observações"}</p><div className="mt-2.5 flex justify-end gap-2 border-t border-[#e3ddd4] pt-2.5"><Link className="secondary-button flex h-8 min-w-[70px] items-center justify-center text-xs" href={`/reservas/${reservation.id}?date=${agendaDate}`}>Abrir</Link>{!cancelled ? <button className={`focus-ring h-8 min-w-[90px] rounded-[9px] px-3 text-xs font-semibold ${arrived ? "border border-[#9eb9a6] bg-white text-[#3f7450]" : "bg-[#3f7450] text-white"}`} onClick={(event) => onAction(reservation, arrived ? "undo-check-in" : "check-in", event.currentTarget)} type="button">{arrived ? "Desfazer chegada" : "Chegada"}</button> : null}</div></article>;
}

function AgendaLoading() {
  return <div aria-label="Carregando reservas" className="space-y-2.5">{[1, 2, 3].map((item) => <div className="h-36 animate-pulse rounded-[14px] border border-[#e3ddd4] bg-white lg:h-[72px]" key={item} />)}</div>;
}

function AgendaMessage({ title, description, children }: { title: string; description: string; children?: ReactNode }) {
  return <div className="rounded-[14px] border border-[#e3ddd4] bg-white px-6 py-12 text-center"><h2 className="text-lg font-semibold">{title}</h2><p className="mx-auto mt-2 max-w-md text-sm text-[#727870]">{description}</p>{children}</div>;
}
