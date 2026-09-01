import { create } from 'zustand';

export const useUIStore = create<{
  isLoginOpen: boolean;
  isConnectOpen: boolean;
  setLoginOpen: (open: boolean) => void;
  setConnectOpen: (open: boolean) => void;
}>((set) => ({
  isLoginOpen: false,
  isConnectOpen: false,
  setLoginOpen: (open) => set({ isLoginOpen: open }),
  setConnectOpen: (open) => set({ isConnectOpen: open }),
}));

export const useTimeStore = create<{ now: number; update: () => void }>((set) => ({
  now: Date.now(),
  update: () => set({ now: Date.now() }),
}));

export const useAccountStore = create<any>((set) => ({
  data: { machines: [] },
  isInitializing: true,
  setData: (newData: any) => set((state: any) => ({ data: { ...state.data, ...newData } })),
  clearData: () => set({ data: { machines: [] } }),
  setInitializing: (val: boolean) => set({ isInitializing: val })
}));

export const useMachinesStore = create<{ machines: Record<string, any> }>((set) => ({
  machines: {},
}));

export const useNodeStore = create<{ active: boolean; loading: boolean }>((set) => ({
  active: false,
  loading: false,
}));

export const useMachineStore = create<{ states: Record<string, any> }>((set) => ({
  states: {},
}));
