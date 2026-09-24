import { NewReservationPage } from "@/components/new-reservation";

type NewReservationRouteProps = {
  searchParams: Promise<{ date?: string | string[] }>;
};

export default async function NewReservationRoute({ searchParams }: NewReservationRouteProps) {
  const query = await searchParams;
  const agendaDate = typeof query.date === "string" ? query.date : undefined;

  return <NewReservationPage agendaDate={agendaDate} />;
}
