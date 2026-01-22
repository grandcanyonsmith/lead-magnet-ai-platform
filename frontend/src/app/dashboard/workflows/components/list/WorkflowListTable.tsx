import React, { useState, Fragment } from "react";
import { useRouter } from "next/navigation";
import { Workflow } from "@/types";
import {
  DocumentTextIcon,
  ArrowTopRightOnSquareIcon,
  ClockIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  EllipsisVerticalIcon,
  EyeIcon,
  PencilIcon,
  FolderArrowDownIcon,
  ClipboardIcon,
  TrashIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  MagnifyingGlassIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";
import { Menu, MenuButton, MenuItem, MenuItems, Transition } from "@headlessui/react";
import clsx from "clsx";
import toast from "react-hot-toast";
import { buildPublicFormUrl } from "@/utils/url";
import { openJobDocumentInNewTab } from "@/utils/jobs/openJobDocument";

interface WorkflowListTableProps {
  workflows: Workflow[];
  workflowJobs: Record<string, any[]>;
  loadingJobs: Record<string, boolean>;
  sortField: string;
  sortDirection: "asc" | "desc";
  handleSort: (field: string) => void;
  handleDelete: (id: string) => void;
  handleMove: (id: string) => void;
  customDomain?: string;
  hasWorkflows: boolean; // Total workflows count (unfiltered) to show different empty states
  onClearSearch: () => void;
}

export function WorkflowListTable({
  workflows,
  workflowJobs,
  loadingJobs,
  sortField,
  sortDirection,
  handleSort,
  handleDelete,
  handleMove,
  customDomain,
  hasWorkflows,
  onClearSearch,
}: WorkflowListTableProps) {
  const router = useRouter();
  const [openingDocumentJobId, setOpeningDocumentJobId] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const openJobDocument = async (jobId: string, fallbackUrl?: string) => {
    if (!jobId || openingDocumentJobId) return;
    setOpeningDocumentJobId(jobId);
    try {
      await openJobDocumentInNewTab(jobId, { fallbackUrl });
    } finally {
      setOpeningDocumentJobId(null);
    }
  };

  const publicUrlFor = (form: any) => {
    if (!form || !form.public_slug) return null;
    return buildPublicFormUrl(form.public_slug, customDomain);
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

  const getWorkflowJobState = (workflowId: string) => {
    const jobs = workflowJobs[workflowId] || [];
    const processingJobs = jobs.filter(
      (j: any) => j.status === "processing" || j.status === "pending",
    );
    const completedJobs = jobs.filter((j: any) => j.status === "completed");
    const latestJob = completedJobs.length > 0 ? completedJobs[0] : null;
    return { jobs, processingJobs, completedJobs, latestJob };
  };

  const renderLatestReportStatus = (
    workflowId: string,
    processingJobs: any[],
    completedJobs: any[],
    latestJob: any | null,
  ) => {
    if (loadingJobs[workflowId]) {
      return (
        <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200">
          <ArrowPathIcon className="w-3 h-3 mr-1 animate-spin" />
          Loading
        </div>
      );
    }
    if (processingJobs.length > 0) {
      return (
        <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200">
          <ArrowPathIcon className="w-3 h-3 mr-1 animate-spin" />
          Processing ({processingJobs.length})
        </div>
      );
    }
    if (completedJobs.length > 0) {
      return (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200">
              {completedJobs.length} generated
            </span>
            {latestJob?.output_url && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  openJobDocument(latestJob.job_id, latestJob.output_url);
                }}
                className="text-xs text-primary-600 hover:text-primary-700 font-medium hover:underline"
              >
                View latest
              </button>
            )}
          </div>
        </div>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
        No documents
      </span>
    );
  };

  const renderActionsMenu = (workflow: Workflow, formUrl: string | null) => (
    <Menu as="div" className="relative inline-block text-left">
      <MenuButton
        onClick={(e) => e.stopPropagation()}
        className="p-2 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 focus:outline-none transition-colors"
      >
        <EllipsisVerticalIcon className="w-5 h-5" aria-hidden="true" />
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
        <MenuItems className="absolute right-0 mt-2 w-48 origin-top-right divide-y divide-gray-100 dark:divide-gray-700 rounded-lg bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black/5 dark:ring-white/10 focus:outline-none z-20">
          <div className="px-1 py-1">
            <MenuItem>
              {({ active }) => (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/dashboard/workflows/${workflow.workflow_id}`);
                  }}
                  className={clsx(
                    active
                      ? "bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300"
                      : "text-gray-700 dark:text-gray-300",
                    "group flex w-full items-center rounded-md px-2 py-2 text-sm",
                  )}
                >
                  <EyeIcon className="mr-2 h-4 w-4" aria-hidden="true" />
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
                      ? "bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300"
                      : "text-gray-700 dark:text-gray-300",
                    "group flex w-full items-center rounded-md px-2 py-2 text-sm",
                  )}
                >
                  <PencilIcon className="mr-2 h-4 w-4" aria-hidden="true" />
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
                    handleMove(workflow.workflow_id);
                  }}
                  className={clsx(
                    active
                      ? "bg-gray-50 dark:bg-gray-700"
                      : "text-gray-700 dark:text-gray-300",
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
                      copyToClipboard(formUrl, workflow.workflow_id);
                    }}
                    className={clsx(
                      active
                        ? "bg-gray-50 dark:bg-gray-700"
                        : "text-gray-700 dark:text-gray-300",
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
                      ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300"
                      : "text-red-600 dark:text-red-400",
                    "group flex w-full items-center rounded-md px-2 py-2 text-sm",
                  )}
                >
                  <TrashIcon className="mr-2 h-4 w-4 text-red-400" aria-hidden="true" />
                  Delete
                </button>
              )}
            </MenuItem>
          </div>
        </MenuItems>
      </Transition>
    </Menu>
  );

  if (workflows.length === 0) {
    if (hasWorkflows) {
      // Empty search results
      return (
        <div className="bg-white dark:bg-card rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center max-w-lg mx-auto mt-12">
          <div className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600 mb-4">
            <MagnifyingGlassIcon className="h-full w-full" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No matching lead magnets
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            Try adjusting your search query or filters.
          </p>
          <button
            onClick={onClearSearch}
            className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            Clear search
          </button>
        </div>
      );
    } else {
      // No workflows at all
      return (
        <div className="bg-white dark:bg-card rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center max-w-lg mx-auto mt-12">
          <div className="mx-auto h-12 w-12 bg-primary-100 dark:bg-primary-900/20 rounded-xl flex items-center justify-center mb-4">
            <PlusIcon className="h-6 w-6 text-primary-600 dark:text-primary-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No lead magnets yet
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
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
      );
    }
  }

  return (
    <div className="space-y-4">
      <div className="block md:hidden space-y-4">
        {workflows.map((workflow) => {
          const formUrl = workflow.form ? publicUrlFor(workflow.form) : null;
          const { processingJobs, completedJobs, latestJob } = getWorkflowJobState(
            workflow.workflow_id,
          );

          return (
            <div
              key={workflow.workflow_id}
              className="group relative bg-white dark:bg-card rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 cursor-pointer transition-all hover:shadow-md active:scale-[0.99]"
              onClick={() =>
                router.push(`/dashboard/workflows/${workflow.workflow_id}`)
              }
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="flex-shrink-0 h-10 w-10 bg-primary-50 dark:bg-primary-900/20 rounded-lg flex items-center justify-center text-primary-600 dark:text-primary-400">
                    <DocumentTextIcon className="h-6 w-6" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                      {workflow.workflow_name}
                    </div>
                    {workflow.workflow_description && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                        {workflow.workflow_description}
                      </div>
                    )}
                  </div>
                </div>
                <div className="shrink-0">
                  {renderActionsMenu(workflow, formUrl)}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500">
                    Form
                  </span>
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
                      <span className="text-gray-900 dark:text-white">
                        {workflow.form.form_name}
                      </span>
                    )
                  ) : (
                    <span className="text-gray-400 italic">
                      No form attached
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500">
                    Created
                  </span>
                  <span className="text-gray-700 dark:text-gray-200">
                    {formatRelativeTime(workflow.created_at)}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500">
                    Updated
                  </span>
                  <span className="text-gray-700 dark:text-gray-200">
                    {formatRelativeTime(
                      workflow.updated_at || workflow.created_at,
                    )}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500">
                    Last used
                  </span>
                  <span className="text-gray-700 dark:text-gray-200">
                    {latestJob ? formatRelativeTime(latestJob.created_at) : "-"}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <div>
                  {renderLatestReportStatus(
                    workflow.workflow_id,
                    processingJobs,
                    completedJobs,
                    latestJob,
                  )}
                </div>
                <span className="text-xs font-medium text-gray-400 dark:text-gray-500">
                  View details
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="hidden md:block bg-white dark:bg-card rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Desktop Table View */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50/50 dark:bg-gray-800/50">
              <tr>
                <th
                  scope="col"
                  className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100/50 dark:hover:bg-gray-700/50 transition-colors select-none"
                  onClick={() => handleSort("name")}
                >
                  <div className="flex items-center gap-1">
                    Tool Name
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
                  className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100/50 dark:hover:bg-gray-700/50 transition-colors select-none"
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
                  className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100/50 dark:hover:bg-gray-700/50 transition-colors select-none"
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
                  className="hidden xl:table-cell px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100/50 dark:hover:bg-gray-700/50 transition-colors select-none"
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
                  className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100/50 dark:hover:bg-gray-700/50 transition-colors select-none"
                  onClick={() => handleSort("last_generated")}
                >
                  <div className="flex items-center gap-1">
                    Last Used
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
                  className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                >
                  Latest Report
                </th>
                <th scope="col" className="relative px-6 py-4">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-card divide-y divide-gray-200 dark:divide-gray-700">
              {workflows.map((workflow) => {
                const formUrl = workflow.form
                  ? publicUrlFor(workflow.form)
                  : null;
                const { processingJobs, completedJobs, latestJob } =
                  getWorkflowJobState(workflow.workflow_id);

                return (
                  <tr
                    key={workflow.workflow_id}
                    className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer group"
                    onClick={() =>
                      router.push(
                        `/dashboard/workflows/${workflow.workflow_id}`,
                      )
                    }
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 bg-primary-50 dark:bg-primary-900/20 rounded-lg flex items-center justify-center text-primary-600 dark:text-primary-400">
                          <DocumentTextIcon className="h-6 w-6" />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                            {workflow.workflow_name}
                          </div>
                          {workflow.workflow_description && (
                            <div className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">
                              {workflow.workflow_description}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
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
                          <span className="text-gray-900 dark:text-white">
                            {workflow.form.form_name}
                          </span>
                        )
                      ) : (
                        <span className="text-gray-400 italic">
                          No form attached
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      <div className="flex items-center gap-1.5">
                        {formatRelativeTime(workflow.created_at)}
                      </div>
                    </td>
                    <td className="hidden xl:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      <div className="flex items-center gap-1.5">
                        <ClockIcon className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                        {formatRelativeTime(
                          workflow.updated_at || workflow.created_at,
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {latestJob ? (
                        <div className="flex items-center gap-1.5 text-gray-900 dark:text-white">
                          {formatRelativeTime(latestJob.created_at)}
                        </div>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-600 text-xs">
                          -
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {renderLatestReportStatus(
                        workflow.workflow_id,
                        processingJobs,
                        completedJobs,
                        latestJob,
                      )}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium">
                      {renderActionsMenu(workflow, formUrl)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
