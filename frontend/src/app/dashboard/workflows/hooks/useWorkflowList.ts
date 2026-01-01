import { useState, useMemo } from "react";
import { Workflow } from "@/types";

export function useWorkflowList(
  workflows: Workflow[],
  workflowJobs: Record<string, any[]>,
  currentFolderId: string | null
) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<string>("last_generated");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const filteredWorkflows = useMemo(() => {
    let filtered = workflows.filter((workflow) => {
      // Filter by folder
      const workflowFolderId = workflow.folder_id || null;
      if (workflowFolderId !== currentFolderId) return false;

      // Filter by search query
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      const name = (workflow.workflow_name || "").toLowerCase();
      const description = (workflow.workflow_description || "").toLowerCase();
      const formName = (workflow.form?.form_name || "").toLowerCase();
      return (
        name.includes(query) ||
        description.includes(query) ||
        formName.includes(query)
      );
    });

    // Sort workflows
    return filtered.sort((a, b) => {
      let valA: any = "";
      let valB: any = "";

      switch (sortField) {
        case "name":
          valA = (a.workflow_name || "").toLowerCase();
          valB = (b.workflow_name || "").toLowerCase();
          break;
        case "form":
          valA = (a.form?.form_name || "").toLowerCase();
          valB = (b.form?.form_name || "").toLowerCase();
          break;
        case "created_at":
          valA = new Date(a.created_at || 0).getTime();
          valB = new Date(b.created_at || 0).getTime();
          break;
        case "updated_at":
          valA = new Date(a.updated_at || 0).getTime();
          valB = new Date(b.updated_at || 0).getTime();
          break;
        case "last_generated": {
          const jobsA = workflowJobs[a.workflow_id] || [];
          const completedA = jobsA.filter((j: any) => j.status === "completed");
          const latestA = completedA.length > 0 ? completedA[0].created_at : "";
          valA = latestA ? new Date(latestA).getTime() : 0;

          const jobsB = workflowJobs[b.workflow_id] || [];
          const completedB = jobsB.filter((j: any) => j.status === "completed");
          const latestB = completedB.length > 0 ? completedB[0].created_at : "";
          valB = latestB ? new Date(latestB).getTime() : 0;
          break;
        }
        default:
          valA = 0;
          valB = 0;
      }

      if (valA < valB) return sortDirection === "asc" ? -1 : 1;
      if (valA > valB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [
    workflows,
    currentFolderId,
    searchQuery,
    sortField,
    sortDirection,
    workflowJobs,
  ]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc"); // Default to desc for new field
    }
  };

  return {
    searchQuery,
    setSearchQuery,
    sortField,
    sortDirection,
    filteredWorkflows,
    handleSort,
  };
}
