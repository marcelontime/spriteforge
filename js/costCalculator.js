// Constants for pricing (USD per 1000 tokens)
const PRICE_PER_K_TEXT = 0.005;        // Text input tokens ($5.00 / 1M tokens)
const PRICE_PER_K_IMG_INPUT = 0.010;   // Image input tokens ($10.00 / 1M tokens)
const PRICE_PER_K_IMG_OUTPUT = 0.040;  // Image output tokens ($40.00 / 1M tokens)

// Token costs for 1024x1024 (square) based on quality
const QUALITY_TOKENS = {
  low: 272,      // 272 tokens for low quality
  medium: 1056,  // 1056 tokens for medium quality
  high: 4160     // 4160 tokens for high quality
};

// Image quality costs calculated from token usage
const IMAGE_QUALITY_COSTS = {
  low: (QUALITY_TOKENS.low / 1000) * PRICE_PER_K_IMG_OUTPUT,    // Based on 272 tokens
  medium: (QUALITY_TOKENS.medium / 1000) * PRICE_PER_K_IMG_OUTPUT, // Based on 1056 tokens
  high: (QUALITY_TOKENS.high / 1000) * PRICE_PER_K_IMG_OUTPUT     // Based on 4160 tokens
};

/**
 * Calculate number of 1024x1024 tiles needed for an image
 */
function calculateTiles(width, height) {
  return Math.ceil(width / 1024) * Math.ceil(height / 1024);
}

/**
 * Calculate tokens for an image based on dimensions and quality
 */
function calculateImageTokens(width, height, quality = 'low') {
  const baseTokens = QUALITY_TOKENS[quality] || QUALITY_TOKENS.low;
  return baseTokens * calculateTiles(width, height);
}

/**
 * Estimate text tokens (simplified version since we don't have tiktoken)
 * This is a rough approximation - in production you'd want to use a proper tokenizer
 */
function estimateTextTokens(text) {
  // Rough approximation: ~4 characters per token
  return Math.ceil(text.length / 4);
}

export class CostCalculator {
  constructor() {
    this.reset();
  }

  reset() {
    this.totalCost = 0;
    this.totalImages = 0;
    this.imageInputTokens = 0;
    this.imageOutputTokens = 0;
    this.textTokens = 0;
  }

  /**
   * Calculate cost for a single image generation
   */
  estimateGenerationCost({ 
    prompt, 
    referenceWidth = 1024, 
    referenceHeight = 1024,
    outputWidth = 1024, 
    outputHeight = 1024,
    quality = 'low' // 'low', 'medium', or 'high'
  }) {
    // Calculate token-based costs
    const textTokens = estimateTextTokens(prompt);
    const inputImageTokens = calculateImageTokens(referenceWidth, referenceHeight, quality);
    const outputImageTokens = calculateImageTokens(outputWidth, outputHeight, quality);

    const textCost = (textTokens / 1000) * PRICE_PER_K_TEXT;
    const inputImageCost = (inputImageTokens / 1000) * PRICE_PER_K_IMG_INPUT;
    const outputImageCost = (outputImageTokens / 1000) * PRICE_PER_K_IMG_OUTPUT;

    // Get the fixed cost based on quality
    const qualityCost = IMAGE_QUALITY_COSTS[quality] || IMAGE_QUALITY_COSTS.low;

    // Total cost is the sum of token-based costs and quality-based cost
    const totalCost = textCost + inputImageCost + outputImageCost + qualityCost;

    return {
      cost: +totalCost.toFixed(4),
      textTokens,
      inputImageTokens,
      outputImageTokens,
      qualityCost,
      breakdown: {
        textCost: +textCost.toFixed(4),
        inputImageCost: +inputImageCost.toFixed(4),
        outputImageCost: +outputImageCost.toFixed(4),
        qualityCost: +qualityCost.toFixed(4)
      }
    };
  }

  /**
   * Add a completed image generation to the running total
   */
  addImageGeneration(prompt, options = {}) {
    const {
      referenceWidth = 1024,
      referenceHeight = 1024,
      outputWidth = 1024,
      outputHeight = 1024,
      quality = 'low'
    } = options;

    const estimation = this.estimateGenerationCost({
      prompt,
      referenceWidth,
      referenceHeight,
      outputWidth,
      outputHeight,
      quality
    });

    this.totalCost += estimation.cost;
    this.totalImages += 1;
    this.imageInputTokens += estimation.inputImageTokens;
    this.imageOutputTokens += estimation.outputImageTokens;
    this.textTokens += estimation.textTokens;

    return estimation;
  }

  /**
   * Get current usage statistics
   */
  getCurrentUsage() {
    return {
      totalImages: this.totalImages,
      totalCost: this.totalCost,
      formattedTotal: `$${this.totalCost.toFixed(2)}`,
      tokenUsage: {
        text: this.textTokens,
        imageInput: this.imageInputTokens,
        imageOutput: this.imageOutputTokens
      }
    };
  }

  /**
   * Estimate cost for a batch of generations
   */
  estimateBatchCost(count, averagePromptLength = 200, quality = 'low') {
    const singleEstimate = this.estimateGenerationCost({
      prompt: 'x'.repeat(averagePromptLength),
      quality
    });

    const totalCost = singleEstimate.cost * count;
    return {
      estimatedCost: totalCost,
      formattedEstimate: `$${totalCost.toFixed(2)}`,
      perImage: singleEstimate.cost,
      totalTokens: {
        text: singleEstimate.textTokens * count,
        imageInput: singleEstimate.inputImageTokens * count,
        imageOutput: singleEstimate.outputImageTokens * count
      }
    };
  }
} 