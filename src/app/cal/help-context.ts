"use client";

import { createContext, useContext } from "react";

interface CalHelpContextType {
  onHelpClick?: () => void;
}

export const CalHelpContext = createContext<CalHelpContextType>({});

export function useCalHelp() {
  return useContext(CalHelpContext);
}
