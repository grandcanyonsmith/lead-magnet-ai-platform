import { useEffect } from "react";
import { toast } from "react-hot-toast";

interface UseEditorIframeProps {
  iframeRef: React.RefObject<HTMLIFrameElement>;
  isSelectionMode: boolean;
  setSelectedElement: (element: string | null) => void;
  setSelectedOuterHtml: (html: string | null) => void;
  setIsSelectionMode: (mode: boolean) => void;
}

export function useEditorIframe({
  iframeRef,
  isSelectionMode,
  setSelectedElement,
  setSelectedOuterHtml,
  setIsSelectionMode,
}: UseEditorIframeProps) {
  // Handle Selection Mode Toggle
  useEffect(() => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        {
          type: "TOGGLE_SELECTION_MODE",
          enabled: isSelectionMode,
        },
        "*",
      );
    }
  }, [isSelectionMode, iframeRef]);

  // Handle iframe messages
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      // Only accept messages from our preview iframe.
      // The HTML inside the iframe is untrusted and can postMessage arbitrarily.
      if (e.source !== iframeRef.current?.contentWindow) return;

      const data: any = e.data;
      if (!data || typeof data !== "object") return;

      if (data.type === "ELEMENT_SELECTED") {
        const selector =
          typeof data.selector === "string" ? (data.selector as string) : null;
        if (!selector) return;

        setSelectedElement(selector);
        setSelectedOuterHtml(
          typeof data.outerHtml === "string"
            ? (data.outerHtml as string)
            : null,
        );
        setIsSelectionMode(false); // Turn off after selection
        toast.success(`Selected: ${selector}`, { icon: "🎯" });
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [
    iframeRef,
    setIsSelectionMode,
    setSelectedElement,
    setSelectedOuterHtml,
  ]);
}
