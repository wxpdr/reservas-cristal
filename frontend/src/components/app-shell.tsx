"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AuthenticatedUser } from "@/lib/api";

type AppShellProps = {
  user: AuthenticatedUser;
  onLogout: () => void;
  children: ReactNode;
};

function roleLabel(role: AuthenticatedUser["role"]) {
  return role === "admin" ? "Administrador" : "Operador";
}

export function AppShell({ user, onLogout, children }: AppShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const reservationsActive = !pathname.startsWith("/usuarios") && !pathname.startsWith("/historico");

  function navClass(active: boolean) {
    return `focus-ring flex h-11 items-center gap-2.5 rounded-[10px] px-3.5 text-sm ${active ? "bg-[#313833] font-semibold text-white" : "text-[#d2d7d2]"}`;
  }

  return (
    <div className="min-h-screen bg-[#f6f3ee] text-[#202421] lg:grid lg:h-screen lg:min-h-0 lg:grid-cols-[232px_minmax(0,1fr)] lg:overflow-hidden">
      <header className="relative flex h-[72px] items-center justify-between bg-[#252b27] px-[18px] text-white lg:hidden">
        <div className="flex items-center gap-3">
          <Image
            src="/img/logo-round.svg"
            alt="Cristal Pizza"
            width={44}
            height={44}
            priority
            className="h-11 w-11 object-contain"
          />

          <p className="text-[11px] text-[#c7ccc2]">
            Reservas internas
          </p>
        </div>

        <button
          aria-expanded={menuOpen}
          aria-label="Abrir menu"
          className="focus-ring flex h-9 w-[42px] items-center justify-center rounded-[10px] bg-[#333b36] text-lg tracking-[2px]"
          onClick={() => setMenuOpen((open) => !open)}
          type="button"
        >
          •••
        </button>

        {menuOpen ? (
          <div className="absolute right-4 top-16 z-20 w-56 rounded-xl border border-[#475048] bg-[#252b27] p-3 shadow-xl">
            <nav aria-label="Navegação móvel" className="mb-3 space-y-1 border-b border-[#475048] pb-3">
              <Link className="focus-ring block min-h-10 rounded-lg px-3 py-2 text-sm" href="/" onClick={() => setMenuOpen(false)}>Reservas</Link>
              {user.role === "admin" ? <><Link className="focus-ring block min-h-10 rounded-lg px-3 py-2 text-sm" href="/usuarios" onClick={() => setMenuOpen(false)}>Usuários</Link><Link className="focus-ring block min-h-10 rounded-lg px-3 py-2 text-sm" href="/historico" onClick={() => setMenuOpen(false)}>Histórico</Link></> : null}
            </nav>
            <p className="truncate text-sm font-semibold">{user.name}</p>
            <p className="mt-0.5 text-xs text-[#aeb6af]">
              {roleLabel(user.role)}
            </p>

            <button
              className="focus-ring mt-3 min-h-11 w-full rounded-lg border border-[#596159] px-3 text-left text-sm font-semibold"
              onClick={onLogout}
              type="button"
            >
              Sair
            </button>
          </div>
        ) : null}
      </header>

      <aside className="hidden flex-col bg-[#252b27] px-6 pb-6 pt-7 text-white lg:flex lg:h-full lg:min-h-0">
        <div className="flex h-[72px] items-center gap-3">
          <Image
            src="/img/logo-round.svg"
            alt="Cristal Pizza"
            width={56}
            height={56}
            priority
            className="h-14 w-14 object-contain"
          />

          <p className="text-xs text-[#aeb6af]">
            Reservas internas
          </p>
        </div>

        <nav aria-label="Navegação principal" className="mt-7 space-y-2">
          <Link
            aria-current={reservationsActive ? "page" : undefined}
            className={navClass(reservationsActive)}
            href="/"
          >
            <span className="size-2 rounded-full bg-[#b75a4d]" />
            Reservas
          </Link>

          {user.role === "admin" ? <><Link aria-current={pathname.startsWith("/usuarios") ? "page" : undefined} className={navClass(pathname.startsWith("/usuarios"))} href="/usuarios"><span className="size-2 rounded-full bg-[#89928a]" />Usuários</Link><Link aria-current={pathname.startsWith("/historico") ? "page" : undefined} className={navClass(pathname.startsWith("/historico"))} href="/historico"><span className="size-2 rounded-full bg-[#89928a]" />Histórico</Link></> : null}
        </nav>

        <div className="mt-auto rounded-xl bg-[#313833] px-3.5 py-2.5">
          <p className="truncate text-[13px] font-semibold">
            {user.name}
          </p>

          <div className="mt-0.5 flex items-center justify-between gap-2">
            <p className="text-[11px] text-[#aeb6af]">
              {roleLabel(user.role)}
            </p>

            <button
              className="focus-ring rounded px-1 text-[11px] font-semibold text-white underline underline-offset-2"
              onClick={onLogout}
              type="button"
            >
              Sair
            </button>
          </div>
        </div>
      </aside>

      <main className="min-w-0 lg:h-full lg:overflow-y-auto">{children}</main>
    </div>
  );
}
