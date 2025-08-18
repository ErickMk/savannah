import express from "express";
import cors from "cors";
import { google } from "googleapis";
import { Buffer } from "buffer";
import { transcribeImage } from "./gemini.js"; // Import the Gemini function

// --- IMPORTANT: Load environment variables at the top ---
import "dotenv/config";

// --- Initialization ---
//
// Initialize Express app
const app = express();
const port = 3000;
//
// Initialize Google Auth client
const auth = new google.auth.GoogleAuth({
    keyFile: "./norman-wachira-80a0d4c0096b.json", // Make sure this path is correct
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
});
//
// Initialize Google Drive API client
const drive = google.drive({ version: "v3", auth });
//
// --- Middleware ---
//
// Use CORS to allow requests from any origin
app.use(cors());

//
// --- Routes ---

/**
 * @route   GET /
 * @desc    Fetch a list of files from a specific Google Drive folder
 */
app.get("/", async (req, res) => {
    try {
        const response = await drive.files.list({
            q: "'1W2W6t7UIKm9330jbeCCapSKXuPG_ZwQn' in parents", // The ID of the folder
            fields: "files(id, name)",
            spaces: "drive",
        });
        //
        // Send the list of files as a JSON response
        res.json(response.data.files);
    } catch (error) {
        console.error("Error fetching file list:", error);
        res.status(500).json({ error: "Failed to retrieve file list." });
    }
});


/**
 * @route   GET /file/:fileId
 * @desc    Fetch a specific file's content by its ID and stream it
 */
app.get("/file/:fileId", async (req, res) => {
    try {
        const { fileId } = req.params;
        //
        // Get the file as a readable stream
        const file = await drive.files.get(
            { fileId: fileId, alt: "media" },
            { responseType: "stream" }
        );
        //
        // Set the header for binary file download and pipe the stream to the response
        res.setHeader("Content-Type", "application/octet-stream");
        file.data.pipe(res);

    } catch (error) {
        console.error("Error fetching file:", error);
        res.status(500).json({ error: "Failed to retrieve file." });
    }
});

/**
 * @route   GET /thumbnail/:fileId
 * @desc    Fetch a thumbnail link for a specific image by its ID
 */
app.get("/thumbnail/:fileId", async (req, res) => {
    try {
        const { fileId } = req.params;

        // Request file metadata, specifically the 'thumbnailLink' field
        const response = await drive.files.get({
            fileId: fileId,
            fields: 'id, name, thumbnailLink' // Important: Request the thumbnailLink field
        });

        const thumbnailLink = response.data.thumbnailLink;

        if (thumbnailLink) {
            // Send the thumbnail link back as JSON
            res.json({ 
                id: response.data.id,
                name: response.data.name,
                thumbnailUrl: thumbnailLink 
            });
        } else {
            // Handle cases where a thumbnail isn't available for the file type
            res.status(404).json({ error: "Thumbnail not available for this file." });
        }

    } catch (error) {
        console.error("Error fetching thumbnail:", error.message);
        // This will catch errors like "File not found" from the API
        res.status(500).json({ error: "Failed to retrieve thumbnail." });
    }
});

/**
 * @route   GET /thumbnails/:folderId
 * @desc    Fetch thumbnail links for all images in a given folder
 */
app.get("/thumbnails/:folderId", async (req, res) => {
    try {
        const { folderId } = req.params;

        // The query string is corrected to use template literals for better readability and to ensure
        // the quotes are correctly formatted for the API.
        const response = await drive.files.list({
            q: `'${folderId}' in parents and mimeType contains 'image/'`,
            fields: 'files(id, name, thumbnailLink)',
            spaces: "drive",
        });

        // Extract and format the thumbnail links, filtering out any files
        // that do not have a thumbnailLink.
        const imageThumbnails = response.data.files
            .filter(file => file.thumbnailLink)
            .map(file => ({
                id: file.id,
                name: file.name,
                thumbnailUrl: file.thumbnailLink,
            }));

        // Send the list of thumbnail links as a JSON response
        res.json(imageThumbnails);

    } catch (error) {
        console.error("Error fetching image thumbnails:", error.message);
        res.status(500).json({ error: "Failed to retrieve image thumbnails." });
    }
});

/**
 * @route   GET /transcribe/:fileId
 * @desc    Transcribe text from a Google Drive image using the Gemini API.
 */
app.get("/transcribe/:fileId", async (req, res) => {
    // A try-catch block provides robust error handling for the entire route.
    // It prevents the server from crashing on unexpected errors.
    try {
        const { fileId } = req.params;

        // Step 1: Get the file content and metadata from Google Drive.
        // We fetch the file as a stream and separately get its MIME type for validation.
        const fileResponse = await drive.files.get({ fileId: fileId, alt: "media" }, { responseType: "stream" });
        const metadataResponse = await drive.files.get({ fileId: fileId, fields: 'mimeType' });

        const mimeType = metadataResponse.data.mimeType;
        // Check if the file is an image, as Gemini requires image input for this task.
        // Return a 400 Bad Request error if the file type is not supported.
        if (!mimeType.startsWith('image/')) {
            return res.status(400).json({ error: "File is not an image." });
        }

        // --- Convert the file stream to a Base64 string ---
        
        // Collect data chunks from the incoming file stream.
        // Once the stream ends, the full buffer is created and converted to a Base64 string.
        const chunks = [];
        fileResponse.data.on('data', chunk => chunks.push(chunk));

        fileResponse.data.on('end', async () => {
            try {
                const buffer = Buffer.concat(chunks);
                const base64Image = buffer.toString('base64');

                // Step 2 & 3: Send the Base64 image data to Gemini for transcription.
                // The `transcribeImage` function handles the API call and returns the text.
                const transcription = await transcribeImage(base64Image, mimeType);

                // Step 4: Send the transcription back to the client.
                // A successful response returns a JSON object containing the transcribed text.
                res.json({ transcription });
            } catch (geminiError) {
                // Handle errors from the Gemini API or during JSON parsing.
                // This ensures a specific error message is returned for transcription failures.
                console.error("Error transcribing with Gemini:", geminiError);
                res.status(500).json({ error: "Failed to transcribe image with Gemini." });
            }
        });

        fileResponse.data.on('error', (driveError) => {
            // Handle errors that occur while fetching the file from Google Drive.
            // This catches issues like network errors or file not found.
            console.error("Error fetching file stream from Drive:", driveError);
            res.status(500).json({ error: "Failed to retrieve file from Google Drive." });
        });

    } catch (error) {
        // Catch any remaining unexpected errors in the main route logic.
        // This acts as a final safety net for uncaught exceptions.
        console.error("Error in transcription route:", error);
        res.status(500).json({ error: "An unexpected error occurred." });
    }
});

//
// --- Server Start ---
app.listen(port, () => {
    console.log(`✅ Server is running on http://localhost:${port}`);
});