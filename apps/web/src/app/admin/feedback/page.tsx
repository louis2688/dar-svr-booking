import { requireAdmin } from "@/server/authz";
import { prisma } from "@/server/db";
import { formatManilaDateTime } from "@/server/time";

const CAT_CHIP: Record<string, string> = {
  Bug: "bg-red-50 text-red-700 border-red-200",
  Idea: "bg-sky-50 text-sky-800 border-sky-200",
  General: "bg-zinc-100 text-zinc-700 border-zinc-200",
  Other: "bg-zinc-100 text-zinc-700 border-zinc-200"
};

export default async function AdminFeedbackPage() {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return <div className="px-4 py-6 text-sm text-red-600 sm:px-6">Forbidden.</div>;
  }

  const items = await prisma.feedback.findMany({ orderBy: { createdAt: "desc" }, take: 300 });

  return (
    <div className="px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-xl font-semibold">Feedback inbox</h1>
        <p className="mt-1 text-sm text-zinc-600">
          {items.length} message{items.length === 1 ? "" : "s"} from users (newest first, Manila time).
        </p>

        <div className="mt-5 grid gap-3">
          {items.length === 0 ? (
            <div className="rounded-xl border bg-white p-6 text-sm text-zinc-600">No feedback yet.</div>
          ) : (
            items.map((f) => (
              <div key={f.id} className="rounded-xl border bg-white p-4">
                <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                  {f.category ? (
                    <span
                      className={[
                        "rounded-full border px-2 py-0.5 font-semibold",
                        CAT_CHIP[f.category] ?? CAT_CHIP.Other
                      ].join(" ")}
                    >
                      {f.category}
                    </span>
                  ) : null}
                  {f.rating ? <span className="text-amber-500">{"★".repeat(f.rating)}<span className="text-zinc-300">{"★".repeat(5 - f.rating)}</span></span> : null}
                  <span className="ml-auto">{formatManilaDateTime(f.createdAt)}</span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-900">{f.message}</p>
                {f.userEmail ? <div className="mt-2 text-xs text-zinc-500">— {f.userEmail}</div> : null}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
