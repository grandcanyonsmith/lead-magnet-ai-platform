"use client";

import { usePlaygroundState } from "./hooks/usePlaygroundState";
import { PlaygroundHeader } from "./components/PlaygroundHeader";
import { PlaygroundTabs } from "./components/PlaygroundTabs";
import { PlaygroundFlowchart } from "./components/PlaygroundFlowchart";
import { ImportWorkflowModal } from "./components/ImportWorkflowModal";
import { PlaygroundProvider, usePlaygroundContext } from "./context/PlaygroundContext";

const PlaygroundContent = () => {
  const {
    stepsLoaded,
    importModalOpen,
    setImportModalOpen,
    loadingWorkflows,
    availableWorkflows,
    selectWorkflowToImport,
  } = usePlaygroundContext();

  if (!stepsLoaded) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        Loading...
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-65px)] flex-col bg-muted/30">
      <PlaygroundHeader />

      <div className="flex flex-col gap-4">
        <PlaygroundTabs />
        <PlaygroundFlowchart />
      </div>

      <ImportWorkflowModal
        importModalOpen={importModalOpen}
        setImportModalOpen={setImportModalOpen}
        loadingWorkflows={loadingWorkflows}
        availableWorkflows={availableWorkflows}
        selectWorkflowToImport={selectWorkflowToImport}
      />
    </div>
  );
};

export default function PlaygroundPage() {
  return (
    <PlaygroundProvider>
      <PlaygroundContent />
    </PlaygroundProvider>
  );
}
