import { AnimationGenerator } from './components/AnimationGenerator.js';

class App {
  constructor() {
    this.apiKey = null;
    this.generator = null;
    this.initialize();
  }

  initialize() {
    // Ensure animation container exists
    const container = document.getElementById('animation-container');
    if (!container) {
      const main = document.querySelector('main') || document.body;
      const newContainer = document.createElement('div');
      newContainer.id = 'animation-container';
      newContainer.className = 'mt-4';
      main.appendChild(newContainer);
    }

    // Set up API key input
    const apiKeyInput = document.getElementById('api-key');
    if (apiKeyInput) {
      apiKeyInput.addEventListener('change', (e) => {
        this.apiKey = e.target.value;
        if (this.apiKey) {
          this.initializeGenerator();
        }
      });
    }

    // Set up generation form
    const generateForm = document.getElementById('generate-form');
    if (generateForm) {
      generateForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleGenerate();
      });
    }

    // Add error display container
    const errorContainer = document.createElement('div');
    errorContainer.id = 'error-container';
    errorContainer.className = 'mt-4';
    document.getElementById('animation-container').appendChild(errorContainer);
  }

  initializeGenerator() {
    try {
      if (this.generator) {
        this.generator.cleanup();
      }
      this.generator = new AnimationGenerator('animation-container', this.apiKey);
    } catch (error) {
      console.error('Failed to initialize generator:', error);
      this.showError('Failed to initialize: ' + error.message);
    }
  }

  async handleGenerate() {
    if (!this.generator) {
      this.showError('Please enter your API key first');
      return;
    }

    const styleSelect = document.getElementById('style-select');
    const actionSelect = document.getElementById('action-select');
    const referenceInput = document.getElementById('reference-image');

    if (!styleSelect || !actionSelect) {
      this.showError('Required form elements are missing');
      return;
    }

    const styleId = styleSelect.value;
    const actionId = actionSelect.value;
    const referenceImage = referenceInput?.files[0];

    // Clear previous error
    this.clearError();

    // If we have a reference image, process it
    let referenceToken = 'REF_CHAR';
    if (referenceImage) {
      try {
        referenceToken = await this.processReferenceImage(referenceImage);
      } catch (error) {
        this.showError('Failed to process reference image: ' + error.message);
        return;
      }
    }

    // Start generation with loading state
    const generateButton = document.getElementById('generate-button');
    if (generateButton) {
      generateButton.disabled = true;
    }

    try {
      await this.generator.generateAnimation(styleId, actionId, referenceToken);
    } catch (error) {
      console.error('Generation failed:', error);
      this.showError('Failed to generate animation: ' + error.message);
    } finally {
      if (generateButton) {
        generateButton.disabled = false;
      }
    }
  }

  async processReferenceImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const base64 = reader.result.split(',')[1];
          resolve(`data:image/png;base64,${base64}`);
        } catch (error) {
          reject(new Error('Invalid image format'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read image'));
      reader.readAsDataURL(file);
    });
  }

  showError(message) {
    const errorContainer = document.getElementById('error-container');
    if (errorContainer) {
      errorContainer.innerHTML = `
        <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <strong class="font-bold">Error!</strong>
          <span class="block sm:inline"> ${message}</span>
        </div>
      `;
    }
  }

  clearError() {
    const errorContainer = document.getElementById('error-container');
    if (errorContainer) {
      errorContainer.innerHTML = '';
    }
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
}); 