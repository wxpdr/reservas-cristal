"use client";

import { useEffect, useRef, type RefObject } from "react";

import type { Reservation } from "@/lib/api";

type ReservationCancellationDialogProps = {
  error: string;
  onClose: () => void;
  onReasonChange: (reason: string) => void;
  onSubmit: () => void;
  pending: boolean;
  reason: string;
  reservation: Reservation;
  triggerRef: RefObject<HTMLButtonElement | null>;
};

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

export function ReservationCancellationDialog({
  error,
  onClose,
  onReasonChange,
  onSubmit,
  pending,
  reason,
  reservation,
  triggerRef,
}: ReservationCancellationDialogProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    reasonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !pending) {
        onClose();
        window.setTimeout(() => triggerRef.current?.focus(), 0);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        "button:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, pending, triggerRef]);

  function close() {
    if (pending) return;
    onClose();
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 sm:items-center sm:p-4" role="presentation">
      <section
        aria-describedby="cancel-reservation-description"
        aria-labelledby="cancel-reservation-title"
        aria-modal="true"
        className="relative max-h-[calc(100dvh-16px)] w-full overflow-y-auto rounded-t-[24px] bg-white px-5 pb-5 pt-8 shadow-2xl sm:max-w-[500px] sm:rounded-[18px] sm:p-7"
        ref={dialogRef}
        role="dialog"
      >
        <span aria-hidden="true" className="absolute left-1/2 top-2.5 h-1 w-10 -translate-x-1/2 rounded-full bg-[#aaa79f] sm:hidden" />
        <h2 className="text-xl font-semibold sm:text-[22px]" id="cancel-reservation-title">Cancelar reserva?</h2>
        <p className="mt-3 text-sm leading-relaxed text-[#727870]" id="cancel-reservation-description">
          A reserva de <strong className="font-semibold text-[#4a504b]">{reservation.customer_name}</strong>, em {formatDate(reservation.reservation_date)} às {reservation.reservation_time.slice(0, 5)}, permanecerá registrada com o status Cancelada.
        </p>
        <label className="mt-4 block text-xs font-semibold text-[#4a504b]" htmlFor="cancellation-reason">Motivo do cancelamento (opcional)</label>
        <textarea
          className="focus-ring mt-2 min-h-[88px] w-full resize-y rounded-[10px] border border-[#ded8cf] bg-white px-3.5 py-3 text-sm outline-none placeholder:text-[#a0a49f]"
          disabled={pending}
          id="cancellation-reason"
          onChange={(event) => onReasonChange(event.target.value)}
          placeholder="Ex.: Cliente desistiu da reserva"
          ref={reasonRef}
          value={reason}
        />
        <p className="mt-4 rounded-[10px] bg-[#fde8e7] px-3.5 py-3 text-xs text-[#9a403b]">A reserva não será excluída e a ação ficará registrada no histórico.</p>
        {error ? <p className="mt-4 rounded-xl border border-[#e7b9b5] bg-[#fff1f1] p-3 text-sm text-[#8f3935]" role="alert">{error}</p> : null}
        <div className="mt-5 grid grid-cols-[112px_1fr] gap-3 sm:flex sm:justify-end sm:gap-2">
          <button className="secondary-button focus-ring min-h-11 px-4 text-sm" disabled={pending} onClick={close} type="button">Voltar</button>
          <button className="focus-ring min-h-11 rounded-[9px] bg-[#a44742] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60" disabled={pending} onClick={onSubmit} type="button">{pending ? "Cancelando…" : "Cancelar reserva"}</button>
        </div>
      </section>
    </div>
  );
}
