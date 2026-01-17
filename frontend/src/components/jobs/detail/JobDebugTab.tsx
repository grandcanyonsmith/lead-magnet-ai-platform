import { ClipboardDocumentIcon } from "@heroicons/react/24/outline";
import { toast } from "react-hot-toast";
import { JsonViewer } from "@/components/ui/JsonViewer";
import { SectionCard } from "@/components/ui/SectionCard";
import { Button } from "@/components/ui/Button";

interface JobDebugTabProps {
  data: unknown;
}

export function JobDebugTab({ data }: JobDebugTabProps) {
  return <RawJsonPanel data={data} />;
}

function RawJsonPanel({ data }: { data: unknown }) {
  const hasData = Array.isArray(data) ? data.length > 0 : Boolean(data);

  if (!hasData) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
        No raw JSON data is available for this run.
      </div>
    );
  }

  const jsonString = JSON.stringify(data, null, 2);

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
      description="Full payload captured for this run."
      actions={
        <Button type="button" size="sm" variant="outline" onClick={handleCopy}>
          <ClipboardDocumentIcon className="h-4 w-4" />
          Copy JSON
        </Button>
      }
    >
      <JsonViewer value={data} raw={jsonString} defaultMode="tree" defaultExpandedDepth={2} />
    </SectionCard>
  );
}
