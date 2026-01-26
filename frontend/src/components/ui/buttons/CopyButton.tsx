import React, { useState, useEffect, useRef } from "react";
import { FiCopy, FiCheck } from "react-icons/fi";

interface CopyButtonProps {
  text: string;
  onCopy?: (text: string) => void;
  variant?: "icon" | "text" | "both";
  className?: string;
  title?: string;
  label?: string;
}

export function CopyButton({
  text,
  onCopy,
  variant = "both",
  className = "",
  title = "Copy to clipboard",
  label = "Copy",
}: CopyButtonProps) {
  const [isCopied, setIsCopied] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Use navigator.clipboard if available, otherwise fallback to onCopy prop
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        triggerCopiedState();
      }).catch((err) => {
        console.error('Failed to copy: ', err);
        // Fallback to onCopy if clipboard API fails
        if (onCopy) onCopy(text);
        triggerCopiedState();
      });
    } else {
      if (onCopy) onCopy(text);
      triggerCopiedState();
    }
  };

  const triggerCopiedState = () => {
    setIsCopied(true);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setIsCopied(false);
    }, 2000);
  };

  const showIcon = variant === "icon" || variant === "both";
  const showText = variant === "text" || variant === "both";

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 active:text-gray-900 dark:active:text-white flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 active:bg-gray-300 dark:active:bg-gray-600 touch-target min-h-[44px] sm:min-h-0 ${className}`}
      title={isCopied ? "Copied" : title}
      aria-label={isCopied ? "Copied" : title}
    >
      {showIcon && (
        isCopied ? (
          <FiCheck className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
        ) : (
          <FiCopy className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
        )
      )}
      {showText && (
        <span className={variant === "both" ? "hidden sm:inline" : ""}>
          {isCopied ? "Copied" : label}
        </span>
      )}
    </button>
  );
}
