import {createSlice, PayloadAction} from '@reduxjs/toolkit';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface UIState {
  toasts: Toast[];
  isRefreshing: boolean;
  activeModal: string | null;
  modalData: unknown;
  bottomSheetContent: string | null;
}

const initialState: UIState = {
  toasts: [],
  isRefreshing: false,
  activeModal: null,
  modalData: null,
  bottomSheetContent: null,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    showToast(state, action: PayloadAction<Omit<Toast, 'id'>>) {
      const id = Date.now().toString();
      state.toasts.push({...action.payload, id});
    },
    hideToast(state, action: PayloadAction<string>) {
      state.toasts = state.toasts.filter(toast => toast.id !== action.payload);
    },
    clearToasts(state) {
      state.toasts = [];
    },
    setRefreshing(state, action: PayloadAction<boolean>) {
      state.isRefreshing = action.payload;
    },
    openModal(state, action: PayloadAction<{modal: string; data?: unknown}>) {
      state.activeModal = action.payload.modal;
      state.modalData = action.payload.data ?? null;
    },
    closeModal(state) {
      state.activeModal = null;
      state.modalData = null;
    },
    openBottomSheet(state, action: PayloadAction<string>) {
      state.bottomSheetContent = action.payload;
    },
    closeBottomSheet(state) {
      state.bottomSheetContent = null;
    },
  },
});

export const {
  showToast,
  hideToast,
  clearToasts,
  setRefreshing,
  openModal,
  closeModal,
  openBottomSheet,
  closeBottomSheet,
} = uiSlice.actions;

export default uiSlice.reducer;

// Selectors
export const selectToasts = (state: {ui: UIState}) => state.ui.toasts;
export const selectIsRefreshing = (state: {ui: UIState}) => state.ui.isRefreshing;
export const selectActiveModal = (state: {ui: UIState}) => state.ui.activeModal;
export const selectModalData = (state: {ui: UIState}) => state.ui.modalData;
export const selectBottomSheetContent = (state: {ui: UIState}) => state.ui.bottomSheetContent;
