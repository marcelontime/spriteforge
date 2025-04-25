/**
 * wizard.js - Simplified version
 * Handles multi-step navigation for the SpritesO3 application
 */

import { getState, updateState } from './state.js';
import { STYLE_DEBUG } from './debug.js';

console.log('Debug settings loaded:', { STYLE_DEBUG });

// Initialize the framePrompts map for storing frame-specific prompts
const framePrompts = new Map();

//////////////////////////////
//  Helper – Next-button    //
//////////////////////////////
function enableStyleNextButton(enabled = true) {
  const apply = () => {
    const btn = document.getElementById('toStep3');
    if (btn) btn.disabled = !enabled;
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply);
  } else {
    apply();
  }
}
window.enableStyleNextButton = enableStyleNextButton;

//////////////////////////////
//  Init sequence           //
//////////////////////////////

document.addEventListener('DOMContentLoaded', () => {
  console.log('Initializing wizard with streamlined approach');
  
  // Initialize UI components
  initWizard();
  
  // Get initial step from URL or default to 1
  const urlParams = new URLSearchParams(window.location.search);
  const initialStep = urlParams.has('step') ? parseInt(urlParams.get('step'), 10) : 1;
  
  // Go to initial step
  goToStep(initialStep);
  
  // Initialize style grid right away
  initStyleCards();
});

// Set up visibility monitoring to prevent flickering
function setupVisibilityMonitoring() {
  // REMOVED early return to enable visibility monitoring
  console.log('Visibility monitoring system has been enabled');
  
  // Keep track of how many fixes we've applied
  const fixHistory = {
    count: 0,
    lastFixTime: 0,
    fixedSteps: {},
    lastWarningTime: 0
  };
  
  // Initial check after DOM is fully loaded
  window.addEventListener('load', () => {
    console.log('Window loaded - checking step visibility');
    
    // Only fix if there's an issue
    if (checkStepVisibility()) {
      fixHistory.count++;
      fixHistory.lastFixTime = Date.now();
      fixHistory.fixedSteps[getCurrentStep()] = (fixHistory.fixedSteps[getCurrentStep()] || 0) + 1;
    }
    
    // Force step 1 visibility on page load if that's the current step
    if (getCurrentStep() === 1) {
      stabilizeStep1();
    }
    
    // Set up mutation observer to watch for visibility changes
    setupStepVisibilityObserver(fixHistory);
  });
  
  // Set up periodic checks for first 5 seconds, but adaptively
  let checkCount = 0;
  const visibilityInterval = setInterval(() => {
    checkCount++;
    const currentStep = getCurrentStep();
    
    // Check visibility and fix if needed - only log if found an issue
    const hadIssue = checkStepVisibility();
    if (hadIssue) {
      fixHistory.count++;
      fixHistory.lastFixTime = Date.now();
      fixHistory.fixedSteps[currentStep] = (fixHistory.fixedSteps[currentStep] || 0) + 1;
      
      // Log aggregate details if we're seeing a lot of fixes
      if (fixHistory.count > 5 && (Date.now() - fixHistory.lastWarningTime) > 1000) {
        console.warn(`Visibility issues summary: Fixed ${fixHistory.count} issues`, fixHistory.fixedSteps);
        fixHistory.lastWarningTime = Date.now();
      }
    }
    
    // Only run ensureSingleVisibleStep() if we're seeing multiple issues
    if (fixHistory.count > 3) {
      ensureSingleVisibleStep();
    }
    
    // If we're on step 1, give it extra stabilization only if we've had issues
    if (currentStep === 1 && hadIssue) {
      stabilizeStep1();
    }
    
    // If we're on step 2, give it extra stabilization if we've had issues
    if (currentStep === 2 && hadIssue) {
      stabilizeStep2();
    }
    
    // Stop checking after 10 attempts (5 seconds)
    if (checkCount >= 10) {
      console.log('Visibility monitoring completed');
      if (fixHistory.count > 0) {
        console.log('Applied fixes during monitoring period:', fixHistory);
      } else {
        console.log('No visibility issues detected during monitoring period');
      }
      clearInterval(visibilityInterval);
    }
  }, 500);
}

// Set up a mutation observer to catch any visibility changes to step panels
function setupStepVisibilityObserver(fixHistory = { count: 0, fixedSteps: {} }) {
  // Create a throttling mechanism
  let isThrottled = false;
  let throttleTimeout = null;
  
  const runVisibilityCheck = () => {
    if (isThrottled) return;
    
    isThrottled = true;
    throttleTimeout = setTimeout(() => {
      isThrottled = false;
    }, 250); // Only allow checks every 250ms
    
    // Check step visibility and only log if there was an issue
    const hadIssue = checkStepVisibility();
    if (hadIssue) {
      fixHistory.count++;
      fixHistory.lastFixTime = Date.now();
      const currentStep = getCurrentStep();
      fixHistory.fixedSteps[currentStep] = (fixHistory.fixedSteps[currentStep] || 0) + 1;
    }
  };
  
  // Create a new observer
  const stepObserver = new MutationObserver((mutations) => {
    // Skip if we've already fixed too many issues (might be in a loop)
    if (fixHistory.count > 30) {
      if (!fixHistory.observerWarned) {
        console.warn('Too many visibility fixes applied - reducing fix frequency', fixHistory);
        fixHistory.observerWarned = true;
      }
      return;
    }
    
    let needsFix = false;
    
    // Check if any mutations affect the visibility of step panels
    mutations.forEach(mutation => {
      if (mutation.target.classList && 
          (mutation.target.classList.contains('step-panel') || 
           mutation.target.hasAttribute('data-step'))) {
        needsFix = true;
      }
    });
    
    // If a relevant change was detected, check and fix visibility
    if (needsFix) {
      runVisibilityCheck();
    }
  });
  
  // Observe all step panels for attribute and style changes
  document.querySelectorAll('.step-panel, [data-step]').forEach(panel => {
    stepObserver.observe(panel, {
      attributes: true,
      attributeFilter: ['style', 'class', 'data-step']
    });
  });
  
  // Also set up a general observer for DOM changes that might affect step panels
  const generalObserver = new MutationObserver((mutations) => {
    const stepPanels = document.querySelectorAll('.step-panel, [data-step]');
    
    // If step panels appear in the DOM, observe them
    if (stepPanels.length > 0) {
      stepPanels.forEach(panel => {
        stepObserver.observe(panel, {
          attributes: true,
          attributeFilter: ['style', 'class', 'data-step']
        });
      });
      
      // Check if steps are correctly displayed, but only infrequently
      const now = Date.now();
      if ((now - (fixHistory.lastGeneralCheck || 0)) > 1000) {
        fixHistory.lastGeneralCheck = now;
        runVisibilityCheck();
      }
    }
  });
  
  // Start observing the entire document for new step panels
  generalObserver.observe(document.body, {
    childList: true,
    subtree: true
  });
}

//////////////////////////////
//  Wizard state helpers    //
//////////////////////////////
function initializeWizardState() {
  console.log('Initializing wizard state');
  
  // Check if the emergency fix script has run and set a step
  const initialStepFromFixScript = window.initialStep || 1;
  
  // Get step from URL, use emergency fix's step as fallback
  const urlParams = new URLSearchParams(window.location.search);
  const step = urlParams.get('step') 
    ? parseInt(urlParams.get('step'), 10) 
    : initialStepFromFixScript;
  
  // First stabilize step 1 in case we need to return to it
  stabilizeStep1();
  
  // Then go to the requested step
  goToStep(['1', '2', '3'].includes(step) ? parseInt(step, 10) : 1);
  
  // Add a final check after a short delay to ensure step visibility
  setTimeout(checkStepVisibility, 100);
  
  // TEMP FIX - Double-ensure single step is visible
  ensureSingleVisibleStep();
}

// Ensure only one step is visible at any time
function ensureSingleVisibleStep() {
  const visibleSteps = [];
  
  // Check which steps appear to be visible
  document.querySelectorAll('.step-panel').forEach(panel => {
    if (panel.classList.contains('is-active') || 
        window.getComputedStyle(panel).display !== 'none') {
      visibleSteps.push(parseInt(panel.getAttribute('data-step'), 10));
    }
  });
  
  console.log('Visible steps detected:', visibleSteps);
  
  // If multiple steps are visible, keep only the current one
  if (visibleSteps.length > 1) {
    console.warn('Multiple steps visible - fixing visibility');
    const currentStep = getCurrentStep();
    document.querySelectorAll('.step-panel').forEach(panel => {
      const stepNum = parseInt(panel.getAttribute('data-step'), 10);
      if (stepNum !== currentStep) {
        // Force hide panels that shouldn't be visible
        panel.style.cssText = 'display:none!important;visibility:hidden!important;opacity:0!important;position:absolute!important;height:0!important;overflow:hidden!important;';
        panel.classList.remove('is-active', 'active');
        panel.classList.add('is-hidden');
      }
    });
  }
}

// Helper to force Step 1 visibility
function stabilizeStep1() {
  const step1Panel = document.querySelector('[data-step="1"]');
  if (step1Panel) {
    console.log('Stabilizing Step 1 panel');
    step1Panel.style.cssText = 'display:block!important;visibility:visible!important;opacity:1!important;position:relative!important;height:auto!important;overflow:visible!important;z-index:1000!important;';
    step1Panel.classList.remove('hidden', 'is-hidden');
    step1Panel.classList.add('is-active');
  }
}

// Helper to force Step 2 visibility
function stabilizeStep2() {
  const step2Panel = document.querySelector('[data-step="2"]');
  if (step2Panel) {
    console.log('Stabilizing Step 2 panel');
    step2Panel.style.cssText = 'display:block!important;visibility:visible!important;opacity:1!important;position:relative!important;height:auto!important;overflow:visible!important;z-index:1000!important;';
    step2Panel.classList.remove('hidden', 'is-hidden');
    step2Panel.classList.add('is-active');
    
    // Also initialize the style cards
    initStyleCards();
  }
}

