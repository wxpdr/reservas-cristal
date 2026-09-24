"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { getErrorMessage, getMonthlyReservations, type MonthlyReservationSummary } from "@/lib/api";

type MonthValue = { year: number; month: number };
type MonthlyViewProps = { onSessionExpired: () => void };

const weekdays = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const mobileWeekdays = ["S", "T", "Q", "Q", "S", "S", "D"];

function currentMonth(): MonthValue {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

function moveMonth(value: MonthValue, amount: number): MonthValue {
  const moved = new Date(value.year, value.month - 1 + amount, 1);
  return { year: moved.getFullYear(), month: moved.getMonth() + 1 };
}

function monthLabel(value: MonthValue) {
  const label = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(value.year, value.month - 1, 1));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function dateValue(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function MonthlyView({ onSessionExpired }: MonthlyViewProps) {
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [summaries, setSummaries] = useState<MonthlyReservationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadMonth = useCallback(async () => {
    try {
      const response = await getMonthlyReservations(selectedMonth.year, selectedMonth.month);
      if (response.status === 401) {
        onSessionExpired();
        return;
      }
      if (!response.ok) {
        setError(await getErrorMessage(response));
        return;
      }
      setSummaries((await response.json()) as MonthlyReservationSummary[]);
    } catch {
      setError("Não foi possível carregar o mês. Verifique sua conexão.");
    } finally {
      setLoading(false);
    }
  }, [onSessionExpired, selectedMonth]);

  useEffect(() => {
    const request = window.setTimeout(() => void loadMonth(), 0);
    return () => window.clearTimeout(request);
  }, [loadMonth]);

  const summaryByDate = useMemo(() => new Map(summaries.map((item) => [item.date, item])), [summaries]);
  const daysInMonth = new Date(selectedMonth.year, selectedMonth.month, 0).getDate();
  const leadingDays = (new Date(selectedMonth.year, selectedMonth.month - 1, 1).getDay() + 6) % 7;
  const today = new Date();
  const todayValue = dateValue(today.getFullYear(), today.getMonth() + 1, today.getDate());
  const cells = Array.from({ length: Math.ceil((leadingDays + daysInMonth) / 7) * 7 }, (_, index) => {
    const day = index - leadingDays + 1;
    return day > 0 && day <= daysInMonth ? day : null;
  });

  function selectMonth(value: MonthValue) {
    setLoading(true);
    setError("");
    setSelectedMonth(value);
  }

  return (
    <div className="px-4 pb-10 pt-4 lg:px-9 lg:py-8">
      <header className="flex min-h-[72px] items-start justify-between gap-4 lg:items-center">
        <div><h1 className="text-2xl font-semibold lg:text-[28px]">Reservas</h1><p className="mt-1 text-xs text-[#727870] lg:text-[13px]">Consulte o movimento dos próximos dias e meses.</p></div>
        <Link className="primary-button focus-ring flex h-8 items-center px-4 text-xs lg:h-10 lg:text-sm" href="/reservas/nova"><span className="lg:hidden">+ Nova</span><span className="hidden lg:inline">+ Nova reserva</span></Link>
      </header>

      <div className="mt-1 lg:mt-4">
        <div className="flex h-[50px] items-center gap-1.5 rounded-[13px] border border-[#e3ddd4] bg-white p-1.5 lg:h-14 lg:gap-2.5 lg:px-3 lg:py-2">
          <button aria-label="Mês anterior" className="date-button" onClick={() => selectMonth(moveMonth(selectedMonth, -1))} type="button">‹</button>
          <p className="flex min-w-0 flex-1 items-center justify-center text-center text-xs font-semibold lg:max-w-[248px] lg:text-sm">{monthLabel(selectedMonth)}</p>
          <button aria-label="Próximo mês" className="date-button" onClick={() => selectMonth(moveMonth(selectedMonth, 1))} type="button">›</button>
          <button className="secondary-button h-8 px-3 text-xs lg:h-10 lg:px-3.5 lg:text-sm" onClick={() => selectMonth(currentMonth())} type="button">Hoje</button>
          <div className="ml-auto hidden h-10 w-[180px] rounded-[10px] bg-[#f0ece6] p-1 lg:flex"><Link className="focus-ring flex flex-1 items-center justify-center rounded-lg text-[13px] text-[#727870]" href="/">Dia</Link><span className="flex flex-1 items-center justify-center rounded-lg bg-white text-[13px] font-semibold">Mês</span></div>
        </div>
        <div className="mt-2 flex h-[42px] rounded-[11px] bg-[#f0ece6] p-1 lg:hidden"><Link className="focus-ring flex flex-1 items-center justify-center rounded-[9px] text-xs font-semibold text-[#727870]" href="/">Dia</Link><span className="flex flex-1 items-center justify-center rounded-[9px] bg-white text-xs font-semibold shadow-sm">Mês</span></div>
      </div>

      <section aria-busy={loading} aria-live="polite" className="mt-3 rounded-[14px] border border-[#e3ddd4] bg-white p-[15px] lg:mt-4 lg:border-0 lg:bg-transparent lg:p-0">
        <div className="lg:flex lg:h-11 lg:items-center lg:justify-between"><div><h2 className="text-[17px] font-semibold lg:text-lg">Planejamento mensal</h2><p className="mt-0.5 text-[11px] text-[#727870] lg:text-xs">Veja rapidamente os dias com maior movimento.</p></div><p className="hidden items-center gap-2 text-xs text-[#727870] lg:flex"><span className="size-2 rounded-full bg-[#a64f43]" />Reservas ativas</p></div>
        <div className="mt-3 grid grid-cols-7 gap-1 lg:mt-3.5 lg:gap-2">{weekdays.map((day, index) => <span className="py-1 text-center text-[10px] font-semibold text-[#727870] lg:px-3 lg:text-left lg:text-xs" key={day}><span className="lg:hidden">{mobileWeekdays[index]}</span><span className="hidden lg:inline">{day}</span></span>)}</div>
        {loading ? <div className="mt-1 grid grid-cols-7 gap-1 lg:gap-2" aria-label="Carregando calendário">{cells.map((_, index) => <div className="h-[72px] animate-pulse rounded-[9px] bg-[#f0ece6] lg:h-[110px] lg:rounded-[14px]" key={index} />)}</div> : null}
        {!loading && error ? <div className="mt-4 rounded-xl bg-[#faf9f6] px-5 py-10 text-center"><p className="font-semibold">Não foi possível carregar o mês</p><p className="mt-1 text-sm text-[#727870]">{error}</p><button className="secondary-button mt-4 px-4 py-2 text-sm" onClick={() => { setLoading(true); setError(""); void loadMonth(); }} type="button">Tentar novamente</button></div> : null}
        {!loading && !error ? <div className="mt-1 grid grid-cols-7 gap-1 lg:gap-2">{cells.map((day, index) => day === null ? <span aria-hidden="true" className="h-[72px] rounded-[9px] border border-[#e3ddd4] bg-[#faf9f6] opacity-40 lg:h-[110px] lg:rounded-[14px]" key={`empty-${index}`} /> : <MonthDay day={day} isToday={dateValue(selectedMonth.year, selectedMonth.month, day) === todayValue} key={day} month={selectedMonth} summary={summaryByDate.get(dateValue(selectedMonth.year, selectedMonth.month, day))} />)}</div> : null}
        {!loading && !error && summaries.length === 0 ? <p className="mt-5 rounded-[9px] bg-[#f6f3ee] px-3 py-3 text-center text-[10px] text-[#727870] lg:text-xs">Nenhuma reserva ativa neste mês. Selecione um dia para abrir a agenda.</p> : <p className="mt-5 rounded-[9px] bg-[#f6f3ee] px-3 py-3 text-[10px] text-[#727870] lg:hidden">Toque em um dia para abrir a agenda.</p>}
      </section>
    </div>
  );
}

function MonthDay({ day, isToday, month, summary }: { day: number; isToday: boolean; month: MonthValue; summary?: MonthlyReservationSummary }) {
  const value = dateValue(month.year, month.month, day);
  const reservations = summary?.reservation_count ?? 0;
  const people = summary?.people_count ?? 0;
  return <Link aria-label={`${day}: ${reservations} ${reservations === 1 ? "reserva" : "reservas"}, ${people} ${people === 1 ? "pessoa" : "pessoas"}`} className={`focus-ring flex h-[72px] min-w-0 flex-col overflow-hidden rounded-[9px] border p-1.5 lg:h-[110px] lg:rounded-[14px] lg:p-3 ${isToday ? "border-[1.5px] border-[#a64f43] bg-[#f6ede7]" : "border-[#e3ddd4] bg-[#faf9f6] lg:bg-white"}`} href={`/?date=${value}`}><span className={`text-[11px] font-semibold lg:text-[13px] ${isToday ? "text-[#a64f43]" : ""}`}>{day}<span className="sr-only">{isToday ? " Hoje" : ""}</span></span><span className="mt-auto truncate text-[9px] font-semibold text-[#3f7450] lg:mt-2 lg:text-xs lg:text-[#202421]">{reservations} <span className="lg:hidden">res.</span><span className="hidden lg:inline">{reservations === 1 ? "reserva" : "reservas"}</span></span><span className="truncate text-[9px] text-[#727870] lg:mt-1 lg:text-[11px]">{people} <span className="lg:hidden">pess.</span><span className="hidden lg:inline">{people === 1 ? "pessoa" : "pessoas"}</span></span></Link>;
}
