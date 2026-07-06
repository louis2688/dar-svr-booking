import { requireAdmin } from "@/server/authz";
import { prisma } from "@/server/db";
import { formatManilaDateTime } from "@/server/time";

/**
 * Admin activity log. Derived from booking lifecycle fields (created + decided)
 * rather than a dedicated audit table — covers the main recent actions without
 * per-route instrumentation. A booking that was approved then later cancelled
 * only shows its latest decision (decidedAt is overwritten).
 */
type Activity = {
  at: Date;
  action: "Created" | "Approved" | "Rejected" | "Cancelled";
  controlNo: string;
  requestor: string;
  by: string;
};

const ACTION_CHIP: Record<Activity["action"], string> = {
  Created: "bg-sky-50 text-sky-800 border-sky-200",
  Approved: "bg-emerald-50 text-emerald-800 border-emerald-200",
  Rejected: "bg-red-50 text-red-700 border-red-200",
  Cancelled: "bg-zinc-100 text-zinc-700 border-zinc-200"
};

const DECISION: Record<string, Activity["action"]> = {
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled"
};

export default async function AdminHistoryPage() {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return <div className="px-4 py-6 sm:px-6 text-sm text-red-600">Forbidden.</div>;
  }

  const bookings = await prisma.bookingRequest.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      requestedBy: { select: { name: true, email: true } },
      decidedBy: { select: { name: true, email: true } }
    }
  });

  const events: Activity[] = [];
  for (const b of bookings) {
    events.push({
      at: b.createdAt,
      action: "Created",
      controlNo: b.controlNo,
      requestor: b.requestorName,
      by: b.requestedBy?.name ?? b.requestedBy?.email ?? "—"
    });
    if (b.decidedAt && DECISION[b.status]) {
      events.push({
        at: b.decidedAt,
        action: DECISION[b.status],
        controlNo: b.controlNo,
        requestor: b.requestorName,
        by: b.decidedBy?.name ?? b.decidedBy?.email ?? "—"
      });
    }
  }
  events.sort((a, b) => b.at.getTime() - a.at.getTime());
  const recent = events.slice(0, 200);

  return (
    <div className="px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-xl font-semibold">Activity / History</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Recent actions on bookings — who did what and when (Manila time).
        </p>

        <div className="mt-5 overflow-x-auto rounded-xl border bg-white p-2 sm:p-4">
          <table className="min-w-[720px] w-full border-collapse text-sm">
            <thead>
              <tr className="bg-zinc-50 text-left text-xs text-zinc-500">
                <th className="rounded-l-lg px-3 py-2.5 font-medium">When</th>
                <th className="px-3 py-2.5 font-medium">Action</th>
                <th className="px-3 py-2.5 font-medium">Control no</th>
                <th className="px-3 py-2.5 font-medium">Requestor</th>
                <th className="rounded-r-lg px-3 py-2.5 font-medium">By</th>
              </tr>
            </thead>
            <tbody>
              {recent.length === 0 ? (
                <tr className="border-t">
                  <td className="px-3 py-4 text-zinc-600" colSpan={5}>
                    No activity yet.
                  </td>
                </tr>
              ) : (
                recent.map((e, i) => (
                  <tr key={i} className="border-t border-zinc-100">
                    <td className="whitespace-nowrap px-3 py-2.5 text-zinc-500">{formatManilaDateTime(e.at)}</td>
                    <td className="px-3 py-2.5">
                      <span
                        className={[
                          "inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
                          ACTION_CHIP[e.action]
                        ].join(" ")}
                      >
                        {e.action}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-semibold text-emerald-800">{e.controlNo}</td>
                    <td className="px-3 py-2.5">{e.requestor}</td>
                    <td className="px-3 py-2.5">{e.by}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
