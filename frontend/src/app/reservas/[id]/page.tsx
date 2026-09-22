import { ReservationDetailsPage } from "@/components/reservation-details";

type ReservationPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ date?: string | string[] }>;
};

export default async function ReservationPage({ params, searchParams }: ReservationPageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const agendaDate = typeof query.date === "string" ? query.date : undefined;

  return <ReservationDetailsPage agendaDate={agendaDate} reservationId={id} />;
}
