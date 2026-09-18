"use client";

import { FormEvent, useState } from "react";

import { AuthCard, buttonClassName, inputClassName } from "@/components/auth-card";
import { AuthShell } from "@/components/auth-shell";
import { apiRequest, getErrorMessage } from "@/lib/api";

export default function RecoverAccessPage() {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const data = new FormData(event.currentTarget);
    const response = await apiRequest("/api/auth/password-reset/request", {
      method: "POST",
      body: JSON.stringify({ email: data.get("email") }),
    });
    setLoading(false);
    if (!response.ok) {
      setError(await getErrorMessage(response));
      return;
    }
    setMessage("Se o e-mail estiver cadastrado, você receberá as instruções.");
  }

  return (
    <AuthShell>
      <AuthCard
        title="Recuperar acesso"
        description="Informe seu e-mail cadastrado para receber as instruções."
      >
        <form className="mt-6" onSubmit={submit}>
          <label className="block text-sm font-semibold">
            E-mail
            <input className={inputClassName} name="email" type="email" required />
          </label>
          {message ? <p className="mt-4 text-sm text-green-800">{message}</p> : null}
          {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
          <button className={buttonClassName} disabled={loading} type="submit">
            {loading ? "Enviando..." : "Enviar recuperação"}
          </button>
        </form>
      </AuthCard>
    </AuthShell>
  );
}

