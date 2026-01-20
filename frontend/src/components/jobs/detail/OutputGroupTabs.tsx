import type { OutputGroupKey, OutputGroupViewModel } from "@/utils/jobs/outputs";

interface OutputGroupTabsProps {
  groups: OutputGroupViewModel[];
  activeKey: OutputGroupKey;
  onChange: (key: OutputGroupKey) => void;
}

export function OutputGroupTabs({
  groups,
  activeKey,
  onChange,
}: OutputGroupTabsProps) {
  return (
    <div
      className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/80 px-1.5 py-1 text-[11px] font-semibold shadow-sm backdrop-blur"
      role="tablist"
      aria-label="Output types"
    >
      {groups.map((group) => {
        const isActive = activeKey === group.key;
        return (
          <button
            key={group.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(group.key)}
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 uppercase tracking-wide transition ${
              isActive
                ? "bg-foreground/10 text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>{group.label}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${group.badgeClassName}`}
            >
              {group.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