// Final check to ensure the current step is visible
function checkStepVisibility() {
  const currentStep = getCurrentStep();
  const currentPanel = document.querySelector(`[data-step="${currentStep}"]`);
  
  console.log(`Visibility check: Current step=${currentStep}`);
  
  // Check if the current panel exists
  if (!currentPanel) {
    console.error(`Step panel ${currentStep} not found in DOM`);
    return;
  }
  
  // Get computed style properties to check visibility
  const style = window.getComputedStyle(currentPanel);
  const isDisplayNone = style.display === 'none';
  const isVisibilityHidden = style.visibility === 'hidden';
  const isOpacityZero = parseFloat(style.opacity) === 0;
  const isZeroHeight = style.height === '0px';
  const isClassHidden = currentPanel.classList.contains('is-hidden') || 
                        currentPanel.classList.contains('hidden');
  const isNotActive = !currentPanel.classList.contains('is-active');
  
  // Log detailed visibility state
  if (isDisplayNone || isVisibilityHidden || isOpacityZero || isZeroHeight || isClassHidden || isNotActive) {
    console.warn(`Step panel ${currentStep} visibility issue detected:`, {
      display: style.display,
      visibility: style.visibility,
      opacity: style.opacity,
      height: style.height,
      hidden_class: isClassHidden,
      active_class: !isNotActive,
      classList: Array.from(currentPanel.classList)
    });
    
    // Apply the fix
    console.log(`Fixing visibility for step ${currentStep}`);
    
    // Force all panels to proper state
    document.querySelectorAll('.step-panel, [data-step]').forEach(panel => {
      if (!panel.hasAttribute('data-step')) return;
      
      const panelStep = parseInt(panel.getAttribute('data-step'), 10);
      const shouldBeVisible = panelStep === currentStep;
      
      if (shouldBeVisible) {
        panel.style.cssText = 'display:block!important;visibility:visible!important;opacity:1!important;position:relative!important;height:auto!important;overflow:visible!important;z-index:1000!important;';
        panel.classList.remove('hidden', 'is-hidden');
        panel.classList.add('is-active');
        
        // Special handling for step 2
        if (panelStep === 2) {
          // Initialize style cards whenever step 2 becomes visible
          initStyleCards();
        }
        
        // Force a repaint
        void panel.offsetWidth;
      } else {
        panel.style.cssText = 'display:none!important;visibility:hidden!important;opacity:0!important;position:absolute!important;height:0!important;overflow:hidden!important;';
        panel.classList.remove('is-active', 'active');
        panel.classList.add('is-hidden');
      }
    });
    
    // Update the stepper circles to match
    updateStepperCircles(currentStep);
    
    return true; // Fix was applied
  }
  
  return false; // No fix needed
}

// Update stepper circles to match current step
function updateStepperCircles(currentStep) {
  document.querySelectorAll('#stepper .step').forEach((stepEl, idx) => {
    const num = idx + 1;
    const circle = stepEl.querySelector('.step-circle');
    const label = stepEl.querySelector('div');  // Changed from span to div
    
    if (!circle || !label) return;
    
    // Reset class names
    circle.className = 'step-circle flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium';
    label.className = 'ml-2 text-sm font-medium';
    
    if (num < currentStep) {
      // Completed steps
      circle.classList.add('bg-primary/30', 'text-primary');
      label.classList.add('text-primary/70');
      if (num === 1) label.classList.add('mr-auto'); // Keep the first label left-aligned
      stepEl.classList.remove('active');
    } else if (num === currentStep) {
      // Active step
      circle.classList.add('bg-primary', 'text-gray-900');
      label.classList.add('text-primary');
      if (num === 1) label.classList.add('mr-auto'); // Keep the first label left-aligned
      stepEl.classList.add('active');
    } else {
      // Inactive steps
      circle.classList.add('bg-gray-800', 'text-gray-400');
      label.classList.add('text-gray-400');
      stepEl.classList.remove('active');
    }
  });
}

function getCurrentStep() {
  const urlParams = new URLSearchParams(window.location.search);
  const stepFromURL = urlParams.get('step');
  if (stepFromURL && [1, 2, 3].includes(parseInt(stepFromURL, 10))) {
    return parseInt(stepFromURL, 10);
  }
  
  // If no valid step in URL, check active step in DOM
  const activePanel = document.querySelector('.step-panel.is-active');
  if (activePanel && activePanel.dataset.step) {
    return parseInt(activePanel.dataset.step, 10);
  }
  
  return 1; // Default to step 1
}

//////////////////////////////
//  Core UI initialization  //
//////////////////////////////
function initWizard() {
  // Step 1 to Step 2 button
  document.getElementById('toStep2')?.addEventListener('click', async () => {
    try {
      // Get current state and validate
      const state = getState();
      
      if (!state.selectedStyle) {
        alert('Please select a style first');
        return;
      }
      
      if (!state.uploadedImage) {
        alert('Please upload an image first');
        return;
      }
      
      // Disable the button to prevent multiple clicks
      const toStep2Btn = document.getElementById('toStep2');
      if (toStep2Btn) {
        toStep2Btn.disabled = true;
        toStep2Btn.innerHTML = `
          <div class="flex items-center justify-center">
            <div class="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
            <span>Generating...</span>
          </div>
        `;
      }
      
      // Only make API call if we're not using the original style
      if (state.selectedStyle && state.selectedStyle !== 'original') {
        // Show loading state on the selected style card
        const selectedCard = document.querySelector(`.style-option[data-style-id="${state.selectedStyle}"]`);
        if (selectedCard) {
          showStyleCardLoading(selectedCard);
        }
        
        // Generate the style
        await generateSingleStyle(state.selectedStyle);
        
        // Hide loading state
        if (selectedCard) {
          hideStyleCardLoading(selectedCard);
        }
      }
      
      // Navigate to step 2
      goToStep(2);
    } catch (error) {
      console.error('Error generating style:', error);
      alert(`Failed to generate style: ${error.message || 'Unknown error'}`);
      
      // Re-enable the button
      const toStep2Btn = document.getElementById('toStep2');
      if (toStep2Btn) {
        toStep2Btn.disabled = false;
        toStep2Btn.textContent = 'Next →';
      }
    }
  });

  // Back to Upload button in Step 2
  document.querySelectorAll('[data-back]').forEach(btn => {
    const targetStep = btn.getAttribute('data-back');
    btn.addEventListener('click', () => {
      goToStep(parseInt(targetStep, 10) || 1);
    });
  });

  // Step-1 requirements
  const apiKeyInput = document.getElementById('apiKey');
  apiKeyInput?.addEventListener('input', updateStep1Status);

  const imageUpload = document.getElementById('imageUpload');
  imageUpload?.addEventListener('change', e => {
    handleImageUpload(e);
    updateStep1Status();
  });

  // Dropzone
  setupDropZone();

  // Global helper – showImageModal
  window.showImageModal = window.showImageModal || function (src) {
    const modal = document.getElementById('imageModal');
    const img = document.getElementById('modalImage');
    if (modal && img && src) {
      img.src = src;
      modal.classList.remove('hidden');
    }
  };
  
  // Make the enable button function global
  window.enableStyleNextButton = enableStyleNextButton;
  
  // Action selection in step 2
  const actionSelect = document.getElementById('actionSelect');
  if (actionSelect) {
    actionSelect.addEventListener('change', () => {
      const generateActionBtn = document.getElementById('generateActionBtn');
      if (generateActionBtn) {
        generateActionBtn.disabled = !actionSelect.value;
      }
      
      // Update state with selected action
      updateState({ selectedAction: actionSelect.value });
      
      // Update frames display if we already have frames for this action
      if (actionSelect.value) {
        displayActionFrames(actionSelect.value);
      }
    });
  }
  
  // Generate action button in step 2
  const generateActionBtn = document.getElementById('generateActionBtn');
  if (generateActionBtn) {
    generateActionBtn.addEventListener('click', async () => {
      await generateSelectedAction();
    });
  }
}

//////////////////////////////
//  Navigation              //
//////////////////////////////
function goToStep(stepNumber) {
  console.log('Going to step:', stepNumber);
  
  // Ensure valid step number
  if (![1, 2].includes(stepNumber)) {
    console.error('Invalid step number:', stepNumber);
    stepNumber = 1; // Default to step 1
  }
  
  // Store the current step in state
  updateState({ currentStep: stepNumber });
  
  // Hide all steps
  document.querySelectorAll('.step-panel').forEach(panel => {
    panel.classList.remove('is-active');
    panel.style.display = 'none';
  });
  
  // Show the current step
  const currentPanel = document.querySelector(`.step-panel[data-step="${stepNumber}"]`);
  if (currentPanel) {
    currentPanel.classList.add('is-active');
    currentPanel.style.display = 'block';
    
    // Initialize styles when showing step 1
    if (stepNumber === 1) {
      initStyleCards();
      
      // When returning to step 1, restore Next button state
      const state = getState();
      const nextButton = document.getElementById('toStep2');
      const apiKey = document.getElementById('apiKey')?.value;
      const previewImage = document.getElementById('previewImage');
      const hasImg = previewImage && state.uploadedImageUrl;
      const hasSelectedStyle = !!state.selectedStyle;
      
      if (nextButton) {
        // Enable the button if we have all required inputs
        nextButton.disabled = !(apiKey && hasImg && hasSelectedStyle);
        nextButton.textContent = 'Next →';
      }
      
      // If we have an uploaded image, make sure it's displayed
      if (state.uploadedImageUrl && previewImage) {
        previewImage.src = state.uploadedImageUrl;
        const previewContainer = document.getElementById('imagePreview');
        if (previewContainer) {
          previewContainer.classList.remove('hidden');
        }
        
        // Hide the upload text if image is already loaded
        const uploadTextContainer = document.querySelector('.step-panel[data-step="1"] .border-dashed .text-center');
        if (uploadTextContainer) {
          uploadTextContainer.classList.add('hidden');
        }
      }
    }
    
    // For step 2, initialize action selection from generated style
    if (stepNumber === 2) {
      const state = getState();
      
      // Check if we have the required state data
      if (!state.selectedStyle || !state.uploadedImage) {
        console.warn('Missing required data for step 2, showing loading state');
        
        // Show loading state in the action selection area
        const styledImagePreview = document.getElementById('styledImagePreview');
        if (styledImagePreview) {
          styledImagePreview.src = 'media/loading.svg';
          styledImagePreview.alt = 'Loading...';
        }
        
        // Try again after a short delay to allow state to update
        setTimeout(() => {
          const updatedState = getState();
          if (updatedState.selectedStyle && updatedState.uploadedImage) {
            console.log('State data now available, initializing step 2');
            initializeActionSelection();
          } else {
            console.error('Failed to load required data for step 2 after delay');
            // Display error message in the UI
            const actionDescription = document.getElementById('actionDescription');
            if (actionDescription) {
              actionDescription.innerHTML = `
                <div class="p-4 bg-red-900/20 rounded-lg text-center">
                  <p class="text-red-400">Error: Missing required data</p>
                  <p class="text-sm text-gray-400 mt-2">Please go back to step 1 and ensure you've uploaded an image and selected a style.</p>
                </div>
              `;
            }
          }
        }, 500);
      } else {
        // We have the required data, proceed with initialization
        initializeActionSelection();
      }
    }
  } else {
    console.error(`Step panel ${stepNumber} not found`);
  }
  
  // Update stepper circles
  updateStepperCircles(stepNumber);
  
  // Update URL
  const url = new URL(window.location);
  url.searchParams.set('step', stepNumber);
  window.history.replaceState({}, '', url);
}

