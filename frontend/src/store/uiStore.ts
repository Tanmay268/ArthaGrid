import { create } from 'zustand';

interface UiState {
  mobileNavOpen: boolean;
  setMobileNav: (open: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  mobileNavOpen: false,
  setMobileNav: (mobileNavOpen) => set({ mobileNavOpen }),
}));
