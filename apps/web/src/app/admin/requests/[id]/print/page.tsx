import { prisma } from "@/server/db";
import { requireAdmin } from "@/server/authz";

import { BookingPrintDocument } from "@/server/booking-print";

export default async function PrintRequestPage(props: { params: Promise<{ id: string }> }) {
  const sessionRes = await requireAdmin();
  if (!sessionRes.ok) {
    return <div className="p-6">Forbidden.</div>;
  }

  const { id } = await props.params;
  const req = await prisma.bookingRequest.findUnique({
    where: { id },
    include: { vehicle: true, passengers: true, decidedBy: true }
  });

  if (!req) {
    return <div className="p-6">Not found.</div>;
  }

  return (
    <BookingPrintDocument
      req={{
        controlNo: req.controlNo,
        status: req.status,
        date: req.date,
        startTime: req.startTime,
        destination: req.destination,
        purpose: req.purpose,
        timeText: req.timeText,
        requestorName: req.requestorName,
        createdAt: req.createdAt,
        vehicle: req.vehicle,
        passengers: req.passengers.map((p) => ({ fullName: p.fullName })),
        decidedByName: req.decidedBy?.name ?? req.decidedBy?.email ?? null
      }}
    />
  );
}
