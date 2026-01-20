import type { JobHeaderStat } from "@/utils/jobs/headerStats";

interface JobHeaderStatsProps {
  stats: JobHeaderStat[];
  highlightBorderClassName?: string;
}

export function JobHeaderStats({
  stats,
  highlightBorderClassName = "border-transparent",
}: JobHeaderStatsProps) {
  return (
    <div className="overflow-x-auto scrollbar-hide">
      <div className="flex min-w-max items-stretch divide-x divide-border/60 rounded-xl border border-border/60 bg-card/60 shadow-sm overflow-hidden">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={`min-w-[150px] px-3 py-2 ${
              stat.highlight ? `border-b-2 ${highlightBorderClassName}` : ""
            }`}
          >
            <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
              {stat.label}
            </p>
            <p className="text-sm font-semibold text-foreground leading-tight">
              {stat.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
