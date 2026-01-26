import React, { createContext, useContext, ReactNode } from "react";
import { usePlaygroundState } from "../hooks/usePlaygroundState";

type PlaygroundState = ReturnType<typeof usePlaygroundState>;

const PlaygroundContext = createContext<PlaygroundState | null>(null);

export const PlaygroundProvider = ({ children }: { children: ReactNode }) => {
  const state = usePlaygroundState();

  return (
    <PlaygroundContext.Provider value={state}>
      {children}
    </PlaygroundContext.Provider>
  );
};

export const usePlaygroundContext = () => {
  const context = useContext(PlaygroundContext);
  if (!context) {
    throw new Error(
      "usePlaygroundContext must be used within a PlaygroundProvider"
    );
  }
  return context;
};
