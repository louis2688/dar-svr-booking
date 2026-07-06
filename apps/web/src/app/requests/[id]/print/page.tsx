import { prisma } from "@/server/db";
import { resolveSessionDbUser } from "@/server/authz";
import { BookingPrintDocument } from "@/server/booking-print";

export default async function UserPrintRequestPage(props: { params: Promise<{ id: string }> }) {
  const resolved = await resolveSessionDbUser();
  if (!resolved.ok) {
    return <div className="p-6 text-sm">{resolved.message}</div>;
  }

  const { id } = await props.params;
  const [req, signatories] = await Promise.all([
    prisma.bookingRequest.findUnique({
      where: { id },
      include: { vehicle: true, passengers: true, decidedBy: { select: { name: true, email: true } } }
    }),
    prisma.signatory.findMany()
  ]);

  if (!req) {
    return <div className="p-6">Not found.</div>;
  }

  // Any signed-in user may view a booking (read-only); only admins can edit its
  // inline fields (enforced in the print document + the write endpoints).

  const approver = signatories.find((s) => s.role === "APPROVER") ?? null;
  const noted = signatories.find((s) => s.role === "NOTED_BY") ?? null;

  return (
    <BookingPrintDocument
      approver={approver}
      noted={noted}
      req={{
        id: req.id,
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
        decidedByName: req.decidedBy?.name ?? req.decidedBy?.email ?? null,
        notedBy: req.notedBy
      }}
    />
  );
}
