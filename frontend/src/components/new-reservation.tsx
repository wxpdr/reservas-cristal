"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { cloneElement, useCallback, useEffect, useRef, useState, type FormEvent, type ReactElement } from "react";

import { AppShell } from "@/components/app-shell";
import {
  createReservation,
  getCurrentUser,
  getErrorMessage,
  logout,
  type AuthenticatedUser,
  type ReservationCreate,
} from "@/lib/api";

type NewReservationPageProps = { agendaDate?: string };
type FieldName = keyof ReservationCreate;
type FormErrors = Partial<Record<FieldName, string>>;

const dateValuePattern = /^\d{4}-\d{2}-\d{2}$/;

function localDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function validDateOrToday(value: string | undefined) {
  if (!value || !dateValuePattern.test(value)) return localDateValue(new Date());
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return !Number.isNaN(date.getTime()) && localDateValue(date) === value
    ? value
    : localDateValue(new Date());
}

function validate(payload: ReservationCreate): FormErrors {
  const errors: FormErrors = {};
  if (!payload.customer_name) errors.customer_name = "Informe o nome do cliente.";
  if (!payload.phone) errors.phone = "Informe o telefone.";
  if (!Number.isInteger(payload.party_size) || payload.party_size <= 0) errors.party_size = "Informe uma quantidade maior que zero.";
  if (!payload.reservation_date) errors.reservation_date = "Informe a data.";
  if (!payload.reservation_time) errors.reservation_time = "Informe o horário.";
  if (!payload.origin) errors.origin = "Selecione a origem.";
  return errors;
}

