// Style selection functionality
const styleCards = document.querySelectorAll('.style-card');
let selectedStyle = null;

function selectStyle(card) {
  // Remove selection from previously selected card
  if (selectedStyle) {
    selectedStyle.classList.remove('selected');
  }
  
  // Select new card
  card.classList.add('selected');
  selectedStyle = card;
  
  // Enable next button if a style is selected
  const nextButton = document.querySelector('[data-step="2"] .btn-primary');
  if (nextButton) {
    nextButton.disabled = false;
  }
  
  // Store selected style data
  const styleData = {
    id: card.dataset.styleId,
    name: card.querySelector('.style-card-title').textContent,
    description: card.querySelector('.style-card-description').textContent,
    specs: card.querySelector('.style-card-specs').textContent,
    features: Array.from(card.querySelectorAll('.feature-tag')).map(tag => tag.textContent)
  };
  
  // Store in session storage for later use
  sessionStorage.setItem('selectedStyle', JSON.stringify(styleData));
}

// Add click handlers to style cards
styleCards.forEach(card => {
  card.addEventListener('click', () => selectStyle(card));
});

// Initialize next button state
document.addEventListener('DOMContentLoaded', () => {
  const nextButton = document.querySelector('[data-step="2"] .btn-primary');
  if (nextButton) {
    nextButton.disabled = true;
  }
}); 