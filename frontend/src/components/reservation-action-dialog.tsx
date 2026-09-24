"use client";

import { useEffect, useRef, type RefObject } from "react";

import type { Reservation } from "@/lib/api";

type ReservationActionDialogProps = {
  action: "check-in" | "undo-check-in";
  error: string;
  onClose: () => void;
  onSubmit: () => void;
  pending: boolean;
  reservation: Reservation;
  triggerRef: RefObject<HTMLButtonElement | null>;
};

const content = {
  "check-in": {
    title: "Confirmar chegada?",
    description: "A reserva será marcada como Chegou. Você poderá desfazer a ação logo depois.",
    submit: "Confirmar chegada",
    pending: "Confirmando chegada…",
  },
  "undo-check-in": {
    title: "Desfazer chegada?",
    description: "A reserva voltará ao estado anterior registrado pelo sistema.",
    submit: "Desfazer chegada",
    pending: "Desfazendo…",
  },
} as const;

function peopleLabel(count: number) {
  return `${count} ${count === 1 ? "pessoa" : "pessoas"}`;
}

export function ReservationActionDialog({
  action,
  error,
  onClose,
  onSubmit,
  pending,
  reservation,
  triggerRef,
}: ReservationActionDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const labels = content[action];
  const titleId = `${action}-title`;
  const descriptionId = `${action}-description`;

  useEffect(() => {
    cancelRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !pending) {
        onClose();
        window.setTimeout(() => triggerRef.current?.focus(), 0);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        "button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex='-1'])",
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
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="relative w-full rounded-t-[24px] border border-[#e3ddd4] bg-white px-5 pb-5 pt-8 shadow-2xl sm:max-w-[470px] sm:rounded-2xl sm:p-6"
        ref={dialogRef}
        role="dialog"
      >
        <span aria-hidden="true" className="absolute left-1/2 top-2.5 h-1 w-10 -translate-x-1/2 rounded-full bg-[#aaa79f] sm:hidden" />
        <h2 className="text-xl font-semibold" id={titleId}>{labels.title}</h2>
        <div className="mt-4 rounded-xl bg-[#f6f3ee] p-4">
          <p className="font-semibold">{reservation.customer_name}</p>
          <p className="mt-1 text-sm text-[#727870]">{peopleLabel(reservation.party_size)} <span aria-hidden="true">•</span> {reservation.reservation_time.slice(0, 5)}</p>
        </div>
        <p className="mt-4 text-sm text-[#727870]" id={descriptionId}>{labels.description}</p>
        {error ? <p className="mt-4 rounded-xl border border-[#e7b9b5] bg-[#fff1f1] p-3 text-sm text-[#8f3935]" role="alert">{error}</p> : null}
        <div className="mt-6 grid grid-cols-[112px_1fr] gap-5 sm:flex sm:justify-end sm:gap-2">
          <button className="secondary-button focus-ring min-h-11 px-4 text-sm" disabled={pending} onClick={close} ref={cancelRef} type="button">Cancelar</button>
          <button className="focus-ring min-h-11 rounded-[9px] bg-[#3f7450] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60" disabled={pending} onClick={onSubmit} type="button">{pending ? labels.pending : labels.submit}</button>
        </div>
      </section>
    </div>
  );
}
