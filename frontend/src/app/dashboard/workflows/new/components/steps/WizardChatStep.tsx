import React from "react";
import { FiMessageSquare } from "react-icons/fi";
import { WizardStep } from "../../hooks/useNewWorkflowState";
import { IdeationWizardStep } from "../IdeationWizardStep";
import { IdeationReview } from "../IdeationReview";
import { ChatInterface } from "../ChatInterface";
import { ICPProfile } from "@/types";
import { IdeationDraft, ChatMessage } from "../../constants";

interface WizardChatStepProps {
  setStep: (step: WizardStep) => void;
  chatErrors: string[];
  icpProfiles: ICPProfile[];
  selectedIcpProfileId: string;
  setSelectedIcpProfileId: (id: string) => void;
  setIcpProfileError: (error: string | null) => void;
  selectedIcpProfile: ICPProfile | undefined;
  applyIcpProfile: (profile: ICPProfile) => void;
  selectedIcpResearchStatus: string | undefined;
  icpResearchError: string | null;
  runIcpResearch: (profileId: string, force?: boolean) => void;
  isIcpResearching: boolean;
  icpProfileName: string;
  setIcpProfileName: (name: string) => void;
  handleSaveIcpProfile: () => void;
  hasWizardCore: boolean;
  isUpdatingSettings: boolean;
  icpProfileError: string | null;
  isChatSetupComplete: boolean;
  isWizardReview: boolean;
  chatSetupStep: number;
  totalWizardSteps: number;
  currentWizardStep: any;
  handleSkipWizard: () => void;
  wizardProgress: number;
  wizardStepValue: string;
  updateDraftField: (key: any, value: string) => void;
  appendDraftValue: (key: any, value: string) => void;
  setDraftPreset: (key: any, value: string) => void;
  handleWizardNext: () => void;
  handleWizardBack: () => void;
  showWizardHint: boolean;
  ideationDraft: IdeationDraft;
  setChatSetupStep: (step: number) => void;
  setChatSetupError: (error: string | null) => void;
  handleGenerateFromWizard: () => void;
  ideation: any;
  chatMessages: ChatMessage[];
  chatInput: string;
  setChatInput: (input: string) => void;
  handleSendChatMessage: () => void;
  selectedDeliverableId: string | null;
  setSelectedDeliverableId: (id: string | null) => void;
  mockupImages: string[];
  isGeneratingMockups: boolean;
  mockupError: string | null;
  handleGenerateMockups: () => void;
  handleCreateWorkflow: () => void;
  chatScrollRef: React.RefObject<HTMLDivElement>;
  chatInputRef: React.RefObject<HTMLTextAreaElement>;
  applyStarterPrompt: (prompt: string) => void;
  contextItems: any[];
  handleEditWizard: () => void;
  handleResetChat: () => void;
}

