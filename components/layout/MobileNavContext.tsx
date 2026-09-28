"use client";

import { createContext, useCallback, useContext, useState } from "react";

type MobileNavContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  // Number of TopBars currently mounted. Pages that render a TopBar get the
  // hamburger from it; pages that don't fall back to the layout's MobileHeader.
  topBarCount: number;
  registerTopBar: () => () => void;
};

const MobileNavContext = createContext<MobileNavContextValue | null>(null);

// Wraps the dashboard shell so the Sidebar (an off-canvas drawer on small
// screens) and the TopBar's hamburger button can share open/close state
// even though they're siblings rendered at different points in the tree.
export function MobileNavProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [topBarCount, setTopBarCount] = useState(0);

  const registerTopBar = useCallback(() => {
    setTopBarCount(c => c + 1);
    return () => setTopBarCount(c => c - 1);
  }, []);

  return (
    <MobileNavContext.Provider value={{ open, setOpen, topBarCount, registerTopBar }}>
      {children}
    </MobileNavContext.Provider>
  );
}

export function useMobileNav() {
  const ctx = useContext(MobileNavContext);
  if (!ctx) throw new Error("useMobileNav must be used within a MobileNavProvider");
  return ctx;
}
