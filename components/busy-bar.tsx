// Thin indeterminate progress bar shown under async action buttons (lookup,
// scan, save, generate) so a click gives immediate visual feedback while the
// server / external API works.
export function BusyBar({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div
      role="progressbar"
      aria-label="Working"
      className="mt-1 h-1 w-full overflow-hidden rounded-full bg-primary/15"
    >
      <div className="h-full w-1/4 rounded-full bg-primary [animation:busybar_1.1s_ease-in-out_infinite]" />
    </div>
  );
}
