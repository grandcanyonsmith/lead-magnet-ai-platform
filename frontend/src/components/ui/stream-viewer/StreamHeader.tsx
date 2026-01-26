import React from "react";
import {
  FiCheckCircle,
  FiAlertCircle,
  FiMaximize2,
  FiMinimize2,
} from "react-icons/fi";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { LogEntry } from "./utils";

interface StreamHeaderProps {
  status: "connecting" | "streaming" | "completed" | "error" | "pending";
  logs: LogEntry[];
  headerContent?: React.ReactNode;
  isMaximized: boolean;
  setIsMaximized: (maximized: boolean) => void;
}

export function StreamHeader({
  status,
  logs,
  headerContent,
  isMaximized,
  setIsMaximized,
}: StreamHeaderProps) {
  return (
    <PanelHeader className="backdrop-blur-sm select-none">
      <div className="flex flex-col gap-2 flex-1">
        <div className="flex items-center gap-4">
          <div className={`
            flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border
            ${status === 'streaming' ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800' : ''}
            ${status === 'completed' ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800' : ''}
            ${status === 'error' ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800' : ''}
            ${status === 'connecting' || status === 'pending' ? 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700' : ''}
          `}>
            {status === 'streaming' && (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                </span>
                Running
              </>
            )}
            {status === 'completed' && <><FiCheckCircle /> Completed</>}
            {status === 'error' && <><FiAlertCircle /> Error</>}
            {status === 'connecting' && <span>Connecting...</span>}
            {status === 'pending' && <span>Pending</span>}
          </div>

          <div className="h-4 w-px bg-gray-300 dark:bg-gray-700 mx-1" />

          <div className="text-sm text-gray-500 dark:text-gray-400 font-mono">
            {logs.length} events
          </div>
        </div>
        {headerContent}
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 border-l border-gray-200 dark:border-gray-700 pl-4">
           <button
             onClick={() => setIsMaximized(!isMaximized)}
             className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
             title={isMaximized ? "Minimize" : "Maximize"}
           >
             {isMaximized ? <FiMinimize2 className="w-4 h-4" /> : <FiMaximize2 className="w-4 h-4" />}
           </button>
        </div>
      </div>
    </PanelHeader>
  );
}
