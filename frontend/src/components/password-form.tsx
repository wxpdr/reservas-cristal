"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { apiRequest, getErrorMessage } from "@/lib/api";
import { buttonClassName, inputClassName } from "./auth-card";

type PasswordFormProps = {
  token: string;
  endpoint: "/api/auth/first-access" | "/api/auth/password-reset/complete";
  buttonLabel: string;
};

export function PasswordForm({ token, endpoint, buttonLabel }: PasswordFormProps) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const data = new FormData(event.currentTarget);
    const password = String(data.get("password"));
    const confirmation = String(data.get("confirmation"));
    if (password !== confirmation) {
      setError("As senhas não coincidem.");
      return;
    }
    setLoading(true);
    const response = await apiRequest(endpoint, {
      method: "POST",
      body: JSON.stringify({ token, password }),
    });
    setLoading(false);
    if (!response.ok) {
      setError(await getErrorMessage(response));
      return;
    }
    router.push("/login?senha=definida");
  }

  return (
    <form className="mt-6" onSubmit={submit}>
      <label className="block text-sm font-semibold">
        Nova senha
        <input className={inputClassName} name="password" type="password" minLength={8} required />
      </label>
      <label className="mt-5 block text-sm font-semibold">
        Confirmar senha
        <input
          className={inputClassName}
          name="confirmation"
          type="password"
          minLength={8}
          required
        />
      </label>
      {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
      <button className={buttonClassName} disabled={loading || !token} type="submit">
        {loading ? "Salvando..." : buttonLabel}
      </button>
      {!token ? <p className="mt-4 text-sm text-red-700">Link sem token válido.</p> : null}
    </form>
  );
}