export const WizardChatStep: React.FC<WizardChatStepProps> = ({
  setStep,
  chatErrors,
  icpProfiles,
  selectedIcpProfileId,
  setSelectedIcpProfileId,
  setIcpProfileError,
  selectedIcpProfile,
  applyIcpProfile,
  selectedIcpResearchStatus,
  icpResearchError,
  runIcpResearch,
  isIcpResearching,
  icpProfileName,
  setIcpProfileName,
  handleSaveIcpProfile,
  hasWizardCore,
  isUpdatingSettings,
  icpProfileError,
  isChatSetupComplete,
  isWizardReview,
  chatSetupStep,
  totalWizardSteps,
  currentWizardStep,
  handleSkipWizard,
  wizardProgress,
  wizardStepValue,
  updateDraftField,
  appendDraftValue,
  setDraftPreset,
  handleWizardNext,
  handleWizardBack,
  showWizardHint,
  ideationDraft,
  setChatSetupStep,
  setChatSetupError,
  handleGenerateFromWizard,
  ideation,
  chatMessages,
  chatInput,
  setChatInput,
  handleSendChatMessage,
  selectedDeliverableId,
  setSelectedDeliverableId,
  mockupImages,
  isGeneratingMockups,
  mockupError,
  handleGenerateMockups,
  handleCreateWorkflow,
  chatScrollRef,
  chatInputRef,
  applyStarterPrompt,
  contextItems,
  handleEditWizard,
  handleResetChat,
}) => {
  return (
    <div>
      <div className="mb-8">
        <button
          onClick={() => setStep("choice")}
          className="text-sm text-gray-500 hover:text-gray-700 dark:text-muted-foreground dark:hover:text-foreground mb-4 flex items-center gap-1 transition-colors group"
        >
          <span className="group-hover:-translate-x-1 transition-transform">
            ←
          </span>
          Back to options
        </button>
        <div className="flex items-start gap-3">
          <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg">
            <FiMessageSquare className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-foreground mb-2">
              Chat to Ideate
            </h1>
            <p className="text-gray-600 dark:text-muted-foreground text-base leading-relaxed">
              Describe your lead magnet idea. We&apos;ll suggest options with
              quick visual previews, help you refine the concept, and then
              build it for you.
            </p>
          </div>
        </div>
      </div>

      {chatErrors.length > 0 && (
        <div className="mb-6 space-y-2">
          {chatErrors.map((message, index) => (
            <div
              key={`${message}-${index}`}
              className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm"
            >
              {message}
            </div>
          ))}
        </div>
      )}

      <div className="bg-white dark:bg-card rounded-lg shadow-lg border border-gray-200 dark:border-border overflow-hidden">
        <div className="space-y-6 p-6">
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-900/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                ICP Library
              </div>
              <span className="text-[10px] px-2 py-1 rounded-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400">
                {icpProfiles.length} saved
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <select
                value={selectedIcpProfileId}
                onChange={(event) => {
                  setSelectedIcpProfileId(event.target.value);
                  setIcpProfileError(null);
                }}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400"
              >
                <option value="">Select a saved ICP profile</option>
                {icpProfiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() =>
                  selectedIcpProfile && applyIcpProfile(selectedIcpProfile)
                }
                disabled={!selectedIcpProfile}
                className="px-4 py-2 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Use ICP
              </button>
            </div>
            {selectedIcpProfile && (
              <div className="space-y-2 text-xs text-gray-600 dark:text-gray-400">
                <div>
                  {selectedIcpProfile.icp
                    ? `ICP: ${selectedIcpProfile.icp}`
                    : "ICP profile loaded."}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400 font-semibold">
                    Research
                  </span>
                  {selectedIcpResearchStatus ? (
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        selectedIcpResearchStatus === "completed"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200"
                          : selectedIcpResearchStatus === "failed"
                            ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200"
                      }`}
                    >
                      {selectedIcpResearchStatus === "completed"
                        ? "Ready"
                        : selectedIcpResearchStatus === "failed"
                          ? "Failed"
                          : "In progress"}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                      Not started
                    </span>
                  )}
                  {selectedIcpProfile.research_completed_at && (
                    <span className="text-[10px] text-gray-500 dark:text-gray-400">
                      Updated{" "}
                      {new Date(
                        selectedIcpProfile.research_completed_at,
                      ).toLocaleDateString()}
                    </span>
                  )}
                </div>
                {selectedIcpProfile.research_report && (
                  <div className="rounded-lg border border-gray-100 dark:border-gray-800 bg-white/80 dark:bg-gray-950/40 p-3 space-y-2">
                    {selectedIcpProfile.research_report.summary && (
                      <div>
                        <div className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400 font-semibold">
                          Summary
                        </div>
                        <div className="text-xs text-gray-700 dark:text-gray-200">
                          {selectedIcpProfile.research_report.summary}
                        </div>
                      </div>
                    )}
                    <div className="grid sm:grid-cols-2 gap-2">
                      {selectedIcpProfile.research_report.pains &&
                        selectedIcpProfile.research_report.pains.length >
                          0 && (
                          <div>
                            <div className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400 font-semibold">
                              Pains
                            </div>
                            <ul className="list-disc list-inside text-xs text-gray-700 dark:text-gray-200 space-y-1">
                              {selectedIcpProfile.research_report.pains
                                .slice(0, 4)
                                .map((item) => (
                                  <li key={item}>{item}</li>
                                ))}
                            </ul>
                          </div>
                        )}
                      {selectedIcpProfile.research_report.desires &&
                        selectedIcpProfile.research_report.desires.length >
                          0 && (
                          <div>
                            <div className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400 font-semibold">
                              Desires
                            </div>
                            <ul className="list-disc list-inside text-xs text-gray-700 dark:text-gray-200 space-y-1">
                              {selectedIcpProfile.research_report.desires
                                .slice(0, 4)
                                .map((item) => (
                                  <li key={item}>{item}</li>
                                ))}
                            </ul>
                          </div>
                        )}
                      {selectedIcpProfile.research_report.wants &&
                        selectedIcpProfile.research_report.wants.length >
                          0 && (
                          <div>
                            <div className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400 font-semibold">
                              Wants
                            </div>
                            <ul className="list-disc list-inside text-xs text-gray-700 dark:text-gray-200 space-y-1">
                              {selectedIcpProfile.research_report.wants
                                .slice(0, 4)
                                .map((item) => (
                                  <li key={item}>{item}</li>
                                ))}
                            </ul>
                          </div>
                        )}
                    </div>
                  </div>
                )}
                {selectedIcpProfile.research_error && (
                  <div className="text-xs text-red-600 dark:text-red-400">
                    {selectedIcpProfile.research_error}
                  </div>
                )}
                {icpResearchError && (
                  <div className="text-xs text-red-600 dark:text-red-400">
                    {icpResearchError}
                  </div>
                )}
                {selectedIcpProfile && (
                  <button
                    type="button"
                    onClick={() =>
                      runIcpResearch(selectedIcpProfile.id, true)
                    }
                    disabled={
                      isIcpResearching ||
                      selectedIcpResearchStatus === "pending"
                    }
                    className="inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-lg border border-emerald-600 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {selectedIcpResearchStatus === "pending" ||
                    isIcpResearching
                      ? "Running deep research..."
                      : "Run deep research"}
                  </button>
                )}
              </div>
            )}
            <div className="pt-3 border-t border-gray-200 dark:border-gray-700 space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Save current ICP
              </div>
              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <input
                  value={icpProfileName}
                  onChange={(event) => setIcpProfileName(event.target.value)}
                  placeholder="e.g., Creator Ops Consultants"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400"
                />
                <button
                  type="button"
                  onClick={handleSaveIcpProfile}
                  disabled={
                    !hasWizardCore || isUpdatingSettings || isIcpResearching
                  }
                  className="px-4 py-2 text-sm rounded-lg border border-emerald-600 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUpdatingSettings
                    ? "Saving..."
                    : isIcpResearching
                      ? "Researching..."
                      : "Save ICP"}
                </button>
              </div>
              {!hasWizardCore && (
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Complete ICP, pain, and outcome before saving.
                </div>
              )}
              {icpProfileError && (
                <div className="text-xs text-red-600 dark:text-red-400">
                  {icpProfileError}
                </div>
              )}
            </div>
          </div>
          {!isChatSetupComplete ? (
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                    {isWizardReview
                      ? "Review"
                      : `Step ${Math.min(chatSetupStep + 1, totalWizardSteps)} of ${totalWizardSteps}`}
                  </div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-foreground">
                    {isWizardReview
                      ? "Review your inputs"
                      : currentWizardStep?.title}
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-muted-foreground">
                    {isWizardReview
                      ? "Make sure the context is accurate. You can edit any field before generating options."
                      : currentWizardStep?.description}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleSkipWizard}
                  className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-foreground hover:border-gray-300 dark:hover:border-gray-500 transition-colors"
                >
                  Skip to chat
                </button>
              </div>

              <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                <div
                  className="h-2 rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${Math.round(wizardProgress * 100)}%` }}
                />
              </div>

              {!isWizardReview ? (
                <IdeationWizardStep
                  stepConfig={currentWizardStep}
                  value={wizardStepValue}
                  onChange={(val) =>
                    updateDraftField(currentWizardStep.key, val)
                  }
                  onAppend={(val) =>
                    appendDraftValue(currentWizardStep.key, val)
                  }
                  onPreset={(val) =>
                    setDraftPreset(currentWizardStep.key, val)
                  }
                  onNext={handleWizardNext}
                  onBack={handleWizardBack}
                  isFirstStep={chatSetupStep === 0}
                  isLastStep={chatSetupStep + 1 >= totalWizardSteps}
                  showHint={showWizardHint || false}
                />
              ) : (
                <IdeationReview
                  draft={ideationDraft}
                  onEditStep={(index) => {
                    setChatSetupStep(index);
                    setChatSetupError(null);
                  }}
                  onBack={handleWizardBack}
                  onSkip={handleSkipWizard}
                  onGenerate={handleGenerateFromWizard}
                  isGenerating={ideation.isIdeating}
                />
              )}
            </div>
          ) : (
            <ChatInterface
              chatMessages={chatMessages}
              chatInput={chatInput}
              setChatInput={setChatInput}
              handleSendChatMessage={handleSendChatMessage}
              isIdeating={ideation.isIdeating}
              selectedDeliverableId={selectedDeliverableId}
              setSelectedDeliverableId={setSelectedDeliverableId}
              mockupImages={mockupImages}
              isGeneratingMockups={isGeneratingMockups}
              mockupError={mockupError}
              handleGenerateMockups={handleGenerateMockups}
              handleCreateWorkflow={handleCreateWorkflow}
              chatScrollRef={chatScrollRef}
              chatInputRef={chatInputRef}
              applyStarterPrompt={applyStarterPrompt}
              contextItems={contextItems}
              handleEditWizard={handleEditWizard}
              handleResetChat={handleResetChat}
            />
          )}
        </div>
      </div>
    </div>
  );
};
