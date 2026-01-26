import { RefObject } from "react";
import Image from "next/image";
import {
  FiLayout,
  FiImage,
  FiZap,
  FiSend,
  FiLoader,
} from "react-icons/fi";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import {
  ChatMessage,
  CHAT_STARTER_PROMPTS,
  buildPreviewFallbackUrl,
} from "../constants";

interface ChatInterfaceProps {
  chatMessages: ChatMessage[];
  chatInput: string;
  setChatInput: (val: string) => void;
  handleSendChatMessage: () => void;
  isIdeating: boolean;
  selectedDeliverableId: string | null;
  setSelectedDeliverableId: (id: string | null) => void;
  mockupImages: string[];
  isGeneratingMockups: boolean;
  mockupError: string | null;
  handleGenerateMockups: () => void;
  handleCreateWorkflow: () => void;
  chatScrollRef: RefObject<HTMLDivElement>;
  chatInputRef: RefObject<HTMLTextAreaElement>;
  applyStarterPrompt: (val: string) => void;
  contextItems: Array<{ label: string; value: string }>;
  handleEditWizard: () => void;
  handleResetChat: () => void;
}

export function ChatInterface({
  chatMessages,
  chatInput,
  setChatInput,
  handleSendChatMessage,
  isIdeating,
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
}: ChatInterfaceProps) {
  const hasUserMessages = chatMessages.some((m) => m.role === "user");
  const showStarterPrompts = !hasUserMessages && chatMessages.length === 1;
  const selectedDeliverable = chatMessages
    .flatMap((m) => m.deliverables || [])
    .find((d) => d.id === selectedDeliverableId);

  return (
    <>
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Context summary
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleEditWizard}
              className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-emerald-300 dark:hover:border-emerald-700 hover:text-emerald-700 dark:hover:text-emerald-200 transition-colors"
            >
              Edit context
            </button>
            <button
              type="button"
              onClick={handleResetChat}
              className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-500 hover:text-gray-900 dark:hover:text-foreground transition-colors"
            >
              Reset chat
            </button>
          </div>
        </div>
        {contextItems.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {contextItems.map((item) => (
              <div
                key={item.label}
                className="rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-950/40 px-2.5 py-2 max-w-full"
                title={`${item.label}: ${item.value}`}
              >
                <div className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400 font-semibold">
                  {item.label}
                </div>
                <div className="text-xs text-gray-700 dark:text-gray-200 line-clamp-2">
                  {item.value}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-gray-500 dark:text-gray-400">
            No saved context yet. Use the wizard or share a quick summary in
            chat.
          </div>
        )}
      </div>

      <div
        ref={chatScrollRef}
        className="rounded-lg border border-gray-200 dark:border-border bg-gradient-to-b from-gray-50/50 to-white dark:from-gray-900/50 dark:to-gray-950 p-4 max-h-[500px] overflow-y-auto space-y-4 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700"
      >
        {chatMessages.map((message, index) => {
          const isUserMessage = message.role === "user";
          return (
            <div key={message.id} className="space-y-3">
              <div
                className={`flex ${
                  isUserMessage ? "justify-end" : "justify-start"
                } animate-in fade-in slide-in-from-bottom-2 duration-300`}
                style={{ animationDelay: `${index * 10}ms` }}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                    isUserMessage
                      ? "bg-gradient-to-r from-emerald-600 to-emerald-500 text-white whitespace-pre-wrap"
                      : "bg-white dark:bg-gray-800 text-gray-900 dark:text-foreground border border-gray-200 dark:border-gray-700"
                  }`}
                >
                  {isUserMessage ? (
                    message.content
                  ) : (
                    <MarkdownRenderer
                      value={message.content}
                      className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0"
                      fallbackClassName="whitespace-pre-wrap text-sm text-gray-900 dark:text-foreground"
                    />
                  )}
                </div>
              </div>

              {message.deliverables && message.deliverables.length > 0 && (
                <div className="flex justify-start animate-in fade-in slide-in-from-bottom-3 duration-300">
                  <div className="w-full rounded-2xl border border-emerald-200/70 dark:border-emerald-900/60 bg-white dark:bg-gray-900 px-4 py-4 shadow-sm">
                    <div className="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-gray-700">
                      <h3 className="text-base font-bold text-gray-900 dark:text-foreground flex items-center gap-2">
                        <FiLayout className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        Suggested Deliverables
                      </h3>
                      <span className="text-xs px-2 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 font-medium">
                        {message.deliverables.length}{" "}
                        {message.deliverables.length === 1
                          ? "option"
                          : "options"}
                      </span>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4 pt-3">
                      {message.deliverables.map((deliverable, idx) => {
                        const isSelected =
                          deliverable.id === selectedDeliverableId;
                        const fallbackSeed = `${deliverable.id || deliverable.title}-${idx + 1}`;
                        const examplePreview = deliverable.example_images?.find(
                          (image) => image?.url,
                        )?.url;
                        const previewUrl =
                          examplePreview ||
                          deliverable.image_url ||
                          buildPreviewFallbackUrl(fallbackSeed);
                        return (
                          <button
                            key={deliverable.id}
                            type="button"
                            onClick={() =>
                              setSelectedDeliverableId(deliverable.id)
                            }
                            aria-pressed={isSelected}
                            aria-label={`Select ${deliverable.title}`}
                            className={`group text-left rounded-xl border-2 p-4 transition-all duration-200 hover:shadow-lg ${
                              isSelected
                                ? "border-emerald-500 ring-4 ring-emerald-200/50 dark:ring-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-md"
                                : "border-gray-200 dark:border-gray-700 hover:border-emerald-300 dark:hover:border-emerald-700 bg-white dark:bg-gray-800"
                            }`}
                            style={{ animationDelay: `${idx * 50}ms` }}
                          >
                            <div className="relative aspect-[4/3] rounded-lg overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 border border-gray-200 dark:border-gray-700 mb-3 group-hover:scale-[1.02] transition-transform duration-200">
                              <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-400 dark:text-gray-500">
                                <FiImage className="w-8 h-8 opacity-50" />
                              </div>
                              <Image
                                src={previewUrl}
                                alt={deliverable.title}
                                fill
                                className="object-cover"
                                unoptimized
                                onError={(event) => {
                                  const target =
                                    event.currentTarget as HTMLImageElement;
                                  if (target.dataset.fallback === "true") {
                                    target.style.display = "none";
                                    return;
                                  }
                                  target.dataset.fallback = "true";
                                  target.src =
                                    buildPreviewFallbackUrl(fallbackSeed);
                                }}
                              />
                              {isSelected && (
                                <div className="absolute top-2 right-2 bg-emerald-600 text-white rounded-full p-1.5 shadow-lg">
                                  <FiZap className="w-3 h-3" />
                                </div>
                              )}
                            </div>
                            <div className="space-y-2">
                              <div className="flex items-start justify-between gap-2">
                                <h4 className="text-sm font-bold text-gray-900 dark:text-foreground leading-tight">
                                  {deliverable.title}
                                </h4>
                              </div>
                              <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 leading-relaxed">
                                {deliverable.description}
                              </p>
                              {deliverable.build_description?.trim() && (
                                <div className="rounded-lg bg-gray-50/80 dark:bg-gray-900/60 border border-gray-100 dark:border-gray-700 px-2 py-1.5 space-y-1">
                                  <div className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400 font-semibold">
                                    Build plan
                                  </div>
                                  <div className="text-xs text-gray-600 dark:text-gray-300 line-clamp-3">
                                    {deliverable.build_description}
                                  </div>
                                </div>
                              )}
                              <div className="flex items-center gap-2 pt-1">
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 uppercase tracking-wide font-medium">
                                  {deliverable.deliverable_type}
                                </span>
                              </div>
                              {deliverable.example_images &&
                                deliverable.example_images.length > 0 && (
                                  <div className="space-y-1">
                                    <div className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400 font-semibold">
                                      Example styles
                                    </div>
                                    <div className="flex gap-2">
                                      {deliverable.example_images
                                        .filter((image) => image?.url)
                                        .slice(0, 3)
                                        .map((image, imageIndex) => {
                                          const href =
                                            image.source_url || image.url;
                                          return (
                                            <a
                                              key={`${deliverable.id}-example-${imageIndex}`}
                                              href={href}
                                              target="_blank"
                                              rel="noreferrer"
                                              className="relative h-12 w-12 rounded-md overflow-hidden border border-gray-200 dark:border-gray-700"
                                              title={image.title || undefined}
                                            >
                                              <Image
                                                src={image.url}
                                                alt={
                                                  image.title ||
                                                  `${deliverable.title} example ${imageIndex + 1}`
                                                }
                                                fill
                                                className="object-cover"
                                                unoptimized
                                                onError={(event) => {
                                                  (
                                                    event.currentTarget as HTMLImageElement
                                                  ).style.display = "none";
                                                }}
                                              />
                                            </a>
                                          );
                                        })}
                                    </div>
                                  </div>
                                )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {showStarterPrompts && (
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Starter prompts
              </div>
              <span className="text-[11px] text-gray-500 dark:text-gray-400">
                Tap to fill the composer
              </span>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {CHAT_STARTER_PROMPTS.map((prompt) => (
                <button
                  key={prompt.title}
                  type="button"
                  onClick={() => applyStarterPrompt(prompt.value)}
                  className="text-left p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-emerald-300 dark:hover:border-emerald-700 bg-white dark:bg-gray-900 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all group"
                >
                  <div className="text-sm font-semibold text-gray-900 dark:text-foreground group-hover:text-emerald-700 dark:group-hover:text-emerald-300">
                    {prompt.title}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {prompt.description}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {isIdeating && (
          <div className="flex justify-start">
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3 shadow-sm flex items-center gap-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" />
                <div
                  className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce"
                  style={{ animationDelay: "0.2s" }}
                />
                <div
                  className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce"
                  style={{ animationDelay: "0.4s" }}
                />
              </div>
              <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                Thinking...
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="relative">
          <textarea
            ref={chatInputRef}
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendChatMessage();
              }
            }}
            placeholder={
              selectedDeliverable
                ? `Ask questions about "${selectedDeliverable.title}" or suggest changes...`
                : "Describe your lead magnet idea..."
            }
            disabled={isIdeating}
            className="w-full pl-4 pr-12 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-foreground placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 focus:border-transparent resize-none shadow-sm"
            rows={3}
          />
          <button
            onClick={handleSendChatMessage}
            disabled={!chatInput.trim() || isIdeating}
            className="absolute right-3 bottom-3 p-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            {isIdeating ? (
              <FiLoader className="w-4 h-4 animate-spin" />
            ) : (
              <FiSend className="w-4 h-4" />
            )}
          </button>
        </div>

        {selectedDeliverable && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/20 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-foreground">
                    Selected: {selectedDeliverable.title}
                  </h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                    Ready to build this lead magnet?
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleGenerateMockups}
                    disabled={isGeneratingMockups}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 disabled:opacity-50 transition-colors"
                  >
                    {isGeneratingMockups ? "Generating..." : "Preview Mockups"}
                  </button>
                  <button
                    onClick={handleCreateWorkflow}
                    className="px-4 py-1.5 text-sm font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm hover:shadow transition-all"
                  >
                    Build Workflow &rarr;
                  </button>
                </div>
              </div>

              {mockupError && (
                <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
                  {mockupError}
                </div>
              )}

              {mockupImages.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    AI Generated Mockups
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {mockupImages.map((url, idx) => (
                      <div
                        key={idx}
                        className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                      >
                        <Image
                          src={url}
                          alt={`Mockup ${idx + 1}`}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
