import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { FormField } from "@/components/settings/FormField";

type PromptOverridesJsonEditorProps = {
  value: string;
  onChange: (value: string) => void;
  error?: string;
};

export function PromptOverridesJsonEditor({
  value,
  onChange,
  error,
}: PromptOverridesJsonEditorProps) {
  return (
    <Card>
      <CardHeader className="border-b border-gray-100 dark:border-border bg-gray-50/50 dark:bg-secondary/30 p-4 sm:p-6">
        <CardTitle className="text-lg">Edit Overrides JSON</CardTitle>
        <CardDescription>
          Update the JSON payload directly if you want bulk edits.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 sm:p-6">
        <FormField
          label="Prompt Overrides (JSON)"
          name="prompt_overrides"
          type="textarea"
          value={value}
          onChange={onChange}
          error={error}
          helpText="Use keys from docs/prompt-overrides.md. Supports {{variables}} placeholders."
          placeholder='{"workflow_generation": {"instructions": "...", "prompt": "..."}}'
          className="min-h-[160px] sm:min-h-[200px]"
        />
      </CardContent>
    </Card>
  );
}
