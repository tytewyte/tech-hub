import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  currentScreen: 'welcome',
  isModalOpen: false,
  modalContent: null,
  notifications: [],
  theme: 'light',
  loading: false,
  globalError: null,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setCurrentScreen: (state, action) => {
      state.currentScreen = action.payload;
    },
    setModalState: (state, action) => {
      state.isModalOpen = action.payload.isOpen;
      state.modalContent = action.payload.content;
    },
    addNotification: (state, action) => {
      state.notifications.push(action.payload);
    },
    removeNotification: (state, action) => {
      state.notifications = state.notifications.filter(
        (notif) => notif.id !== action.payload
      );
    },
    setTheme: (state, action) => {
      state.theme = action.payload;
    },
    setLoading: (state, action) => {
      state.loading = action.payload;
    },
    setGlobalError: (state, action) => {
      state.globalError = action.payload;
    },
  },
});

export const {
  setCurrentScreen,
  setModalState,
  addNotification,
  removeNotification,
  setTheme,
  setLoading,
  setGlobalError,
} = uiSlice.actions;

export default uiSlice.reducer;