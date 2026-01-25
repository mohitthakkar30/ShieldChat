"use client";

import { createContext, useContext, useMemo, ReactNode } from "react";
import { Connection } from "@solana/web3.js";
import { RPC_ENDPOINT } from "@/lib/constants";

interface SolanaConnectionContextType {
  connection: Connection;
}

const SolanaConnectionContext = createContext<SolanaConnectionContextType | null>(null);

interface SolanaConnectionProviderProps {
  children: ReactNode;
}

export function SolanaConnectionProvider({ children }: SolanaConnectionProviderProps) {
  const connection = useMemo(
    () => new Connection(RPC_ENDPOINT, "confirmed"),
    []
  );

  return (
    <SolanaConnectionContext.Provider value={{ connection }}>
      {children}
    </SolanaConnectionContext.Provider>
  );
}

export function useSolanaConnection() {
  const context = useContext(SolanaConnectionContext);
  if (!context) {
    throw new Error("useSolanaConnection must be used within a SolanaConnectionProvider");
  }
  return context;
}

// Alias for backwards compatibility with existing code using useConnection
export const useConnection = useSolanaConnection;
