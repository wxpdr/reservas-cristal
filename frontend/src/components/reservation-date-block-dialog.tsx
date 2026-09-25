"use client";

import { useEffect, useRef, type RefObject } from "react";

type Props = {
  dateLabel: string;
  error: string;
  onClose: () => void;
  onSubmit: (reason: string | null) => void;
  pending: boolean;
  triggerRef: RefObject<HTMLButtonElement | null>;
};

export function ReservationDateBlockDialog({ dateLabel, error, onClose, onSubmit, pending, triggerRef }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const trigger = triggerRef.current;
    reasonRef.current?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !pending) onClose();
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>("button, textarea"));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      trigger?.focus();
    };
  }, [onClose, pending, triggerRef]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !pending) onClose(); }}>
      <div aria-describedby="date-block-description" aria-labelledby="date-block-title" aria-modal="true" className="w-full rounded-t-2xl bg-white p-5 shadow-xl sm:max-w-[440px] sm:rounded-2xl sm:p-6" ref={dialogRef} role="dialog">
        <h2 className="text-xl font-semibold" id="date-block-title">Bloquear novas reservas?</h2>
        <p className="mt-2 text-sm text-[#727870]" id="date-block-description">{dateLabel} deixará de aceitar novas reservas. As reservas existentes serão mantidas.</p>
        <label className="mt-5 block text-xs font-semibold text-[#4a504b]" htmlFor="block-reason">Motivo do bloqueio (opcional)</label>
        <textarea className="form-control mt-1.5 min-h-24" disabled={pending} id="block-reason" maxLength={500} placeholder="Ex.: Limite de reservas atingido" ref={reasonRef} />
        <p className="mt-3 rounded-lg bg-[#fff1f1] px-3 py-2 text-xs text-[#8f3935]">Somente administradores podem bloquear ou desbloquear a data.</p>
        {error ? <p className="mt-3 text-sm text-[#8f3935]" role="alert">{error}</p> : null}
        <div className="mt-5 flex justify-end gap-2">
          <button className="secondary-button h-10 px-4 text-sm" disabled={pending} onClick={onClose} type="button">Voltar</button>
          <button className="primary-button h-10 px-4 text-sm disabled:opacity-60" disabled={pending} onClick={() => onSubmit(reasonRef.current?.value.trim() || null)} type="button">{pending ? "Bloqueando…" : "Bloquear dia"}</button>
        </div>
      </div>
    </div>
  );
}
