import React from "react";
import { JsonViewer, JsonViewerProps } from "@/components/ui/json-viewer/JsonViewer";

/**
 * RecursiveJson component
 * A wrapper around the unified JsonViewer to be part of the recursive UI suite.
 * This ensures all recursive components are importable from the same place.
 */
export const RecursiveJson: React.FC<JsonViewerProps> = (props) => {
  return <JsonViewer {...props} />;
};
