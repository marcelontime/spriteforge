import { generateSpritePrompt, getActionFrameCount, isAnimationComplete, STYLE_DEFINITIONS } from './prompts.js';

export class SpriteAnimationManager {
  constructor(apiKey, maxWorkers = 3) {
    this.apiKey = apiKey;
    this.maxWorkers = maxWorkers;
    this.workers = new Map();
    this.frameQueue = [];
    this.completedFrames = new Map();
    this.activeWorkers = 0;
    this.onFrameComplete = null;
    this.onAnimationComplete = null;
    this.onError = null;
    this.referenceImage = null;
  }

  initialize() {
    // Create worker pool
    for (let i = 0; i < this.maxWorkers; i++) {
      const worker = new Worker('./workers/spriteWorker.js', { type: 'module' });
      worker.onmessage = this.handleWorkerMessage.bind(this);
      worker.postMessage({ type: 'INIT', payload: { apiKey: this.apiKey } });
      this.workers.set(i, { worker, busy: false });
    }
  }

  async generateAnimation(styleId, actionId, referenceToken, seed = undefined) {
    const totalFrames = getActionFrameCount(actionId);
    const style = STYLE_DEFINITIONS[styleId];
    
    // Reset state
    this.frameQueue = [];
    this.completedFrames.clear();
    
    // Store reference image if using original style
    if (style?.isReferenceOnly) {
      this.referenceImage = referenceToken;
    }
    
    // Generate prompts for all frames and add to queue
    for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
      const prompt = generateSpritePrompt(
        styleId,
        actionId,
        referenceToken,
        seed,
        frameIndex,
        frameIndex > 0 ? this.completedFrames.get(frameIndex - 1) : null
      );
      
      this.frameQueue.push({
        styleId,
        actionId,
        frameIndex,
        prompt,
        attempts: 0,
        isReferenceStyle: style?.isReferenceOnly
      });
    }

    // Start processing queue
    this.processQueue();
  }

  processQueue() {
    // Find available workers
    for (const [workerId, workerInfo] of this.workers) {
      if (!workerInfo.busy && this.frameQueue.length > 0) {
        const frame = this.frameQueue.shift();
        this.assignFrameToWorker(workerId, frame);
      }
    }
  }

  assignFrameToWorker(workerId, frame) {
    const workerInfo = this.workers.get(workerId);
    if (!workerInfo) return;

    workerInfo.busy = true;
    this.activeWorkers++;

    const { styleId, actionId, frameIndex, prompt, isReferenceStyle } = frame;
    const previousFrame = frameIndex > 0 ? this.completedFrames.get(frameIndex - 1) : null;

    workerInfo.worker.postMessage({
      type: 'GENERATE_FRAME',
      payload: {
        styleId,
        actionId,
        frameIndex,
        prompt,
        previousFrame,
        referenceImage: isReferenceStyle ? this.referenceImage : null,
        isReferenceStyle
      }
    });
  }

  handleWorkerMessage(event) {
    const { type, payload } = event.data;
    const worker = event.target;
    const workerId = this.findWorkerById(worker);

    if (workerId !== null) {
      this.workers.get(workerId).busy = false;
      this.activeWorkers--;
    }

    switch (type) {
      case 'FRAME_COMPLETE':
        this.handleFrameComplete(payload);
        break;
      case 'FRAME_ERROR':
        this.handleFrameError(payload);
        break;
    }

    // Continue processing queue
    this.processQueue();
  }

  handleFrameComplete({ frameIndex, styleId, actionId, imageData }) {
    // Store the completed frame
    this.completedFrames.set(frameIndex, imageData);

    // Notify listener
    if (this.onFrameComplete) {
      this.onFrameComplete(frameIndex, imageData);
    }

    // Check if animation is complete
    if (this.isAnimationComplete(actionId)) {
      const frames = Array.from(this.completedFrames.entries())
        .sort(([a], [b]) => a - b)
        .map(([_, image]) => image);

      if (this.onAnimationComplete) {
        this.onAnimationComplete(frames);
      }
    }
  }

  handleFrameError({ frameIndex, styleId, actionId, error }) {
    const frame = {
      styleId,
      actionId,
      frameIndex,
      prompt: generateSpritePrompt(styleId, actionId, 'REF_CHAR', undefined, frameIndex),
      attempts: (this.frameQueue.find(f => f.frameIndex === frameIndex)?.attempts || 0) + 1
    };

    if (frame.attempts < 3) {
      // Retry the frame
      this.frameQueue.push(frame);
    } else if (this.onError) {
      this.onError(frameIndex, error);
    }
  }

  findWorkerById(worker) {
    for (const [id, info] of this.workers) {
      if (info.worker === worker) return id;
    }
    return null;
  }

  isAnimationComplete(actionId) {
    const totalFrames = getActionFrameCount(actionId);
    return this.completedFrames.size === totalFrames;
  }

  cleanup() {
    // Terminate all workers
    for (const { worker } of this.workers.values()) {
      worker.terminate();
    }
    this.workers.clear();
    this.frameQueue = [];
    this.completedFrames.clear();
  }
} 