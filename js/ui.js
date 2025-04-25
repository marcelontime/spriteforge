import { generateSpriteStyles, generateSpriteAction, callOpenAIEdit } from './api.js';
import { getState, updateState, updateUIState } from './state.js';
import { STYLE_PROMPTS, ACTION_PROMPTS, generateSpritePrompt } from './prompts.js';
import { CostCalculator } from './costCalculator.js';

// Global framePrompts map to store custom prompts for each frame
window.framePrompts = window.framePrompts || new Map();
const framePrompts = window.framePrompts;

// Constants for standardized image sizing
const STANDARD_IMAGE_WIDTH = 128;
const STANDARD_IMAGE_HEIGHT = 128;

// Add JSZip import (add this to your HTML)
// <script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>

// UI Elements
const imageUpload = document.getElementById('imageUpload');
const preview = document.getElementById('preview');
const generateStylesBtn = document.getElementById('toStep2');
const loader = document.getElementById('loader');
const stylesGrid = document.getElementById('stylesGrid');
const actionsPanel = document.getElementById('actionsPanel');
const actionSelect = document.getElementById('actionSelect');
const generateActionBtn = document.getElementById('generateActionBtn');
const actionResult = document.getElementById('actionResult');
const apiKeyInput = document.getElementById('apiKey');
const downloadAllBtn = document.getElementById('downloadAllBtn');

// Create usage counter element
const usageCounter = document.createElement('div');
usageCounter.className = 'fixed top-4 right-4 bg-gray-800 rounded-lg p-3 shadow-lg border border-gray-700 z-50';
usageCounter.innerHTML = `
  <div class="flex items-center gap-4">
    <div class="flex items-center gap-2">
      <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
              d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"/>
      </svg>
      <span id="currentCost" class="font-mono font-medium text-gray-200">$0.00</span>
    </div>
    <div class="flex items-center gap-2">
      <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
      </svg>
      <span id="imagesGenerated" class="font-mono font-medium text-gray-200">0</span>
    </div>
  </div>
`;
document.body.appendChild(usageCounter);

// Create modal elements for image preview
const modal = document.createElement('div');
modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] hidden';
modal.id = 'imageModal';

const modalContent = document.createElement('div');
modalContent.className = 'relative bg-transparent max-w-full';
modal.appendChild(modalContent);

const modalImage = document.createElement('img');
modalImage.className = 'max-w-full max-h-[90vh] object-contain rounded-lg shadow-lg';
modalImage.style.width = `${STANDARD_IMAGE_WIDTH * 3}px`;
modalImage.style.height = `${STANDARD_IMAGE_HEIGHT * 3}px`;
modalContent.appendChild(modalImage);

const closeButton = document.createElement('button');
closeButton.className = 'absolute top-3 right-3 bg-gray-900 bg-opacity-50 hover:bg-opacity-75 text-white hover:text-gray-300 rounded-full p-2 cursor-pointer';
closeButton.innerHTML = '✕';
closeButton.onclick = () => modal.classList.add('hidden');
modalContent.appendChild(closeButton);

// Append modal to body at the top level to avoid z-index issues
document.body.insertBefore(modal, document.body.firstChild);

// Close modal when clicking outside the image
modal.addEventListener('click', (e) => {
  if (e.target === modal) {
    modal.classList.add('hidden');
  }
});

// Function to show image in modal
function showImageModal(imageUrl) {
  modalImage.src = imageUrl;
  modal.classList.remove('hidden');
}

// Initialize state with fixed model
updateState({
  selectedModel: 'gpt-image-1'
});

// Initialize cost calculator
const costCalculator = new CostCalculator();

