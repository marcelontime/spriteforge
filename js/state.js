// Global state management
let state = {
  apiKey: '',
  uploadedImage: null,
  selectedStyle: null,
  selectedAction: null,
  generatedStyles: [],
  generatedFrames: [],
  currentReferenceToken: null,
  selectedModel: 'gpt-image-1' // Set default model
};

// Constants
const STORAGE_KEYS = {
  API_KEY: 'openai_api_key'
};

export function getState() {
  return state;
}

export function updateState(newState) {
  state = { ...state, ...newState };
  
  // Persist API key to localStorage if it's being updated
  if (newState.apiKey !== undefined) {
    localStorage.setItem(STORAGE_KEYS.API_KEY, newState.apiKey);
  }
  
  updateUIState();
}

// Update UI elements based on state
export function updateUIState() {
  const apiKeyInput = document.getElementById('apiKey');
  if (apiKeyInput && state.apiKey) {
    apiKeyInput.value = state.apiKey;
  }
}

// Initialize state from localStorage
document.addEventListener('DOMContentLoaded', () => {
  const apiKeyInput = document.getElementById('apiKey');
  if (apiKeyInput) {
    const savedApiKey = localStorage.getItem(STORAGE_KEYS.API_KEY);
    if (savedApiKey) {
      updateState({ apiKey: savedApiKey });
    }
  }
});

// Local storage management
export const storage = {
  getApiKey: () => localStorage.getItem(STORAGE_KEYS.API_KEY),
  setApiKey: (key) => localStorage.setItem(STORAGE_KEYS.API_KEY, key.trim()),
};

// State updates
export function updateSourceImage(file) {
  state.sourceImageFile = file;
}

export function updateChosenStyle(style) {
  state.chosenStyle = style;
}

export function resetStyleChoice() {
  state.chosenStyle = null;
} 