//////////////////////////////
//  Step-2 style cards      //
//////////////////////////////
function initStyleCards() {
  const stylesGrid = document.querySelector('#stylesGrid');
  if (!stylesGrid) return console.error('Styles grid not found');
  if (stylesGrid.children.length > 0) return; // already populated

  import('./prompts.js').then(module => {
    // Get styles from STYLE_DEFINITIONS in prompts.js
    const styleDefinitions = module.STYLE_DEFINITIONS;
    if (!styleDefinitions) {
      console.error('Style definitions not found in prompts.js');
      return;
    }
    
    // Convert object to array
    const styles = Object.values(styleDefinitions);
    console.log('Loaded styles:', styles.length);
    
    stylesGrid.innerHTML = styles.map(style => {
      // Get the image path - try to use the real image file if it exists
      const getImagePath = (style) => {
        // First check if this is the original style, always use placeholder
        if (style.id === 'original') {
          return 'media/style_previews/placeholder.svg';
        }
        
        // First check if the style definition has an iconUrl
        if (style.iconUrl) {
          return style.iconUrl;
        }
        
        // Use PNG file directly for more reliability
        return `media/style_previews/${style.id}.png`;
      };
      
      const imagePath = getImagePath(style);
      
      // Create very simple style cards for the new compact interface
      return `<div class="style-option style-card relative cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all p-2 bg-gray-800/50 rounded-lg" data-style-id="${style.id}" data-style-name="${style.name}" data-style-description="${style.description || ''}">
        <div class="flex flex-col">
          <div class="w-full aspect-square bg-gray-900/80 rounded mb-2 flex items-center justify-center overflow-hidden">
            <img src="${imagePath}" 
                 alt="${style.name}" 
                 class="w-full h-full object-cover"
                 onerror="this.onerror=null; this.src='media/style_previews/placeholder.svg';">
          </div>
          <h3 class="text-sm font-semibold text-center text-white">${style.name}</h3>
        </div>
      </div>`;
    }).join('');

    const cards = stylesGrid.querySelectorAll('.style-option');
    cards.forEach(card => card.addEventListener('click', async () => {
      // Simply add a loading class, no need to modify content
      card.classList.add('loading');
      card.style.opacity = '0.7';
      
      try {
        cards.forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        const styleId = card.dataset.styleId;
        const styleName = card.dataset.styleName;
        const styleDescription = card.dataset.styleDescription;
        updateState({ selectedStyle: styleId, stylesGenerated: false });
        
        // Update the main selected style preview
        updateSelectedStylePreview(card);
        
        // Enable next button after style is selected
        enableStyleNextButton(true);
      } catch (error) {
        console.error('Error selecting style:', error);
        showStyleCardError(card, error.message || 'Selection failed');
        alert(`Failed to select style: ${error.message || 'Unknown error'}`);
      } finally {
        // Remove loading class
        card.classList.remove('loading');
        card.style.opacity = '1';
      }
    }));
    
    // Check if a style was previously selected and highlight it
    const state = getState();
    if (state.selectedStyle) {
      const selectedCard = stylesGrid.querySelector(`.style-option[data-style-id="${state.selectedStyle}"]`);
      if (selectedCard) {
        selectedCard.classList.add('selected');
        updateSelectedStylePreview(selectedCard);
        enableStyleNextButton(true);
      }
    } else {
      // If no style was previously selected, select Hollow Knight by default
      const defaultStyle = stylesGrid.querySelector(`.style-option[data-style-id="handdrawn"]`);
      if (defaultStyle) {
        defaultStyle.classList.add('selected');
        updateSelectedStylePreview(defaultStyle);
        updateState({ selectedStyle: 'handdrawn', stylesGenerated: false });
        enableStyleNextButton(false); // Still need an uploaded image
      }
    }
  }).catch(err => console.error('Error loading style definitions:', err));
}

// Helper function to show loading state on style card
function showStyleCardLoading(card) {
  // Simply add a loading class, no need to modify content
  card.classList.add('loading');
  card.style.opacity = '0.7';
}

// Helper function to hide loading state on style card
function hideStyleCardLoading(card) {
  // Remove loading class
  card.classList.remove('loading');
  card.style.opacity = '1';
  
  const styleId = card.dataset.styleId;
  const imgContainer = card.querySelector('div.aspect-square');
  
  // Get generated style image if available
  const state = getState();
  const generatedStyle = state.generatedStyles?.find(s => s.id === styleId);
  
  if (imgContainer && generatedStyle && generatedStyle.imageUrl) {
    // Show the generated image
    imgContainer.innerHTML = `<img src="${generatedStyle.imageUrl}" alt="${card.dataset.styleName}" class="w-full h-full object-cover">`;
  } else if (imgContainer && !imgContainer.querySelector('img')) {
    // If there's no image, restore the original style image or placeholder
    const imagePath = `media/style_previews/${styleId}.png`;
    imgContainer.innerHTML = `
      <img src="${imagePath}" 
           alt="${card.dataset.styleName}" 
           class="w-full h-full object-cover"
           onerror="this.onerror=null; this.src='media/style_previews/placeholder.svg';">
    `;
  }
}

// Helper function to show error state on style card
function showStyleCardError(card, errorMessage) {
  // Simply add an error class, no need for complex markup
  card.classList.add('error');
}

// Function to generate a single style using OpenAI API
async function generateSingleStyle(styleId) {
  const state = getState();
  
  // Check if we already have the API dependencies
  if (typeof callOpenAIEdit !== 'function') {
    // Import the API module if not already available
    const apiModule = await import('./api.js');
    window.callOpenAIEdit = apiModule.callOpenAIEdit;
    window.generateSpritePrompt = (await import('./prompts.js')).generateSpritePrompt;
    window.makeStylePreview = (await import('./prompts.js')).makeStylePreview;
  }
  
  // Verify we have everything needed
  if (!state.apiKey) {
    throw new Error('Please enter your OpenAI API key');
  }
  
  if (!state.uploadedImage) {
    throw new Error('Please upload an image first');
  }
  
  console.log(`Generating style: ${styleId}`);
  
  // Show loading state on the selected style card (already happens in caller)
  const selectedCard = document.querySelector(`.style-option[data-style-id="${styleId}"]`);
  if (selectedCard) {
    const imgContainer = selectedCard.querySelector('div.aspect-square');
    if (imgContainer) {
      // Replace the image with loading.svg
      imgContainer.innerHTML = `<img src="media/loading.svg" alt="Loading..." class="w-full h-full p-4">`;
    }
  }
  
  // Also show loading in the main style preview if this style is selected
  const selectedStyleImage = document.getElementById('selectedStyleImage');
  if (selectedStyleImage && state.selectedStyle === styleId) {
    selectedStyleImage.src = 'media/loading.svg';
    selectedStyleImage.alt = 'Generating style...';
  }
  
  try {
    // Generate a unique reference token for this character
    const referenceToken = `CHAR_${Date.now().toString(36)}`;
    updateState({ currentReferenceToken: referenceToken });
    
    // Generate the preview prompt for this style
    const prompt = window.makeStylePreview(styleId);
    
    console.log(`Generated prompt for ${styleId}:`, prompt);
    
    // Call the OpenAI API
    const result = await window.callOpenAIEdit(prompt, state.uploadedImage);
    
    // Store the result
    const generatedStyles = [...(state.generatedStyles || [])];
    const styleIndex = generatedStyles.findIndex(s => s.id === styleId);
    
    if (styleIndex !== -1) {
      generatedStyles[styleIndex] = { id: styleId, imageUrl: result };
    } else {
      generatedStyles.push({ id: styleId, imageUrl: result });
    }
    
    updateState({ generatedStyles });
    
    // Update the card with the generated image
    if (selectedCard) {
      const imgContainer = selectedCard.querySelector('div.aspect-square');
      if (imgContainer) {
        imgContainer.innerHTML = `<img src="${result}" alt="${styleId}" class="w-full h-full object-cover">`;
      }
    }
    
    // Update the main preview if this style is selected
    if (selectedStyleImage && state.selectedStyle === styleId) {
      selectedStyleImage.src = result;
      selectedStyleImage.alt = `${styleId} style`;
    }
    
    console.log(`Style ${styleId} generated successfully`);
    return result;
  } catch (error) {
    console.error(`Error generating style ${styleId}:`, error);
    
    // Restore the original image on error
    if (selectedCard) {
      hideStyleCardLoading(selectedCard);
    }
    
    // Show error in main preview if needed
    if (selectedStyleImage && state.selectedStyle === styleId) {
      // For the main preview, show placeholder on error
      selectedStyleImage.src = `media/style_previews/${styleId}.png`;
      selectedStyleImage.alt = `Error generating ${styleId} style`;
      
      // Add error handler to fall back to placeholder if needed
      selectedStyleImage.onerror = function() {
        this.onerror = null;
        this.src = 'media/style_previews/placeholder.svg';
      };
    }
    
    throw error;
  }
}

// Update the selected style preview
function updateSelectedStylePreview(card) {
  const selectedStyleImage = document.getElementById('selectedStyleImage');
  const selectedStyleName = document.getElementById('selectedStyleName');
  const selectedStyleContainer = document.getElementById('selectedStyleContainer');
  
  if (!selectedStyleImage || !selectedStyleName || !selectedStyleContainer) return;
  
  const styleId = card.dataset.styleId;
  
  // Update the image and name
  const cardImage = card.querySelector('img');
  if (cardImage) {
    // Use the same image path as in the card
    selectedStyleImage.src = cardImage.src;
    selectedStyleImage.alt = card.dataset.styleName || 'Selected style';
  } else {
    // Fallback to style ID-based path
    const imagePath = `media/style_previews/${styleId}.png`;
    selectedStyleImage.src = imagePath;
    selectedStyleImage.alt = card.dataset.styleName || 'Selected style';
    
    // Add error handler to fall back to placeholder if needed
    selectedStyleImage.onerror = function() {
      this.onerror = null;
      this.src = `media/style_previews/placeholder.svg`;
    };
  }
  
  // Update the style name
  selectedStyleName.textContent = card.dataset.styleName || 'Selected Style';
  
  // Make the container visible
  selectedStyleContainer.style.display = 'block';
  
  // Check if we have a generated version of this style and show it
  const state = getState();
  const generatedStyle = state.generatedStyles?.find(s => s.id === styleId);
  
  if (generatedStyle && generatedStyle.imageUrl) {
    selectedStyleImage.src = generatedStyle.imageUrl;
  }
}

//////////////////////////////
//  Step-1 checks           //
//////////////////////////////
function updateStep1Status() {
  const apiKey = document.getElementById('apiKey')?.value;
  const previewImage = document.getElementById('previewImage');
  const hasImg = previewImage && !previewImage.classList.contains('hidden');
  const state = getState();
  const hasSelectedStyle = !!state.selectedStyle;
  
  // Update the toStep2 button status
  const nextButton = document.getElementById('toStep2');
  if (nextButton) {
    nextButton.disabled = !(apiKey && hasImg && hasSelectedStyle);
  }
}

