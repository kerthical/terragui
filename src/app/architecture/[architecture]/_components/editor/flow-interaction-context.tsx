"use client";

import { createContext, type ReactNode, useContext } from "react";

export type FlowInteractionState = {
  hoveredNodeId: string | null;
  interactionDisabled: boolean;
};

type FlowInteractionProviderProps = {
  children: ReactNode;
  state: FlowInteractionState;
};

const FlowInteractionContext = createContext<FlowInteractionState>({ hoveredNodeId: null, interactionDisabled: false });

export function FlowInteractionProvider({ children, state }: FlowInteractionProviderProps) {
  return <FlowInteractionContext.Provider value={state}>{children}</FlowInteractionContext.Provider>;
}

export const useFlowInteraction = (): FlowInteractionState => useContext(FlowInteractionContext);
