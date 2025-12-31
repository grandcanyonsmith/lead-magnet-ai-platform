import React from "react";
import { WorkflowTrigger, WorkflowTriggerType } from "@/types/workflow";
import { FiGlobe, FiFileText } from "react-icons/fi";

interface WorkflowTriggerEditorProps {
  trigger: WorkflowTrigger;
  onChange: (trigger: WorkflowTrigger) => void;
  workflowId: string;
  settings?: any;
}

export default function WorkflowTriggerEditor({
  trigger,
  onChange,
  workflowId,
  settings,
}: WorkflowTriggerEditorProps) {
  const handleTypeChange = (type: WorkflowTriggerType) => {
    onChange({
      ...trigger,
      type,
    });
  };

  const getWebhookUrl = () => {
    if (settings?.webhook_token) {
       return `${window.location.origin}/api/v1/webhooks/${settings.webhook_token}`;
    }
    return `${window.location.origin}/api/v1/webhooks/[YOUR_WEBHOOK_TOKEN]`; 
  };

  return (
    <div className="space-y-6">
       {/* Trigger Type Selection */}
       <div>
         <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
           Trigger Type
         </label>
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           <button
             type="button"
             onClick={() => handleTypeChange("form")}
             className={`flex flex-col items-center justify-center p-6 rounded-xl border-2 transition-all ${
               trigger.type === "form"
                 ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300"
                 : "border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/40 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-700"
             }`}
           >
             <FiFileText className="w-8 h-8 mb-3" />
             <span className="font-semibold">Form Submission</span>
             <span className="text-xs mt-1 text-center opacity-80">
               Trigger workflow when a user submits a form
             </span>
           </button>
           
           <button
             type="button"
             onClick={() => handleTypeChange("webhook")}
             className={`flex flex-col items-center justify-center p-6 rounded-xl border-2 transition-all ${
               trigger.type === "webhook"
                 ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300"
                 : "border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/40 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-700"
             }`}
           >
             <FiGlobe className="w-8 h-8 mb-3" />
             <span className="font-semibold">Webhook URL</span>
             <span className="text-xs mt-1 text-center opacity-80">
               Trigger workflow via API call
             </span>
           </button>
         </div>
       </div>

       {trigger.type === "webhook" && (
         <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg border border-gray-200 dark:border-gray-800">
           <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
             Webhook Configuration
           </h3>
           <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
             Send a POST request to <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-primary-600 dark:text-primary-400">{getWebhookUrl()}</code> with the following JSON body:
           </p>
           
           <div className="bg-gray-900 text-gray-200 p-3 rounded-md font-mono text-xs overflow-x-auto">
             <pre>{JSON.stringify({
               workflow_id: workflowId,
               form_data: {
                 name: "User Name",
                 email: "user@example.com",
                 // other fields
               }
             }, null, 2)}</pre>
           </div>
           
           {!settings?.webhook_token && (
             <p className="mt-4 text-xs text-gray-500">
               Note: You need your personal webhook token to construct the URL. You can find it in your settings.
             </p>
           )}
         </div>
       )}
       
       {trigger.type === "form" && (
         <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg border border-gray-200 dark:border-gray-800">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              The workflow will be triggered automatically when the associated form is submitted.
              You can customize the form in the &quot;Form&quot; tab.
            </p>
         </div>
       )}
    </div>
  );
}

