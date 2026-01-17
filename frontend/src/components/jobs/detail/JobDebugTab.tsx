import { ClipboardDocumentIcon } from "@heroicons/react/24/outline";
import { toast } from "react-hot-toast";
import { JsonViewer } from "@/components/ui/JsonViewer";

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
      <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/80 p-4 text-sm text-gray-600 dark:text-gray-400">
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
    <div className="rounded-2xl border border-gray-200 bg-gray-950 text-gray-100">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <p className="text-sm font-semibold">Raw execution JSON</p>

        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-700 px-3 py-1.5 text-xs font-semibold hover:bg-gray-800"
        >
          <ClipboardDocumentIcon className="h-4 w-4" />
          Copy JSON
        </button>
      </div>

      <div className="p-4">
        <JsonViewer
          value={data}
          raw={jsonString}
          defaultMode="tree"
          defaultExpandedDepth={2}
        />
      </div>
    </div>
  );
}
