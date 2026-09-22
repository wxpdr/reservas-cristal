import Link from "next/link";

export default function ReservationPlaceholder() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f3ee] p-6">
      <section className="w-full max-w-md rounded-2xl border border-[#e3ddd4] bg-white p-7 text-center">
        <p className="text-sm font-semibold text-[#a64f43]">Reservas Cristal</p>
        <h1 className="mt-2 text-2xl font-semibold">Detalhes da reserva</h1>
        <p className="mt-3 text-sm text-[#727870]">Esta tela será implementada na próxima etapa do Sprint 3.</p>
        <Link className="secondary-button mt-6 inline-flex h-10 items-center px-4 text-sm" href="/">Voltar para a agenda</Link>
      </section>
    </main>
  );
}
