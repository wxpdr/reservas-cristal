import { EditReservationPage } from "@/components/edit-reservation";

type EditReservationRouteProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ date?: string | string[] }>;
};

export default async function EditReservationRoute({
  params,
  searchParams,
}: EditReservationRouteProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const agendaDate = typeof query.date === "string" ? query.date : undefined;

  return <EditReservationPage agendaDate={agendaDate} reservationId={id} />;
}
