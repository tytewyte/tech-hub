import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  selectedSystem: null,
  diagnosticSteps: [],
  currentStep: 0,
  userResponses: {},
  troubleshootingHistory: [],
  knowledgeBase: null,
  loading: false,
  error: null,
};

const hvacSlice = createSlice({
  name: 'hvac',
  initialState,
  reducers: {
    setSelectedSystem: (state, action) => {
      state.selectedSystem = action.payload;
    },
    setDiagnosticSteps: (state, action) => {
      state.diagnosticSteps = action.payload;
    },
    setCurrentStep: (state, action) => {
      state.currentStep = action.payload;
    },
    addUserResponse: (state, action) => {
      state.userResponses[action.payload.step] = action.payload.response;
    },
    addToHistory: (state, action) => {
      state.troubleshootingHistory.push(action.payload);
    },
    setKnowledgeBase: (state, action) => {
      state.knowledgeBase = action.payload;
    },
    setLoading: (state, action) => {
      state.loading = action.payload;
    },
    setError: (state, action) => {
      state.error = action.payload;
    },
    resetState: (state) => {
      return initialState;
    },
  },
});

export const {
  setSelectedSystem,
  setDiagnosticSteps,
  setCurrentStep,
  addUserResponse,
  addToHistory,
  setKnowledgeBase,
  setLoading,
  setError,
  resetState,
} = hvacSlice.actions;

export default hvacSlice.reducer;