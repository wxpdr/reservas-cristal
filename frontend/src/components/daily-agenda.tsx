"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { getErrorMessage, getReservations, type Reservation } from "@/lib/api";

type DailyAgendaProps = { onSessionExpired: () => void };

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

export function DailyAgenda({ onSessionExpired }: DailyAgendaProps) {
  const [selectedDate, setSelectedDate] = useState(() => localDateValue(new Date()));
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadReservations = useCallback(async () => {
    try {
      const response = await getReservations(selectedDate);
      if (response.status === 401) {
        onSessionExpired();
        return;
      }
      if (!response.ok) {
        setError(await getErrorMessage(response));
        return;
      }
      setReservations((await response.json()) as Reservation[]);
    } catch {
      setError("Não foi possível carregar a agenda. Verifique sua conexão.");
    } finally {
      setLoading(false);
    }
  }, [onSessionExpired, selectedDate]);

  useEffect(() => {
    const request = window.setTimeout(() => void loadReservations(), 0);
    return () => window.clearTimeout(request);
  }, [loadReservations]);
  const peopleCount = useMemo(() => reservations.reduce((total, item) => total + item.party_size, 0), [reservations]);
  const isToday = selectedDate === localDateValue(new Date());
  function selectDate(date: string) {
    setLoading(true);
    setError("");
    setSelectedDate(date);
  }
  function retry() {
    setLoading(true);
    setError("");
    void loadReservations();
  }

  return (
    <div className="px-4 pb-10 pt-4 lg:px-9 lg:py-8">
      <header className="flex min-h-[72px] items-start justify-between gap-4 lg:items-center">
        <div>
          <h1 className="text-2xl font-semibold lg:text-[28px]"><span className="lg:hidden">{isToday ? "Reservas de hoje" : "Reservas do dia"}</span><span className="hidden lg:inline">Reservas</span></h1>
          <p className="mt-1 text-xs text-[#727870] lg:text-[13px]"><span className="lg:hidden">{reservations.length} {reservations.length === 1 ? "reserva" : "reservas"} • {peopleCount} {peopleCount === 1 ? "pessoa" : "pessoas"}</span><span className="hidden lg:inline">Acompanhe e organize o atendimento do dia.</span></p>
        </div>
        <button className="primary-button h-8 px-4 text-xs disabled:cursor-not-allowed disabled:opacity-80 lg:h-10 lg:px-3.5 lg:text-sm" disabled title="Fluxo de nova reserva será implementado na próxima etapa" type="button"><span className="lg:hidden">+ Nova</span><span className="hidden lg:inline">+ Nova reserva</span></button>
      </header>

      <DateControls selectedDate={selectedDate} onChange={selectDate} onPrevious={() => selectDate(moveDate(selectedDate, -1))} onNext={() => selectDate(moveDate(selectedDate, 1))} onToday={() => selectDate(localDateValue(new Date()))} />

      <section aria-busy={loading} aria-live="polite" className="mt-6 lg:mt-4">
        <div className="mb-3 hidden h-10 items-center justify-between lg:flex"><h2 className="text-lg font-semibold">Reservas do dia</h2><p className="rounded-full bg-[#efeae3] px-2.5 py-1.5 text-xs text-[#727870]">{reservations.length} {reservations.length === 1 ? "reserva" : "reservas"} • {peopleCount} {peopleCount === 1 ? "pessoa" : "pessoas"}</p></div>
        {loading ? <AgendaLoading /> : null}
        {!loading && error ? <AgendaMessage title="Não foi possível carregar a agenda" description={error}><button className="secondary-button mt-4 px-4 py-2" onClick={retry} type="button">Tentar novamente</button></AgendaMessage> : null}
        {!loading && !error && reservations.length === 0 ? <AgendaMessage title="Nenhuma reserva neste dia" description="Quando uma reserva for cadastrada para esta data, ela aparecerá aqui." /> : null}
        {!loading && !error && reservations.length > 0 ? <ReservationList reservations={reservations} /> : null}
      </section>
    </div>
  );
}

type DateControlsProps = { selectedDate: string; onChange: (date: string) => void; onPrevious: () => void; onNext: () => void; onToday: () => void };