// Update current usage display - simplified to only update the counter
function updateCurrentUsage() {
    const usage = costCalculator.getCurrentUsage();
    const imagesGenerated = document.getElementById('imagesGenerated');
    const currentCost = document.getElementById('currentCost');
    
    if (imagesGenerated && currentCost) {
        imagesGenerated.textContent = usage.totalImages;
        currentCost.textContent = usage.formattedTotal;
        
        // Add a subtle animation effect
        imagesGenerated.classList.add('scale-110', 'text-primary-400');
        currentCost.classList.add('scale-110', 'text-primary-400');
        
        setTimeout(() => {
            imagesGenerated.classList.remove('scale-110', 'text-primary-400');
            currentCost.classList.remove('scale-110', 'text-primary-400');
        }, 200);
    }
}

// Remove model selection event listener and related code
document.addEventListener('DOMContentLoaded', () => {
  // Initialize with GPT-Image-1 model
  const apiKeyInput = document.getElementById('apiKey');
  const imageUpload = document.getElementById('imageUpload');
  const generateStylesBtn = document.getElementById('toStep2');
  const generateActionBtn = document.getElementById('generateActionBtn');
  
  // Load API key from localStorage if available
  const savedApiKey = localStorage.getItem('apiKey');
  if (savedApiKey && apiKeyInput) {
    apiKeyInput.value = savedApiKey;
    updateState({ apiKey: savedApiKey });
  }
  
  // Initialize UI state
  updateUIState();
  
  // Update cost display initially
  updateCurrentUsage();
  
  // Event listeners
  if (apiKeyInput) {
    apiKeyInput.addEventListener('change', (e) => {
      updateState({ apiKey: e.target.value });
      // Save to localStorage
      localStorage.setItem('apiKey', e.target.value);
    });
  }

  // Handle file upload
  if (imageUpload) {
    imageUpload.addEventListener('change', function(e) {
      const file = e.target.files[0];
      if (file) {
        // Validate file size (max 4MB)
        if (file.size > 4 * 1024 * 1024) {
          alert('Please select an image under 4MB');
          this.value = '';
          return;
        }

        // Show preview and convert to PNG
        const reader = new FileReader();
        reader.onload = function(e) {
          // Create an image element to draw to canvas
          const img = new Image();
          img.onload = function() {
            // Create canvas
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Set to standard size
            canvas.width = STANDARD_IMAGE_WIDTH;
            canvas.height = STANDARD_IMAGE_HEIGHT;
            
            // Fill with transparent background
            ctx.fillStyle = 'rgba(0, 0, 0, 0)';
            ctx.fillRect(0, 0, STANDARD_IMAGE_WIDTH, STANDARD_IMAGE_HEIGHT);
            
            // Draw image centered and scaled to fit
            const scale = Math.min(
              STANDARD_IMAGE_WIDTH / img.width,
              STANDARD_IMAGE_HEIGHT / img.height
            );
            
            const scaledWidth = img.width * scale;
            const scaledHeight = img.height * scale;
            const x = (STANDARD_IMAGE_WIDTH - scaledWidth) / 2;
            const y = (STANDARD_IMAGE_HEIGHT - scaledHeight) / 2;
            
            // Use better image smoothing
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, x, y, scaledWidth, scaledHeight);
            
            // Convert to PNG blob with compression
            canvas.toBlob(function(blob) {
              // Create a File object from the blob
              const pngFile = new File([blob], 'image.png', { 
                type: 'image/png',
                lastModified: Date.now()
              });
              
              // Log size reduction
              console.log('Image processing complete:', {
                originalSize: file.size,
                newSize: pngFile.size,
                originalDimensions: `${img.width}x${img.height}`,
                newDimensions: `${scaledWidth}x${scaledHeight}`,
                finalDimensions: `${STANDARD_IMAGE_WIDTH}x${STANDARD_IMAGE_HEIGHT}`
              });
              
              // Update state with PNG file
              updateState({ uploadedImage: pngFile });
              
              // Show preview
              const previewContainer = document.getElementById('imagePreview');
              const previewImage = document.getElementById('previewImage');
              if (previewContainer && previewImage) {
                previewImage.src = URL.createObjectURL(blob);
                previewContainer.classList.remove('hidden');
              }
              
              // Enable generate button if we have an API key
              const state = getState();
              if (generateStylesBtn && state.apiKey) {
                generateStylesBtn.disabled = false;
              }
            }, 'image/png', 0.8); // Added compression quality
          };
          img.src = e.target.result;
        };
        reader.readAsDataURL(file);
      } else {
        // Hide preview and disable button if no file
        const previewContainer = document.getElementById('imagePreview');
        if (previewContainer) {
          previewContainer.classList.add('hidden');
        }
        if (generateStylesBtn) {
          generateStylesBtn.disabled = true;
        }
        updateState({ uploadedImage: null });
      }
    });
  }
});

