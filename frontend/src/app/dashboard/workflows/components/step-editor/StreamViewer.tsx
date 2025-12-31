"use client";

import React, { useEffect, useState, useRef } from "react";
import { FiTerminal, FiImage, FiCheckCircle, FiAlertCircle } from "react-icons/fi";
import { authService } from "@/lib/auth";

interface StreamViewerProps {
  endpoint: string;
  requestBody: any;
  onClose: () => void;
}

interface LogEntry {
  timestamp: number;
  message: string;
  level: string;
  type: string;
}

export default function StreamViewer({ endpoint, requestBody, onClose }: StreamViewerProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [screenshotBase64, setScreenshotBase64] = useState<string | null>(null);
  const [status, setStatus] = useState<"connecting" | "streaming" | "completed" | "error">("connecting");
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    const abortController = new AbortController();

    async function startStream() {
      try {
        const token = await authService.getIdToken();
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify(requestBody),
          signal: abortController.signal
        });

        if (!response.ok) {
           const text = await response.text();
           throw new Error(`API Error: ${response.status} ${text}`);
        }
        
        setStatus("streaming");

        const reader = response.body?.getReader();
        if (!reader) throw new Error("Response body is not readable");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || ""; // Keep incomplete line in buffer

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const event = JSON.parse(line);
              
              if (active) {
                handleEvent(event);
              }
            } catch (e) {
              console.warn("Failed to parse JSON line:", line);
            }
          }
        }
        
        if (active) setStatus("completed");

      } catch (err: any) {
        if (err.name === 'AbortError') return;
        if (active) {
          setError(err.message);
          setStatus("error");
        }
      }
    }

    startStream();

    return () => {
      active = false;
      abortController.abort();
    };
  }, [endpoint, requestBody]);

  const handleEvent = (event: any) => {
    if (event.type === 'log') {
        setLogs(prev => [...prev, event]);
    } else if (event.type === 'screenshot') {
        // Store both URL and base64 for fallback
        if (event.url) {
            setScreenshotUrl(event.url);
        }
        if (event.base64) {
            setScreenshotBase64(event.base64);
        }
    } else if (event.type === 'complete') {
        setLogs(prev => [...prev, { 
            type: 'log', 
            timestamp: Date.now(), 
            level: 'info', 
            message: 'Stream completed.' 
        }]);
    } else if (event.type === 'error') {
        setError(event.message);
        setStatus("error");
    }
  };

  // Auto-scroll logs
  useEffect(() => {
    if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="flex flex-col gap-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 h-[600px]">
      <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-2">
        <h3 className="font-semibold text-sm flex items-center gap-2">
           <FiTerminal /> Live Execution
        </h3>
        <div className="flex items-center gap-2 text-xs">
           {status === 'streaming' && <span className="text-blue-500 animate-pulse">Running...</span>}
           {status === 'completed' && <span className="text-green-500 flex items-center gap-1"><FiCheckCircle /> Done</span>}
           {status === 'error' && <span className="text-red-500 flex items-center gap-1"><FiAlertCircle /> Error</span>}
        </div>
      </div>

      <div className="flex flex-1 gap-4 overflow-hidden">
        {/* Logs Panel */}
        <div className="flex-1 flex flex-col min-w-0">
           <div 
             ref={scrollRef}
             className="flex-1 overflow-y-auto font-mono text-xs p-2 bg-black text-green-400 rounded-md whitespace-pre-wrap"
           >
             {logs.map((log, i) => (
               <div key={i} className={`mb-1 ${log.level === 'error' ? 'text-red-400' : ''}`}>
                 <span className="opacity-50">[{new Date(log.timestamp * 1000).toLocaleTimeString()}]</span> {log.message}
               </div>
             ))}
             {logs.length === 0 && <span className="opacity-50">Waiting for logs...</span>}
           </div>
           {error && (
             <div className="mt-2 p-2 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs rounded border border-red-200 dark:border-red-800">
               {error}
             </div>
           )}
        </div>

        {/* Screenshot Panel */}
        <div className="w-1/2 flex flex-col border-l border-gray-200 dark:border-gray-700 pl-4">
           <div className="font-medium text-xs mb-2 flex items-center gap-2">
             <FiImage /> Latest Screenshot
           </div>
           <div className="flex-1 bg-gray-200 dark:bg-gray-800 rounded-md flex items-center justify-center overflow-hidden relative">
             {screenshotUrl || screenshotBase64 ? (
               <img 
                 src={screenshotUrl || (screenshotBase64 ? `data:image/jpeg;base64,${screenshotBase64}` : '')} 
                 alt="Screenshot" 
                 className="max-w-full max-h-full object-contain"
                 onError={(e) => {
                   console.error("[StreamViewer] Failed to load screenshot from URL:", screenshotUrl);
                   // Fallback to base64 if URL fails
                   if (screenshotBase64 && screenshotUrl) {
                     const target = e.target as HTMLImageElement;
                     target.src = `data:image/jpeg;base64,${screenshotBase64}`;
                   }
                 }}
               />
             ) : (
               <div className="text-gray-400 text-xs text-center p-4">
                 No screenshot yet
               </div>
             )}
           </div>
        </div>
      </div>
    </div>
  );
}

