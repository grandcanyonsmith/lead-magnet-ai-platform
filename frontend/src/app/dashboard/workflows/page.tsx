"use client";

import {
  useEffect,
  useState,
  useRef,
  useMemo,
  useCallback,
  Fragment,
} from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useSettings } from "@/hooks/api/useSettings";
import { buildPublicFormUrl } from "@/utils/url";
import { openJobDocumentInNewTab } from "@/utils/jobs/openJobDocument";
import { LeadMagnetsTabs } from "@/components/leadMagnets/LeadMagnetsTabs";
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  ArrowTopRightOnSquareIcon,
  ClipboardIcon,
  CheckIcon,
  EllipsisVerticalIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ListBulletIcon,
  DocumentTextIcon,
  ArrowLeftIcon,
  FolderIcon,
  FolderPlusIcon,
  FolderArrowDownIcon,
  XMarkIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  ChevronUpIcon,
  ChevronDownIcon,
} from "@heroicons/react/24/outline";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
  Menu,
  MenuButton,
  MenuItem,
  MenuItems,
} from "@headlessui/react";
import { Folder } from "@/types";
import toast from "react-hot-toast";
import clsx from "clsx";

export default function WorkflowsPage() {
  const router = useRouter();
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [workflowJobs, setWorkflowJobs] = useState<Record<string, any[]>>({});
  const [loadingJobs, setLoadingJobs] = useState<Record<string, boolean>>({});
  const [openingDocumentJobId, setOpeningDocumentJobId] = useState<
    string | null
  >(null);

  // Sorting state
  const [sortField, setSortField] = useState<string>("last_generated");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Folder modal state
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [showMoveFolderModal, setShowMoveFolderModal] = useState<string | null>(
    null,
  );
  const [newFolderName, setNewFolderName] = useState("");
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState("");
  const [folderActionLoading, setFolderActionLoading] = useState(false);

  // Track which workflow IDs we've already loaded jobs for
  const loadedWorkflowIdsRef = useRef<Set<string>>(new Set());
  // Ref to track the latest workflows and workflowJobs for polling
  const workflowsRef = useRef<any[]>([]);
  const workflowJobsRef = useRef<Record<string, any[]>>({});
  const loadJobsForWorkflowRef = useRef<
    ((workflowId: string) => Promise<void>) | null
  >(null);
  // Track if we're currently processing a batch to prevent concurrent batches
  const isProcessingBatchRef = useRef<boolean>(false);
  // Track active polling cancellation to allow cleanup
  const pollingCancellationRef = useRef<(() => void) | null>(null);
  // Track active initial load cancellation to allow cleanup
  const initialLoadCancellationRef = useRef<(() => void) | null>(null);
  // Global request queue to ensure only one API request happens at a time
  const requestQueueRef = useRef<Promise<void>>(Promise.resolve());
  // Track active requests to prevent duplicates - use Map to store promises for deduplication
  const activeRequestsRef = useRef<Map<string, Promise<void>>>(new Map());
  const { settings } = useSettings();

  const openJobDocument = useCallback(
    async (jobId: string, fallbackUrl?: string) => {
      if (!jobId || openingDocumentJobId) return;

      setOpeningDocumentJobId(jobId);

      try {
        await openJobDocumentInNewTab(jobId, { fallbackUrl });
      } finally {
        setOpeningDocumentJobId(null);
      }
    },
    [openingDocumentJobId],
  );

  const loadWorkflows = useCallback(async () => {
    try {
      // Get all workflows including drafts - don't filter by status
      const data = await api.getWorkflows();
      const workflowsList = data.workflows || [];
      setWorkflows(workflowsList);
      // Reset loaded workflow IDs when workflows are reloaded
      loadedWorkflowIdsRef.current.clear();
      // Reset processed workflow IDs tracker so effect runs again
      lastProcessedWorkflowIdsRef.current = "";
    } catch (error) {
      console.error("Failed to load workflows:", error);
      toast.error("Failed to load lead magnets");
    } finally {
      setLoading(false);
    }
  }, []);

  // Define loadJobsForWorkflow before it's used in useEffect hooks
  const loadJobsForWorkflow = useCallback(async (workflowId: string) => {
    // Check if there's already an active request for this workflow
    const existingRequest = activeRequestsRef.current.get(workflowId);
    if (existingRequest) {
      // Return the existing promise to deduplicate
      return existingRequest;
    }

    // Create a promise that will be queued after the previous request completes
    // This ensures global serialization - only one API request happens at a time
    const requestPromise = requestQueueRef.current.then(async () => {
      // Mark as loading in state
      setLoadingJobs((prev) => ({ ...prev, [workflowId]: true }));

      try {
        const data = await api.getJobs({ workflow_id: workflowId, limit: 5 });
        setWorkflowJobs((prev) => ({ ...prev, [workflowId]: data.jobs || [] }));
      } catch (error) {
        console.error(`Failed to load jobs for workflow ${workflowId}:`, error);
        setWorkflowJobs((prev) => ({ ...prev, [workflowId]: [] }));
        throw error;
      } finally {
        // Remove from active requests and clear loading state
        activeRequestsRef.current.delete(workflowId);
        setLoadingJobs((prev) => ({ ...prev, [workflowId]: false }));
      }
    });

    // Update the queue to include this new request
    requestQueueRef.current = requestPromise.catch(() => {}); // Don't let errors break the queue

    // Store the promise IMMEDIATELY (atomic operation) - before any async work starts
    activeRequestsRef.current.set(workflowId, requestPromise);

    return requestPromise;
  }, []);

  // Load folders
  const loadFolders = useCallback(async () => {
    try {
      const data = await api.getFolders();
      setFolders(data.folders || []);
    } catch (error) {
      console.error("Failed to load folders:", error);
      toast.error("Failed to load folders");
    }
  }, []);

  // Create folder
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    setFolderActionLoading(true);
    try {
      await api.createFolder({ folder_name: newFolderName.trim() });
      await loadFolders();
      setNewFolderName("");
      setShowCreateFolderModal(false);
      toast.success("Folder created");
    } catch (error: any) {
      console.error("Failed to create folder:", error);
      toast.error(error?.message || "Failed to create folder");
    } finally {
      setFolderActionLoading(false);
    }
  };

  // Rename folder
  const handleRenameFolder = async (folderId: string) => {
    if (!editingFolderName.trim()) return;
    setFolderActionLoading(true);
    try {
      await api.updateFolder(folderId, {
        folder_name: editingFolderName.trim(),
      });
      await loadFolders();
      setEditingFolderId(null);
      setEditingFolderName("");
      toast.success("Folder renamed");
    } catch (error: any) {
      console.error("Failed to rename folder:", error);
      toast.error(error?.message || "Failed to rename folder");
    } finally {
      setFolderActionLoading(false);
    }
  };

  // Delete folder
  const handleDeleteFolder = async (folderId: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this folder? Lead magnets inside will be moved to the root.",
      )
    )
      return;
    setFolderActionLoading(true);
    try {
      await api.deleteFolder(folderId);
      await Promise.all([loadFolders(), loadWorkflows()]);
      if (currentFolderId === folderId) {
        setCurrentFolderId(null);
      }
      toast.success("Folder deleted");
    } catch (error: any) {
      console.error("Failed to delete folder:", error);
      toast.error(error?.message || "Failed to delete folder");
    } finally {
      setFolderActionLoading(false);
    }
  };

  // Move workflow to folder
  const handleMoveToFolder = async (
    workflowId: string,
    folderId: string | null,
  ) => {
    setFolderActionLoading(true);
    try {
      await api.moveWorkflowToFolder(workflowId, folderId);
      await loadWorkflows();
      setShowMoveFolderModal(null);
      toast.success("Moved");
    } catch (error: any) {
      console.error("Failed to move workflow:", error);
      toast.error(error?.message || "Failed to move lead magnet");
    } finally {
      setFolderActionLoading(false);
    }
  };

  // Get current folder name
  const currentFolder = useMemo(() => {
    if (!currentFolderId) return null;
    return folders.find((f) => f.folder_id === currentFolderId) || null;
  }, [currentFolderId, folders]);

  useEffect(() => {
    loadWorkflows();
    loadFolders();
  }, [loadFolders, loadWorkflows]);

  // Create stable workflow IDs array to prevent unnecessary effect runs
  const workflowIds = useMemo(() => {
    return workflows
      .map((w) => w.workflow_id)
      .sort()
      .join(",");
  }, [workflows]);

  // Track the last workflowIds we processed to prevent duplicate processing
  const lastProcessedWorkflowIdsRef = useRef<string>("");

  // Load jobs for each workflow - only when workflow IDs actually change
  useEffect(() => {
    if (workflows.length === 0) return;

    // Skip if we've already processed these workflow IDs
    if (lastProcessedWorkflowIdsRef.current === workflowIds) {
      return;
    }

    // Cancel any previous initial load batch before starting a new one
    if (initialLoadCancellationRef.current) {
      initialLoadCancellationRef.current();
      initialLoadCancellationRef.current = null;
    }

    // Atomic check-and-set: skip if already processing, otherwise mark as processing
    if (isProcessingBatchRef.current) {
      return;
    }

    // Mark as processing IMMEDIATELY to prevent concurrent runs (atomic)
    // This must happen synchronously before any async work starts
    isProcessingBatchRef.current = true;
    lastProcessedWorkflowIdsRef.current = workflowIds;

    // Batch load jobs to prevent overwhelming the server
    // Process workflows in batches of 5 with a small delay between batches
    const workflowsToLoad = workflows.filter((workflow) => {
      const workflowId = workflow.workflow_id;
      if (!loadedWorkflowIdsRef.current.has(workflowId)) {
        loadedWorkflowIdsRef.current.add(workflowId);
        return true;
      }
      return false;
    });

    if (workflowsToLoad.length === 0) {
      isProcessingBatchRef.current = false;
      return;
    }

    // Process in batches of 5
    const batchSize = 5;
    let batchIndex = 0;
    let cancelled = false;
    const timeoutIds: NodeJS.Timeout[] = [];

    // Create cleanup function and store it in ref so it can be called from outside
    const cleanupInitialLoad = () => {
      cancelled = true;
      timeoutIds.forEach((id) => clearTimeout(id));
      isProcessingBatchRef.current = false;
      initialLoadCancellationRef.current = null;
    };

    // Store cleanup function so it can be called when effect re-runs or unmounts
    initialLoadCancellationRef.current = cleanupInitialLoad;

    const processBatch = async () => {
      if (cancelled) {
        return;
      }

      const batch = workflowsToLoad.slice(
        batchIndex * batchSize,
        (batchIndex + 1) * batchSize,
      );

      // Process workflows sequentially within batch to prevent race conditions
      for (const workflow of batch) {
        if (cancelled) break;
        await loadJobsForWorkflow(workflow.workflow_id);
        // Small delay between requests in the same batch
        if (!cancelled) {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      }

      if (cancelled) return;

      batchIndex++;
      if (batchIndex * batchSize < workflowsToLoad.length) {
        // Process next batch after a short delay
        const timeoutId = setTimeout(processBatch, 100);
        timeoutIds.push(timeoutId);
      } else {
        // All batches processed, clear the flag after a small delay to ensure all requests started
        const timeoutId = setTimeout(() => {
          if (!cancelled) {
            isProcessingBatchRef.current = false;
            initialLoadCancellationRef.current = null;
          }
        }, 200);
        timeoutIds.push(timeoutId);
      }
    };

    processBatch();

    // Cleanup function: cancel any pending batches and clear the flag
    return () => {
      cleanupInitialLoad();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflowIds]); // Removed loadJobsForWorkflow - it's stable and we use ref

  // Keep refs updated with latest values
  useEffect(() => {
    workflowsRef.current = workflows;
    workflowJobsRef.current = workflowJobs;
    loadJobsForWorkflowRef.current = loadJobsForWorkflow;
  }, [workflows, workflowJobs, loadJobsForWorkflow]);

  // Track if we have processing jobs to avoid recreating interval unnecessarily
  const hasProcessingJobs = useMemo(() => {
    return Object.values(workflowJobs).some((jobs) =>
      jobs.some(
        (job: any) => job.status === "processing" || job.status === "pending",
      ),
    );
  }, [workflowJobs]);

  // Auto-refresh jobs for workflows that have processing jobs
  useEffect(() => {
    if (!hasProcessingJobs) {
      // Cancel any active polling when there are no processing jobs
      if (pollingCancellationRef.current) {
        pollingCancellationRef.current();
        pollingCancellationRef.current = null;
      }
      return;
    }

    const interval = setInterval(() => {
      // Use refs to get latest values without recreating interval
      const currentWorkflows = workflowsRef.current;
      const currentWorkflowJobs = workflowJobsRef.current;
      const currentLoadJobsForWorkflow = loadJobsForWorkflowRef.current;

      if (!currentLoadJobsForWorkflow) return;

      // Collect workflows that need polling
      const workflowsToPoll = currentWorkflows.filter((workflow) => {
        const jobs = currentWorkflowJobs[workflow.workflow_id] || [];
        return jobs.some(
          (job: any) => job.status === "processing" || job.status === "pending",
        );
      });

      if (workflowsToPoll.length === 0) return;

      // Cancel any previous polling cycle before starting a new one
      if (pollingCancellationRef.current) {
        pollingCancellationRef.current();
        pollingCancellationRef.current = null;
      }

      // Atomic check-and-set: skip if already processing, otherwise mark as processing
      if (isProcessingBatchRef.current) {
        return;
      }

      // Mark as processing IMMEDIATELY (atomic operation)
      // This must happen synchronously before any async work starts
      isProcessingBatchRef.current = true;

      // Batch polling requests to prevent overwhelming the server
      const batchSize = 5;
      let batchIndex = 0;
      let cancelled = false;
      const timeoutIds: NodeJS.Timeout[] = [];

      // Create cleanup function and store it in ref so it can be called from outside
      const cleanupPolling = () => {
        cancelled = true;
        timeoutIds.forEach((id) => clearTimeout(id));
        isProcessingBatchRef.current = false;
        pollingCancellationRef.current = null;
      };

      // Store cleanup function so it can be called when effect re-runs or unmounts
      pollingCancellationRef.current = cleanupPolling;

      const processPollBatch = async () => {
        if (cancelled) {
          return;
        }

        const batch = workflowsToPoll.slice(
          batchIndex * batchSize,
          (batchIndex + 1) * batchSize,
        );

        // Process workflows sequentially within batch to prevent race conditions
        for (const workflow of batch) {
          if (cancelled) break;
          await currentLoadJobsForWorkflow(workflow.workflow_id);
          // Small delay between requests in the same batch
          if (!cancelled) {
            await new Promise((resolve) => setTimeout(resolve, 50));
          }
        }

        if (cancelled) return;

        batchIndex++;
        if (batchIndex * batchSize < workflowsToPoll.length) {
          // Process next batch after a short delay
          const timeoutId = setTimeout(processPollBatch, 100);
          timeoutIds.push(timeoutId);
        } else {
          // All batches processed, clear the flag
          const timeoutId = setTimeout(() => {
            if (!cancelled) {
              isProcessingBatchRef.current = false;
              pollingCancellationRef.current = null;
            }
          }, 200);
          timeoutIds.push(timeoutId);
        }
      };

      processPollBatch();
    }, 5000);

    return () => {
      clearInterval(interval);
      // Cancel any active polling batches
      if (pollingCancellationRef.current) {
        pollingCancellationRef.current();
        pollingCancellationRef.current = null;
      }
      isProcessingBatchRef.current = false;
    };
  }, [hasProcessingJobs]); // Only recreate interval when processing status changes

  const handleDelete = async (id: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this lead magnet? This will also delete its associated form.",
      )
    ) {
      return;
    }

    try {
      await api.deleteWorkflow(id);
      await loadWorkflows();
      toast.success("Lead magnet deleted");
    } catch (error) {
      console.error("Failed to delete workflow:", error);
      toast.error("Failed to delete lead magnet");
    }
  };

  const publicUrlFor = (form: any) => {
    if (!form || !form.public_slug) return null;
    return buildPublicFormUrl(form.public_slug, settings?.custom_domain);
  };

  const copyToClipboard = async (text: string, workflowId: string) => {
    if (!text) {
      console.error("No URL to copy");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopiedUrl(workflowId);
      setTimeout(() => setCopiedUrl(null), 2000);
      toast.success("Copied");
    } catch (error) {
      console.error("Failed to copy:", error);
      // Fallback for older browsers
      try {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
        setCopiedUrl(workflowId);
        setTimeout(() => setCopiedUrl(null), 2000);
        toast.success("Copied");
      } catch (fallbackError) {
        console.error("Fallback copy also failed:", fallbackError);
        toast.error("Failed to copy URL");
      }
    }
  };

  const getJobStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircleIcon className="w-3.5 h-3.5 text-green-600" />;
      case "failed":
        return <XCircleIcon className="w-3.5 h-3.5 text-red-600" />;
      case "processing":
        return (
          <ArrowPathIcon className="w-3.5 h-3.5 text-blue-600 animate-spin" />
        );
      default:
        return <ClockIcon className="w-3.5 h-3.5 text-yellow-600" />;
    }
  };

  const formatRelativeTime = (dateString: string) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc"); // Default to desc for new field
    }
  };

  // Filter workflows based on search query and current folder
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

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="h-8 bg-gray-200 rounded w-48 animate-pulse"></div>
          <div className="flex gap-2">
            <div className="h-10 w-32 bg-gray-200 rounded-lg animate-pulse"></div>
            <div className="h-10 w-40 bg-gray-200 rounded-lg animate-pulse"></div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-16 bg-gray-100 rounded-lg animate-pulse"
              ></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header Section */}
      <div className="mb-6 sm:mb-8">
        {currentFolderId && (
          <button
            onClick={() => setCurrentFolderId(null)}
            className="group flex items-center text-sm font-medium text-gray-500 hover:text-gray-900 mb-4 transition-colors"
          >
            <ArrowLeftIcon className="w-4 h-4 mr-1 group-hover:-translate-x-0.5 transition-transform" />
            Back to All Lead Magnets
          </button>
        )}

        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
              {currentFolder ? currentFolder.folder_name : "Lead Magnets"}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {currentFolder
                ? `${filteredWorkflows.length} lead magnet${filteredWorkflows.length !== 1 ? "s" : ""} in this folder`
                : "Manage your AI lead magnets and their forms"}
            </p>
            <LeadMagnetsTabs className="mt-3" />
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={() => setShowCreateFolderModal(true)}
              className="flex items-center justify-center px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 text-sm"
            >
              <FolderPlusIcon className="w-5 h-5 mr-2 text-gray-400" />
              New Folder
            </button>
            <button
              onClick={() => router.push("/dashboard/workflows/new")}
              className="flex items-center justify-center px-4 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 text-sm flex-1 sm:flex-none"
            >
              <PlusIcon className="w-5 h-5 mr-2" />
              Create Lead Magnet
            </button>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      {workflows.length > 0 && (
        <div className="mb-6">
          <div className="relative max-w-lg">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MagnifyingGlassIcon
                className="h-5 w-5 text-gray-400"
                aria-hidden="true"
              />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search lead magnets..."
              className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:text-sm transition-shadow shadow-sm"
            />
          </div>
        </div>
      )}

      {/* Folders Section - Only show when not inside a folder */}
      {!currentFolderId && folders.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            <FolderIcon className="w-4 h-4" />
            Folders
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {folders.map((folder) => (
              <div key={folder.folder_id} className="relative group">
                {editingFolderId === folder.folder_id ? (
                  <div className="bg-white rounded-xl border-2 border-primary-500 p-3 shadow-sm">
                    <input
                      type="text"
                      value={editingFolderName}
                      onChange={(e) => setEditingFolderName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter")
                          handleRenameFolder(folder.folder_id);
                        if (e.key === "Escape") {
                          setEditingFolderId(null);
                          setEditingFolderName("");
                        }
                      }}
                      className="w-full text-sm border-0 border-b border-gray-200 p-0 pb-1 focus:ring-0 focus:border-primary-500 bg-transparent"
                      autoFocus
                      disabled={folderActionLoading}
                    />
                    <div className="flex gap-2 mt-2 justify-end">
                      <button
                        onClick={() => {
                          setEditingFolderId(null);
                          setEditingFolderName("");
                        }}
                        className="text-xs text-gray-500 hover:text-gray-700"
                        disabled={folderActionLoading}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleRenameFolder(folder.folder_id)}
                        className="text-xs text-primary-600 hover:text-primary-700 font-medium disabled:opacity-50"
                        disabled={folderActionLoading}
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => setCurrentFolderId(folder.folder_id)}
                    className="group/card cursor-pointer w-full bg-white rounded-xl border border-gray-200 p-4 hover:border-primary-200 hover:shadow-md transition-all relative"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <FolderIcon className="w-8 h-8 text-primary-100 fill-primary-50 group-hover/card:text-primary-200 transition-colors" />
                      <Menu as="div" className="relative">
                        <MenuButton
                          onClick={(e) => e.stopPropagation()}
                          className="p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 opacity-0 group-hover/card:opacity-100 transition-opacity focus:outline-none"
                        >
                          <EllipsisVerticalIcon className="w-4 h-4" />
                        </MenuButton>
                        <Transition
                          as={Fragment}
                          enter="transition ease-out duration-100"
                          enterFrom="transform opacity-0 scale-95"
                          enterTo="transform opacity-100 scale-100"
                          leave="transition ease-in duration-75"
                          leaveFrom="transform opacity-100 scale-100"
                          leaveTo="transform opacity-0 scale-95"
                        >
                          <MenuItems className="absolute right-0 mt-1 w-36 origin-top-right bg-white rounded-lg shadow-lg ring-1 ring-black/5 focus:outline-none z-10">
                            <div className="py-1">
                              <MenuItem>
                                {({ active }) => (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingFolderId(folder.folder_id);
                                      setEditingFolderName(folder.folder_name);
                                    }}
                                    className={clsx(
                                      active ? "bg-gray-50" : "",
                                      "flex w-full items-center px-4 py-2 text-xs text-gray-700",
                                    )}
                                  >
                                    <PencilIcon className="mr-2 h-3.5 w-3.5 text-gray-400" />
                                    Rename
                                  </button>
                                )}
                              </MenuItem>
                              <MenuItem>
                                {({ active }) => (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteFolder(folder.folder_id);
                                    }}
                                    className={clsx(
                                      active ? "bg-red-50" : "",
                                      "flex w-full items-center px-4 py-2 text-xs text-red-600",
                                    )}
                                  >
                                    <TrashIcon className="mr-2 h-3.5 w-3.5 text-red-400" />
                                    Delete
                                  </button>
                                )}
                              </MenuItem>
                            </div>
                          </MenuItems>
                        </Transition>
                      </Menu>
                    </div>
                    <div className="font-medium text-gray-900 truncate text-sm mb-0.5">
                      {folder.folder_name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {folder.workflow_count || 0} item
                      {(folder.workflow_count || 0) !== 1 ? "s" : ""}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {filteredWorkflows.length === 0 && workflows.length > 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center max-w-lg mx-auto mt-12">
          <div className="mx-auto h-12 w-12 text-gray-300 mb-4">
            <MagnifyingGlassIcon className="h-full w-full" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No matching lead magnets
          </h3>
          <p className="text-gray-500 mb-6">
            Try adjusting your search query or filters.
          </p>
          <button
            onClick={() => setSearchQuery("")}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            Clear search
          </button>
        </div>
      ) : workflows.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center max-w-lg mx-auto mt-12">
          <div className="mx-auto h-12 w-12 bg-primary-100 rounded-xl flex items-center justify-center mb-4">
            <PlusIcon className="h-6 w-6 text-primary-600" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No lead magnets yet
          </h3>
          <p className="text-gray-500 mb-6">
            Get started by creating your first AI-powered lead magnet workflow.
          </p>
          <button
            onClick={() => router.push("/dashboard/workflows/new")}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            <PlusIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
            Create Lead Magnet
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Desktop Table View */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50/50">
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100/50 transition-colors select-none"
                    onClick={() => handleSort("name")}
                  >
                    <div className="flex items-center gap-1">
                      Lead Magnet
                      {sortField === "name" &&
                        (sortDirection === "asc" ? (
                          <ChevronUpIcon className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDownIcon className="w-3.5 h-3.5" />
                        ))}
                    </div>
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100/50 transition-colors select-none"
                    onClick={() => handleSort("form")}
                  >
                    <div className="flex items-center gap-1">
                      Form
                      {sortField === "form" &&
                        (sortDirection === "asc" ? (
                          <ChevronUpIcon className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDownIcon className="w-3.5 h-3.5" />
                        ))}
                    </div>
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100/50 transition-colors select-none"
                    onClick={() => handleSort("created_at")}
                  >
                    <div className="flex items-center gap-1">
                      Created At
                      {sortField === "created_at" &&
                        (sortDirection === "asc" ? (
                          <ChevronUpIcon className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDownIcon className="w-3.5 h-3.5" />
                        ))}
                    </div>
                  </th>
                  <th
                    scope="col"
                    className="hidden xl:table-cell px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100/50 transition-colors select-none"
                    onClick={() => handleSort("updated_at")}
                  >
                    <div className="flex items-center gap-1">
                      Last Updated
                      {sortField === "updated_at" &&
                        (sortDirection === "asc" ? (
                          <ChevronUpIcon className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDownIcon className="w-3.5 h-3.5" />
                        ))}
                    </div>
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100/50 transition-colors select-none"
                    onClick={() => handleSort("last_generated")}
                  >
                    <div className="flex items-center gap-1">
                      Last Generated
                      {sortField === "last_generated" &&
                        (sortDirection === "asc" ? (
                          <ChevronUpIcon className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDownIcon className="w-3.5 h-3.5" />
                        ))}
                    </div>
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Documents
                  </th>
                  <th scope="col" className="relative px-6 py-4">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredWorkflows.map((workflow) => {
                  const formUrl = workflow.form
                    ? publicUrlFor(workflow.form)
                    : null;
                  const jobs = workflowJobs[workflow.workflow_id] || [];
                  const processingJobs = jobs.filter(
                    (j: any) =>
                      j.status === "processing" || j.status === "pending",
                  );
                  const completedJobs = jobs.filter(
                    (j: any) => j.status === "completed",
                  );
                  const latestJob =
                    completedJobs.length > 0 ? completedJobs[0] : null;

                  return (
                    <tr
                      key={workflow.workflow_id}
                      className="hover:bg-gray-50/50 transition-colors cursor-pointer group"
                      onClick={() =>
                        router.push(
                          `/dashboard/workflows/${workflow.workflow_id}`,
                        )
                      }
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 bg-primary-50 rounded-lg flex items-center justify-center text-primary-600">
                            <DocumentTextIcon className="h-6 w-6" />
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900 group-hover:text-primary-600 transition-colors">
                              {workflow.workflow_name}
                            </div>
                            {workflow.workflow_description && (
                              <div className="text-sm text-gray-500 truncate max-w-xs">
                                {workflow.workflow_description}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {workflow.form ? (
                          formUrl ? (
                            <a
                              href={formUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1.5 text-primary-600 hover:text-primary-700 font-medium transition-colors"
                            >
                              <span className="truncate max-w-[150px]">
                                {workflow.form.form_name}
                              </span>
                              <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5 flex-shrink-0" />
                            </a>
                          ) : (
                            <span className="text-gray-900">
                              {workflow.form.form_name}
                            </span>
                          )
                        ) : (
                          <span className="text-gray-400 italic">
                            No form attached
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex items-center gap-1.5">
                          {formatRelativeTime(workflow.created_at)}
                        </div>
                      </td>
                      <td className="hidden xl:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex items-center gap-1.5">
                          <ClockIcon className="w-4 h-4 text-gray-400" />
                          {formatRelativeTime(
                            workflow.updated_at || workflow.created_at,
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {latestJob ? (
                          <div className="flex items-center gap-1.5 text-gray-900">
                            {formatRelativeTime(latestJob.created_at)}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {loadingJobs[workflow.workflow_id] ? (
                          <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            <ArrowPathIcon className="w-3 h-3 mr-1 animate-spin" />
                            Loading
                          </div>
                        ) : processingJobs.length > 0 ? (
                          <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            <ArrowPathIcon className="w-3 h-3 mr-1 animate-spin" />
                            Processing ({processingJobs.length})
                          </div>
                        ) : completedJobs.length > 0 ? (
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                {completedJobs.length} generated
                              </span>
                              {completedJobs[0]?.output_url && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openJobDocument(
                                      completedJobs[0].job_id,
                                      completedJobs[0].output_url,
                                    );
                                  }}
                                  className="text-xs text-primary-600 hover:text-primary-700 font-medium hover:underline"
                                >
                                  View latest
                                </button>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                            No documents
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-medium">
                        <Menu
                          as="div"
                          className="relative inline-block text-left"
                        >
                          <MenuButton
                            onClick={(e) => e.stopPropagation()}
                            className="p-2 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 focus:outline-none transition-colors"
                          >
                            <EllipsisVerticalIcon
                              className="w-5 h-5"
                              aria-hidden="true"
                            />
                          </MenuButton>
                          <Transition
                            as={Fragment}
                            enter="transition ease-out duration-100"
                            enterFrom="transform opacity-0 scale-95"
                            enterTo="transform opacity-100 scale-100"
                            leave="transition ease-in duration-75"
                            leaveFrom="transform opacity-100 scale-100"
                            leaveTo="transform opacity-0 scale-95"
                          >
                            <MenuItems className="absolute right-0 mt-2 w-48 origin-top-right divide-y divide-gray-100 rounded-lg bg-white shadow-lg ring-1 ring-black/5 focus:outline-none z-20">
                              <div className="px-1 py-1">
                                <MenuItem>
                                  {({ active }) => (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        router.push(
                                          `/dashboard/workflows/${workflow.workflow_id}`,
                                        );
                                      }}
                                      className={clsx(
                                        active
                                          ? "bg-primary-50 text-primary-700"
                                          : "text-gray-700",
                                        "group flex w-full items-center rounded-md px-2 py-2 text-sm",
                                      )}
                                    >
                                      <EyeIcon
                                        className="mr-2 h-4 w-4"
                                        aria-hidden="true"
                                      />
                                      View Details
                                    </button>
                                  )}
                                </MenuItem>
                                <MenuItem>
                                  {({ active }) => (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        router.push(
                                          `/dashboard/workflows/${workflow.workflow_id}/edit`,
                                        );
                                      }}
                                      className={clsx(
                                        active
                                          ? "bg-primary-50 text-primary-700"
                                          : "text-gray-700",
                                        "group flex w-full items-center rounded-md px-2 py-2 text-sm",
                                      )}
                                    >
                                      <PencilIcon
                                        className="mr-2 h-4 w-4"
                                        aria-hidden="true"
                                      />
                                      Edit Lead Magnet
                                    </button>
                                  )}
                                </MenuItem>
                              </div>
                              <div className="px-1 py-1">
                                <MenuItem>
                                  {({ active }) => (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setShowMoveFolderModal(
                                          workflow.workflow_id,
                                        );
                                      }}
                                      className={clsx(
                                        active ? "bg-gray-50" : "text-gray-700",
                                        "group flex w-full items-center rounded-md px-2 py-2 text-sm",
                                      )}
                                    >
                                      <FolderArrowDownIcon
                                        className="mr-2 h-4 w-4 text-gray-400"
                                        aria-hidden="true"
                                      />
                                      Move to Folder
                                    </button>
                                  )}
                                </MenuItem>
                                {formUrl && (
                                  <MenuItem>
                                    {({ active }) => (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          copyToClipboard(
                                            formUrl,
                                            workflow.workflow_id,
                                          );
                                        }}
                                        className={clsx(
                                          active
                                            ? "bg-gray-50"
                                            : "text-gray-700",
                                          "group flex w-full items-center rounded-md px-2 py-2 text-sm",
                                        )}
                                      >
                                        <ClipboardIcon
                                          className="mr-2 h-4 w-4 text-gray-400"
                                          aria-hidden="true"
                                        />
                                        Copy Form Link
                                      </button>
                                    )}
                                  </MenuItem>
                                )}
                              </div>
                              <div className="px-1 py-1">
                                <MenuItem>
                                  {({ active }) => (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDelete(workflow.workflow_id);
                                      }}
                                      className={clsx(
                                        active
                                          ? "bg-red-50 text-red-700"
                                          : "text-red-600",
                                        "group flex w-full items-center rounded-md px-2 py-2 text-sm",
                                      )}
                                    >
                                      <TrashIcon
                                        className="mr-2 h-4 w-4 text-red-400"
                                        aria-hidden="true"
                                      />
                                      Delete
                                    </button>
                                  )}
                                </MenuItem>
                              </div>
                            </MenuItems>
                          </Transition>
                        </Menu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Folder Modal */}
      <Transition appear show={showCreateFolderModal} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-[100]"
          onClose={() => setShowCreateFolderModal(false)}
        >
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/25 backdrop-blur-sm" />
          </TransitionChild>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <TransitionChild
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <DialogPanel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                  <DialogTitle
                    as="h3"
                    className="text-lg font-medium leading-6 text-gray-900 flex items-center justify-between"
                  >
                    Create New Folder
                    <button
                      onClick={() => setShowCreateFolderModal(false)}
                      className="text-gray-400 hover:text-gray-500"
                    >
                      <XMarkIcon className="h-5 w-5" />
                    </button>
                  </DialogTitle>
                  <div className="mt-4">
                    <input
                      type="text"
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleCreateFolder();
                      }}
                      placeholder="Folder name (e.g., Marketing, Sales)"
                      className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                      autoFocus
                    />
                  </div>

                  <div className="mt-6 flex justify-end gap-3">
                    <button
                      type="button"
                      className="inline-flex justify-center rounded-lg border border-transparent bg-gray-100 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2"
                      onClick={() => setShowCreateFolderModal(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="inline-flex justify-center rounded-lg border border-transparent bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={handleCreateFolder}
                      disabled={!newFolderName.trim() || folderActionLoading}
                    >
                      {folderActionLoading ? "Creating..." : "Create Folder"}
                    </button>
                  </div>
                </DialogPanel>
              </TransitionChild>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Move to Folder Modal */}
      <Transition appear show={!!showMoveFolderModal} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-[100]"
          onClose={() => setShowMoveFolderModal(null)}
        >
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/25 backdrop-blur-sm" />
          </TransitionChild>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <TransitionChild
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <DialogPanel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                  <DialogTitle
                    as="h3"
                    className="text-lg font-medium leading-6 text-gray-900 flex items-center justify-between"
                  >
                    Move to Folder
                    <button
                      onClick={() => setShowMoveFolderModal(null)}
                      className="text-gray-400 hover:text-gray-500"
                    >
                      <XMarkIcon className="h-5 w-5" />
                    </button>
                  </DialogTitle>
                  <div className="mt-4 max-h-64 overflow-y-auto space-y-2">
                    <button
                      onClick={() =>
                        showMoveFolderModal &&
                        handleMoveToFolder(showMoveFolderModal, null)
                      }
                      className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors flex items-center gap-3 group"
                    >
                      <FolderIcon className="w-5 h-5 text-gray-400 group-hover:text-gray-600" />
                      <span className="text-sm font-medium text-gray-700">
                        Root (No folder)
                      </span>
                    </button>
                    {folders.map((folder) => (
                      <button
                        key={folder.folder_id}
                        onClick={() =>
                          showMoveFolderModal &&
                          handleMoveToFolder(
                            showMoveFolderModal,
                            folder.folder_id,
                          )
                        }
                        className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors flex items-center gap-3 group"
                      >
                        <FolderIcon className="w-5 h-5 text-primary-200 group-hover:text-primary-400" />
                        <span className="text-sm font-medium text-gray-700">
                          {folder.folder_name}
                        </span>
                      </button>
                    ))}
                  </div>
                </DialogPanel>
              </TransitionChild>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
}
