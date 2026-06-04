type Status = "compliant" | "expiring-soon" | "expired" | "non-compliant" | string;

const toneByStatus: Record<string, string> = {
  compliant: "badge badge-green",
  "expiring-soon": "badge badge-amber",
  expired: "badge badge-red",
  "non-compliant": "badge badge-red"
};

export function StatusBadge({ status }: { status: Status }) {
  const label = status.replaceAll("-", " ");
  return <span className={toneByStatus[status] ?? "badge badge-neutral"}>{label}</span>;
}
