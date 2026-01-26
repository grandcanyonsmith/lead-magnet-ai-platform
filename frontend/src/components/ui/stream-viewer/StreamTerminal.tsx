import React, { useRef, useEffect } from "react";
import { FiSearch, FiX, FiTerminal, FiAlertCircle } from "react-icons/fi";
import { LogLine } from "./LogLine";
import { LogEntry, stripShellPrefix } from "./utils";

interface StreamTerminalProps {
  viewMode: 'split' | 'terminal' | 'preview';
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  matchingIndices: number[];
  currentMatchIndex: number;
  navigateMatch: (direction: 'next' | 'prev') => void;
  scrollRef: React.RefObject<HTMLDivElement>;
  handleScroll: () => void;
  filteredLogs: LogEntry[];
  logs: LogEntry[];
  searchQueryTrimmed: boolean;
  filterLevel: string;
  error?: string | null;
  showLineNumbers: boolean;
  showTimestamps: boolean;
  wrapLines: boolean;
  expandedLogs: Set<number>;
  toggleExpandLog: (index: number) => void;
  matchRefs: React.MutableRefObject<(HTMLDivElement | null)[]>;
}

export function StreamTerminal({
  viewMode,
  searchQuery,
  setSearchQuery,
  matchingIndices,
  currentMatchIndex,
  navigateMatch,
  scrollRef,
  handleScroll,
  filteredLogs,
  logs,
  searchQueryTrimmed,
  filterLevel,
  error,
  showLineNumbers,
  showTimestamps,
  wrapLines,
  expandedLogs,
  toggleExpandLog,
  matchRefs,
}: StreamTerminalProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!searchQueryTrimmed) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
      if (e.key === 'Enter' && (e.shiftKey || e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        navigateMatch(e.shiftKey ? 'prev' : 'next');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchQueryTrimmed, navigateMatch]);

  return (
    <div className={`flex flex-col min-w-0 transition-all duration-300 ease-in-out bg-[#0d1117] ${
        viewMode === 'split' ? 'w-1/2 border-r border-gray-800' :
        viewMode === 'terminal' ? 'w-full' : 'hidden'
    }`}>
       <div className="flex items-center gap-2 px-3 py-2 bg-[#161b22] border-b border-gray-800 text-xs select-none">
         <div className="relative flex-1 min-w-[220px]">
           <FiSearch className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
           <input
            ref={searchInputRef}
             type="text"
             value={searchQuery}
             onChange={(e) => setSearchQuery(e.target.value)}
             placeholder="Search logs, levels, timestamps..."
             className="w-full pl-8 pr-8 py-1.5 bg-[#0d1117] border border-gray-700 rounded text-gray-200 placeholder-gray-500 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
           />
           {searchQuery && (
             <button
               onClick={() => setSearchQuery("")}
               className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-gray-500 hover:text-gray-300 rounded"
               title="Clear search"
             >
               <FiX className="w-3.5 h-3.5" />
             </button>
           )}
         </div>
         {searchQueryTrimmed && matchingIndices.length > 0 && (
           <div className="flex items-center gap-1 text-gray-500">
             <button
               onClick={() => navigateMatch('prev')}
               className="px-2 py-1 hover:bg-white/10 rounded transition-colors"
               title="Previous match (Shift+Enter)"
             >
               ↑
             </button>
             <span className="text-[10px] min-w-[45px] text-center">
               {currentMatchIndex + 1}/{matchingIndices.length}
             </span>
             <button
               onClick={() => navigateMatch('next')}
               className="px-2 py-1 hover:bg-white/10 rounded transition-colors"
               title="Next match (Enter)"
             >
               ↓
             </button>
           </div>
         )}
       </div>

       <div
         ref={scrollRef}
        onScroll={handleScroll}
         className="flex-1 overflow-y-auto p-2 scrollbar-hide"
       >
         <div className="space-y-0.5">
          {filteredLogs.map((log) => {
             const originalIndex = logs.indexOf(log);
             const isMatch = searchQueryTrimmed ? matchingIndices.includes(originalIndex) : false;
             const isCurrentMatch = isMatch && matchingIndices[currentMatchIndex] === originalIndex;
            const rawMessage = stripShellPrefix(log.message || "");
            const lineCount = rawMessage.split("\n").length;
            const isExpandable =
              rawMessage.length > 320 || lineCount > 4;
            const isExpanded = expandedLogs.has(originalIndex);

             return (
               <LogLine
                 key={originalIndex}
                 log={log}
                 searchQuery={searchQuery}
                 isMatch={isMatch}
                 isCurrentMatch={isCurrentMatch}
                 index={originalIndex}
                 showLineNumbers={showLineNumbers}
                 showTimestamps={showTimestamps}
                 wrapLines={wrapLines}
                 isExpandable={isExpandable}
                 isExpanded={isExpanded}
                 onToggleExpand={toggleExpandLog}
                 onRef={(el) => {
                   matchRefs.current[originalIndex] = el;
                 }}
               />
             );
           })}
           {logs.length === 0 && (
             <div className="flex flex-col items-center justify-center h-40 text-gray-600 gap-2">
               <FiTerminal className="w-8 h-8 opacity-20" />
               <span className="text-sm">Ready to connect...</span>
             </div>
           )}
          {logs.length > 0 && filteredLogs.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 text-gray-600 gap-2">
              <FiSearch className="w-8 h-8 opacity-20" />
              {searchQueryTrimmed ? (
                <span className="text-sm">No logs match &quot;{searchQuery}&quot;</span>
              ) : (
                <span className="text-sm">No {filterLevel === "all" ? "" : `${filterLevel} `}logs in view</span>
              )}
            </div>
          )}
         </div>
       </div>

       {error && (
         <div className="p-3 bg-red-900/20 border-t border-red-900/50 text-red-400 text-xs flex items-start gap-2 animate-in slide-in-from-bottom-2">
           <FiAlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
           <span className="font-medium">{error}</span>
         </div>
       )}
    </div>
  );
}
