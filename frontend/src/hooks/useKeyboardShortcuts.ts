"use client";

import { useEffect, useCallback } from "react";

interface KeyboardShortcutsOptions {
  onSearch?: () => void;
  onShortcutsHelp?: () => void;
  onNavigate?: (index: number) => void;
  onClose?: () => void;
  navItemsCount?: number;
  enabled?: boolean;
}

export function useKeyboardShortcuts({
  onSearch,
  onShortcutsHelp,
  onNavigate,
  onClose,
  navItemsCount = 5,
  enabled = true,
}: KeyboardShortcutsOptions) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      // Check if user is typing in an input field
      const target = e.target as HTMLElement;
      const isInputField =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable;

      // Cmd/Ctrl+K or Cmd/Ctrl+Space: Open search
      if (modKey && (e.key === "k" || e.key === " ") && onSearch) {
        e.preventDefault();
        e.stopPropagation();
        onSearch();
        return;
      }

      // Cmd/Ctrl+/: Show shortcuts help
      if (modKey && e.key === "/" && onShortcutsHelp) {
        e.preventDefault();
        onShortcutsHelp();
        return;
      }

      // Number keys (1-5): Navigate to nav items
      // Only handle if NOT typing in an input field
      if (onNavigate && !modKey && !e.altKey && !e.shiftKey && !isInputField) {
        const num = parseInt(e.key);
        if (num >= 1 && num <= navItemsCount) {
          e.preventDefault();
          onNavigate(num - 1);
          return;
        }
      }

      // Esc: Close modals/sidebar
      if (e.key === "Escape" && onClose) {
        onClose();
        return;
      }
    },
    [enabled, onSearch, onShortcutsHelp, onNavigate, onClose, navItemsCount],
  );

  useEffect(() => {
    if (enabled) {
      window.addEventListener("keydown", handleKeyDown);
      return () => {
        window.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, [enabled, handleKeyDown]);
}
