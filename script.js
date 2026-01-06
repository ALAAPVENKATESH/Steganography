// Hook up your UI as before; this file focuses on the logic.
// jQuery expected (as in your original).

$('button.encode, button.decode').click(function(event) {
  event.preventDefault();
});

// AI Image Generation Function using Freepik Mystic API
async function generateAIImage(prompt, secretMessage) {
    const apiKey = '           '; // Your Freepik API key
    const url = 'https://api.freepik.com/v1/ai/mystic';
    
    try {
        // Show loading state
        $('.genai-result').hide();
        const loadingHtml = `
            <div class="text-center py-4">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-2">Generating your image... This may take a moment.</p>
            </div>`;
        $('.genai-result').html(loadingHtml).show();

        // Call the Freepik Mystic API
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Freepik-API-Key': apiKey
            },
            body: JSON.stringify({
                prompt: prompt,
                resolution: "2k",
                aspect_ratio: "square_1_1",
                model: "fluid",
                creative_detailing: 50,
                filter_nsfw: true
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `API request failed: ${response.status}`);
        }

        const data = await response.json();
        
        // Check if the task was created successfully
        if (!data.data || !data.data.task_id) {
            throw new Error('Failed to create image generation task');
        }

        // Poll for the task status
        return await pollForGeneratedImage(data.data.task_id, apiKey);

    } catch (error) {
        console.error('Error generating image:', error);
        $('.genai-result').html(`
            <div class="alert alert-danger">
                <i class="fas fa-exclamation-triangle me-2"></i>
                Error: ${error.message || 'Failed to generate image'}
            </div>
        `).show();
        throw error;
    }
}

