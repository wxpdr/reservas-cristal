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

export type UserCreate = {
  name: string;
  email: string;
  role: AuthenticatedUser["role"];
};

export type UserUpdate = Partial<UserCreate> & { active?: boolean };

export type AuditEvent = {
  id: string;
  reservation_id: string;
  reservation_customer_name: string;
  reservation_date: string;
  user_id: string;
  user_name: string;
  user_role: AuthenticatedUser["role"];
  action: "CREATE" | "UPDATE" | "CONFIRM" | "CHECK_IN" | "UNDO_CHECK_IN" | "CANCEL" | "TABLE_CHANGE";
  changes: Record<string, unknown> | null;
  created_at: string;
};

export type AuditEventPage = {
  items: AuditEvent[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
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
  status: "AGENDADA" | "CHEGOU" | "CANCELADA";
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
  blocked: boolean;
};

export type ReservationDateBlockStatus = {
  date: string;
  blocked: boolean;
  reason: string | null;
};

export function getCurrentUser(): Promise<Response> {
  return apiRequest("/api/auth/me");
}

export function getUsers(): Promise<Response> {
  return apiRequest("/api/users");
}

export function createUser(payload: UserCreate): Promise<Response> {
  return apiRequest("/api/users", { method: "POST", body: JSON.stringify(payload) });
}

export function updateUser(userId: string, payload: UserUpdate): Promise<Response> {
  return apiRequest(`/api/users/${encodeURIComponent(userId)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function resendUserInvitation(userId: string): Promise<Response> {
  return apiRequest(`/api/users/${encodeURIComponent(userId)}/resend-invitation`, {
    method: "POST",
  });
}

export function getAuditEvents(filters: {
  date?: string;
  userId?: string;
  action?: string;
  page: number;
  pageSize: number;
}): Promise<Response> {
  const params = new URLSearchParams();
  if (filters.date) params.set("date", filters.date);
  if (filters.userId) params.set("user_id", filters.userId);
  if (filters.action) params.set("action", filters.action);
  params.set("page", String(filters.page));
  params.set("page_size", String(filters.pageSize));
  const query = params.toString();
  return apiRequest(`/api/audit/reservation-events${query ? `?${query}` : ""}`);
}

export function getReservations(date: string): Promise<Response> {
  const params = new URLSearchParams({ date });
  return apiRequest(`/api/reservations?${params.toString()}`);
}

export function getMonthlyReservations(year: number, month: number): Promise<Response> {
  const params = new URLSearchParams({ year: String(year), month: String(month) });
  return apiRequest(`/api/reservations/monthly?${params.toString()}`);
}

export function getReservationDateBlock(date: string): Promise<Response> {
  return apiRequest(`/api/reservation-date-blocks/${encodeURIComponent(date)}`);
}

export function blockReservationDate(date: string, reason: string | null): Promise<Response> {
  return apiRequest(`/api/reservation-date-blocks/${encodeURIComponent(date)}`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function unblockReservationDate(date: string): Promise<Response> {
  return apiRequest(`/api/reservation-date-blocks/${encodeURIComponent(date)}`, {
    method: "DELETE",
  });
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
