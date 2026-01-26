import { useEffect } from "react";
import { isTextInputTarget } from "../utils";

interface UseEditorShortcutsProps {
  setIsSelectionMode: (mode: boolean) => void;
  setShowAiSettings: (show: boolean) => void;
  handleSave: () => void;
  handleUndo: () => void;
  handleRedo: () => void;
}

export function useEditorShortcuts({
  setIsSelectionMode,
  setShowAiSettings,
  handleSave,
  handleUndo,
  handleRedo,
}: UseEditorShortcutsProps) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsSelectionMode(false);
        setShowAiSettings(false);
        return;
      }

      const isMeta = e.metaKey || e.ctrlKey;
      if (!isMeta) return;

      const key = e.key.toLowerCase();

      if (key === "s") {
        e.preventDefault();
        handleSave();
        return;
      }

      // Don't override native undo/redo inside text inputs
      if (isTextInputTarget(e.target)) return;

      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
        return;
      }

      if ((key === "z" && e.shiftKey) || key === "y") {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    handleRedo,
    handleSave,
    handleUndo,
    setIsSelectionMode,
    setShowAiSettings,
  ]);
}
