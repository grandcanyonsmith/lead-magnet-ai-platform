import React, { useEffect, useState } from "react";
import { WorkflowStep } from "@/types/workflow";
import { Select } from "@/components/ui/Select";
import {
  FIELD_LABEL,
  FIELD_OPTIONAL,
  SELECT_CONTROL,
  CONTROL_BASE,
  HELP_TEXT,
  OUTPUT_TYPE_OPTIONS,
} from "../constants";

interface OutputSettingsProps {
  step: WorkflowStep;
  index: number;
  onChange: (field: keyof WorkflowStep, value: any) => void;
}

export default function OutputSettings({
  step,
  index,
  onChange,
}: OutputSettingsProps) {
  const [outputSchemaJson, setOutputSchemaJson] = useState<string>("");
  const [outputSchemaError, setOutputSchemaError] = useState<string | null>(null);

  const outputFormatType = step.output_format?.type;
  const outputFormatSchema =
    outputFormatType === "json_schema" &&
    step.output_format &&
    "schema" in step.output_format
      ? step.output_format.schema
      : undefined;

  // Keep the JSON Schema editor text in sync when the underlying schema changes.
  useEffect(() => {
    if (outputFormatType === "json_schema") {
      const schemaObj = outputFormatSchema || {};
      setOutputSchemaJson(JSON.stringify(schemaObj, null, 2));
      setOutputSchemaError(null);
    } else {
      setOutputSchemaJson("");
      setOutputSchemaError(null);
    }
  }, [outputFormatType, outputFormatSchema]);

  return (
    <div className="rounded-xl border border-border/50 bg-muted/10 p-5 space-y-4">
      <h5 className="text-sm font-semibold text-foreground">Output settings</h5>
      <div className="space-y-1.5">
        <label className={FIELD_LABEL} htmlFor={`output-format-${index}`}>
          <span>Output Type</span>
          <span className={FIELD_OPTIONAL}>(Optional)</span>
        </label>
        <Select
          id={`output-format-${index}`}
          value={step.output_format?.type || "text"}
          onChange={(nextValue) => {
            const t = nextValue as "text" | "json_object" | "json_schema";
            if (t === "text") {
              onChange("output_format", undefined);
              return;
            }
            if (t === "json_object") {
              onChange("output_format", { type: "json_object" });
              return;
            }
            if (t === "json_schema") {
              const existing = step.output_format;
              const defaultSchema = {
                type: "object",
                properties: {},
                additionalProperties: true,
              };
              const next =
                existing && existing.type === "json_schema"
                  ? existing
                  : {
                      type: "json_schema",
                      name: `step_${index + 1}_output`,
                      strict: true,
                      schema: defaultSchema,
                    };
              onChange("output_format", next as any);
            }
          }}
          className={SELECT_CONTROL}
        >
          {OUTPUT_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label} - {option.description}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
        <div className="space-y-1">
          <label className={FIELD_LABEL} htmlFor={`text-verbosity-${index}`}>
            <span>Output Verbosity</span>
            <span className={FIELD_OPTIONAL}>(Optional)</span>
          </label>
          <Select
            id={`text-verbosity-${index}`}
            value={step.text_verbosity || ""}
            onChange={(nextValue) =>
              onChange("text_verbosity", nextValue || undefined)
            }
            className={SELECT_CONTROL}
            placeholder="Default"
          >
            <option value="">Default</option>
            <option value="low">Low - Concise</option>
            <option value="medium">Medium - Balanced</option>
            <option value="high">High - Detailed</option>
          </Select>
          <p className={HELP_TEXT}>
            Adjusts how detailed and verbose the AI&apos;s output will be.
          </p>
        </div>

        <div className="space-y-1">
          <label className={FIELD_LABEL} htmlFor={`max-output-tokens-${index}`}>
            <span>Max Output Tokens</span>
            <span className={FIELD_OPTIONAL}>(Optional)</span>
          </label>
          <input
            id={`max-output-tokens-${index}`}
            type="number"
            min="1"
            step="100"
            value={step.max_output_tokens || ""}
            onChange={(e) =>
              onChange(
                "max_output_tokens",
                e.target.value ? parseInt(e.target.value, 10) : undefined
              )
            }
            className={CONTROL_BASE}
            placeholder="e.g., 4000"
            aria-label="Max output tokens"
          />
          <p className={HELP_TEXT}>
            Maximum number of tokens the AI can generate. Leave empty for no
            limit.
          </p>
        </div>
      </div>
    </div>
  );
}
