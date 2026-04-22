'use client';

import { createContext, useContext } from 'react';

export type RanchAccess = {
  ranchId: string;
  ranchName: string;
  role: 'owner' | 'member';
};

type RanchContextValue = {
  activeRanch: RanchAccess | null;
  ranches: RanchAccess[];
};

const RanchContext = createContext<RanchContextValue>({
  activeRanch: null,
  ranches: [],
});

export function RanchProvider({
  activeRanch,
  ranches,
  children,
}: React.PropsWithChildren<RanchContextValue>) {
  return (
    <RanchContext.Provider value={{ activeRanch, ranches }}>
      {children}
    </RanchContext.Provider>
  );
}

export function useRanch() {
  return useContext(RanchContext);
}
