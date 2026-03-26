import toast from "react-hot-toast";
import {
  ArrowDownTrayIcon,
  ArrowTopRightOnSquareIcon,
  ClipboardDocumentIcon,
} from "@heroicons/react/24/outline";

interface OutputCardActionsProps {
  url: string;
}

export function OutputCardActions({ url }: OutputCardActionsProps) {
  const handleCopy = async (event: React.MouseEvent) => {
    event.stopPropagation();
    try {
      if (typeof navigator === "undefined" || !navigator.clipboard) {
        throw new Error("Clipboard API not available");
      }
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Unable to copy link");
    }
  };

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={handleCopy}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        aria-label="Copy link"
      >
        <ClipboardDocumentIcon className="h-4 w-4" />
      </button>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(event) => event.stopPropagation()}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        aria-label="Open link"
      >
        <ArrowTopRightOnSquareIcon className="h-4 w-4" />
      </a>
      <a
        href={url}
        download
        onClick={(event) => event.stopPropagation()}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        aria-label="Download file"
      >
        <ArrowDownTrayIcon className="h-4 w-4" />
      </a>
    </div>
  );
}
