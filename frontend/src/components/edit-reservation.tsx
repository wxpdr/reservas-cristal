"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  cloneElement,
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactElement,
} from "react";

import { AppShell } from "@/components/app-shell";
import {
  getCurrentUser,
  getErrorMessage,
  getReservation,
  logout,
  updateReservation,
  type AuthenticatedUser,
  type Reservation,
  type ReservationUpdate,
} from "@/lib/api";

type EditReservationPageProps = { agendaDate?: string; reservationId: string };
type FieldName = keyof ReservationUpdate;
type FormErrors = Partial<Record<FieldName, string>>;

function validate(payload: ReservationUpdate): FormErrors {
  const errors: FormErrors = {};
  if (!payload.customer_name) errors.customer_name = "Informe o nome do cliente.";
  if (!payload.phone) errors.phone = "Informe o telefone.";
  if (!Number.isInteger(payload.party_size) || payload.party_size <= 0) {
    errors.party_size = "Informe uma quantidade maior que zero.";
  }
  if (!payload.reservation_date) errors.reservation_date = "Informe a data.";
  if (!payload.reservation_time) errors.reservation_time = "Informe o horário.";
  if (!payload.origin) errors.origin = "Selecione a origem.";
  return errors;
}

function detailHref(reservationId: string, agendaDate?: string, updated = false) {
  const params = new URLSearchParams();
  if (agendaDate) params.set("date", agendaDate);
  if (updated) params.set("updated", "1");
  const query = params.toString();
  return `/reservas/${encodeURIComponent(reservationId)}${query ? `?${query}` : ""}`;
}

export function EditReservationPage({ agendaDate, reservationId }: EditReservationPageProps) {
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
      const currentUser = (await userResponse.json()) as AuthenticatedUser;
      setUser(currentUser);

      if (reservationResponse.status === 404 || reservationResponse.status === 422) {
        setNotFound(true);
        return;
      }
      if (!reservationResponse.ok) {
        setError(await getErrorMessage(reservationResponse));
        return;
      }
      setReservation((await reservationResponse.json()) as Reservation);
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
        <PageMessage
          agendaDate={agendaDate}
          description="A reserva pode não existir ou o endereço está incorreto."
          title="Reserva não encontrada"
        />
      </AppShell>
    );
  }

  if (error || !user || !reservation) {
    return <AccessError message={error || "Tente novamente."} onRetry={() => void loadPage()} />;
  }

  return (
    <AppShell onLogout={handleLogout} user={user}>
      <EditReservationForm
        agendaDate={agendaDate}
        onSessionExpired={() => router.replace("/login")}
        reservation={reservation}
      />
    </AppShell>
  );
}

