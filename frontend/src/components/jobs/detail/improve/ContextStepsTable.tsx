import { Fragment } from "react";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { getStepKey, StepContextRow } from "./utils";

interface ContextStepsTableProps {
  contextSummary: {
    total: number;
    models: string[];
    tools: string[];
  };
  stepSearch: string;
  setStepSearch: (value: string) => void;
  filteredContextRows: StepContextRow[];
  contextRows: StepContextRow[];
  emptyMessage: string;
  expandedStepKeys: Set<string>;
  toggleStepExpansion: (key: string) => void;
  expandAllSteps: () => void;
  collapseAllSteps: () => void;
  handleCopyText: (label: string, text: string) => void;
  truncate: (text: string, length: number) => string;
}

export function ContextStepsTable({
  contextSummary,
  stepSearch,
  setStepSearch,
  filteredContextRows,
  contextRows,
  emptyMessage,
  expandedStepKeys,
  toggleStepExpansion,
  expandAllSteps,
  collapseAllSteps,
  handleCopyText,
  truncate,
}: ContextStepsTableProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
          <p className="text-xs text-muted-foreground">Steps</p>
          <p className="text-sm font-semibold text-foreground">
            {contextSummary.total}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
          <p className="text-xs text-muted-foreground">Models</p>
          <p
            className="text-sm font-semibold text-foreground truncate"
            title={contextSummary.models.join(", ")}
          >
            {contextSummary.models.length
              ? truncate(contextSummary.models.join(", "), 32)
              : "—"}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
          <p className="text-xs text-muted-foreground">Tools</p>
          <p
            className="text-sm font-semibold text-foreground truncate"
            title={contextSummary.tools.join(", ")}
          >
            {contextSummary.tools.length
              ? truncate(contextSummary.tools.join(", "), 32)
              : "—"}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="relative w-full sm:max-w-[260px]">
          <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={stepSearch}
            onChange={(event) => setStepSearch(event.target.value)}
            placeholder="Search steps..."
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={expandAllSteps}
            disabled={filteredContextRows.length === 0}
          >
            Expand all
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={collapseAllSteps}
            disabled={expandedStepKeys.size === 0}
          >
            Collapse
          </Button>
        </div>
      </div>

      {filteredContextRows.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-border bg-background">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Order
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Step Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Instructions
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Description
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Model
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Tools
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Details
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-background">
              {filteredContextRows.map((step) => {
                const stepKey = getStepKey(step);
                const isExpanded = expandedStepKeys.has(stepKey);
                const toolList =
                  step.tools && step.tools !== "N/A"
                    ? step.tools
                        .split(",")
                        .map((tool) => tool.trim())
                        .filter(Boolean)
                    : [];

                return (
                  <Fragment key={stepKey}>
                    <tr className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-foreground">
                        {step.step_order}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        {step.step_name}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground max-w-md">
                        <div
                          className="line-clamp-2"
                          title={step.instructions}
                        >
                          {step.instructions}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground max-w-md">
                        <div className="line-clamp-2" title={step.description}>
                          {step.description}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-muted-foreground">
                        {step.model}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {step.tools}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => toggleStepExpansion(stepKey)}
                          aria-expanded={isExpanded}
                          className="h-8 w-8 p-0"
                        >
                          {isExpanded ? (
                            <ChevronUpIcon className="h-4 w-4" />
                          ) : (
                            <ChevronDownIcon className="h-4 w-4" />
                          )}
                          <span className="sr-only">
                            {isExpanded ? "Collapse details" : "Expand details"}
                          </span>
                        </Button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-muted/20">
                        <td colSpan={7} className="px-4 py-4">
                          <div className="grid gap-4 lg:grid-cols-2">
                            <div className="space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-xs font-semibold uppercase text-muted-foreground">
                                  Instructions
                                </p>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() =>
                                    handleCopyText(
                                      "Instructions",
                                      step.instructions,
                                    )
                                  }
                                >
                                  Copy
                                </Button>
                              </div>
                              <pre className="whitespace-pre-wrap break-words text-sm text-foreground font-sans">
                                {step.instructions}
                              </pre>
                            </div>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-xs font-semibold uppercase text-muted-foreground">
                                  Description
                                </p>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() =>
                                    handleCopyText(
                                      "Description",
                                      step.description,
                                    )
                                  }
                                >
                                  Copy
                                </Button>
                              </div>
                              <pre className="whitespace-pre-wrap break-words text-sm text-foreground font-sans">
                                {step.description}
                              </pre>
                            </div>
                          </div>
                          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span className="uppercase text-[10px]">Model</span>
                            <span className="font-medium text-foreground">
                              {step.model}
                            </span>
                            <span className="text-muted-foreground/50">•</span>
                            <span className="uppercase text-[10px]">Tools</span>
                            {toolList.length ? (
                              <div className="flex flex-wrap gap-1">
                                {toolList.map((tool) => (
                                  <Badge key={tool} variant="outline">
                                    {tool}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <span className="text-foreground">N/A</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-sm text-muted-foreground">
          {contextRows.length === 0
            ? emptyMessage
            : "No steps match your search."}
        </div>
      )}
    </div>
  );
}
