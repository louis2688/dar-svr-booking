import { formatBookingTimeLabel } from "@svr/shared";

import type { BookingRow } from "@/components/dashboard/BookingsTable";
import { formatManilaDateTime } from "@/server/time";

type BookingWithVehicle = {
  id: string;
  controlNo: string;
  date: Date;
  startTime: string;
  requestorName: string;
  destination: string;
  createdAt: Date;
  status: string;
  vehicle: { name: string; plateNo: string | null } | null;
};

/** Serialize a Prisma booking (with vehicle) into the client table's row shape. */
export function toBookingRow(b: BookingWithVehicle): BookingRow {
  return {
    id: b.id,
    controlNo: b.controlNo,
    vehicleName: b.vehicle?.name ?? null,
    plateNo: b.vehicle?.plateNo ?? null,
    dateStr: b.date.toISOString().slice(0, 10),
    startTimeLabel: formatBookingTimeLabel(b.startTime),
    requestorName: b.requestorName,
    destination: b.destination,
    createdLabel: formatManilaDateTime(b.createdAt),
    status: b.status
  };
}