function EditReservationForm({
  agendaDate,
  onSessionExpired,
  reservation,
}: {
  agendaDate?: string;
  onSessionExpired: () => void;
  reservation: Reservation;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const submittingRef = useRef(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const contextDate = agendaDate ?? reservation.reservation_date;
  const detailsHref = detailHref(reservation.id, contextDate);

  function focusFirstError(validationErrors: FormErrors) {
    const firstField = Object.keys(validationErrors)[0];
    if (!firstField) return;
    const element = formRef.current?.elements.namedItem(firstField);
    if (element instanceof HTMLElement) element.focus();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;

    const data = new FormData(event.currentTarget);
    const payload: ReservationUpdate = {
      customer_name: String(data.get("customer_name") ?? "").trim(),
      phone: String(data.get("phone") ?? "").trim(),
      party_size: Number(data.get("party_size")),
      reservation_date: String(data.get("reservation_date") ?? ""),
      reservation_time: String(data.get("reservation_time") ?? ""),
      origin: String(data.get("origin") ?? "") as ReservationUpdate["origin"],
      table_label: String(data.get("table_label") ?? "").trim() || null,
      notes: String(data.get("notes") ?? "").trim() || null,
    };
    const validationErrors = validate(payload);
    setErrors(validationErrors);
    setSubmitError("");
    if (Object.keys(validationErrors).length > 0) {
      focusFirstError(validationErrors);
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    try {
      const response = await updateReservation(reservation.id, payload);
      if (response.status === 401) {
        onSessionExpired();
        return;
      }
      if (response.status === 404) {
        setSubmitError("A reserva não foi encontrada.");
        return;
      }
      if (response.status === 422) {
        setSubmitError("Revise os dados informados e tente novamente.");
        return;
      }
      if (response.status === 409) {
        setSubmitError(await getErrorMessage(response));
        return;
      }
      if (!response.ok) {
        setSubmitError(await getErrorMessage(response));
        return;
      }
      router.push(detailHref(reservation.id, contextDate, true));
      router.refresh();
    } catch {
      setSubmitError("Não foi possível salvar as alterações. Verifique sua conexão e tente novamente.");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <div className="px-4 pb-10 pt-4 lg:px-9 lg:py-8">
      <header className="relative min-h-[50px] lg:flex lg:h-[72px] lg:items-center lg:justify-between lg:gap-3">
        <div className="min-w-0 pr-24 lg:pr-0">
          <h1 className="text-2xl font-semibold lg:text-[28px]">Editar reserva</h1>
          <p className="mt-1 truncate text-xs text-[#727870] lg:text-[13px]">
            Atualize os dados da reserva de {reservation.customer_name}.
          </p>
        </div>
        <Link
          className="secondary-button focus-ring absolute right-0 top-0 flex h-8 shrink-0 items-center px-5 text-xs lg:static lg:h-10 lg:px-3.5 lg:text-sm"
          href={detailsHref}
        >
          Voltar
        </Link>
      </header>

      <form className="mt-3 lg:mt-4" noValidate onSubmit={handleSubmit} ref={formRef}>
        <section className="rounded-[14px] border border-[#e3ddd4] bg-white p-4 lg:min-h-[620px] lg:rounded-2xl lg:p-6">
          <h2 className="text-[17px] font-semibold lg:text-lg">Dados da reserva</h2>
          <p className="mt-1 text-[11px] text-[#727870] lg:text-xs">
            Edite apenas as informações que precisam ser atualizadas.
          </p>

          <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 lg:grid-cols-12 lg:gap-y-4">
            <Field className="col-span-2 lg:col-span-8" error={errors.customer_name} label="Nome do cliente" name="customer_name" required>
              <input autoComplete="name" defaultValue={reservation.customer_name} maxLength={120} name="customer_name" />
            </Field>
            <Field className="col-span-2 lg:col-span-4" error={errors.phone} label="Telefone" name="phone" required>
              <input autoComplete="tel" defaultValue={reservation.phone} inputMode="tel" maxLength={30} name="phone" type="tel" />
            </Field>
            <Field className="col-span-1 lg:col-span-3" error={errors.party_size} label="Pessoas" name="party_size" required>
              <input defaultValue={reservation.party_size} inputMode="numeric" min="1" name="party_size" step="1" type="number" />
            </Field>
            <Field className="col-span-1 lg:col-span-3" error={errors.reservation_date} label="Data" name="reservation_date" required>
              <input defaultValue={reservation.reservation_date} name="reservation_date" type="date" />
            </Field>
            <Field className="col-span-1 lg:col-span-3" error={errors.reservation_time} label="Horário" name="reservation_time" required>
              <input defaultValue={reservation.reservation_time.slice(0, 5)} name="reservation_time" type="time" />
            </Field>
            <Field className="col-span-1 lg:col-span-3" error={errors.origin} label="Origem" name="origin" required>
              <select defaultValue={reservation.origin} name="origin">
                <option value="TELEFONE">Telefone</option>
                <option value="WHATSAPP">WhatsApp</option>
                <option value="PRESENCIAL">Presencial</option>
                <option value="TAGME">Tagme</option>
                <option value="OUTRO">Outro</option>
              </select>
            </Field>
            <Field className="col-span-2 lg:col-span-4" label="Mesa" name="table_label">
              <input defaultValue={reservation.table_label ?? ""} maxLength={50} name="table_label" placeholder="Opcional" />
            </Field>
            <Field className="col-span-2 lg:col-span-8" label="Observação rápida" name="notes">
              <textarea defaultValue={reservation.notes ?? ""} name="notes" placeholder="Opcional" rows={3} />
            </Field>
          </div>

          <p className="mt-3 rounded-[9px] border border-[#f1dec0] bg-[#fff4d8] px-3 py-3.5 text-[11px] font-semibold text-[#a25b1f] lg:mt-4 lg:rounded-xl lg:px-3.5 lg:text-xs">
            <span className="lg:hidden">20+ pessoas recebem destaque visual.</span>
            <span className="hidden lg:inline">Reservas com 20 pessoas ou mais recebem destaque visual, mas não são bloqueadas.</span>
          </p>
          {submitError ? <p className="mt-3 rounded-[9px] border border-[#e7b9b5] bg-[#fff1f1] px-3 py-3 text-sm text-[#8f3935]" role="alert">{submitError}</p> : null}
        </section>

        <div className="mt-3 flex justify-end gap-2 lg:h-16 lg:items-center">
          <Link className="secondary-button focus-ring flex h-9 items-center px-4 text-xs lg:h-10 lg:px-[18px] lg:text-sm" href={detailsHref}>Cancelar</Link>
          <button className="primary-button h-9 px-4 text-xs disabled:cursor-not-allowed disabled:opacity-60 lg:h-10 lg:px-[18px] lg:text-sm" disabled={submitting} type="submit">
            {submitting ? "Salvando…" : "Salvar alterações"}
          </button>
        </div>
        <p className="mt-2 hidden min-h-[52px] items-center rounded-xl bg-[#f0ece6] px-3.5 text-xs font-medium text-[#727870] lg:flex">
          O status da reserva não é alterado nesta tela.
        </p>
      </form>
    </div>
  );
}

type FieldControlProps = {
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  className?: string;
  id?: string;
};

function Field({ children, className = "", error, label, name, required = false }: { children: ReactElement<FieldControlProps>; className?: string; error?: string; label: string; name: string; required?: boolean }) {
  const errorId = `${name}-error`;
  return (
    <div className={`min-w-0 ${className}`}>
      <label className="block text-[11px] font-semibold text-[#727870] lg:text-xs lg:text-[#4a504b]" htmlFor={name}>{label}{required ? " *" : ""}</label>
      {cloneElement(children, {
        id: name,
        className: `form-control mt-1.5 ${children.props.className ?? ""}`,
        "aria-invalid": Boolean(error),
        "aria-describedby": error ? errorId : undefined,
      })}
      {error ? <p className="mt-1 text-[11px] text-[#a44742]" id={errorId}>{error}</p> : null}
    </div>
  );
}

function PageLoading() {
  return <main aria-busy="true" aria-label="Carregando edição da reserva" className="flex min-h-screen items-center justify-center bg-[#f6f3ee]"><div className="loading-dot" /></main>;
}

function AccessError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <main className="flex min-h-screen items-center justify-center bg-[#f6f3ee] p-6"><section className="w-full max-w-md rounded-2xl border border-[#e3ddd4] bg-white p-6 text-center"><h1 className="text-xl font-semibold">Não foi possível editar a reserva</h1><p className="mt-2 text-sm text-[#727870]">{message}</p><button className="primary-button mt-5 px-4 py-2" onClick={onRetry} type="button">Tentar novamente</button></section></main>;
}

function PageMessage({ agendaDate, description, title }: { agendaDate?: string; description: string; title: string }) {
  const href = agendaDate ? `/?date=${encodeURIComponent(agendaDate)}` : "/";
  return <div className="flex min-h-[calc(100vh-72px)] items-center justify-center p-6 lg:min-h-screen"><section className="w-full max-w-md rounded-2xl border border-[#e3ddd4] bg-white p-7 text-center"><h1 className="text-xl font-semibold">{title}</h1><p className="mt-2 text-sm text-[#727870]">{description}</p><Link className="secondary-button focus-ring mt-5 inline-flex h-10 items-center px-4 text-sm" href={href}>Voltar à agenda</Link></section></div>;
}
