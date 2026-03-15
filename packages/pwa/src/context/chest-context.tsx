import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { useAuth } from '../auth/context';

interface ChestItem {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  isAutoCreated: boolean;
  _count?: { memories: number };
}

interface ChestContextValue {
  chests: ChestItem[];
  activeChest: ChestItem | null;
  setActiveChest: (chest: ChestItem) => void;
  refreshChests: () => Promise<void>;
  loading: boolean;
}

const ChestContext = createContext<ChestContextValue | null>(null);

const STORAGE_KEY = 'cc_active_chest';

export function ChestProvider({ children }: { children: ReactNode }) {
  const { client } = useAuth();
  const [chests, setChests] = useState<ChestItem[]>([]);
  const [activeChest, setActiveChestState] = useState<ChestItem | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshChests = useCallback(async () => {
    if (!client) return;
    try {
      const result = await client.listChests();
      setChests(result.data);
      const savedName = localStorage.getItem(STORAGE_KEY);
      const saved = result.data.find((c) => c.name === savedName);
      const defaultChest = result.data.find((c) => c.name === 'default');
      const target = saved ?? defaultChest ?? result.data[0] ?? null;
      if (target) {
        setActiveChestState(target);
        client.setChestName(target.name);
      }
    } catch {
      // Non-critical
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => { refreshChests(); }, [refreshChests]);

  const setActiveChest = useCallback((chest: ChestItem) => {
    setActiveChestState(chest);
    localStorage.setItem(STORAGE_KEY, chest.name);
    if (client) client.setChestName(chest.name);
  }, [client]);

  return (
    <ChestContext.Provider value={{ chests, activeChest, setActiveChest, refreshChests, loading }}>
      {children}
    </ChestContext.Provider>
  );
}

export function useChest(): ChestContextValue {
  const ctx = useContext(ChestContext);
  if (!ctx) throw new Error('useChest must be used within ChestProvider');
  return ctx;
}
