"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { AppShell } from "@/components/app-shell";
import {
  getCurrentUser,
  getErrorMessage,
  getReservation,
  logout,
  type AuthenticatedUser,
  type Reservation,
} from "@/lib/api";

type ReservationDetailsPageProps = {
  agendaDate?: string;
  reservationId: string;
  reservationUpdated?: boolean;
};

const statusLabels: Record<Reservation["status"], string> = {
  AGENDADA: "Agendada",
  CONFIRMADA: "Confirmada",
  CHEGOU: "Chegou",
  CANCELADA: "Cancelada",
};

const originLabels: Record<Reservation["origin"], string> = {
  TELEFONE: "Telefone",
  WHATSAPP: "WhatsApp",
  PRESENCIAL: "Presencial",
  TAGME: "Tagme",
  OUTRO: "Outro",
};

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function peopleLabel(count: number) {
  return `${count} ${count === 1 ? "pessoa" : "pessoas"}`;
}

export function ReservationDetailsPage({
  agendaDate,
  reservationId,
  reservationUpdated = false,
}: ReservationDetailsPageProps) {
  const router = useRouter();
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notFound, setNotFound] = useState(false);

  const loadPage = useCallback(async () => {
    setLoading(true);
    setError("");
    setNotFound(false);

    try {
      const [userResponse, reservationResponse] = await Promise.all([
        getCurrentUser(),
        getReservation(reservationId),
      ]);

      if (userResponse.status === 401 || reservationResponse.status === 401) {
        router.replace("/login");
        return;
      }
      if (!userResponse.ok) {
        setError("Não foi possível confirmar seu acesso. Tente novamente.");
        return;
      }
      if (reservationResponse.status === 404) {
        setUser((await userResponse.json()) as AuthenticatedUser);
        setNotFound(true);
        return;
      }
      if (!reservationResponse.ok) {
        setError(await getErrorMessage(reservationResponse));
        return;
      }

      const [currentUser, currentReservation] = await Promise.all([
        userResponse.json() as Promise<AuthenticatedUser>,
        reservationResponse.json() as Promise<Reservation>,
      ]);
      setUser(currentUser);
      setReservation(currentReservation);
    } catch {
      setError("Não foi possível carregar a reserva. Verifique sua conexão.");
    } finally {
      setLoading(false);
    }
  }, [reservationId, router]);

  useEffect(() => {
    const request = window.setTimeout(() => void loadPage(), 0);
    return () => window.clearTimeout(request);
  }, [loadPage]);

  async function handleLogout() {
    try {
      await logout();
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  if (loading) return <PageLoading />;

  if (user && notFound) {
    return (
      <AppShell onLogout={handleLogout} user={user}>
        <PageMessage agendaDate={agendaDate} description="A reserva pode não existir ou o endereço está incorreto." title="Reserva não encontrada" />
      </AppShell>
    );
  }

  if (error || !user || !reservation) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f6f3ee] p-6">
        <section className="w-full max-w-md rounded-2xl border border-[#e3ddd4] bg-white p-6 text-center">
          <h1 className="text-xl font-semibold">Não foi possível abrir a reserva</h1>
          <p className="mt-2 text-sm text-[#727870]">{error || "Tente novamente."}</p>
          <button className="primary-button mt-5 px-4 py-2" onClick={() => void loadPage()} type="button">Tentar novamente</button>
        </section>
      </main>
    );
  }

  return (
    <AppShell onLogout={handleLogout} user={user}>
      <ReservationDetails
        agendaDate={agendaDate}
        reservation={reservation}
        reservationUpdated={reservationUpdated}
      />
    </AppShell>
  );
}

