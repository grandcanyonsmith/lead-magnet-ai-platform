import React from 'react';

export const StepHeader: React.FC<{ stepIndex: number; stepName?: string }> = ({
  stepIndex,
  stepName,
}) => {
  const label = stepName ? `Step ${stepIndex + 1} - ${stepName}` : `Step ${stepIndex + 1}`;
  return (
    <div className="my-3 flex items-center gap-2 text-[11px] text-muted-foreground">
      <div className="h-px flex-1 bg-border/70" />
      <span
        className="inline-flex max-w-full items-center rounded-full bg-muted/60 px-3 py-1 font-semibold"
        title={label}
      >
        <span className="truncate">{label}</span>
      </span>
      <div className="h-px flex-1 bg-border/70" />
    </div>
  );
};