//////////////////////////////
//  Drag & drop             //
//////////////////////////////
function setupDropZone() {
  const dropZone = document.querySelector('.step-panel[data-step="1"] .border-dashed');
  if (!dropZone) return console.error('Drop zone not found');

  const prevent = e => { e.preventDefault(); e.stopPropagation(); };
  ['dragenter','dragover','dragleave','drop'].forEach(evt => dropZone.addEventListener(evt, prevent, false));
  ['dragenter','dragover'].forEach(evt => dropZone.addEventListener(evt, () => dropZone.classList.add('border-primary'), false));
  ['dragleave','drop'].forEach(evt => dropZone.addEventListener(evt, () => dropZone.classList.remove('border-primary'), false));

  dropZone.addEventListener('drop', e => {
    const files = e.dataTransfer?.files;
    if (!files?.length) return;
    const fileInput = document.getElementById('imageUpload');
    if (!fileInput) return;
    const dt = new DataTransfer();
    Array.from(files).forEach(f => dt.items.add(f));
    fileInput.files = dt.files;
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    
    // Hide drag and drop text container after successful drop
    const uploadTextContainer = dropZone.querySelector('.text-center');
    if (uploadTextContainer) {
      uploadTextContainer.classList.add('hidden');
    }
  });
}

//////////////////////////////
//  Image upload            //
//////////////////////////////
function handleImageUpload(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  
  // Show loading state
  const previewContainer = document.getElementById('imagePreview');
  const uploadTextContainer = document.querySelector('.step-panel[data-step="1"] .border-dashed .text-center');
  
  if (previewContainer) {
    previewContainer.classList.remove('hidden');
    const preview = document.getElementById('previewImage');
    if (preview) {
      preview.src = 'media/loading.svg'; // Show loading placeholder
    }
  }
  
  if (uploadTextContainer) {
    uploadTextContainer.classList.add('hidden');
  }
  
  // Process image for API use
  processImageForAPI(file)
    .then(({ imageDataUrl, processedFile }) => {
      const preview = document.getElementById('previewImage');
      
      if (preview) {
        preview.src = imageDataUrl;
      }
      
      // Store both the data URL for preview and the processed file for API calls
      updateState({
        uploadedImage: processedFile,
        uploadedImageUrl: imageDataUrl
      });
      
      // Update the Original Style card with the uploaded image
      updateOriginalStyleCard(imageDataUrl);
      
      // Check if style is already selected, if so, enable the Next button
      const state = getState();
      if (state.selectedStyle) {
        enableStyleNextButton(true);
      } else {
        // Select the Original style by default since we have an image now
        const originalStyleCard = document.querySelector(`.style-option[data-style-id="original"]`);
        if (originalStyleCard) {
          // Trigger a click on the original style card
          originalStyleCard.click();
        } else {
          // Still need to select a style
          enableStyleNextButton(false);
        }
      }
      
      // Save thumbnail to localStorage
      try {
        const img = new Image();
        img.onload = function() {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          canvas.width = 100;
          canvas.height = 100;
          ctx.drawImage(img, 0, 0, 100, 100);
          localStorage.setItem('last_image_thumbnail', canvas.toDataURL('image/jpeg', 0.5));
        };
        img.src = imageDataUrl;
      } catch (e) {
        console.warn('Could not save thumbnail:', e);
      }
    })
    .catch(error => {
      console.error('Error processing image:', error);
      alert('Failed to process the image. Please try a different image.');
      
      // Reset the file input
      const imageUpload = document.getElementById('imageUpload');
      if (imageUpload) {
        imageUpload.value = '';
      }
      
      // Hide preview
      if (previewContainer) {
        previewContainer.classList.add('hidden');
      }
      
      // Show upload text again
      if (uploadTextContainer) {
        uploadTextContainer.classList.remove('hidden');
      }
    });
}

// Helper function to update the Original Style card with the uploaded image
function updateOriginalStyleCard(imageUrl) {
  // Find the Original Style card
  const originalStyleCard = document.querySelector(`.style-option[data-style-id="original"]`);
  if (originalStyleCard) {
    // Find the image container within the card
    const imgContainer = originalStyleCard.querySelector('div.aspect-square');
    if (imgContainer) {
      // Replace the image with the uploaded image
      imgContainer.innerHTML = `
        <img src="${imageUrl}" 
             alt="Original Style" 
             class="w-full h-full object-cover"
             onerror="this.onerror=null; this.src='media/style_previews/placeholder.svg';">
      `;
    }
  }
  
  // Also update the style preview if Original Style is currently selected
  const state = getState();
  if (state.selectedStyle === 'original') {
    const selectedStyleImage = document.getElementById('selectedStyleImage');
    if (selectedStyleImage) {
      selectedStyleImage.src = imageUrl;
    }
  }
}

// Helper function to process an image for the OpenAI API
async function processImageForAPI(file) {
  return new Promise((resolve, reject) => {
    try {
      // Make sure it's an image file
      if (!file.type.startsWith('image/')) {
        reject(new Error('Please upload an image file'));
        return;
      }
      
      // Create a canvas to process the image
      const img = new Image();
      img.onload = () => {
        try {
          // Create a canvas with a standard size
          const canvas = document.createElement('canvas');
          // Set reasonable dimensions - will be resized by API anyway
          const maxSize = 1024;
          
          // Calculate dimensions while maintaining aspect ratio
          let width = img.width;
          let height = img.height;
          
          if (width > height && width > maxSize) {
            height = Math.round(height * (maxSize / width));
            width = maxSize;
          } else if (height > maxSize) {
            width = Math.round(width * (maxSize / height));
            height = maxSize;
          }
          
          canvas.width = width;
          canvas.height = height;
          
          // Draw the image on the canvas
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          
          // Get data URL for preview
          const imageDataUrl = canvas.toDataURL('image/png');
          
          // Convert to PNG file for API
          canvas.toBlob(blob => {
            const processedFile = new File([blob], 'image.png', {
              type: 'image/png',
              lastModified: Date.now()
            });
            
            console.log('Image processed for API:', {
              originalSize: file.size,
              processedSize: processedFile.size,
              originalType: file.type,
              dimensions: `${width}x${height}`
            });
            
            resolve({ imageDataUrl, processedFile });
          }, 'image/png', 0.95);
        } catch (err) {
          console.error('Error processing canvas:', err);
          reject(err);
        }
      };
      
      img.onerror = () => {
        reject(new Error('Failed to load the image'));
      };
      
      // Load the image
      img.src = URL.createObjectURL(file);
    } catch (err) {
      console.error('Error in image processing:', err);
      reject(err);
    }
  });
}

//////////////////////////////
//  Action select           //
//////////////////////////////
function populateActionSelect() {
  const select = document.getElementById('actionSelect');
  if (!select) return;
  const actions = [
    { id:'idle',  name:'Idle'  },{ id:'walk', name:'Walk' },{ id:'run', name:'Run' },{ id:'jump', name:'Jump' },
    { id:'attack', name:'Attack' },{ id:'cast_spell', name:'Cast Spell' },{ id:'crouch', name:'Crouch' },
    { id:'climb', name:'Climb' },{ id:'fall', name:'Fall' },{ id:'victory', name:'Victory' },{ id:'death', name:'Death' }
  ];
  select.length = 1; // keep placeholder
  actions.forEach(a => {
    const opt = document.createElement('option');
    opt.value = a.id; opt.textContent = a.name; select.appendChild(opt);
  });
  select.addEventListener('change', () => {
    document.getElementById('generateActionBtn').disabled = !select.value;
  });
}