function ReservationDetails({
  agendaDate,
  reservation,
  reservationUpdated,
}: {
  agendaDate?: string;
  reservation: Reservation;
  reservationUpdated: boolean;
}) {
  const cancelled = reservation.status === "CANCELADA";
  const largeGroup = reservation.party_size >= 20;
  const agendaHref = agendaDate ? `/?date=${encodeURIComponent(agendaDate)}` : "/";
  const editParams = new URLSearchParams();
  if (agendaDate) editParams.set("date", agendaDate);
  const editQuery = editParams.toString();
  const editHref = `/reservas/${encodeURIComponent(reservation.id)}/editar${editQuery ? `?${editQuery}` : ""}`;

  return (
    <div className="px-4 pb-10 pt-4 lg:px-9 lg:py-8">
      <header className="flex min-h-[50px] items-start justify-between gap-3 lg:h-[72px] lg:items-center">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold lg:text-[28px]">Detalhes da reserva</h1>
          <p className="mt-1 text-xs text-[#727870] lg:text-[13px]">Consulte os dados da reserva.</p>
        </div>
        <Link className="secondary-button focus-ring flex h-8 shrink-0 items-center px-5 text-xs lg:h-10 lg:px-3.5 lg:text-sm" href={agendaHref}>
          <span className="lg:hidden">Voltar</span><span className="hidden lg:inline">Voltar à agenda</span>
        </Link>
      </header>

      {reservationUpdated ? <p className="mt-3 rounded-xl border border-[#b8d3bf] bg-[#e9f3eb] px-4 py-3 text-sm font-medium text-[#2f6240]" role="status">Reserva atualizada com sucesso.</p> : null}

      <section className={`relative mt-3 rounded-[14px] border p-4 lg:mt-4 lg:flex lg:min-h-[142px] lg:items-start lg:justify-between lg:rounded-2xl lg:px-6 lg:py-[22px] ${cancelled ? "border-[#de7575] bg-[#fff1f1]" : "border-[#e3ddd4] bg-white"}`}>
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="pr-24 text-lg font-semibold lg:pr-0 lg:text-2xl">{reservation.customer_name}</h2>
            {largeGroup ? <span className="hidden rounded-full bg-[#fff0dd] px-2.5 py-1.5 text-[11px] font-semibold text-[#9a5b22] lg:inline-flex">{peopleLabel(reservation.party_size)} • grupo</span> : null}
          </div>
          <p className="mt-1 text-xs text-[#727870] lg:text-[13px]">{reservation.phone}</p>
          <p className="mt-2 hidden text-[11px] text-[#9a9f99] lg:block">Criada em {formatDateTime(reservation.created_at)}</p>
          <div className="mt-4 grid grid-cols-2 gap-3 lg:hidden">
            <span className={`meta-chip ${largeGroup ? "bg-[#fff0dd] text-[#9a5b22]" : ""}`}>{peopleLabel(reservation.party_size)}{largeGroup ? " • grupo" : ""}</span>
            <span className="meta-chip">{reservation.table_label || "Sem mesa"}</span>
          </div>
        </div>
        <div className="absolute right-4 top-3 lg:static lg:mt-7 lg:text-right">
          <p className="mb-2 hidden text-[11px] font-medium text-[#727870] lg:block">Status atual</p>
          <span className={`status-badge status-${reservation.status.toLowerCase()}`}>{cancelled ? "✕ " : ""}{statusLabels[reservation.status]}</span>
        </div>
      </section>

      <div className="mt-3 grid gap-3 lg:mt-4 lg:grid-cols-2 lg:gap-4">
        <section className="rounded-[14px] border border-[#e3ddd4] bg-white p-4 lg:min-h-[286px] lg:rounded-2xl lg:px-6 lg:py-[22px]">
          <h2 className="text-[17px] font-semibold">Dados da reserva</h2>
          <dl className="mt-5 grid grid-cols-2 gap-x-7 gap-y-5">
            <Info label="Data" value={formatDate(reservation.reservation_date)} />
            <Info label="Horário" value={reservation.reservation_time.slice(0, 5)} />
            <Info label="Origem" value={originLabels[reservation.origin]} />
            <Info accent={!reservation.table_label} label="Mesa" value={reservation.table_label || "Sem mesa atribuída"} />
          </dl>
          <p className="mt-5 border-t border-[#e3ddd4] pt-4 text-[10px] text-[#727870] lg:hidden">Última atualização em {formatDateTime(reservation.updated_at)}.</p>
        </section>

        <section className="rounded-[14px] border border-[#e3ddd4] bg-white p-4 lg:min-h-[286px] lg:rounded-2xl lg:px-6 lg:py-[22px]">
          <h2 className="text-[17px] font-semibold">Observações</h2>
          <div className="mt-3 min-h-12 rounded-[9px] bg-[#f6f3ee] p-3 text-xs leading-relaxed text-[#727870] lg:min-h-[150px] lg:rounded-xl lg:p-3.5 lg:text-[13px]">{reservation.notes || "Sem observações."}</div>
          {cancelled ? (
            <div className="mt-3 rounded-[9px] border border-[#e7b9b5] bg-[#fff1f1] p-3 text-xs text-[#8f3935]">
              <strong className="block font-semibold">Motivo do cancelamento</strong>
              <span className="mt-1 block">{reservation.cancellation_reason || "Motivo não informado."}</span>
            </div>
          ) : null}
        </section>
      </div>

      <FutureActions cancelled={cancelled} editHref={editHref} />
      <p className="mt-3 hidden min-h-[54px] items-center rounded-xl bg-[#f0ece6] px-3.5 text-xs font-medium text-[#727870] lg:flex">A mesa pode ser atribuída ou alterada a qualquer momento. Ações relevantes ficam registradas no histórico.</p>
    </div>
  );
}

