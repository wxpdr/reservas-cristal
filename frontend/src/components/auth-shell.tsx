import Image from "next/image";
import type { ReactNode } from "react";

type AuthShellProps = {
  children: ReactNode;
};

export function AuthShell({ children }: AuthShellProps) {
  return (
    <main className="min-h-screen bg-[#f7f4ef] lg:grid lg:grid-cols-[39%_61%]">
      <aside className="bg-[#202824] px-6 pb-24 pt-7 text-white lg:flex lg:min-h-screen lg:flex-col lg:justify-between lg:px-13 lg:py-13">
        <div>
          <Image
            src="/img/logo-round.svg"
            alt="Cristal Pizza"
            width={72}
            height={72}
            priority
            className="h-16 w-16 object-contain lg:h-[72px] lg:w-[72px]"
          />
          <p className="mt-2 text-xs text-stone-300">Reservas internas</p>
        </div>
        <div className="mt-8 lg:mt-0">
          <h1 className="max-w-md text-3xl font-bold leading-tight lg:text-4xl">
            Uma agenda mais simples para cuidar de cada chegada.
          </h1>
          <p className="mt-3 max-w-md text-sm text-stone-300 lg:text-base">
            Acesse a agenda interna da Cristal com seu usuário.
          </p>
        </div>
        <p className="hidden text-xs text-stone-300 lg:block">Cristal Pizza · Acesso restrito à equipe.</p>
      </aside>
      <section className="-mt-8 flex px-4 pb-16 lg:mt-0 lg:items-center lg:justify-center lg:p-12">
        <div className="w-full lg:max-w-[460px]">{children}</div>
      </section>
    </main>
  );
}