// Helper function to poll for the generated image
async function pollForGeneratedImage(taskId, apiKey, maxRetries = 20) {
    const pollUrl = `https://api.freepik.com/v1/tasks/${taskId}`;
    let retries = 0;
    
    while (retries < maxRetries) {
        try {
            // Update loading message with retry count
            $('.genai-result').html(`
                <div class="text-center py-4">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    <p class="mt-2">Generating your image... (${retries * 2}s elapsed)</p>
                    <div class="progress mt-2" style="height: 5px;">
                        <div class="progress-bar progress-bar-striped progress-bar-animated" style="width: ${Math.min(95, (retries / maxRetries) * 100)}%"></div>
                    </div>
                </div>
            `);

            const response = await fetch(pollUrl, {
                headers: {
                    'X-Freepik-API-Key': apiKey
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to check task status: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.data.status === 'COMPLETED' && data.data.generated && data.data.generated.length > 0) {
                // Image is ready, load and return it
                const img = new Image();
                img.crossOrigin = 'anonymous';
                
                return new Promise((resolve, reject) => {
                    img.onload = function() {
                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');
                        canvas.width = img.width;
                        canvas.height = img.height;
                        ctx.drawImage(img, 0, 0, img.width, img.height);
                        resolve(canvas);
                    };
                    img.onerror = () => reject(new Error('Failed to load the generated image'));
                    img.src = data.data.generated[0];
                });
            } else if (data.data.status === 'FAILED') {
                throw new Error('Image generation failed');
            }

            // Wait before polling again (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, 2000 * (Math.floor(retries/3) + 1)));
            retries++;
            
        } catch (error) {
            console.error('Error polling for image:', error);
            if (retries >= maxRetries - 1) {
                throw new Error('Image generation timed out. Please try again.');
            }
            await new Promise(resolve => setTimeout(resolve, 3000)); // Wait before retry
        }
    }

    throw new Error('Image generation timed out. Please try again.');
}

// Function to handle AI-based encoding
async function encodeWithAI() {
    const prompt = document.getElementById('promptInput').value;
    const message = document.getElementById('secretMessage').value;
    
    if (!prompt || !message) {
        alert('Please provide both an image prompt and a secret message');
        return;
    }
    
    try {
        // Generate the AI image
        const generatedCanvas = await generateAIImage(prompt, message);
        
        // Display the generated image
        const generatedCtx = document.getElementById('generatedCanvas').getContext('2d');
        generatedCtx.canvas.width = generatedCanvas.width;
        generatedCtx.canvas.height = generatedCanvas.height;
        generatedCtx.drawImage(generatedCanvas, 0, 0);
        
        // Encode the message into the image
        encodeMessageIntoCanvas(generatedCanvas, message);
        
        // Show the result section
        $('.genai-result').show();
    } catch (error) {
        console.error('Error in encodeWithAI:', error);
    }
}

// Helper function to encode message into a canvas
function encodeMessageIntoCanvas(canvas, message) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // Get image data
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    
    // Convert message to binary
    const textEncoder = new TextEncoder();
    const messageBytes = textEncoder.encode(message);
    
    // Add message length (4 bytes) to the beginning
    const length = messageBytes.length;
    const payload = new Uint8Array(4 + length);
    payload[0] = (length >>> 24) & 0xFF;
    payload[1] = (length >>> 16) & 0xFF;
    payload[2] = (length >>> 8) & 0xFF;
    payload[3] = length & 0xFF;
    payload.set(messageBytes, 4);
    
    // Check if the image can hold the message
    const totalBits = payload.length * 8;
    const capacity = width * height * 3; // 3 bits per pixel (R,G,B)
    
    if (totalBits > capacity) {
        alert('Message is too long for the generated image');
        return;
    }
    
    // Encode the message in the LSB of the image
    let bitIndex = 0;
    for (let byteIndex = 0; byteIndex < payload.length; byteIndex++) {
        const byte = payload[byteIndex];
        for (let bit = 7; bit >= 0; bit--, bitIndex++) {
            const bitVal = (byte >> bit) & 1;
            const pixelIndex = Math.floor(bitIndex / 3) * 4;
            const channel = bitIndex % 3; // 0 = R, 1 = G, 2 = B
            
            // Clear the LSB and set it to our bit
            data[pixelIndex + channel] = (data[pixelIndex + channel] & 0xFE) | bitVal;
        }
    }
    
    // Put the modified data back to the canvas
    ctx.putImageData(imageData, 0, 0);
    
    // Update the encoded canvas
    const encodedCanvas = document.getElementById('encodedCanvas');
    const encodedCtx = encodedCanvas.getContext('2d');
    encodedCanvas.width = width;
    encodedCanvas.height = height;
    encodedCtx.drawImage(canvas, 0, 0);
    
    // Show download button
    const downloadBtn = document.createElement('button');
    downloadBtn.className = 'btn btn-primary mt-3';
    downloadBtn.innerHTML = '<i class="fas fa-download me-2"></i>Download Encoded Image';
    downloadBtn.onclick = () => {
        const link = document.createElement('a');
        link.download = 'encoded-image.png';
        link.href = encodedCanvas.toDataURL('image/png');
        link.click();
    };
    
    const downloadContainer = document.getElementById('downloadContainer');
    downloadContainer.innerHTML = '';
    downloadContainer.appendChild(downloadBtn);
}

// Original functions (kept for backward compatibility)
function previewDecodeImage() {
  const file = document.querySelector('input[name=decodeFile]').files[0];
  previewImage(file, ".decode canvas", () => $(".decode").fadeIn());
}

function previewEncodeImage() {
  const file = document.querySelector("input[name=baseFile]").files[0];
  $(".images .nulled").hide();
  $(".images .message").hide();
  previewImage(file, ".original canvas", () => {
    $(".images .original").fadeIn();
    $(".images").fadeIn();
  });
}

function previewImage(file, canvasSelector, callback) {
  const $canvas = $(canvasSelector).first();
  if (!$canvas.length) return;

  const canvasEl = $canvas[0];
  const ctx = canvasEl.getContext('2d');

  if (!file) {
    // Clear canvas if no file
    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
    return;
  }

  const reader = new FileReader();
  reader.onload = function(evt) {
    const img = new Image();
    img.onload = function() {
      canvasEl.width = img.width;
      canvasEl.height = img.height;
      ctx.drawImage(img, 0, 0);
      callback?.();
    };
    img.onerror = function() {
      console.error("Could not load image");
    };
    img.src = evt.target.result; // data URL
  };
  reader.onerror = function() {
    console.error("FileReader error");
  };
  reader.readAsDataURL(file);
}

// Rest of your existing functions...
function ctxFor(selector, width, height) {
  const $c = $(selector).first();
  $c.prop({ width, height });
  return $c[0].getContext('2d');
}

function encodeMessage() {
  $(".error").hide();
  $(".binary").hide();

  const text = $("textarea.message").val() || "";
  const $originalCanvas = $('.original canvas').first();
  if (!$originalCanvas.length) {
    $(".error").text("No original image loaded.").fadeIn();
    return;
  }
  const originalCtx = $originalCanvas[0].getContext("2d");
  const width = $originalCanvas[0].width;
  const height = $originalCanvas[0].height;

  // Convert text to bytes (UTF-8)
  const encoder = new TextEncoder();
  const msgBytes = encoder.encode(text); // Uint8Array

  // Build payload: 4 bytes length + message bytes
  const length = msgBytes.length;
  const payload = new Uint8Array(4 + length);
  payload[0] = (length >>> 24) & 0xFF;
  payload[1] = (length >>> 16) & 0xFF;
  payload[2] = (length >>> 8) & 0xFF;
  payload[3] = length & 0xFF;
  payload.set(msgBytes, 4);

  const totalBits = payload.length * 8;
  const capacity = width * height * 3; // 3 bits per pixel (R,G,B)
  if (totalBits > capacity) {
    $(".error")
      .text(`Text too long for chosen image. Need ${totalBits} bits but have ${capacity}.`)
      .fadeIn();
    return;
  }

  // Rest of the encodeMessage function...
  const original = originalCtx.getImageData(0, 0, width, height);
  const nulledData = new Uint8ClampedArray(original.data); // copy

  // Clear LSB of RGB channels
  for (let i = 0, n = nulledData.length; i < n; i += 4) {
    nulledData[i]     &= 0xFE; // R
    nulledData[i + 1] &= 0xFE; // G
    nulledData[i + 2] &= 0xFE; // B
  }

  // Put nulled image to nulled canvas
  const nulledCtx = ctxFor('.nulled canvas', width, height);
  nulledCtx.putImageData(new ImageData(nulledData, width, height), 0, 0);

  // Write payload bits into LSBs
  const messageCtx = ctxFor('.message canvas', width, height);
  const stegoData = new Uint8ClampedArray(nulledData);
  let bitIndex = 0;
  for (let byteIndex = 0; byteIndex < payload.length; byteIndex++) {
    const b = payload[byteIndex];
    for (let bit = 7; bit >= 0; bit--) { // MSB first
      const bitVal = (b >>> bit) & 1;
      const channelPos = Math.floor(bitIndex / 3) * 4 + (bitIndex % 3);
      stegoData[channelPos] |= bitVal;
      bitIndex++;
    }
  }

  messageCtx.putImageData(new ImageData(stegoData, width, height), 0, 0);

  // Show binary representation
  const binStrArr = [];
  for (let i = 0; i < payload.length; i++) {
    binStrArr.push(payload[i].toString(2).padStart(8, '0'));
  }
  $('.binary textarea').text(binStrArr.join(''));
  $(".binary").fadeIn();
  $(".images .nulled").fadeIn();
  $(".images .message").fadeIn();
}

function decodeMessage() {
  const $canvas = $('.decode canvas').first();
  if (!$canvas.length) {
    $(".error").text("No decode image loaded.").fadeIn();
    return;
  }
  const ctx = $canvas[0].getContext('2d');
  const width = $canvas[0].width;
  const height = $canvas[0].height;

  const imgData = ctx.getImageData(0, 0, width, height).data;
  const totalBitsAvailable = width * height * 3;

  // Read bits into array of 0/1
  const bits = new Uint8Array(totalBitsAvailable);
  let bIdx = 0;
  for (let i = 0, n = imgData.length; i < n && bIdx < totalBitsAvailable; i += 4) {
    bits[bIdx++] = imgData[i]     & 1; // R
    bits[bIdx++] = imgData[i + 1] & 1; // G
    bits[bIdx++] = imgData[i + 2] & 1; // B
  }

  // Read first 32 bits as big-endian length (bytes)
  if (bits.length < 32) {
    $(".error").text("Image too small to contain header").fadeIn();
    return;
  }
  let length = 0;
  for (let i = 0; i < 32; i++) {
    length = (length << 1) | bits[i];
  }

  const requiredBits = 32 + (length * 8);
  if (requiredBits > bits.length) {
    $(".error").text(`Declared length ${length} bytes exceeds image capacity.`).fadeIn();
    return;
  }

  // Extract payload bytes
  const payload = new Uint8Array(length);
  let bitPos = 32; // start after header
  for (let byteIndex = 0; byteIndex < length; byteIndex++) {
    let value = 0;
    for (let bit = 0; bit < 8; bit++) {
      value = (value << 1) | bits[bitPos++];
    }
    payload[byteIndex] = value;
  }

  // Decode UTF-8
  const decoder = new TextDecoder();
  const output = decoder.decode(payload);

  $('.binary-decode textarea').text(output);
  $('.binary-decode').fadeIn();
}
