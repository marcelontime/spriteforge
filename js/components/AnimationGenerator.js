import { SpriteAnimationManager } from '../SpriteAnimationManager.js';

export class AnimationGenerator {
  constructor(containerId, apiKey) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      throw new Error(`Container with id '${containerId}' not found`);
    }
    
    this.manager = new SpriteAnimationManager(apiKey);
    this.frames = new Map();
    this.setupUI();
    this.initializeManager();
  }

  setupUI() {
    // Create frame container
    this.frameContainer = document.createElement('div');
    this.frameContainer.className = 'frame-container grid grid-cols-5 gap-4 mt-4 p-4';
    this.container.appendChild(this.frameContainer);

    // Create progress indicator
    this.progressIndicator = document.createElement('div');
    this.progressIndicator.className = 'progress-bar mt-4 p-4';
    this.container.appendChild(this.progressIndicator);

    // Create final animation preview
    this.animationPreview = document.createElement('div');
    this.animationPreview.className = 'animation-preview mt-8 p-4';
    this.container.appendChild(this.animationPreview);

    // Create loading indicator
    this.loadingIndicator = document.createElement('div');
    this.loadingIndicator.className = 'loading-indicator text-center p-4';
    this.loadingIndicator.innerHTML = `
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      <div class="mt-2">Generating frames...</div>
    `;
    this.loadingIndicator.style.display = 'none';
    this.container.appendChild(this.loadingIndicator);
  }

  initializeManager() {
    this.manager.initialize();

    // Set up event handlers
    this.manager.onFrameComplete = (frameIndex, imageData) => {
      this.updateFrame(frameIndex, imageData);
      this.updateProgress();
    };

    this.manager.onAnimationComplete = (frames) => {
      this.showFinalAnimation(frames);
      this.loadingIndicator.style.display = 'none';
    };

    this.manager.onError = (frameIndex, error) => {
      this.showError(frameIndex, error);
      this.loadingIndicator.style.display = 'none';
    };
  }

  updateFrame(frameIndex, imageData) {
    // Create or update frame display
    let frameElement = this.frames.get(frameIndex);
    
    if (!frameElement) {
      frameElement = document.createElement('div');
      frameElement.className = 'frame-item relative bg-white rounded-lg shadow-lg overflow-hidden';
      
      const img = document.createElement('img');
      img.className = 'w-full h-auto';
      frameElement.appendChild(img);
      
      const label = document.createElement('div');
      label.className = 'absolute top-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-sm';
      label.textContent = `Frame ${frameIndex + 1}`;
      frameElement.appendChild(label);
      
      // Add to container in the correct order
      let inserted = false;
      for (const [existingIndex, existingFrame] of this.frames.entries()) {
        if (frameIndex < existingIndex) {
          this.frameContainer.insertBefore(frameElement, existingFrame);
          inserted = true;
          break;
        }
      }
      if (!inserted) {
        this.frameContainer.appendChild(frameElement);
      }
      
      this.frames.set(frameIndex, frameElement);
    }

    // Update image with fade-in effect
    const img = frameElement.querySelector('img');
    img.style.opacity = '0';
    img.src = `data:image/png;base64,${imageData}`;
    img.onload = () => {
      img.style.transition = 'opacity 0.3s ease-in';
      img.style.opacity = '1';
    };
  }

  updateProgress() {
    const total = this.manager.getActionFrameCount();
    const completed = this.frames.size;
    const percent = (completed / total) * 100;
    
    this.progressIndicator.innerHTML = `
      <div class="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
        <div class="bg-blue-600 h-2.5 rounded-full transition-all duration-300" style="width: ${percent}%"></div>
      </div>
      <div class="text-sm mt-2 text-center">${completed} of ${total} frames complete</div>
    `;
  }

  showFinalAnimation(frames) {
    if (frames.length === 0) return;

    // Create animation display
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    let currentFrame = 0;
    let images = [];
    
    // Show loading message
    this.animationPreview.innerHTML = '<div class="text-center">Loading animation preview...</div>';

    // Load all images
    Promise.all(frames.map(frame => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Failed to load frame'));
        img.src = `data:image/png;base64,${frame}`;
      });
    }))
    .then(loadedImages => {
      images = loadedImages;
      
      // Set canvas size
      canvas.width = images[0].width;
      canvas.height = images[0].height;
      canvas.className = 'mx-auto border rounded-lg shadow-lg';
      
      // Animation settings
      const fps = 12;
      const frameTime = 1000 / fps;
      let lastTime = 0;
      
      // Start animation loop
      const animate = (timestamp) => {
        if (timestamp - lastTime >= frameTime) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(images[currentFrame], 0, 0);
          currentFrame = (currentFrame + 1) % images.length;
          lastTime = timestamp;
        }
        requestAnimationFrame(animate);
      };
      
      // Clear previous animation if any
      this.animationPreview.innerHTML = '';
      this.animationPreview.appendChild(canvas);
      
      animate(0);
    })
    .catch(error => {
      this.animationPreview.innerHTML = `
        <div class="error-message bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <strong>Error creating animation:</strong>
          <p>${error.message}</p>
        </div>
      `;
    });
  }

  showError(frameIndex, error) {
    const frameElement = this.frames.get(frameIndex);
    if (frameElement) {
      frameElement.innerHTML = `
        <div class="error-message bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <strong>Error generating frame ${frameIndex + 1}:</strong>
          <p>${error}</p>
        </div>
      `;
    }
  }

  async generateAnimation(styleId, actionId, referenceToken, seed) {
    try {
      // Clear previous results
      this.frameContainer.innerHTML = '';
      this.frames.clear();
      this.animationPreview.innerHTML = '';
      
      // Show loading indicator
      this.loadingIndicator.style.display = 'block';
      
      // Start generation
      await this.manager.generateAnimation(styleId, actionId, referenceToken, seed);
    } catch (error) {
      console.error('Animation generation failed:', error);
      this.container.innerHTML = `
        <div class="error-message bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mt-4">
          <strong>Failed to generate animation:</strong>
          <p>${error.message}</p>
        </div>
      `;
      this.loadingIndicator.style.display = 'none';
    }
  }

  cleanup() {
    this.manager.cleanup();
  }
} 