//////////////////////////////
//  Reset                   //
//////////////////////////////
function resetState() {
  const imageUpload = document.getElementById('imageUpload');
  if (imageUpload) imageUpload.value = '';
  
  const preview = document.getElementById('previewImage');
  if (preview) { 
    preview.src = ''; 
    preview.classList.add('hidden'); 
  }
  
  const previewContainer = document.getElementById('imagePreview');
  if (previewContainer) {
    previewContainer.classList.add('hidden');
  }
  
  // Show the upload text and choose file button again
  const uploadTextContainer = document.querySelector('.step-panel[data-step="1"] .border-dashed .text-center');
  if (uploadTextContainer) {
    uploadTextContainer.classList.remove('hidden');
  }
  
  const stylesGrid = document.getElementById('stylesGrid');
  if (stylesGrid) stylesGrid.replaceChildren();
  
  updateState({ 
    selectedStyle: null, 
    stylesGenerated: false, 
    uploadedImage: null, 
    generatedStyles: [], 
    generatedFrames: [] 
  });
  
  const actionSel = document.getElementById('actionSelect');
  if (actionSel) actionSel.selectedIndex = 0;
  
  const generateActionBtn = document.getElementById('generateActionBtn');
  if (generateActionBtn) generateActionBtn.setAttribute('disabled', '');
  
  const downloadAllBtn = document.getElementById('downloadAllBtn');
  if (downloadAllBtn) downloadAllBtn.classList.add('hidden');
  
  const canvas = document.getElementById('animationCanvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

//////////////////////////////
//  Final preview images     //
//////////////////////////////
function updateFinalPreviewImages() {
  const state = getState();
  
  // Check if we're still using the old 3-step flow, if not, just return
  const finalImagePreview = document.getElementById('finalImagePreview');
  const finalStylePreview = document.getElementById('finalStylePreview');
  
  if (!finalImagePreview && !finalStylePreview) {
    // New 2-step flow doesn't have these elements, so we can safely return
    return;
  }
  
  // Update final uploaded image preview if element exists
  if (finalImagePreview) {
    if (state.uploadedImageUrl) {
      finalImagePreview.src = state.uploadedImageUrl;
    } else {
      // Use placeholder if no image uploaded yet
      finalImagePreview.src = 'media/style_previews/placeholder.svg';
    }
  }
  
  // Update final style preview if element exists
  if (finalStylePreview && state.selectedStyle) {
    // First check if we have a generated style image
    const generatedStyle = state.generatedStyles?.find(s => s.id === state.selectedStyle);
    
    if (generatedStyle && generatedStyle.imageUrl) {
      // Use the generated style image
      finalStylePreview.src = generatedStyle.imageUrl;
      finalStylePreview.alt = `${state.selectedStyle} style (generated)`;
    } else {
      // Fallback to the style preview image
      finalStylePreview.src = `media/style_previews/${state.selectedStyle}.png`;
      finalStylePreview.alt = `${state.selectedStyle} style`;
      
      // Add error handler to fall back to placeholder
      finalStylePreview.onerror = function() {
        this.onerror = null;
        this.src = 'media/style_previews/placeholder.svg';
      };
    }
  }
}

//////////////////////////////
//  Exports                 //
//////////////////////////////
export const wizard = { 
  goToStep, 
  enableStyleNextButton, 
  getCurrentStep,
  initStyleCards,
  updateStep1Status,
  updateFinalPreviewImages,
  updateSelectedStylePreview,
  generateSingleStyle,
  showStyleCardLoading,
  hideStyleCardLoading,
  showStyleCardError,
  processImageForAPI,
  generateSelectedAction,
  displayActionFrames,
  downloadActionFrames,
  initializeActionSelection,
  updateStepperCircles
};

// Simple debug function that can be called from console if needed
export function debugGoToStep(step) {
  goToStep(step);
  return `Navigated to step ${step}`;
}

// Helper function to add a delay between API calls
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Function to generate the selected action
async function generateSelectedAction() {
  const state = getState();
  // Ensure we have both style and action selected
  const actionSelect = document.getElementById('actionSelect');
  const selectedAction = actionSelect ? actionSelect.value : null;
  
  if (!state.selectedStyle || !selectedAction) {
    alert('Please select both a style and an action');
    return;
  }
  
  // Update state with selected action
  updateState({ selectedAction });
  
  // Get UI elements
  const generateActionBtn = document.getElementById('generateActionBtn');
  const actionPreview = document.getElementById('actionPreview');
  const actionFramesContainer = document.getElementById('actionFramesContainer');
  
  try {
    // Disable button and show loading state
    if (generateActionBtn) {
      generateActionBtn.disabled = true;
      generateActionBtn.innerHTML = `
        <div class="flex items-center justify-center">
          <div class="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
          <span>Generating...</span>
        </div>
      `;
    }
    
    // Show loading in the preview area
    if (actionPreview) {
      actionPreview.innerHTML = `
        <div class="flex flex-col items-center justify-center p-4">
          <img src="media/loading.svg" alt="Loading..." class="w-16 h-16 mb-4">
          <p class="text-gray-400">Generating ${selectedAction} animation...</p>
        </div>
      `;
      actionPreview.classList.remove('hidden');
    }
    
    // Check if we need to import the API module
    if (typeof window.generateSpriteAction !== 'function') {
      const apiModule = await import('./api.js');
      window.generateSpriteAction = apiModule.generateSpriteAction;
      window.callOpenAIEdit = apiModule.callOpenAIEdit;
      window.dataURLtoFile = apiModule.dataURLtoFile;
    }
    
    // Get action info from prompts.js
    const promptsModule = await import('./prompts.js');
    const actionInfo = promptsModule.ACTION_PROMPTS[selectedAction];
    
    if (!actionInfo) {
      throw new Error(`Unknown action: ${selectedAction}`);
    }
    
    // Clear any existing frames for this action and style
    let currentFrames = state.generatedFrames || [];
    currentFrames = currentFrames.filter(frame => 
      !(frame.actionId === selectedAction && frame.styleId === state.selectedStyle)
    );
    updateState({ generatedFrames: currentFrames });
    
    // Generate all frames for this action
    const frameCount = actionInfo.frames;
    console.log(`Generating ${frameCount} frames for ${selectedAction} action in sequence`);
    
    // Track successful and failed frames
    let successCount = 0;
    let errorCount = 0;
    
    // Reference to the previous frame's result to use as input for the next frame
    let previousFrameImage = null;
    
    // We'll select the appropriate input image for the first frame
    let inputImage = null;
    
    // Check if we're using the "original" style, which should use the uploaded image directly
    if (state.selectedStyle === 'original') {
      // For original style, use the uploaded image as-is
      inputImage = state.uploadedImage;
      console.log('Using original uploaded image for Original Style');
    } else {
      // For generated styles, try to get the styled image
      try {
        // Get the styled image directly from the DOM - it's already displayed in the preview
        const styledImagePreview = document.getElementById('styledImagePreview');
        
        if (styledImagePreview && styledImagePreview.src && styledImagePreview.src.startsWith('data:image/')) {
          console.log('Using styled image preview from DOM for first frame');
          
          // Convert the image to a File object
          const response = await fetch(styledImagePreview.src);
          const blob = await response.blob();
          inputImage = new File([blob], 'styled_image.png', { type: 'image/png' });
          
          console.log('Successfully converted styled preview image to File:', {
            type: inputImage.type,
            size: inputImage.size
          });
        } else {
          // Fallback to the generated style from state if we can't get it from the DOM
          const generatedStyle = state.generatedStyles?.find(s => s.id === state.selectedStyle);
          if (generatedStyle && generatedStyle.imageUrl) {
            // Convert the data URL to a file object for API use
            const response = await fetch(generatedStyle.imageUrl);
            const blob = await response.blob();
            inputImage = new File([blob], 'styled_image.png', { type: 'image/png' });
            
            console.log('Using generated style image from state as base for frame sequence:', {
              type: inputImage.type,
              size: inputImage.size
            });
          }
        }
      } catch (err) {
        console.warn('Could not get styled image, falling back to original upload', err);
      }
    }
    
    // Final fallback to the original image if all else fails
    if (!inputImage) {
      console.log('No styled image found, using original upload as fallback');
      inputImage = state.uploadedImage;
    }
    
    // Generate frames one by one in sequence
    for (let i = 0; i < frameCount; i++) {
      // Update loading message
      if (actionPreview) {
        actionPreview.innerHTML = `
          <div class="flex flex-col items-center justify-center p-4">
            <img src="media/loading.svg" alt="Loading..." class="w-16 h-16 mb-4">
            <p class="text-gray-400">Generating frame ${i+1}/${frameCount}...</p>
            ${i > 0 ? `<p class="text-xs text-gray-500">Using previous frame as reference</p>` : ''}
          </div>
        `;
      }
      
      // Mark the current frame as "loading" in the state
      currentFrames.push({
        actionId: selectedAction,
        styleId: state.selectedStyle,
        frameIndex: i,
        loading: true
      });
      
      // Update state and display after marking this frame as loading
      updateState({ generatedFrames: [...currentFrames] });
      displayActionFrames(selectedAction);
      
      try {
        // Add a small delay between API calls to avoid rate limiting
        if (i > 0) {
          await delay(1000); // 1 second delay between frames
        }
        
        // Generate prompt for this frame
        const framePrompt = promptsModule.generateSpritePrompt(
          state.selectedStyle,
          selectedAction,
          state.currentReferenceToken || 'REF_CHAR',
          undefined,
          i,
          i > 0 // Always use continuity parameter for frames after the first
        );
        
        // Add extra continuity instructions based on style and frame position
        let enhancedPrompt = framePrompt;
        
        if (i > 0) {
          // For all non-first frames, add continuity emphasis
          if (state.selectedStyle === 'original') {
            // For Original Style, emphasize preserving the exact reference character
            enhancedPrompt = `${framePrompt}\n\nCRITICAL: This is frame ${i+1} in a sequence. Maintain EXACT consistency with previous frame. Do not stylize or reinterpret. Use identical colors, proportions, and art style as the reference image.`;
          } else {
            // For stylized images, emphasize color palette and style consistency
            enhancedPrompt = `${framePrompt}\n\nIMPORTANT: Maintain exact same color palette, style, and character design as previous frame. This is frame ${i+1} in a continuous animation sequence.`;
          }
        } else if (state.selectedStyle === 'original') {
          // For first frame of Original Style, add emphasis on preserving reference
          enhancedPrompt = `${framePrompt}\n\nCRITICAL: Maintain EXACT reference image style. Do not stylize or reinterpret. Create animation while preserving the original character design perfectly.`;
        }
        
        // Store the prompt for potential regeneration
        const promptKey = `${selectedAction}_${i}`;
        framePrompts.set(promptKey, enhancedPrompt);
        
        // For the first frame or after errors, use the initial input image
        // For subsequent frames, use the previous frame's result
        const currentInput = (i === 0 || !previousFrameImage) ? inputImage : previousFrameImage;
        
        console.log(`Generating frame ${i+1}/${frameCount} using ${i === 0 ? 'initial styled image' : 'previous frame'} as input`);
        
        // Generate this frame using the OpenAI API directly
        const result = await window.callOpenAIEdit(
          enhancedPrompt,
          currentInput,
          state.apiKey,
          state.selectedModel
        ).catch(error => {
          console.error(`API call error for frame ${i+1}:`, error);
          throw new Error(`Failed to generate frame ${i+1}: ${error.message || 'API error'}`);
        });
        
        // Save the result for the next frame
        try {
          const response = await fetch(result);
          const blob = await response.blob();
          previousFrameImage = new File([blob], `frame_${i+1}.png`, { type: 'image/png' });
          console.log(`Created File object from frame ${i+1} result:`, {
            type: previousFrameImage.type,
            size: previousFrameImage.size
          });
        } catch (err) {
          console.warn(`Failed to convert frame ${i+1} to File, will reset to original image for next frame`, err);
          previousFrameImage = null;
        }
        
        // Add the frame to our state
        successCount++;

        // Find and replace any loading frame with the completed one
        const frameIdx = currentFrames.findIndex(f => 
          f.frameIndex === i && 
          f.actionId === selectedAction && 
          f.styleId === state.selectedStyle
        );

        if (frameIdx !== -1) {
          // Replace the existing frame
          currentFrames[frameIdx] = {
            actionId: selectedAction,
            styleId: state.selectedStyle,
            frameIndex: i,
            imageUrl: result
          };
        } else {
          // Add as a new frame if not found
          currentFrames.push({
            actionId: selectedAction,
            styleId: state.selectedStyle,
            frameIndex: i,
            imageUrl: result
          });
        }
        
        // Update state and display after each frame
        updateState({ generatedFrames: [...currentFrames] });
        displayActionFrames(selectedAction);
        
        // Update preview to show the latest frame
        if (actionPreview) {
          if (i === frameCount - 1) {
            // If it's the last frame, show completion
            actionPreview.innerHTML = `
              <div class="flex flex-col items-center">
                <div class="w-full max-w-md overflow-hidden rounded-lg">
                  <img src="${result}" alt="${actionInfo.name}" class="w-full h-auto">
                </div>
                <p class="mt-2 text-sm text-gray-400">${actionInfo.name} - Complete (${frameCount} frames)</p>
                ${errorCount > 0 ? 
                  `<p class="text-xs text-red-500 mt-1">${errorCount} frames failed - see details below</p>` : 
                  ''}
                <p class="text-xs text-gray-500 mt-1">Generated in sequence for better animation continuity</p>
              </div>
            `;
          } else {
            // Otherwise show current progress
            actionPreview.innerHTML = `
              <div class="flex flex-col items-center">
                <div class="w-full max-w-md overflow-hidden rounded-lg">
                  <img src="${result}" alt="${actionInfo.name}" class="w-full h-auto">
                </div>
                <p class="mt-2 text-sm text-gray-400">${actionInfo.name} - Frame ${i+1}/${frameCount}</p>
                <p class="text-xs text-gray-500 mt-2">Generating remaining frames...</p>
                ${successCount > 0 ? `<p class="text-xs text-green-500 mt-1">${successCount} frames completed</p>` : ''}
                ${errorCount > 0 ? `<p class="text-xs text-red-500 mt-1">${errorCount} errors</p>` : ''}
                ${i > 0 ? `<p class="text-xs text-blue-500 mt-1">Using previous frame as reference</p>` : ''}
              </div>
            `;
          }
        }
      } catch (error) {
        errorCount++;
        console.error(`Error generating frame ${i+1}:`, error);
        
        // If we fail, reset the previous frame reference to ensure next frame starts fresh
        previousFrameImage = null;
        
        // Find and replace any loading frame with the error state
        const frameIdx = currentFrames.findIndex(f => 
          f.frameIndex === i && 
          f.actionId === selectedAction && 
          f.styleId === state.selectedStyle
        );

        if (frameIdx !== -1) {
          // Replace the existing frame
          currentFrames[frameIdx] = { 
            actionId: selectedAction, 
            styleId: state.selectedStyle, 
            frameIndex: i, 
            error: error.message || 'Generation failed' 
          };
        } else {
          // Add error frame to show the issue
          currentFrames.push({
            actionId: selectedAction,
            styleId: state.selectedStyle,
            frameIndex: i,
            error: error.message || 'Generation failed'
          });
        }
        
        // Update state and display
        updateState({ generatedFrames: [...currentFrames] });
        displayActionFrames(selectedAction);
        
        // Continue with next frame if possible
        if (actionPreview) {
          actionPreview.innerHTML = `
            <div class="flex flex-col items-center">
              <div class="w-full max-w-md overflow-hidden rounded-lg bg-red-900/20 p-4 text-center">
                <svg class="w-12 h-12 text-red-500 mb-2 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                </svg>
                <p class="text-red-400 font-medium">Error generating frame ${i+1}</p>
                <p class="text-gray-400 text-sm mt-1">${error.message || 'Unknown error'}</p>
              </div>
              <p class="mt-4 text-sm text-gray-400">Continuing with remaining frames...</p>
              ${successCount > 0 ? `<p class="text-xs text-green-500 mt-1">${successCount} frames completed</p>` : ''}
              ${errorCount > 0 ? `<p class="text-xs text-red-500 mt-1">${errorCount} errors</p>` : ''}
              <p class="text-xs text-yellow-500 mt-1">Will reset to initial image for next frame</p>
            </div>
          `;
          
          // Add a longer delay after an error
          await delay(2000);
        }
      }
    }
    
    // All frames generated or attempted, show final status
    if (actionPreview && successCount === 0) {
      actionPreview.innerHTML = `
        <div class="flex flex-col items-center justify-center p-4 bg-red-900/20 rounded-lg">
          <svg class="w-12 h-12 text-red-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
          </svg>
          <p class="text-red-400 font-medium">Generation Failed</p>
          <p class="text-gray-400 text-sm mt-1">All frames failed to generate. Please try again later.</p>
        </div>
      `;
    }
    
    // Show download button if any frames were generated
    const downloadAllBtn = document.getElementById('downloadAllBtn');
    if (downloadAllBtn && successCount > 0) {
      downloadAllBtn.classList.remove('hidden');
    }
    
  } catch (error) {
    console.error('Error generating action:', error);
    if (actionPreview) {
      actionPreview.innerHTML = `
        <div class="flex flex-col items-center justify-center p-4 bg-red-900/20 rounded-lg">
          <svg class="w-12 h-12 text-red-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
          </svg>
          <p class="text-red-400 font-medium">Generation Failed</p>
          <p class="text-gray-400 text-sm mt-1">${error.message || 'Unknown error'}</p>
        </div>
      `;
    }
    
    alert(`Failed to generate action: ${error.message || 'Unknown error'}`);
  } finally {
    // Reset the button
    if (generateActionBtn) {
      generateActionBtn.disabled = false;
      generateActionBtn.textContent = 'Generate Action';
    }
  }
}

// Function to display generated action frames
function displayActionFrames(actionId) {
  const state = getState();
  const framesContainer = document.getElementById('actionFramesContainer');
  const actionPreview = document.getElementById('actionPreview');
  if (!framesContainer) return;
  
  // Filter frames for the current action
  const actionFrames = state.generatedFrames.filter(frame => 
    frame.actionId === actionId && frame.styleId === state.selectedStyle
  );
  
  // Handle case when no frames exist yet
  if (actionFrames.length === 0) {
    framesContainer.innerHTML = `
      <div class="text-center py-8">
        <p class="text-sm text-gray-400">No frames generated yet</p>
        <p class="text-xs text-gray-500 mt-2">Click "Generate Action" to create animation frames</p>
      </div>
    `;
    return;
  }
  
  // Import action details
  import('./prompts.js').then(module => {
    const actionInfo = module.ACTION_PROMPTS[actionId];
    if (!actionInfo) return;
    
    // Count successful and error frames
    const successFrames = actionFrames.filter(frame => frame.imageUrl).length;
    const errorFrames = actionFrames.filter(frame => frame.error).length;
    const loadingFrames = actionFrames.filter(frame => frame.loading).length;
    const totalFrames = actionInfo.frames;
    const inProgress = successFrames + errorFrames < totalFrames || loadingFrames > 0;
    
    // Find current frame being processed
    let currentProcessingFrame = -1;
    if (inProgress) {
      for (let i = 0; i < totalFrames; i++) {
        const frame = actionFrames.find(f => f.frameIndex === i);
        if (!frame || frame.loading) {
          currentProcessingFrame = i;
          break;
        }
      }
    }
    
    // Create frame display
    framesContainer.innerHTML = `
      <div class="mb-4">
        <h4 class="text-lg font-medium mb-2">${actionInfo.name} Frames</h4>
        <p class="text-sm text-gray-400">${actionInfo.basePrompt}</p>
        <div class="flex items-center gap-3 mt-3">
          <span class="text-xs px-2 py-1 bg-gray-800 rounded">
            ${successFrames}/${totalFrames} frames generated
          </span>
          ${errorFrames > 0 ? 
            `<span class="text-xs px-2 py-1 bg-red-900/30 text-red-400 rounded">
              ${errorFrames} errors
            </span>` : 
            ''}
          ${inProgress ? 
            `<span class="text-xs px-2 py-1 bg-blue-900/30 text-blue-400 rounded flex items-center">
              <img src="media/loading.svg" alt="Loading..." class="w-4 h-4 mr-1">
              ${currentProcessingFrame >= 0 ? `Generating frame ${currentProcessingFrame + 1}/${totalFrames}` : 'Processing...'}
            </span>` : 
            ''}
        </div>
        
        ${inProgress ? 
          `<div class="w-full bg-gray-800 rounded-full h-2.5 mt-3">
            <div class="bg-primary h-2.5 rounded-full" style="width: ${Math.round((successFrames / totalFrames) * 100)}%"></div>
          </div>` : 
          ''}
      </div>
      
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-4">
        ${Array(totalFrames).fill(0).map((_, index) => {
          const frame = actionFrames.find(f => f.frameIndex === index);
          
          if (frame && frame.imageUrl) {
            // Regular successful frame
            return `
              <div class="frame-container relative bg-gray-900/50 p-2 rounded-lg border border-gray-800 hover:border-primary/50 transition-colors">
                <span class="absolute top-2 left-2 bg-gray-800/80 text-xs text-gray-300 px-2 py-1 rounded">
                  Frame ${index + 1}/${totalFrames}
                </span>
                <button 
                  class="absolute top-2 right-2 bg-gray-800/80 hover:bg-primary/70 text-gray-300 hover:text-white p-2 rounded-lg transition-colors"
                  onclick="showFrameEditModal('${actionId}', ${index})"
                  title="Edit this frame"
                >
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
                  </svg>
                </button>
                <div class="group relative" style="margin-top: 6px">
                  <img src="${frame.imageUrl}" 
                       alt="Frame ${index + 1}" 
                       class="w-full h-auto rounded cursor-pointer hover:opacity-80 transition-opacity"
                       onclick="window.showImageModal('${frame.imageUrl}')">
                  <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 flex items-center justify-center transition-all duration-200 opacity-0 group-hover:opacity-100">
                    <button 
                      class="bg-primary-500 hover:bg-primary-600 text-white font-medium py-1 px-3 rounded-lg transition-all duration-200 transform scale-90 group-hover:scale-100"
                      onclick="showFrameEditModal('${actionId}', ${index})"
                    >
                      Edit Frame
                    </button>
                  </div>
                </div>
                <div class="mt-2 text-xs text-gray-500 px-1">
                  ${actionInfo.framePrompts && actionInfo.framePrompts[index] ? actionInfo.framePrompts[index] : ''}
                </div>
              </div>
            `;
          } else if (frame && frame.error) {
            // Error frame
            return `
              <div class="frame-container relative bg-gray-900/50 p-2 rounded-lg border border-red-900/30 hover:border-red-500/50 transition-colors">
                <span class="absolute top-2 left-2 bg-red-900/80 text-xs text-gray-300 px-2 py-1 rounded">
                  Frame ${index + 1}/${totalFrames} - Error
                </span>
                <button 
                  class="absolute top-2 right-2 bg-gray-800/80 hover:bg-primary/70 text-gray-300 hover:text-white p-2 rounded-lg transition-colors"
                  onclick="showFrameEditModal('${actionId}', ${index})"
                  title="Try again"
                >
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                  </svg>
                </button>
                <div class="group relative" style="margin-top: 6px">
                  <div class="w-full aspect-square flex items-center justify-center bg-red-900/20 rounded">
                    <div class="text-center p-4">
                      <svg class="w-8 h-8 text-red-500 mb-2 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                      </svg>
                      <p class="text-xs text-red-400">Generation failed</p>
                    </div>
                  </div>
                  <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 flex items-center justify-center transition-all duration-200 opacity-0 group-hover:opacity-100">
                    <button 
                      class="bg-primary-500 hover:bg-primary-600 text-white font-medium py-1 px-3 rounded-lg transition-all duration-200 transform scale-90 group-hover:scale-100"
                      onclick="showFrameEditModal('${actionId}', ${index})"
                    >
                      Try Again
                    </button>
                  </div>
                </div>
                <div class="mt-2 text-xs text-gray-500 px-1">
                  ${actionInfo.framePrompts && actionInfo.framePrompts[index] ? actionInfo.framePrompts[index] : ''}
                </div>
              </div>
            `;
          } else if (frame && frame.loading) {
            // Currently generating this frame
            return `
              <div class="frame-container relative bg-gray-900/50 p-2 rounded-lg border border-blue-500/30 hover:border-blue-500/50 transition-colors">
                <span class="absolute top-2 left-2 bg-blue-900/80 text-xs text-gray-300 px-2 py-1 rounded flex items-center">
                  <span class="mr-1">Frame ${index + 1}/${totalFrames}</span>
                  <span class="inline-block w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                </span>
                <div class="w-full aspect-square flex items-center justify-center bg-gray-800/50 rounded">
                  <img src="media/loading.svg" alt="Loading..." class="w-12 h-12">
                </div>
                <div class="mt-2 text-xs text-gray-500 px-1">
                  ${actionInfo.framePrompts && actionInfo.framePrompts[index] ? actionInfo.framePrompts[index] : ''}
                </div>
              </div>
            `;
          } else {
            // Not yet generated frame
            return `
              <div class="frame-container relative bg-gray-900/50 p-2 rounded-lg border border-gray-800">
                <span class="absolute top-2 left-2 bg-gray-800/80 text-xs text-gray-300 px-2 py-1 rounded">
                  Frame ${index + 1}/${totalFrames}
                </span>
                <div class="w-full aspect-square flex items-center justify-center bg-gray-800/50 rounded">
                  <div class="text-xs text-gray-500">Waiting...</div>
                </div>
                <div class="mt-2 text-xs text-gray-500 px-1">
                  ${actionInfo.framePrompts && actionInfo.framePrompts[index] ? actionInfo.framePrompts[index] : ''}
                </div>
              </div>
            `;
          }
        }).join('')}
      </div>
      
      ${successFrames > 0 ? `
        <div class="flex justify-center mt-6">
          <button class="btn-primary px-4 py-2" onclick="downloadActionFrames('${actionId}')">
            <svg class="w-4 h-4 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
            </svg>
            Download Frames
          </button>
        </div>
      ` : ''}
    `;
    
    // If we have successful frames, create animation in the preview area
    if (successFrames > 0) {
      createActionPreviewAnimation(actionFrames.filter(frame => frame.imageUrl), actionInfo);
    }
  });
}

// Function to create an animated preview of the action
function createActionPreviewAnimation(frames, actionInfo) {
  if (!frames || frames.length === 0) return;
  
  const actionPreview = document.getElementById('actionPreview');
  if (!actionPreview) return;
  
  // Create canvas for animation
  actionPreview.innerHTML = `
    <div class="flex flex-col items-center">
      <canvas id="actionPreviewCanvas" class="border rounded-lg border-gray-700 w-full max-w-md bg-transparent"></canvas>
      <p class="mt-2 text-sm text-gray-400">${actionInfo.name} - Complete (${frames.length} frames)</p>
    </div>
  `;
  
  const canvas = document.getElementById('actionPreviewCanvas');
  const ctx = canvas.getContext('2d');
  
  // Set canvas size with standard dimensions
  const STANDARD_WIDTH = 256;
  const STANDARD_HEIGHT = 256;
  canvas.width = STANDARD_WIDTH;
  canvas.height = STANDARD_HEIGHT;
  
  // Animation settings - adjust FPS based on number of frames
  let fps = 12; // Default animation framerate
  
  // Adjust FPS based on frame count
  if (frames.length <= 2) {
    fps = 1.5; // Very slow for 1-2 frames
  } else if (frames.length <= 4) {
    fps = 3; // Slow for 3-4 frames
  } else if (frames.length <= 6) {
    fps = 5; // Medium-slow for 5-6 frames
  } else if (frames.length <= 8) {
    fps = 8; // Medium speed for 7-8 frames
  }
  // For more than 8 frames, keep the default 12 FPS
  
  const frameTime = 1000 / fps;
  let frameImages = [];
  let currentFrame = 0;
  let animationId = null;
  let lastTime = 0;
  
  // Load all frame images
  const loadImages = async () => {
    frameImages = await Promise.all(frames.map(frame => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.src = frame.imageUrl;
      });
    }));
    
    // Start animation once images are loaded
    if (frameImages.length > 0) {
      startAnimation();
    }
  };
  
  // Animation loop
  const animate = (timestamp) => {
    if (!timestamp) timestamp = 0;
    
    const elapsed = timestamp - lastTime;
    
    if (elapsed > frameTime) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      if (frameImages[currentFrame]) {
        // Center the image on the canvas
        const img = frameImages[currentFrame];
        
        // Better image quality settings
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        // Draw the current frame centered on the canvas
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      }
      
      // Advance to next frame
      currentFrame = (currentFrame + 1) % frameImages.length;
      lastTime = timestamp;
    }
    
    // Continue animation loop
    animationId = requestAnimationFrame(animate);
  };
  
  // Start the animation
  const startAnimation = () => {
    if (animationId) {
      cancelAnimationFrame(animationId);
    }
    
    // Show the preview container
    actionPreview.classList.remove('hidden');
    
    // Start animation loop
    animationId = requestAnimationFrame(animate);
  };
  
  // Clean up function (not used but good practice)
  const cleanup = () => {
    if (animationId) {
      cancelAnimationFrame(animationId);
    }
  };
  
  // Load images and start animation
  loadImages();
  
  // Return cleanup function
  return cleanup;
}

