import type { ReactNode } from "react";

type AuthCardProps = {
  title: string;
  description: string;
  children: ReactNode;
};

export function AuthCard({ title, description, children }: AuthCardProps) {
  return (
    <div className="rounded-2xl border border-[#ded6cc] bg-white p-6 shadow-sm lg:p-8">
      <h2 className="text-2xl font-bold lg:text-3xl">{title}</h2>
      <p className="mt-2 text-sm text-stone-500">{description}</p>
      {children}
    </div>
  );
}

export const inputClassName =
  "mt-2 h-12 w-full rounded-xl border border-[#ded6cc] bg-white px-4 outline-none transition focus:border-[#b05043] focus:ring-2 focus:ring-[#b05043]/15";

export const buttonClassName =
  "mt-6 h-12 w-full rounded-xl bg-[#b05043] px-5 font-semibold text-white transition hover:bg-[#99453a] disabled:cursor-not-allowed disabled:opacity-60";