function DateControls({ selectedDate, onChange, onPrevious, onNext, onToday }: DateControlsProps) {
  return (
    <div className="mt-1 lg:mt-4">
      <div className="flex h-[50px] items-center gap-1.5 rounded-[13px] border border-[#e3ddd4] bg-white p-1.5 lg:h-14 lg:gap-2.5 lg:px-3 lg:py-2">
        <button aria-label="Dia anterior" className="date-button" onClick={onPrevious} type="button">‹</button>
        <label className="relative flex h-10 min-w-0 flex-1 items-center justify-center text-center text-xs font-semibold lg:max-w-[248px] lg:text-sm"><span>{formatDate(selectedDate)}</span><input aria-label="Escolher data da agenda" className="absolute inset-0 cursor-pointer opacity-0" onChange={(event) => event.target.value && onChange(event.target.value)} type="date" value={selectedDate} /></label>
        <button aria-label="Próximo dia" className="date-button" onClick={onNext} type="button">›</button>
        <button className="secondary-button h-8 px-3 text-xs lg:h-10 lg:px-3.5 lg:text-sm" onClick={onToday} type="button">Hoje</button>
        <div className="ml-auto hidden h-10 w-[180px] rounded-[10px] bg-[#f0ece6] p-1 lg:flex"><span className="flex flex-1 items-center justify-center rounded-lg bg-white text-[13px] font-semibold">Dia</span><span className="flex flex-1 items-center justify-center text-[13px] text-[#8d918b]">Mês</span></div>
      </div>
      <div className="mt-2 flex h-[42px] rounded-[13px] bg-[#f0ece6] p-1 lg:hidden"><span className="flex flex-1 items-center justify-center rounded-[9px] bg-white text-xs font-semibold shadow-sm">Dia</span><span className="flex flex-1 items-center justify-center text-xs font-semibold text-[#777c75]">Mês</span></div>
    </div>
  );
}

function ReservationList({ reservations }: { reservations: Reservation[] }) {
  return <><div className="hidden lg:block"><div className="reservation-grid h-8 items-center px-4 text-[13px] font-medium text-[#727870]"><span>Pessoas</span><span>Nome</span><span>Horário</span><span>Telefone</span><span>Observação</span><span /></div><div className="space-y-2.5">{reservations.map((item) => <DesktopReservation key={item.id} reservation={item} />)}</div></div><div className="space-y-2.5 lg:hidden">{reservations.map((item) => <MobileReservation key={item.id} reservation={item} />)}</div></>;
}

function DesktopReservation({ reservation }: { reservation: Reservation }) {
  const cancelled = reservation.status === "CANCELADA";
  const largeGroup = reservation.party_size >= 20;
  return <article className={`reservation-grid reservation-row ${cancelled ? "reservation-cancelled" : ""}`}><span className="font-semibold">{reservation.party_size}{largeGroup ? "  • grupo" : ""}</span><span className="truncate font-semibold">{reservation.customer_name}</span><time className={largeGroup ? "font-semibold text-[#9a5b22]" : ""}>{formatTime(reservation.reservation_time)}</time><span className="truncate text-[#727870]">{reservation.phone}</span><span className="truncate font-medium">{reservation.notes || "—"}</span><div className="flex items-center justify-end gap-2"><Link className="focus-ring rounded-lg px-3 py-2 font-semibold" href={`/reservas/${reservation.id}`}>Abrir</Link>{cancelled ? <span className="cancelled-badge">✕ Cancelada</span> : null}</div></article>;
}

function MobileReservation({ reservation }: { reservation: Reservation }) {
  const cancelled = reservation.status === "CANCELADA";
  const largeGroup = reservation.party_size >= 20;
  return <article className={`mobile-reservation ${cancelled ? "reservation-cancelled" : ""}`}>{cancelled ? <span className="cancelled-badge absolute right-4 top-3">✕ Cancelada</span> : null}<time className="block text-lg font-semibold leading-tight">{formatTime(reservation.reservation_time)}</time><h2 className={`mt-1 font-semibold ${cancelled ? "pr-28" : ""}`}>{reservation.customer_name}</h2><div className="mt-2.5 grid grid-cols-[100px_1fr] gap-3"><span className={`meta-chip ${largeGroup ? "bg-[#fff1d8]" : ""}`}>{peopleLabel(reservation.party_size)}</span><span className="meta-chip truncate">{reservation.phone}</span></div><p className={`mt-2 rounded-lg border px-2.5 py-2 text-[11px] text-[#727870] ${cancelled ? "border-[#ebb0b0] bg-[#fde3e3]" : "border-[#e3ddd4] bg-[#faf9f6]"}`}>Obs. {reservation.notes || "Sem observações"}</p><div className="mt-2.5 flex justify-end gap-2 border-t border-[#e3ddd4] pt-2.5"><Link className="secondary-button flex h-8 min-w-[70px] items-center justify-center text-xs" href={`/reservas/${reservation.id}`}>Abrir</Link>{!cancelled ? <button className="h-8 min-w-[132px] cursor-not-allowed rounded-[9px] bg-[#3f7450] px-3 text-xs font-semibold text-white opacity-80" disabled title="A confirmação de chegada será implementada na próxima etapa" type="button">Marcar chegada</button> : null}</div></article>;
}

function AgendaLoading() {
  return <div aria-label="Carregando reservas" className="space-y-2.5">{[1, 2, 3].map((item) => <div className="h-36 animate-pulse rounded-[14px] border border-[#e3ddd4] bg-white lg:h-[72px]" key={item} />)}</div>;
}

function AgendaMessage({ title, description, children }: { title: string; description: string; children?: ReactNode }) {
  return <div className="rounded-[14px] border border-[#e3ddd4] bg-white px-6 py-12 text-center"><h2 className="text-lg font-semibold">{title}</h2><p className="mx-auto mt-2 max-w-md text-sm text-[#727870]">{description}</p>{children}</div>;
}
