const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function apiRequest(path: string, init: RequestInit): Promise<Response> {
  return fetch(`${apiUrl}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
}

export async function getErrorMessage(response: Response): Promise<string> {
  const fallback = "Não foi possível concluir. Tente novamente.";
  try {
    const body = (await response.json()) as { detail?: string };
    return body.detail ?? fallback;
  } catch {
    return fallback;
  }
}

