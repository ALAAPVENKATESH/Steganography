# Steganography Tool (Image-Based Secret Messaging)

A client-side steganography web application that allows users to hide and extract secret messages within images using Least Significant Bit (LSB) techniques.  
The project also includes an AI-assisted image generation workflow where a generated image is automatically encoded with a hidden message.

All encoding and decoding operations are performed entirely in the browser. No data is uploaded or stored on any server.

---

## Features

### Image Steganography
- Upload an image (PNG/JPG)
- Hide secret text inside the image using LSB encoding
- Visual preview of:
  - Original image
  - Normalized (LSB-cleared) image
  - Encoded image
- Binary representation of embedded data
- Download the encoded image

### AI-Based Image Encoding
- Generate images from text prompts using an AI image generation API
- Embed a secret message into the generated image
- Download the AI-generated image containing the hidden message

### Decoding
- Decode hidden messages from previously encoded images
- UTF-8 compatible (supports non-English characters)

---

## Technology Stack

- HTML5
- CSS3
- Bootstrap 5
- JavaScript (ES6+)
- Canvas API
- jQuery
- Freepik Mystic AI API

---

## Project Structure

```text
├── index.html        # Application UI
├── script.js         # Steganography logic and AI integration
└── README.md         # Project documentation
```
##How It Works
Encoding (LSB Technique)

The input message is converted into UTF-8 bytes.

A 4-byte header is prepended to store the message length.

Each bit of the message is embedded into the least significant bit of the image’s RGB pixel values.

The visual appearance of the image remains unchanged while containing hidden data.

Decoding

LSB values are extracted from the image’s RGB channels.

The first 32 bits are read to determine message length.

The remaining bits are reconstructed into the original UTF-8 message.

##Running the Project Locally

Clone the repository:
```
git clone https://github.com/ALAAPVENKATESH/Steganography.git
```

Open index.html in any modern web browser.

No server, build tools, or additional setup is required.

AI Image Generation Notes

The AI image generation feature uses the Freepik Mystic API.

Image generation tasks are polled asynchronously until completion.

The generated image is then processed locally for message embedding.

##Security Note:
The API key is currently included in the client code for demonstration purposes.
For production use, the API key should be moved to a secure backend.

##Limitations

Maximum message length depends on image resolution.

Larger messages require higher resolution images.

Best results are achieved with PNG images.

AI image generation requires an active internet connection.
