"use client";

import { useParams } from "next/navigation";

const WORKFLOW_PATH_PATTERN = /\/dashboard\/workflows\/([^/]+)/;

function normalizeWorkflowParam(param: string | string[] | undefined): string {
  if (Array.isArray(param)) {
    return normalizeWorkflowParam(param[0]);
  }
  if (typeof param === "string" && param !== "_") {
    return param;
  }
  return "";
}

function getWorkflowIdFromPathname(): string {
  if (typeof window === "undefined") {
    return "";
  }

  const pathMatch = window.location.pathname.match(WORKFLOW_PATH_PATTERN);
  if (pathMatch?.[1] && pathMatch[1] !== "_") {
    return pathMatch[1];
  }

  return "";
}

/**
 * Hook to extract workflow ID from params/URL
 * Handles static-export edge rewrite scenarios where param might be '_'
 */
export function useWorkflowId(): string {
  const params = useParams();
  return normalizeWorkflowParam(params?.id) || getWorkflowIdFromPathname();
}
