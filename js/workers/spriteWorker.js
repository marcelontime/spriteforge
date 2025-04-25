// Web Worker for handling sprite generation API calls
let apiKey = null;

self.onmessage = async function(e) {
  const { type, payload } = e.data;
  
  switch (type) {
    case 'INIT':
      apiKey = payload.apiKey;
      break;
      
    case 'GENERATE_FRAME':
      try {
        const { styleId, actionId, frameIndex, prompt, previousFrame, referenceImage, isReferenceStyle } = payload;
        
        // For reference style, we'll use image-to-image generation
        const requestBody = isReferenceStyle ? {
          prompt: prompt,
          n: 1,
          size: "512x512",
          response_format: "b64_json",
          image: referenceImage.split(',')[1], // Remove data:image/png;base64, prefix
          mask: null // Optional: could be used to mask specific areas
        } : {
          prompt: prompt,
          n: 1,
          size: "512x512",
          response_format: "b64_json"
        };

        // Make the API call to generate the frame
        const response = await fetch(
          isReferenceStyle ? 
            'https://api.openai.com/v1/images/variations' : 
            'https://api.openai.com/v1/images/generations', 
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(requestBody)
          }
        );

        if (!response.ok) {
          throw new Error(`API call failed: ${response.statusText}`);
        }

        const data = await response.json();
        
        // Send the generated image back to the main thread
        self.postMessage({
          type: 'FRAME_COMPLETE',
          payload: {
            frameIndex,
            styleId,
            actionId,
            imageData: data.data[0].b64_json,
            error: null
          }
        });
      } catch (error) {
        self.postMessage({
          type: 'FRAME_ERROR',
          payload: {
            frameIndex,
            styleId,
            actionId,
            error: error.message
          }
        });
      }
      break;
  }
}; 