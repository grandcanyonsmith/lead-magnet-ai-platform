import { ClipboardDocumentIcon } from "@heroicons/react/24/outline";
import { toast } from "react-hot-toast";
import { JsonViewer } from "@/components/ui/JsonViewer";
import { SectionCard } from "@/components/ui/SectionCard";
import { Button } from "@/components/ui/Button";
import { buildExecutionJsonSummary } from "@/utils/jobs/rawExecutionJson";

interface JobDebugTabProps {
  data: unknown;
}

export function JobDebugTab({ data }: JobDebugTabProps) {
  return <RawJsonPanel data={data} />;
}

function RawJsonPanel({ data }: { data: unknown }) {
  const filteredData = buildExecutionJsonSummary(data);
  const hasData = Array.isArray(filteredData)
    ? filteredData.length > 0
    : Boolean(filteredData);

  if (!hasData) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
        No raw JSON data is available for this run.
      </div>
    );
  }

  const jsonString = JSON.stringify(filteredData, null, 2);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(jsonString);
      toast.success("Execution JSON copied");
    } catch {
      toast.error("Unable to copy JSON");
    }
  };

  return (
    <SectionCard
      title="Raw execution JSON"
      description="Filtered execution steps (instructions, tools, step info, outputs)."
      actions={
        <Button type="button" size="sm" variant="outline" onClick={handleCopy}>
          <ClipboardDocumentIcon className="h-4 w-4" />
          Copy JSON
        </Button>
      }
    >
      <JsonViewer
        value={filteredData}
        raw={jsonString}
        defaultMode="tree"
        defaultExpandedDepth={2}
      />
    </SectionCard>
  );
}
