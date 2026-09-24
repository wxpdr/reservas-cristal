const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function apiRequest(path: string, init: RequestInit = {}): Promise<Response> {
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

export type AuthenticatedUser = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "operator";
  active: boolean;
  invitation_pending: boolean;
  created_at: string;
  updated_at: string;
};

export type Reservation = {
  id: string;
  customer_name: string;
  phone: string;
  party_size: number;
  reservation_date: string;
  reservation_time: string;
  origin: "TELEFONE" | "WHATSAPP" | "PRESENCIAL" | "TAGME" | "OUTRO";
  table_label: string | null;
  notes: string | null;
  status: "AGENDADA" | "CONFIRMADA" | "CHEGOU" | "CANCELADA";
  confirmed_at: string | null;
  checked_in_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
};

export type ReservationCreate = {
  customer_name: string;
  phone: string;
  party_size: number;
  reservation_date: string;
  reservation_time: string;
  origin: Reservation["origin"];
  table_label: string | null;
  notes: string | null;
};

export type ReservationUpdate = ReservationCreate;

export type MonthlyReservationSummary = {
  date: string;
  reservation_count: number;
  people_count: number;
};

export function getCurrentUser(): Promise<Response> {
  return apiRequest("/api/auth/me");
}

export function getReservations(date: string): Promise<Response> {
  const params = new URLSearchParams({ date });
  return apiRequest(`/api/reservations?${params.toString()}`);
}

export function getMonthlyReservations(year: number, month: number): Promise<Response> {
  const params = new URLSearchParams({ year: String(year), month: String(month) });
  return apiRequest(`/api/reservations/monthly?${params.toString()}`);
}

export function getReservation(reservationId: string): Promise<Response> {
  return apiRequest(`/api/reservations/${encodeURIComponent(reservationId)}`);
}

export function createReservation(payload: ReservationCreate): Promise<Response> {
  return apiRequest("/api/reservations", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateReservation(
  reservationId: string,
  payload: ReservationUpdate,
): Promise<Response> {
  return apiRequest(`/api/reservations/${encodeURIComponent(reservationId)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function confirmReservation(reservationId: string): Promise<Response> {
  return apiRequest(`/api/reservations/${encodeURIComponent(reservationId)}/confirm`, {
    method: "POST",
  });
}

export function checkInReservation(reservationId: string): Promise<Response> {
  return apiRequest(`/api/reservations/${encodeURIComponent(reservationId)}/check-in`, {
    method: "POST",
  });
}

export function undoReservationCheckIn(reservationId: string): Promise<Response> {
  return apiRequest(`/api/reservations/${encodeURIComponent(reservationId)}/undo-check-in`, {
    method: "POST",
  });
}

export function cancelReservation(
  reservationId: string,
  cancellationReason: string | null,
): Promise<Response> {
  return apiRequest(`/api/reservations/${encodeURIComponent(reservationId)}/cancel`, {
    method: "POST",
    body: JSON.stringify({ cancellation_reason: cancellationReason }),
  });
}

export function logout(): Promise<Response> {
  return apiRequest("/api/auth/logout", { method: "POST" });
}