export function NewReservationPage({ agendaDate }: NewReservationPageProps) {
  const router = useRouter();
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [authError, setAuthError] = useState("");

  const loadUser = useCallback(async () => {
    setAuthError("");
    try {
      const response = await getCurrentUser();
      if (response.status === 401) {
        router.replace("/login");
        return;
      }
      if (!response.ok) {
        setAuthError("Não foi possível confirmar seu acesso. Tente novamente.");
        return;
      }
      setUser((await response.json()) as AuthenticatedUser);
    } catch {
      setAuthError("Não foi possível conectar ao sistema. Verifique sua conexão.");
    }
  }, [router]);

  useEffect(() => {
    const request = window.setTimeout(() => void loadUser(), 0);
    return () => window.clearTimeout(request);
  }, [loadUser]);

  async function handleLogout() {
    try {
      await logout();
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  if (authError) {
    return <AccessError message={authError} onRetry={() => void loadUser()} />;
  }
  if (!user) {
    return <PageLoading />;
  }

  return (
    <AppShell onLogout={handleLogout} user={user}>
      <NewReservationForm agendaDate={validDateOrToday(agendaDate)} onSessionExpired={() => router.replace("/login")} />
    </AppShell>
  );
}

function NewReservationForm({ agendaDate, onSessionExpired }: { agendaDate: string; onSessionExpired: () => void }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const submittingRef = useRef(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const agendaHref = `/?date=${encodeURIComponent(agendaDate)}`;

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
    const payload: ReservationCreate = {
      customer_name: String(data.get("customer_name") ?? "").trim(),
      phone: String(data.get("phone") ?? "").trim(),
      party_size: Number(data.get("party_size")),
      reservation_date: String(data.get("reservation_date") ?? ""),
      reservation_time: String(data.get("reservation_time") ?? ""),
      origin: String(data.get("origin") ?? "") as ReservationCreate["origin"],
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
      const response = await createReservation(payload);
      if (response.status === 401) {
        onSessionExpired();
        return;
      }
      if (response.status === 422) {
        setSubmitError("Revise os dados informados e tente novamente.");
        return;
      }
      if (!response.ok) {
        setSubmitError(await getErrorMessage(response));
        return;
      }
      router.push(`/?date=${encodeURIComponent(payload.reservation_date)}&created=1`);
      router.refresh();
    } catch {
      setSubmitError("Não foi possível salvar a reserva. Verifique sua conexão e tente novamente.");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <div className="px-4 pb-10 pt-4 lg:px-9 lg:py-8">
      <header className="relative min-h-[50px] lg:flex lg:h-[72px] lg:items-center lg:justify-between lg:gap-3">
        <div className="min-w-0 pr-24 lg:pr-0">
          <h1 className="text-2xl font-semibold lg:text-[28px]">Nova reserva</h1>
          <p className="mt-1 whitespace-nowrap text-xs text-[#727870] lg:text-[13px]">Registre uma nova reserva na agenda da Cristal.</p>
        </div>
        <Link className="secondary-button focus-ring absolute right-0 top-0 flex h-8 shrink-0 items-center px-5 text-xs lg:static lg:h-10 lg:px-3.5 lg:text-sm" href={agendaHref}><span className="lg:hidden">Voltar</span><span className="hidden lg:inline">Voltar à agenda</span></Link>
      </header>

      <form className="mt-3 lg:mt-4" noValidate onSubmit={handleSubmit} ref={formRef}>
        <section className="rounded-[14px] border border-[#e3ddd4] bg-white p-4 lg:min-h-[620px] lg:rounded-2xl lg:p-6">
          <h2 className="text-[17px] font-semibold lg:text-lg">Dados da reserva</h2>
          <p className="mt-1 text-[11px] text-[#727870] lg:text-xs">Preencha os dados essenciais para criar a reserva.</p>

          <div className="mt-5 grid gap-x-4 gap-y-3 lg:grid-cols-12 lg:gap-y-4">
            <Field className="col-span-2 lg:col-span-8" error={errors.customer_name} label="Nome do cliente" name="customer_name" required>
              <input autoComplete="name" maxLength={120} name="customer_name" placeholder="Ex.: Mariana Lopes" />
            </Field>
            <Field className="col-span-2 lg:col-span-4" error={errors.phone} label="Telefone" name="phone" required>
              <input autoComplete="tel" inputMode="tel" maxLength={30} name="phone" placeholder="(11) 99999-9999" type="tel" />
            </Field>
            <Field className="col-span-1 lg:col-span-3" error={errors.party_size} label="Pessoas" name="party_size" required>
              <input inputMode="numeric" min="1" name="party_size" placeholder="Ex.: 4" step="1" type="number" />
            </Field>
            <Field className="col-span-1 lg:col-span-3" error={errors.reservation_date} label="Data" name="reservation_date" required>
              <input defaultValue={agendaDate} name="reservation_date" type="date" />
            </Field>
            <Field className="col-span-1 lg:col-span-3" error={errors.reservation_time} label="Horário" name="reservation_time" required>
              <input name="reservation_time" type="time" />
            </Field>
            <Field className="col-span-1 lg:col-span-3" error={errors.origin} label="Origem" name="origin" required>
              <select defaultValue="TELEFONE" name="origin">
                <option value="TELEFONE">Telefone</option><option value="WHATSAPP">WhatsApp</option><option value="PRESENCIAL">Presencial</option><option value="TAGME">Tagme</option><option value="OUTRO">Outro</option>
              </select>
            </Field>
            <Field className="col-span-2 lg:col-span-4" label="Mesa" name="table_label">
              <input maxLength={50} name="table_label" placeholder="Opcional" />
            </Field>
            <Field className="col-span-2 lg:col-span-8" label="Observação rápida" name="notes">
              <textarea name="notes" placeholder="Ex.: prefere mesa com melhor circulação." rows={3} />
            </Field>
          </div>

          <p className="mt-3 rounded-[9px] border border-[#f1dec0] bg-[#fff4d8] px-3 py-3.5 text-[11px] font-semibold text-[#a25b1f] lg:mt-4 lg:rounded-xl lg:px-3.5 lg:text-xs"><span className="lg:hidden">20+ pessoas recebem destaque visual.</span><span className="hidden lg:inline">Reservas com 20 pessoas ou mais recebem destaque visual, mas não são bloqueadas.</span></p>
          {submitError ? <p className="mt-3 rounded-[9px] border border-[#e7b9b5] bg-[#fff1f1] px-3 py-3 text-sm text-[#8f3935]" role="alert">{submitError}</p> : null}
        </section>

        <div className="mt-3 flex justify-end gap-2 lg:h-16 lg:items-center">
          <Link className="secondary-button focus-ring flex h-9 items-center px-4 text-xs lg:h-10 lg:px-[18px] lg:text-sm" href={agendaHref}>Cancelar</Link>
          <button className="primary-button h-9 px-4 text-xs disabled:cursor-not-allowed disabled:opacity-60 lg:h-10 lg:px-[18px] lg:text-sm" disabled={submitting} type="submit">{submitting ? "Salvando…" : "Salvar reserva"}</button>
        </div>
        <p className="mt-2 hidden min-h-[52px] items-center rounded-xl bg-[#f0ece6] px-3.5 text-xs font-medium text-[#727870] lg:flex">Ao salvar, a reserva será criada com o status Agendada.</p>
      </form>
    </div>
  );
}

type FieldControlProps = { "aria-describedby"?: string; "aria-invalid"?: boolean; className?: string; id?: string };

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
  return <main aria-busy="true" aria-label="Carregando formulário" className="flex min-h-screen items-center justify-center bg-[#f6f3ee]"><div className="loading-dot" /></main>;
}

function AccessError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <main className="flex min-h-screen items-center justify-center bg-[#f6f3ee] p-6"><section className="w-full max-w-md rounded-2xl border border-[#e3ddd4] bg-white p-6 text-center"><h1 className="text-xl font-semibold">Acesso indisponível</h1><p className="mt-2 text-sm text-[#727870]">{message}</p><button className="primary-button mt-5 px-4 py-2" onClick={onRetry} type="button">Tentar novamente</button></section></main>;
}
