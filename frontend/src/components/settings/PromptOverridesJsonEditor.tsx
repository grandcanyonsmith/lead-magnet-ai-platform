import { Card, CardContent } from "@/components/ui/Card";
import { CardHeaderIntro } from "@/components/ui/CardHeaderIntro";
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
      <CardHeaderIntro
        className="p-4 sm:p-6"
        title="Edit Overrides JSON"
        description="Update the JSON payload directly if you want bulk edits."
      />
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
