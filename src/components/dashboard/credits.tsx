"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

// The balance in the sidebar. The dashboard layout reads it once; pages
// that spend or refund credits adjust it here, so it stays current without
// refetching the layout.

type Credits = { balance: number; adjust: (delta: number) => void };

const CreditsContext = createContext<Credits | null>(null);

export function CreditsProvider({
  balance: initial,
  children,
}: {
  balance: number;
  children: React.ReactNode;
}) {
  const [balance, setBalance] = useState(initial);
  // A server refresh (router.refresh) brings the stored balance back in.
  const [stored, setStored] = useState(initial);
  if (stored !== initial) {
    setStored(initial);
    setBalance(initial);
  }

  // Stable, so effects can depend on it.
  const adjust = useCallback((delta: number) => setBalance((current) => current + delta), []);
  const value = useMemo(() => ({ balance, adjust }), [balance, adjust]);

  return <CreditsContext.Provider value={value}>{children}</CreditsContext.Provider>;
}

// Null outside the dashboard.
export function useCredits() {
  return useContext(CreditsContext);
}
