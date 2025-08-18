// Import the built-in 'fs' (File System) module from Node.js.
// We'll use this to read the contents of our prompt.txt file.
import fs from "fs";

// Import the GoogleGenerativeAI class from the official Google library.
// This is the main class you'll use to interact with the Gemini API.
// You need to install this library using 'npm install @google/generative-ai'.
import { GoogleGenerativeAI } from "@google/generative-ai";

// This is a custom function we are creating to handle the transcription task.
// The `export` keyword makes this function available to other files (like your server.js)
// that import this module.
/**
 * @param {string} base64Image The image data encoded as a Base64 string.
 * @param {string} mimeType The MIME type of the image (e.g., 'image/jpeg', 'image/png').
 * @returns {Promise<string>} A promise that resolves to the transcribed text.
 */
export async function transcribeImage(base64Image, mimeType) {
    // It's good practice to get your API key from an environment variable
    // for security reasons. This prevents you from hardcoding it in your code.
    // Make sure to have a .env file with GEMINI_API_KEY=YOUR_API_KEY.
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    // This is where you specify the model.
    // 'gemini-1.5-flash' is the correct identifier for the Gemini 1.5 Flash model.
    // It's a multimodal model, so it can handle both text prompts and images.
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    // The text prompt is the instruction you give to the model.
    // In this case, we're asking it to transcribe the text in the image.
    const prompt = fs.readFileSync('prompt.txt', 'utf-8');

    // This object structures the image data for the Gemini API.
    // 'inlineData' is the key that tells the API you're providing a Base64 string.
    const imagePart = {
        inlineData: {
            data: base64Image,
            mimeType: mimeType,
        },
    };

    // This is the core API call. It sends both the text prompt and the image
    // to the Gemini model to get a response.
    const result = await model.generateContent([prompt, imagePart]);

    // The response object contains the generated text.
    const response = await result.response;

    // We extract the plain text from the response and return it.
    return response.text();
}