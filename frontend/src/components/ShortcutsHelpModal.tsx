"use client";

import React from "react";
import { FiCommand } from "react-icons/fi";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/Dialog";

interface ShortcutsHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsHelpModal: React.FC<ShortcutsHelpModalProps> = ({
  isOpen,
  onClose,
}) => {
  const isMac =
    typeof window !== "undefined" &&
    navigator.platform.toUpperCase().indexOf("MAC") >= 0;
  const modKey = isMac ? "⌘" : "Ctrl";

  const shortcuts = [
    { keys: [`${modKey}K`, `${modKey}Space`], description: "Open search" },
    { keys: [`${modKey}/`], description: "Show keyboard shortcuts" },
    {
      keys: ["1", "2", "3", "4", "5"],
      description: "Navigate to sidebar items",
    },
    { keys: ["Esc"], description: "Close modals or sidebar" },
  ];

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-md border border-gray-200 bg-white p-0 sm:rounded-lg">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 p-6 pr-14">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100">
              <FiCommand className="h-5 w-5 text-primary-600" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold text-gray-900">
                Keyboard Shortcuts
              </DialogTitle>
              <p className="text-sm text-gray-500">Speed up your workflow</p>
            </div>
          </div>
        </div>

        {/* Shortcuts List */}
        <div className="p-6">
          <div className="space-y-4">
            {shortcuts.map((shortcut, index) => (
              <div
                key={index}
                className="flex items-center justify-between py-2"
              >
                <span className="text-sm text-gray-600">
                  {shortcut.description}
                </span>
                <div className="flex items-center gap-1.5">
                  {shortcut.keys.map((key, keyIndex) => (
                    <React.Fragment key={keyIndex}>
                      <kbd className="rounded border border-gray-300 bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">
                        {key}
                      </kbd>
                      {keyIndex < shortcut.keys.length - 1 && (
                        <span className="text-gray-400">+</span>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="rounded-b-lg border-t border-gray-200 bg-gray-50 px-6 py-4">
          <p className="text-center text-xs text-gray-500">
            Press{" "}
            <kbd className="rounded border border-gray-300 bg-white px-1.5 py-0.5 text-xs font-semibold text-gray-600">
              Esc
            </kbd>{" "}
            to close
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
