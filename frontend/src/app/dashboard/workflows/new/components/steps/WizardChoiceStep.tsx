import React from "react";
import { FiZap, FiMessageSquare, FiLayout } from "react-icons/fi";
import { WizardStep } from "../../hooks/useNewWorkflowState";

interface WizardChoiceStepProps {
  setStep: (step: WizardStep) => void;
}

export const WizardChoiceStep: React.FC<WizardChoiceStepProps> = ({ setStep }) => {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-foreground mb-4">
          How would you like to start?
        </h1>
        <p className="text-gray-600 dark:text-muted-foreground text-lg">
          Choose how you want to create your new lead magnet workflow
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Generate with AI Card */}
        <button
          onClick={() => setStep("prompt")}
          className="group relative flex flex-col items-center p-8 bg-white dark:bg-card rounded-xl shadow-sm border-2 border-transparent hover:border-purple-500 dark:hover:border-purple-400 transition-all duration-200 hover:shadow-md text-left"
        >
          <div className="w-16 h-16 rounded-full bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-200">
            <FiZap className="w-8 h-8 text-purple-600 dark:text-purple-400" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-foreground mb-3">
            Generate with AI
          </h3>
          <p className="text-gray-600 dark:text-muted-foreground text-center mb-6">
            Describe what you want to build, and AI will generate the entire
            workflow, including research steps and email templates.
          </p>
          <span className="text-purple-600 dark:text-purple-400 font-medium group-hover:underline">
            Start with AI &rarr;
          </span>
        </button>

        {/* Chat with AI Card */}
        <button
          onClick={() => setStep("chat")}
          className="group relative flex flex-col items-center p-8 bg-white dark:bg-card rounded-xl shadow-sm border-2 border-transparent hover:border-emerald-500 dark:hover:border-emerald-400 transition-all duration-200 hover:shadow-md text-left"
        >
          <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-200">
            <FiMessageSquare className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-foreground mb-3">
            Chat with AI
          </h3>
          <p className="text-gray-600 dark:text-muted-foreground text-center mb-6">
            Have a conversation, get visual deliverable options, and choose
            what to build.
          </p>
          <span className="text-emerald-600 dark:text-emerald-400 font-medium group-hover:underline">
            Start chat &rarr;
          </span>
        </button>

        {/* Start from Scratch Card */}
        <button
          onClick={() => setStep("form")}
          className="group relative flex flex-col items-center p-8 bg-white dark:bg-card rounded-xl shadow-sm border-2 border-transparent hover:border-blue-500 dark:hover:border-blue-400 transition-all duration-200 hover:shadow-md text-left"
        >
          <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-200">
            <FiLayout className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-foreground mb-3">
            Start from Scratch
          </h3>
          <p className="text-gray-600 dark:text-muted-foreground text-center mb-6">
            Build your workflow manually step-by-step. Perfect for when you
            already know exactly what you need.
          </p>
          <span className="text-blue-600 dark:text-blue-400 font-medium group-hover:underline">
            Build Manually &rarr;
          </span>
        </button>
      </div>
    </div>
  );
};