// Function to download action frames
async function downloadActionFrames(actionId) {
  const state = getState();
  
  // Filter frames for the selected action
  const actionFrames = state.generatedFrames.filter(frame => 
    frame.actionId === actionId && 
    frame.styleId === state.selectedStyle &&
    frame.imageUrl // Only include successful frames that have an image URL
  );
  
  if (actionFrames.length === 0) {
    alert('No frames to download');
    return;
  }
  
  try {
    // Check if JSZip is loaded
    if (typeof JSZip !== 'function') {
      alert('JSZip library is not loaded. Cannot create ZIP file.');
      return;
    }
    
    const zip = new JSZip();
    const folder = zip.folder(`${state.selectedStyle}_${actionId}`);
    
    // Add frames to zip
    actionFrames.forEach((frame, index) => {
      const imgData = frame.imageUrl.split(',')[1]; // Remove data:image/png;base64,
      folder.file(`frame_${String(index+1).padStart(2, '0')}.png`, imgData, {base64: true});
    });
    
    // Generate zip file
    const content = await zip.generateAsync({type: 'blob'});
    
    // Create download link
    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = `${state.selectedStyle}_${actionId}_frames.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    console.log(`Downloaded ${actionFrames.length} frames for ${actionId} action`);
  } catch (error) {
    console.error('Error downloading frames:', error);
    alert('Failed to download frames: ' + error.message);
  }
}

// Make the download function available globally
window.downloadActionFrames = downloadActionFrames;

// Create frame edit modal
const editModal = document.createElement('div');
editModal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] hidden';
editModal.id = 'frameEditModal';

const editContent = document.createElement('div');
editContent.className = 'relative bg-gray-800 p-8 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-auto text-gray-100';
editModal.appendChild(editContent);

// Append edit modal to body
document.body.insertBefore(editModal, document.body.firstChild);

// Function to show frame edit modal
async function showFrameEditModal(actionId, frameIndex) {
  const state = getState();
  
  // Find the frame in state
  const frame = state.generatedFrames.find(f => 
    f.actionId === actionId && 
    f.styleId === state.selectedStyle && 
    f.frameIndex === frameIndex
  );
  
  if (!frame) {
    console.error('Frame not found:', actionId, frameIndex);
    return;
  }
  
  // Find adjacent frames for reference
  const prevFrame = state.generatedFrames.find(f => 
    f.actionId === actionId && 
    f.styleId === state.selectedStyle && 
    f.frameIndex === frameIndex - 1 &&
    f.imageUrl // Only consider frames with images
  );
  
  const nextFrame = state.generatedFrames.find(f => 
    f.actionId === actionId && 
    f.styleId === state.selectedStyle && 
    f.frameIndex === frameIndex + 1 &&
    f.imageUrl // Only consider frames with images
  );
  
  // Import necessary modules
  const promptsModule = await import('./prompts.js');
  const actionInfo = promptsModule.ACTION_PROMPTS[actionId];
  
  if (!actionInfo) {
    console.error('Action info not found:', actionId);
    return;
  }
  
  // Get or generate the prompt for this frame
  const promptKey = `${actionId}_${frameIndex}`;
  let prompt = framePrompts.get(promptKey);
  
  if (!prompt) {
    // Generate a prompt for this frame
    prompt = promptsModule.generateSpritePrompt(
      state.selectedStyle,
      actionId,
      state.currentReferenceToken || 'REF_CHAR',
      undefined,
      frameIndex,
      frameIndex > 0 // Use continuity parameter for non-first frames
    );
    
    // Add extra continuity instructions if this isn't the first frame
    if (frameIndex > 0) {
      prompt += "\n\nIMPORTANT: Maintain exact same color palette, style, and character design as previous frame. This is part of a continuous animation sequence.";
    }
    
    framePrompts.set(promptKey, prompt);
  }

  // Create modal content with comparison frames
  let referenceFramesHtml = '';
  
  if (prevFrame || nextFrame) {
    referenceFramesHtml = `
      <div class="mb-4 p-3 bg-gray-900 rounded-lg">
        <h4 class="text-sm font-medium text-gray-300 mb-2">Reference Frames for Color/Style Consistency:</h4>
        <div class="flex gap-3 justify-center">
          ${prevFrame ? `
            <div class="text-center">
              <img src="${prevFrame.imageUrl}" alt="Previous Frame" class="h-24 w-auto object-contain bg-black/20 rounded p-1">
              <span class="text-xs text-gray-400 block mt-1">Frame ${frameIndex}</span>
            </div>
          ` : ''}
          ${frame.imageUrl ? `
            <div class="text-center">
              <img src="${frame.imageUrl}" alt="Current Frame" class="h-24 w-auto object-contain bg-black/20 rounded p-1 border border-primary/50">
              <span class="text-xs text-gray-400 block mt-1">Frame ${frameIndex + 1} (Current)</span>
            </div>
          ` : ''}
          ${nextFrame ? `
            <div class="text-center">
              <img src="${nextFrame.imageUrl}" alt="Next Frame" class="h-24 w-auto object-contain bg-black/20 rounded p-1">
              <span class="text-xs text-gray-400 block mt-1">Frame ${frameIndex + 2}</span>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  editContent.innerHTML = `
    <button class="absolute top-3 right-3 bg-gray-900 bg-opacity-50 hover:bg-opacity-75 text-white hover:text-gray-300 rounded-full p-2 cursor-pointer" onclick="closeFrameEditModal()">✕</button>
    <h3 class="text-xl font-semibold text-gray-100 mb-4">Edit Frame ${frameIndex + 1}</h3>
    
    ${referenceFramesHtml}
    
    <div class="space-y-6">
      <div class="flex gap-4">
        <div class="w-1/3">
          <div class="bg-gray-900 rounded-lg p-2 mb-3">
            <img src="${frame.imageUrl || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgZmlsbD0iIzMzMyIvPjx0ZXh0IHg9IjY0IiB5PSI2NCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE2IiBmaWxsPSIjZmZmIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBhbGlnbm1lbnQtYmFzZWxpbmU9Im1pZGRsZSI+RXJyb3I8L3RleHQ+PC9zdmc+'}" 
                 alt="Frame ${frameIndex + 1}" 
                 class="w-full h-auto rounded">
          </div>
          <div class="text-xs text-gray-400">
            <p><strong>Action:</strong> ${actionInfo.name}</p>
            <p><strong>Frame:</strong> ${frameIndex + 1}/${actionInfo.frames}</p>
            <p class="mt-2"><strong>Description:</strong></p>
            <p>${actionInfo.framePrompts[frameIndex] || 'No description available'}</p>
          </div>
        </div>
        <div class="w-2/3">
          <label class="block text-sm font-medium text-gray-300 mb-2">
            Customize Generation Prompt
          </label>
          <div class="text-xs text-gray-400 mb-2">
            Edit the prompt below to customize this frame. You can add specific details or modify the existing prompt.
            ${frameIndex > 0 ? `<span class="text-yellow-400">For best results, maintain color palette and style consistency with previous frames.</span>` : ''}
          </div>
          <textarea id="framePrompt" class="w-full min-h-[200px] p-2 border border-gray-600 rounded-md bg-gray-700 text-gray-100 font-mono resize-vertical focus:outline-none focus:border-primary-500">${prompt}</textarea>
        </div>
      </div>
      <div class="flex justify-end gap-3">
        <button onclick="closeFrameEditModal()" 
                class="px-4 py-2 text-sm font-medium text-gray-200 bg-gray-700 
                       rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 
                       focus:ring-offset-2 focus:ring-gray-500">
          Cancel
        </button>
        <button onclick="regenerateFrame('${actionId}', ${frameIndex})"
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
  
  // Show the modal
  editModal.classList.remove('hidden');
}

// Function to close frame edit modal
function closeFrameEditModal() {
  editModal.classList.add('hidden');
}

// Function to regenerate a specific frame
async function regenerateFrame(actionId, frameIndex) {
  const state = getState();
  const customPrompt = document.getElementById('framePrompt').value;
  
  if (!customPrompt) {
    alert('Please enter a prompt for the frame');
    return;
  }
  
  // Store the custom prompt
  const promptKey = `${actionId}_${frameIndex}`;
  framePrompts.set(promptKey, customPrompt);
  
  try {
    // Find the frame in the state
    const frames = [...(state.generatedFrames || [])];
    const frameIdx = frames.findIndex(f => 
      f.actionId === actionId && 
      f.styleId === state.selectedStyle && 
      f.frameIndex === frameIndex
    );
    
    // Update to loading state using loading.svg
    if (frameIdx !== -1) {
      frames[frameIdx] = { 
        actionId, 
        styleId: state.selectedStyle, 
        frameIndex, 
        loading: true 
      };
    } else {
      frames.push({ 
        actionId, 
        styleId: state.selectedStyle, 
        frameIndex, 
        loading: true 
      });
    }
    
    // Update state and display
    updateState({ generatedFrames: frames });
    displayActionFrames(actionId);
    
    // Close modal
    closeFrameEditModal();
    
    // Make sure we have the API functions
    if (typeof window.callOpenAIEdit !== 'function') {
      const apiModule = await import('./api.js');
      window.callOpenAIEdit = apiModule.callOpenAIEdit;
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
          f.actionId === actionId && 
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
          f.actionId === actionId && 
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
    const result = await window.callOpenAIEdit(
      customPrompt,
      inputImage,
      state.apiKey,
      state.selectedModel
    ).catch(error => {
      console.error(`API call error when regenerating frame ${frameIndex}:`, error);
      throw new Error(`Failed to regenerate frame: ${error.message || 'API error'}`);
    });
    
    // Update frame with new result
    const updatedFrames = [...(state.generatedFrames || [])];
    const updateIdx = updatedFrames.findIndex(f => 
      f.actionId === actionId && 
      f.styleId === state.selectedStyle && 
      f.frameIndex === frameIndex
    );
    
    if (updateIdx !== -1) {
      updatedFrames[updateIdx] = { 
        actionId, 
        styleId: state.selectedStyle, 
        frameIndex, 
        imageUrl: result 
      };
    } else {
      updatedFrames.push({ 
        actionId, 
        styleId: state.selectedStyle, 
        frameIndex, 
        imageUrl: result 
      });
    }
    
    // Update state and display
    updateState({ generatedFrames: updatedFrames });
    displayActionFrames(actionId);
    
    // Update animation preview if appropriate
    const actionPreview = document.getElementById('actionPreview');
    if (actionPreview) {
      const validFrames = updatedFrames.filter(f => 
        f.actionId === actionId && 
        f.styleId === state.selectedStyle && 
        f.imageUrl
      );
      
      if (validFrames.length > 0) {
        // Import necessary modules
        const promptsModule = await import('./prompts.js');
        const actionInfo = promptsModule.ACTION_PROMPTS[actionId];
        if (actionInfo) {
          createActionPreviewAnimation(validFrames, actionInfo);
        }
      }
    }
    
  } catch (error) {
    console.error(`Error regenerating frame ${frameIndex}:`, error);
    
    // Update frame with error
    const frames = [...(state.generatedFrames || [])];
    const frameIdx = frames.findIndex(f => 
      f.actionId === actionId && 
      f.styleId === state.selectedStyle && 
      f.frameIndex === frameIndex
    );
    
    if (frameIdx !== -1) {
      frames[frameIdx] = { 
        actionId, 
        styleId: state.selectedStyle, 
        frameIndex, 
        error: error.message || 'Generation failed' 
      };
    } else {
      frames.push({ 
        actionId, 
        styleId: state.selectedStyle, 
        frameIndex, 
        error: error.message || 'Generation failed' 
      });
    }
    
    // Update state and display
    updateState({ generatedFrames: frames });
    displayActionFrames(actionId);
    
    // Show error
    alert(`Failed to regenerate frame: ${error.message || 'Unknown error'}`);
  }
}

// Make frame edit functions available globally
window.showFrameEditModal = showFrameEditModal;
window.closeFrameEditModal = closeFrameEditModal;
window.regenerateFrame = regenerateFrame;

//////////////////////////////
//  Initialize action selection  //
//////////////////////////////
async function initializeActionSelection() {
  console.log('Initializing action selection UI for step 2');
  const state = getState();
  
  // Double-check that we have the required data
  if (!state.selectedStyle) {
    console.error('Cannot initialize step 2: missing style selection');
    showActionError('Style selection missing', 'Please return to step 1 and select a style.');
    return;
  }
  
  if (!state.uploadedImage) {
    console.error('Cannot initialize step 2: missing uploaded image');
    showActionError('Image upload missing', 'Please return to step 1 and upload an image.');
    return;
  }
  
  // Update the style preview in step 2
  const styledImagePreview = document.getElementById('styledImagePreview');
  if (styledImagePreview) {
    // Set loading state
    styledImagePreview.src = 'media/loading.svg';
    styledImagePreview.alt = 'Loading style preview...';
    
    try {
      const generatedStyle = state.generatedStyles?.find(s => s.id === state.selectedStyle);
      if (generatedStyle && generatedStyle.imageUrl) {
        styledImagePreview.src = generatedStyle.imageUrl;
        styledImagePreview.alt = `${state.selectedStyle} style preview`;
        styledImagePreview.classList.remove('hidden');
      } else if (state.selectedStyle === 'original' && state.uploadedImageUrl) {
        // For original style, just show the uploaded image
        styledImagePreview.src = state.uploadedImageUrl;
        styledImagePreview.alt = 'Original image';
        styledImagePreview.classList.remove('hidden');
      } else {
        // Fallback to placeholder
        styledImagePreview.src = 'media/style_previews/placeholder.svg';
        styledImagePreview.alt = 'Style preview';
        styledImagePreview.classList.remove('hidden');
        
        console.warn(`No generated style image found for ${state.selectedStyle}, using placeholder.`);
      }
    } catch (error) {
      console.error('Error displaying styled image:', error);
      styledImagePreview.src = 'media/style_previews/placeholder.svg';
      styledImagePreview.alt = 'Style preview';
      styledImagePreview.classList.remove('hidden');
    }
  }
  
  // Load actions from prompts.js
  try {
    console.log('Loading actions from prompts.js');
    const actionSelect = document.getElementById('actionSelect');
    const actionDescription = document.getElementById('actionDescription');
    
    if (actionSelect) {
      // Clear existing options except the placeholder
      while (actionSelect.options.length > 1) {
        actionSelect.remove(1);
      }
      
      // Import action prompts
      const { ACTION_PROMPTS } = await import('./prompts.js');
      console.log(`Loaded ${Object.keys(ACTION_PROMPTS).length} actions from prompts.js`);
      
      if (!ACTION_PROMPTS || Object.keys(ACTION_PROMPTS).length === 0) {
        throw new Error('No actions found in ACTION_PROMPTS');
      }
      
      // Add actions to select
      Object.entries(ACTION_PROMPTS).forEach(([actionId, actionData]) => {
        const option = document.createElement('option');
        option.value = actionId;
        option.textContent = actionData.name;
        option.dataset.frames = actionData.frames;
        option.dataset.description = actionData.basePrompt;
        actionSelect.appendChild(option);
      });
      
      // Add event listener to update description when action changes
      actionSelect.addEventListener('change', () => {
        const selectedOption = actionSelect.options[actionSelect.selectedIndex];
        const generateActionBtn = document.getElementById('generateActionBtn');
        
        if (selectedOption && selectedOption.value) {
          // Update action description
          const frames = selectedOption.dataset.frames;
          const description = selectedOption.dataset.description;
          if (actionDescription) {
            actionDescription.innerHTML = `
              <p class="mb-1">${description}</p>
              <div class="flex items-center mt-2">
                <span class="bg-gray-800 text-xs text-gray-300 px-2 py-1 rounded mr-2">
                  ${frames} frames
                </span>
              </div>
            `;
          }
          
          // Enable generate button
          if (generateActionBtn) {
            generateActionBtn.disabled = false;
          }
          
          // Update state
          updateState({ selectedAction: selectedOption.value });
          
          // Update frames display if we already have generated frames
          displayActionFrames(selectedOption.value);
        } else {
          // Disable generate button if no action is selected
          if (generateActionBtn) {
            generateActionBtn.disabled = true;
          }
          
          // Reset description
          if (actionDescription) {
            actionDescription.textContent = 'Select an action to see its description and frame count.';
          }
        }
      });
      
      // Initially disable the generate button
      const generateActionBtn = document.getElementById('generateActionBtn');
      if (generateActionBtn) {
        generateActionBtn.disabled = !actionSelect.value;
      }
      
      console.log('Action selection UI initialized successfully');
    } else {
      throw new Error('Action select element not found in the DOM');
    }
  } catch (error) {
    console.error('Error loading actions:', error);
    showActionError('Failed to load actions', error.message);
  }
}

// Helper function to show an error in the action selection UI
function showActionError(title, message) {
  const actionDescription = document.getElementById('actionDescription');
  if (actionDescription) {
    actionDescription.innerHTML = `
      <div class="p-4 bg-red-900/20 rounded-lg text-center">
        <p class="text-red-400 font-semibold">${title}</p>
        <p class="text-sm text-gray-400 mt-2">${message}</p>
      </div>
    `;
  }
  
  // Disable the generate button
  const generateActionBtn = document.getElementById('generateActionBtn');
  if (generateActionBtn) {
    generateActionBtn.disabled = true;
  }
}
