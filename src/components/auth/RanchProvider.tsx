'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';

export type RanchAccess = {
  ranchId: string;
  ranchName: string;
  role: 'owner' | 'member';
};

type RanchContextValue = {
  activeRanch: RanchAccess | null;
  ranches: RanchAccess[];
  setActiveRanch: (ranchId: string) => void;
};

type RanchProviderProps = React.PropsWithChildren<{
  activeRanch: RanchAccess | null;
  ranches: RanchAccess[];
}>;

const RanchContext = createContext<RanchContextValue>({
  activeRanch: null,
  ranches: [],
  setActiveRanch: () => {},
});

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const ACTIVE_RANCH_COOKIE = 'active_ranch_id';

function persistActiveRanchCookie(ranchId: string) {
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${ACTIVE_RANCH_COOKIE}=${encodeURIComponent(ranchId)}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
}

export function RanchProvider({
  activeRanch,
  ranches,
  children,
}: RanchProviderProps) {
  const [activeRanchId, setActiveRanchId] = useState(activeRanch?.ranchId ?? null);

  const resolvedActiveRanch = useMemo(() => {
    if (activeRanchId) {
      return ranches.find((ranch) => ranch.ranchId === activeRanchId) ?? null;
    }
    return activeRanch;
  }, [activeRanch, activeRanchId, ranches]);

  const setActiveRanch = useCallback((ranchId: string) => {
    const nextRanch = ranches.find((ranch) => ranch.ranchId === ranchId);
    if (!nextRanch) return;
    setActiveRanchId(nextRanch.ranchId);
    persistActiveRanchCookie(nextRanch.ranchId);
  }, [ranches]);

  const value = useMemo(() => ({
    activeRanch: resolvedActiveRanch,
    ranches,
    setActiveRanch,
  }), [resolvedActiveRanch, ranches, setActiveRanch]);

  return (
    <RanchContext.Provider value={value}>
      {children}
    </RanchContext.Provider>
  );
}

export function useRanch() {
  return useContext(RanchContext);
}
