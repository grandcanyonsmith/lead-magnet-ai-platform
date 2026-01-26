import { FiFileText } from "react-icons/fi";

interface PdfPreviewProps {
  previewObjectUrl: string | null | undefined;
  fileName?: string;
  isInView: boolean;
}

export function PdfPreview({
  previewObjectUrl,
  fileName,
  isInView,
}: PdfPreviewProps) {
  return (
    <div className="relative w-full h-full bg-white dark:bg-gray-950">
      {isInView && previewObjectUrl ? (
        <iframe
          src={`${previewObjectUrl}#toolbar=0&navpanes=0&scrollbar=0`}
          className="w-full h-full border-0"
          title={fileName || "PDF Preview"}
        />
      ) : (
        <div className="flex items-center justify-center h-full bg-gray-100 dark:bg-gray-800">
          <FiFileText className="w-12 h-12 text-red-400 dark:text-red-300" />
        </div>
      )}
    </div>
  );
}
