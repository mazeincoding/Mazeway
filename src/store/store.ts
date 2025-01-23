import { create } from "zustand";

interface Store {
  // Loading states
  isFetching: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
  
  // Error states
  fetchError: string | null;
  updateError: string | null;
  deleteError: string | null;

  // Actions
  setFetching: (isFetching: boolean) => void;
  setUpdating: (isUpdating: boolean) => void;
  setDeleting: (isDeleting: boolean) => void;
  
  setFetchError: (error: string | null) => void;
  setUpdateError: (error: string | null) => void; 
  setDeleteError: (error: string | null) => void;

  // Reset all states
  reset: () => void;
}

export const useStore = create<Store>((set) => ({
  // Initial loading states
  isFetching: false,
  isUpdating: false,
  isDeleting: false,

  // Initial error states  
  fetchError: null,
  updateError: null,
  deleteError: null,

  // Loading setters
  setFetching: (isFetching) => set({ isFetching }),
  setUpdating: (isUpdating) => set({ isUpdating }),
  setDeleting: (isDeleting) => set({ isDeleting }),

  // Error setters
  setFetchError: (fetchError) => set({ fetchError }),
  setUpdateError: (updateError) => set({ updateError }),
  setDeleteError: (deleteError) => set({ deleteError }),

  // Reset function
  reset: () => set({
    isFetching: false,
    isUpdating: false, 
    isDeleting: false,
    fetchError: null,
    updateError: null,
    deleteError: null
  })
}));
