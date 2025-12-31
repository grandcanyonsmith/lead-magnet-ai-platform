"use client";

import { useEffect, useState, useMemo } from "react";
import { api } from "@/lib/api";
import { FiRefreshCw, FiInbox, FiClock, FiHardDrive } from "react-icons/fi";
import { PreviewCard } from "@/components/artifacts/PreviewCard";
import { FiltersBar } from "@/components/artifacts/FiltersBar";
import { PaginationControls } from "@/components/artifacts/PaginationControls";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { logger } from "@/utils/logger";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";

type Artifact = {
  artifact_id: string;
  job_id?: string;
  workflow_id?: string;
  artifact_type?: string;
  file_name?: string;
  artifact_name?: string;
  content_type?: string;
  size_bytes?: number;
  file_size_bytes?: number;
  s3_bucket?: string;
  s3_key?: string;
  object_url?: string;
  public_url?: string;
  created_at?: string;
};

const ITEMS_PER_PAGE = 12;

export default function ArtifactsPage() {
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    loadArtifacts();
  }, []);

  const loadArtifacts = async () => {
    try {
      const data = await api.getArtifacts({ limit: 500 });
      const artifactsList = data.artifacts || [];
      setArtifacts(artifactsList);
    } catch (error) {
      logger.error("Failed to load artifacts", {
        error,
        context: "ArtifactsPage",
      });
    } finally {
      setLoading(false);
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    try {
      await loadArtifacts();
    } finally {
      setRefreshing(false);
    }
  };

  const artifactTypes = useMemo(() => {
    const types = new Set<string>();
    artifacts.forEach((a) => {
      if (a.artifact_type) types.add(a.artifact_type);
    });
    return Array.from(types).sort();
  }, [artifacts]);

  const filteredArtifacts = useMemo(() => {
    const filtered = artifacts.filter((artifact) => {
      const matchesSearch =
        !searchQuery ||
        (artifact.file_name || artifact.artifact_name || "")
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        artifact.artifact_id.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesType =
        !selectedType || artifact.artifact_type === selectedType;

      return matchesSearch && matchesType;
    });

    // Sort by created_at based on sortOrder
    filtered.sort((a: Artifact, b: Artifact) => {
      const dateA = new Date(a.created_at || 0).getTime();
      const dateB = new Date(b.created_at || 0).getTime();

      if (dateB !== dateA) {
        return sortOrder === "desc" ? dateB - dateA : dateA - dateB;
      }

      const groupA = a.workflow_id || a.job_id || `no-group-${a.artifact_id}`;
      const groupB = b.workflow_id || b.job_id || `no-group-${b.artifact_id}`;
      return groupA.localeCompare(groupB);
    });

    return filtered;
  }, [artifacts, searchQuery, selectedType, sortOrder]);

  const totalPages = Math.ceil(filteredArtifacts.length / ITEMS_PER_PAGE);

  const paginatedArtifacts = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return filteredArtifacts.slice(startIndex, endIndex);
  }, [filteredArtifacts, currentPage]);

  const totalSize = useMemo(() => {
    const bytes = filteredArtifacts.reduce(
      (acc, curr) => acc + (curr.size_bytes || curr.file_size_bytes || 0),
      0
    );
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  }, [filteredArtifacts]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedType, sortOrder]);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader heading="Downloads" description="Manage your generated files">
          <Button variant="outline" disabled>
            <FiRefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </PageHeader>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1">
            <Skeleton className="h-64 w-full" />
          </div>
          <div className="lg:col-span-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="aspect-[4/3] rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        heading="Downloads"
        description="Manage and preview your generated files"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full">
            <FiInbox className="w-4 h-4" />
            <span className="font-medium">{filteredArtifacts.length}</span>
            <span className="hidden sm:inline">files</span>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full">
            <FiHardDrive className="w-4 h-4" />
            <span className="font-medium">{totalSize}</span>
          </div>
          <Button
            variant="outline"
            onClick={refresh}
            disabled={refreshing}
            isLoading={refreshing}
            className="ml-2"
          >
            <FiRefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        <div className="lg:col-span-1">
          <div className="sticky top-6">
            <FiltersBar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              selectedType={selectedType}
              onTypeChange={setSelectedType}
              sortOrder={sortOrder}
              onSortChange={setSortOrder}
              artifactTypes={artifactTypes}
            />
          </div>
        </div>

        <div className="lg:col-span-3 space-y-6">
          {filteredArtifacts.length === 0 ? (
            <EmptyState
              title={
                artifacts.length === 0 ? "No downloads yet" : "No matching files"
              }
              message={
                artifacts.length === 0
                  ? "Generated files will appear here after you run workflows"
                  : "Try adjusting your search or filter criteria"
              }
              icon={<FiInbox className="h-12 w-12 text-muted-foreground" />}
              action={
                searchQuery || selectedType
                  ? {
                      label: "Clear filters",
                      onClick: () => {
                        setSearchQuery("");
                        setSelectedType("");
                        setSortOrder("desc");
                      },
                    }
                  : undefined
              }
            />
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {paginatedArtifacts.map((artifact) => (
                  <PreviewCard key={artifact.artifact_id} artifact={artifact} />
                ))}
              </div>

              <div className="border-t pt-6">
                <PaginationControls
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={filteredArtifacts.length}
                  itemsPerPage={ITEMS_PER_PAGE}
                  onPageChange={setCurrentPage}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
