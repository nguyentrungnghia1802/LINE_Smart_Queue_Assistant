import { createContext, useContext } from 'react';

import type { LiffContext } from '../types/liff';

const LiffRuntimeContext = createContext<LiffContext | null>(null);

export const LiffRuntimeProvider = LiffRuntimeContext.Provider;

export function useLiffRuntime(): LiffContext {
  const context = useContext(LiffRuntimeContext);
  if (!context) {
    throw new Error('useLiffRuntime must be used inside LiffRuntimeProvider');
  }
  return context;
}