// Handle generate button click - update for wizard flow
document.addEventListener('DOMContentLoaded', () => {
  // This function is now primarily for backward compatibility
  // The wizard.js now handles style generation with the generateSingleStyle function
  const handleGenerateStyles = async function() {
    try {
      // Validate API key
      const state = getState();
      if (!state.apiKey) {
        alert('Please enter your OpenAI API key');
        apiKeyInput.focus();
        return;
      }

      // This function is now a no-op since we're generating styles on-demand
      // when the user clicks on a style card
      console.log('Style generation now happens when a style is selected');
    } catch (error) {
      console.error('Error in style generation:', error);
      alert(error.message || 'Failed to generate styles. Please try again.');
    }
  };

  // Connect to wizard.js for style generation
  window.generateStyles = handleGenerateStyles;
});

// Handle action selection
actionSelect.addEventListener('change', function() {
  generateActionBtn.disabled = !this.value;
  updateState({ selectedAction: this.value });
});

// Function to create and download zip
async function downloadFramesAsZip(frames) {
  const zip = new JSZip();
  const selectedStyle = getState().selectedStyle;
  const selectedAction = getState().selectedAction;
  
  // Add each frame to the zip
  frames.forEach((frame, index) => {
    // Convert data URL to blob
    const imageData = frame.imageUrl.split(',')[1];
    const fileName = `${selectedStyle}_${selectedAction}_${String(index).padStart(2, '0')}.png`;
    zip.file(fileName, imageData, {base64: true});
  });
  
  // Generate and download the zip
  const content = await zip.generateAsync({type: 'blob'});
  const downloadUrl = URL.createObjectURL(content);
  
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = `${selectedStyle}_${selectedAction}_frames.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(downloadUrl);
}

// Frame editing modal elements
const editModal = document.createElement('div');
editModal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] hidden';
editModal.id = 'frameEditModal';

const editContent = document.createElement('div');
editContent.className = 'relative bg-gray-800 p-8 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-auto text-gray-100';
editModal.appendChild(editContent);

// Append edit modal to body at the top level to avoid z-index issues
document.body.insertBefore(editModal, document.body.firstChild);

// Update the frame display template to include edit button
function updateActionFramesDisplay(frames = []) {
  const state = getState();
  const action = ACTION_PROMPTS[state.selectedAction];
  const frameCount = action ? action.frames : 0;

  actionResult.innerHTML = `
    <div class="action-frames-section">
      <div class="action-frames-grid">
        ${Array(frameCount).fill(0).map((_, i) => {
          const frame = frames.find(f => f.frameIndex === i);
          if (frame && frame.imageUrl) {
            return `
              <div class="frame-container" data-frame="${i}">
                <span class="frame-number">Frame ${String(i + 1).padStart(2, '0')}/${frameCount}</span>
                <div class="frame-controls">
                  <button class="frame-button" onclick="showFrameEditModal(${i})" 
                          title="Edit and regenerate this frame">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
                    </svg>
                  </button>
                </div>
                <div class="sprite-container" style="width: ${STANDARD_IMAGE_WIDTH}px; height: ${STANDARD_IMAGE_HEIGHT}px; margin: 0 auto;">
                  <img src="${frame.imageUrl}" 
                       alt="Frame ${i + 1}/${frameCount}" 
                       class="w-full h-full object-contain rounded-lg bg-gray-800 cursor-zoom-in hover:opacity-90 transition-opacity" 
                       onclick="showImageModal('${frame.imageUrl}')" />
                </div>
              </div>
            `;
          } else if (frame && frame.error) {
            return `
              <div class="frame-container" data-frame="${i}">
                <span class="frame-number">Frame ${String(i + 1).padStart(2, '0')}/${frameCount}</span>
                <div class="error-state">
                  <div class="text-center">
                    <p class="error-message">Generation Failed</p>
                    <p class="error-details">${frame.error}</p>
                    <button class="frame-button mt-4" onclick="showFrameEditModal(${i})"
                            title="Try regenerating this frame">
                      Try Again
                    </button>
                  </div>
                </div>
              </div>
            `;
          } else {
            return `
              <div class="frame-container" data-frame="${i}">
                <span class="frame-number">Frame ${String(i + 1).padStart(2, '0')}/${frameCount}</span>
                <div class="loading-state">
                  <div class="loading-spinner"></div>
                  <p class="loading-text">Generating...</p>
                </div>
              </div>
            `;
          }
        }).join('')}
      </div>
      ${frames.some(f => f.imageUrl) ? `
        <div class="flex justify-center gap-4 mt-6">
          <button onclick="downloadFramesZip()" class="btn-secondary">
            <svg class="w-5 h-5 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
            </svg>
            Download All Frames
          </button>
        </div>
      ` : ''}
    </div>
  `;
}

// Function to show frame edit modal
async function showFrameEditModal(frameIndex) {
  const state = getState();
  const frame = state.generatedFrames?.find(f => f.frameIndex === frameIndex);
  
  // Get or generate the prompt for this frame
  let prompt = framePrompts.get(frameIndex);
  if (!prompt) {
    prompt = generateSpritePrompt(
      state.selectedStyle,
      state.selectedAction,
      state.currentReferenceToken,
      undefined,
      frameIndex
    );
    framePrompts.set(frameIndex, prompt);
  }

  editContent.innerHTML = `
    <button class="absolute top-3 right-3 bg-gray-900 bg-opacity-50 hover:bg-opacity-75 text-white hover:text-gray-300 rounded-full p-2 cursor-pointer" onclick="closeFrameEditModal()">✕</button>
    <h3 class="text-xl font-semibold text-gray-100 mb-4">Edit Frame ${frameIndex + 1}</h3>
    <div class="space-y-6">
      <div>
        <label class="block text-sm font-medium text-gray-300 mb-2">
          Customize Generation Prompt
        </label>
        <div class="text-xs text-gray-400 mb-2">
          Edit the prompt below to customize this frame. You can add specific details or modify the existing prompt.
        </div>
        <textarea id="framePrompt" class="w-full min-h-[200px] p-2 border border-gray-600 rounded-md bg-gray-700 text-gray-100 font-mono resize-vertical focus:outline-none focus:border-primary-500">${prompt}</textarea>
      </div>
      <div class="flex justify-end gap-3">
        <button onclick="closeFrameEditModal()" 
                class="px-4 py-2 text-sm font-medium text-gray-200 bg-gray-700 
                       rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 
                       focus:ring-offset-2 focus:ring-gray-500">
          Cancel
        </button>
        <button onclick="regenerateFrame(null, ${frameIndex})"
                class="px-4 py-2 text-sm font-medium text-white bg-primary-500
                       rounded-md hover:bg-primary-600 focus:outline-none focus:ring-2
                       focus:ring-offset-2 focus:ring-primary-400 flex items-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Regenerate Frame
        </button>
      </div>
    </div>
  `;
  
  editModal.classList.remove('hidden');
}

// Function to close frame edit modal
function closeFrameEditModal() {
  editModal.classList.add('hidden');
}

// Function to regenerate a specific frame
async function regenerateFrame(actionId, frameIndex) {
  // If only one parameter is provided, assume it's the frameIndex (for backward compatibility)
  if (frameIndex === undefined) {
    frameIndex = actionId;
    actionId = getState().selectedAction;
  }
  
  const state = getState();
  const customPrompt = document.getElementById('framePrompt').value;
  
  try {
    // Update the frame to loading state
    const frames = [...(state.generatedFrames || [])];
    const frameIdx = frames.findIndex(f => 
      f.frameIndex === frameIndex && 
      (actionId === null || actionId === undefined || f.actionId === actionId)
    );
    
    if (frameIdx !== -1) {
      frames[frameIdx] = { 
        frameIndex, 
        actionId: actionId || state.selectedAction, 
        styleId: state.selectedStyle,
        loading: true 
      };
    } else {
      frames.push({ 
        frameIndex, 
        actionId: actionId || state.selectedAction,
        styleId: state.selectedStyle,
        loading: true 
      });
    }
    
    updateState({ generatedFrames: frames });
    
    // Use wizard's displayActionFrames if it exists, otherwise fallback to updateActionFramesDisplay
    if (typeof displayActionFrames === 'function') {
      displayActionFrames(actionId || state.selectedAction);
    } else {
      updateActionFramesDisplay(frames);
    }
    
    // Find the appropriate input image for this frame regeneration
    let inputImage = null;
    
    // Check if we're using the "original" style
    if (state.selectedStyle === 'original') {
      // For original style, if we're regenerating the first frame, use the uploaded image directly
      if (frameIndex === 0) {
        inputImage = state.uploadedImage;
        console.log('Using original uploaded image for first frame regeneration (Original Style)');
      } else {
        // For later frames in original style, try to use the previous frame for continuity
        const prevFrame = frames.find(f => 
          (f.actionId === actionId || f.actionId === state.selectedAction) && 
          f.styleId === state.selectedStyle && 
          f.frameIndex === frameIndex - 1 &&
          f.imageUrl // Must have valid image
        );
        
        if (prevFrame && prevFrame.imageUrl) {
          console.log('Using previous frame as reference for regeneration (Original Style)');
          try {
            // Convert the previous frame to a File object
            const response = await fetch(prevFrame.imageUrl);
            const blob = await response.blob();
            inputImage = new File([blob], `prev_frame.png`, { type: 'image/png' });
            console.log('Successfully using previous frame as input for regeneration');
          } catch (err) {
            console.warn('Failed to use previous frame, falling back to original upload', err);
            inputImage = state.uploadedImage;
          }
        } else {
          // If no previous frame, use original upload
          inputImage = state.uploadedImage;
        }
      }
    } else {
      // For generated styles, try to use previous frame for continuity
      if (frameIndex > 0) {
        // Find the previous frame in the sequence
        const prevFrame = frames.find(f => 
          (f.actionId === actionId || f.actionId === state.selectedAction) && 
          f.styleId === state.selectedStyle && 
          f.frameIndex === frameIndex - 1 &&
          f.imageUrl // Must have valid image
        );
        
        if (prevFrame && prevFrame.imageUrl) {
          console.log('Using previous frame as reference for regeneration');
          try {
            // Convert the previous frame to a File object
            const response = await fetch(prevFrame.imageUrl);
            const blob = await response.blob();
            inputImage = new File([blob], `prev_frame.png`, { type: 'image/png' });
            console.log('Successfully using previous frame as input for regeneration');
          } catch (err) {
            console.warn('Failed to use previous frame, falling back to styled image', err);
          }
        }
      }
      
      // If we couldn't use previous frame or this is the first frame,
      // try to use styled preview image
      if (frameIndex === 0 || !inputImage) {
        try {
          // Use styled image from preview if available
          const styledImagePreview = document.getElementById('styledImagePreview');
          if (styledImagePreview && styledImagePreview.src && styledImagePreview.src.startsWith('data:image/')) {
            console.log('Using styled image preview for frame regeneration');
            const response = await fetch(styledImagePreview.src);
            const blob = await response.blob();
            inputImage = new File([blob], 'styled_image.png', { type: 'image/png' });
          }
        } catch (err) {
          console.warn('Failed to use styled image, falling back to original upload', err);
        }
      }
    }
    
    // Final fallback to the original image if we haven't set one yet
    if (!inputImage) {
      console.log('No appropriate input image found, using original upload as fallback');
      inputImage = state.uploadedImage;
    }

    // Generate new frame
    const result = await callOpenAIEdit(
      customPrompt,
      inputImage,
      state.apiKey,
      state.selectedModel
    );

    // Update frame with new result
    const updatedFrames = [...(state.generatedFrames || [])];
    const updateIdx = updatedFrames.findIndex(f => 
      f.frameIndex === frameIndex && 
      (actionId === null || actionId === undefined || f.actionId === actionId)
    );
    
    if (updateIdx !== -1) {
      updatedFrames[updateIdx] = { 
        frameIndex, 
        actionId: actionId || state.selectedAction,
        styleId: state.selectedStyle,
        imageUrl: result 
      };
    } else {
      updatedFrames.push({ 
        frameIndex, 
        actionId: actionId || state.selectedAction,
        styleId: state.selectedStyle,
        imageUrl: result 
      });
    }
    
    // Store the custom prompt
    const promptKey = actionId ? `${actionId}_${frameIndex}` : frameIndex;
    framePrompts.set(promptKey, customPrompt);

    // Update state and display
    updateState({ generatedFrames: updatedFrames });
    
    // Use wizard's displayActionFrames if it exists, otherwise fallback to updateActionFramesDisplay
    if (typeof displayActionFrames === 'function') {
      displayActionFrames(actionId || state.selectedAction);
    } else {
      updateActionFramesDisplay(updatedFrames);
    }
    
    // Add cost for generation with actual prompt
    if (typeof costCalculator !== 'undefined' && typeof updateCurrentUsage === 'function') {
      costCalculator.addImageGeneration(customPrompt, {
          referenceWidth: 512,
          referenceHeight: 512,
          outputWidth: 512,
          outputHeight: 512,
          quality: 'medium'
      });
      updateCurrentUsage();
    }

    // Close modal
    closeFrameEditModal();
  } catch (error) {
    console.error(`Error regenerating frame ${frameIndex}:`, error);
    
    // Update frame with error state
    const frames = [...(state.generatedFrames || [])];
    const frameIdx = frames.findIndex(f => 
      f.frameIndex === frameIndex && 
      (actionId === null || actionId === undefined || f.actionId === actionId)
    );
    
    if (frameIdx !== -1) {
      frames[frameIdx] = { 
        frameIndex, 
        actionId: actionId || state.selectedAction,
        styleId: state.selectedStyle,
        error: error.message || 'Generation failed' 
      };
    } else {
      frames.push({ 
        frameIndex, 
        actionId: actionId || state.selectedAction,
        styleId: state.selectedStyle,
        error: error.message || 'Generation failed' 
      });
    }
    
    // Update state and display
    updateState({ generatedFrames: frames });
    if (typeof displayActionFrames === 'function') {
      displayActionFrames(actionId || state.selectedAction);
    } else {
      updateActionFramesDisplay(frames);
    }
    
    alert(error.message || 'Failed to regenerate frame. Please try again.');
  }
}

// Make functions available globally
window.showFrameEditModal = showFrameEditModal;
window.closeFrameEditModal = closeFrameEditModal;
window.regenerateFrame = regenerateFrame;
window.downloadFramesZip = downloadFramesAsZip;
window.showImageModal = showImageModal;

// New animation preview function for the Step 3 canvas
function initAnimationPreview(frames) {
  if (!frames || !frames.some(f => f.imageUrl)) return;
  
  const canvas = document.getElementById('animationCanvas');
  const fpsRange = document.getElementById('fpsRange');
  
  // If elements don't exist, exit early
  if (!canvas || !fpsRange) {
    console.log('Animation elements not found in the DOM');
    return;
  }
  
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    console.error('Could not get canvas context');
    return;
  }
  
  // Set canvas size explicitly for better quality
  canvas.width = STANDARD_IMAGE_WIDTH;
  canvas.height = STANDARD_IMAGE_HEIGHT;
  
  let fps = parseInt(fpsRange.value) || 12; // Default to 12fps if value is invalid
  let frameImages = [];
  let currentFrame = 0;
  let animationId = null;
  let isPlaying = true;
  
  // Load all images
  const loadImages = async () => {
    // Only use frames that have an image URL
    const validFrames = frames.filter(f => f.imageUrl);
    
    frameImages = await Promise.all(validFrames.map(frame => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => {
          console.warn(`Failed to load frame image: ${frame.frameIndex}`);
          resolve(null); // Resolve with null so Promise.all completes
        };
        img.src = frame.imageUrl;
      });
    }));
    
    // Filter out any null images
    frameImages = frameImages.filter(img => img !== null);
    
    // Draw the first frame and start animation
    if (frameImages.length > 0) {
      drawFrame(0);
      startAnimation();
    }
  };
  
  // Draw a specific frame
  const drawFrame = (index) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (frameImages[index]) {
      // Center the image on the canvas
      const img = frameImages[index];
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    }
  };
  
  // Animation loop
  const animate = () => {
    if (!isPlaying) return;
    
    currentFrame = (currentFrame + 1) % frameImages.length;
    drawFrame(currentFrame);
    
    // Use timeout for more precise timing control
    setTimeout(() => {
      animationId = requestAnimationFrame(animate);
    }, 1000 / fps);
  };
  
  // Start animation
  const startAnimation = () => {
    if (animationId) {
      cancelAnimationFrame(animationId);
    }
    
    isPlaying = true;
    animationId = requestAnimationFrame(animate);
  };
  
  // Update FPS when slider changes
  fpsRange.addEventListener('input', () => {
    fps = parseInt(fpsRange.value) || 12;
    if (isPlaying) {
      startAnimation();
    }
  });
  
  // Cleanup function
  const cleanup = () => {
    if (animationId) {
      cancelAnimationFrame(animationId);
    }
    isPlaying = false;
  };
  
  // Load images and start animation
  loadImages();
  
  // Connect download button
  if (downloadAllBtn) {
    downloadAllBtn.addEventListener('click', () => downloadFramesAsZip(frames));
  }
  
  // Return cleanup function
  return cleanup;
}

// Update the generate action button handler
if (generateActionBtn) {
  generateActionBtn.addEventListener('click', async function() {
    const state = getState();
    if (!state.selectedStyle || !state.selectedAction) {
      alert('Please select both a style and an action');
      return;
    }

    try {
      // Disable the generate button
      this.disabled = true;
      this.innerHTML = `
        <div class="flex items-center justify-center">
          <div class="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
          <span>Generating...</span>
        </div>
      `;

      // Get the style information
      const styleModule = await import('./prompts.js');
      const styleInfo = styleModule.STYLE_DEFINITIONS[state.selectedStyle];
      
      // Using demo data for now since we're not calling the API
      const demoFrameCount = 4;
      
      // Create demo frames for preview
      const frames = [];
      for (let i = 0; i < demoFrameCount; i++) {
        // For demo, we'll use the style's icon as a placeholder
        frames.push({
          frameIndex: i,
          // This will be replaced with real generation later
          imageUrl: styleInfo?.iconUrl || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgZmlsbD0iIzMzMyIvPjx0ZXh0IHg9IjY0IiB5PSI2NCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE2IiBmaWxsPSIjZmZmIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBhbGlnbm1lbnQtYmFzZWxpbmU9Im1pZGRsZSI+UGxhY2Vob2xkZXI8L3RleHQ+PC9zdmc+'
        });
      }
      
      // Store generated frames in state
      updateState({ generatedFrames: frames });
      
      // Show the download button
      if (downloadAllBtn) {
        downloadAllBtn.classList.remove('hidden');
      }
      
      // Initialize animation preview
      initAnimationPreview(frames);
      
    } catch (error) {
      console.error('Error in action generation:', error);
      alert(error.message || 'Failed to generate action. Please try again.');
    } finally {
      // Reset button
      this.disabled = false;
      this.textContent = 'Generate Action Sprite';
    }
  });
}

// Make animation functions globally accessible
window.initAnimationPreview = initAnimationPreview;
