import { useReducer, useCallback } from "react";

type HistoryEntry = { html: string; timestamp: number };

export type HtmlState = {
  html: string;
  history: HistoryEntry[];
  historyIndex: number;
};

export type HtmlAction =
  | { type: "reset"; html: string }
  | { type: "set"; html: string }
  | { type: "commit"; html: string }
  | { type: "undo" }
  | { type: "redo" };

const initialHtmlState: HtmlState = { html: "", history: [], historyIndex: -1 };

function htmlReducer(state: HtmlState, action: HtmlAction): HtmlState {
  switch (action.type) {
    case "reset": {
      const entry: HistoryEntry = { html: action.html, timestamp: Date.now() };
      return { html: action.html, history: [entry], historyIndex: 0 };
    }
    case "set": {
      return { ...state, html: action.html };
    }
    case "commit": {
      const base = state.history.slice(0, state.historyIndex + 1);
      const lastHtml = base[base.length - 1]?.html;
      if (lastHtml === action.html) {
        return { ...state, html: action.html };
      }
      const nextHistory: HistoryEntry[] = [
        ...base,
        { html: action.html, timestamp: Date.now() },
      ];
      return {
        html: action.html,
        history: nextHistory,
        historyIndex: nextHistory.length - 1,
      };
    }
    case "undo": {
      if (state.historyIndex <= 0) return state;
      const newIndex = state.historyIndex - 1;
      return {
        ...state,
        html: state.history[newIndex].html,
        historyIndex: newIndex,
      };
    }
    case "redo": {
      if (state.historyIndex >= state.history.length - 1) return state;
      const newIndex = state.historyIndex + 1;
      return {
        ...state,
        html: state.history[newIndex].html,
        historyIndex: newIndex,
      };
    }
    default:
      return state;
  }
}

export function useEditorHistory() {
  const [state, dispatch] = useReducer(htmlReducer, initialHtmlState);

  const canUndo = state.historyIndex > 0;
  const canRedo =
    state.historyIndex >= 0 && state.historyIndex < state.history.length - 1;

  const undo = useCallback(() => dispatch({ type: "undo" }), []);
  const redo = useCallback(() => dispatch({ type: "redo" }), []);
  const reset = useCallback(
    (html: string) => dispatch({ type: "reset", html }),
    [],
  );
  const setHtml = useCallback(
    (html: string) => dispatch({ type: "set", html }),
    [],
  );
  const commit = useCallback(
    (html: string) => dispatch({ type: "commit", html }),
    [],
  );

  return {
    htmlState: state,
    dispatchHtml: dispatch, // Keep raw dispatch if needed
    undo,
    redo,
    reset,
    setHtml,
    commit,
    canUndo,
    canRedo,
  };
}