function Info({ accent = false, label, value }: { accent?: boolean; label: string; value: string }) {
  return <div><dt className="text-[10px] font-medium text-[#7a807a] lg:text-[11px]">{label}</dt><dd className={`mt-1.5 text-[13px] font-semibold lg:text-sm ${accent ? "text-[#a64f43]" : "text-[#202421]"}`}>{value}</dd></div>;
}

function FutureActions({ cancelled, editHref }: { cancelled: boolean; editHref: string }) {
  return (
    <section className="mt-3 rounded-[14px] border border-[#e3ddd4] bg-white p-4 lg:flex lg:min-h-[74px] lg:items-center lg:border-0 lg:bg-transparent lg:p-0">
      <h2 className="text-[17px] font-semibold lg:sr-only">Ações</h2>
      <div className="mt-3 grid grid-cols-[92px_1fr] gap-2 lg:mt-0 lg:flex lg:w-full lg:items-center">
        <Link className="secondary-button focus-ring flex h-9 items-center justify-center text-xs lg:order-2 lg:ml-auto lg:h-10 lg:px-4 lg:text-sm" href={editHref}>Editar</Link>
        {!cancelled ? <button className="h-9 rounded-[9px] bg-[#a64f43] px-3 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 lg:order-3 lg:h-10 lg:text-sm" disabled title="Confirmação será implementada em uma próxima etapa" type="button">Confirmar reserva</button> : null}
        {!cancelled ? <button className="col-span-2 h-9 rounded-[9px] bg-[#3f7450] px-3 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 lg:order-4 lg:h-10 lg:text-sm" disabled title="Check-in será implementado em uma próxima etapa" type="button">Marcar chegada</button> : null}
        {!cancelled ? <button className="col-span-2 h-6 text-[11px] font-semibold text-[#a64f43] disabled:cursor-not-allowed disabled:opacity-60 lg:order-1 lg:h-10 lg:rounded-[10px] lg:border lg:border-[#e7b9b5] lg:bg-white lg:px-4 lg:text-sm" disabled title="Cancelamento será implementado em uma próxima etapa" type="button">Cancelar reserva</button> : null}
      </div>
      <p className="sr-only">Confirmação, chegada e cancelamento ainda não estão disponíveis nesta etapa.</p>
    </section>
  );
}

function PageLoading() {
  return <main aria-busy="true" aria-label="Carregando detalhes da reserva" className="flex min-h-screen items-center justify-center bg-[#f6f3ee]"><div className="loading-dot" /></main>;
}

function PageMessage({ agendaDate, description, title }: { agendaDate?: string; description: string; title: string }) {
  const href = agendaDate ? `/?date=${encodeURIComponent(agendaDate)}` : "/";
  return (
    <div className="flex min-h-[calc(100vh-72px)] items-center justify-center p-6 lg:min-h-screen">
      <section className="w-full max-w-md rounded-2xl border border-[#e3ddd4] bg-white p-7 text-center">
        <h1 className="text-xl font-semibold">{title}</h1><p className="mt-2 text-sm text-[#727870]">{description}</p>
        <Link className="secondary-button focus-ring mt-5 inline-flex h-10 items-center px-4 text-sm" href={href}>Voltar à agenda</Link>
      </section>
    </div>
  );
}
