import { GoogleGenerativeAI } from "@google/generative-ai";
import type { MatchedWord } from '../types';

// Initialize the Google Gemini API client.
// The API key is sourced from the environment variable `VITE_GEMINI_API_KEY`.
const getApiKey = () => {
    const key = import.meta.env.VITE_GEMINI_API_KEY;
    if (!key) {
        console.warn("VITE_GEMINI_API_KEY environment variable is not set. Gemini features will be disabled.");
        return null;
    }
    return key;
};

const apiKey = getApiKey();
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

// Helper function to convert a File object to a GoogleGenAI.Part object.
async function fileToGenerativePart(file: File): Promise<{
    inlineData: {
        data: string;
        mimeType: string;
    };
}> {
    const base64EncodedDataPromise = new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            // reader.result is "data:<mime-type>;base64,<data>"
            // We need to extract just the base64 data.
            resolve((reader.result as string).split(',')[1]);
        };
        reader.readAsDataURL(file);
    });
    return {
        inlineData: {
            data: await base64EncodedDataPromise,
            mimeType: file.type,
        },
    };
}

/**
 * Transcribes an audio file using the Gemini API.
 * @param {File} file The audio file to transcribe.
 * @param {string} prompt A prompt to guide the transcription.
 * @returns {Promise<string>} The transcribed text.
 */
export const transcribe = async (file: File, prompt: string): Promise<string> => {
    if (!genAI) {
        throw new Error("Gemini API is not configured. Please set the VITE_GEMINI_API_KEY environment variable.");
    }

    try {
        const audioPart = await fileToGenerativePart(file);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
        
        const result = await model.generateContent([
            { text: `Transcribe this audio file. ${prompt}` },
            audioPart,
        ]);
        
        const response = await result.response;
        const text = response.text();
        
        if (!text || text.trim().length === 0) {
            throw new Error("Received empty response from Gemini API");
        }
        
        return text.trim();
    } catch (error) {
        console.error("Error in transcribe function:", error);
        throw new Error(`Transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};

/**
 * Edits a transcript based on a system prompt using the Gemini API.
 * @param {MatchedWord[]} words The array of words representing the current transcript.
 * @param {string} systemPrompt The instructions for how to edit the transcript.
 * @returns {Promise<MatchedWord[]>} A new array of words representing the edited transcript.
 */
export const edit = async (words: MatchedWord[], systemPrompt: string): Promise<MatchedWord[]> => {
    if (!genAI) {
        throw new Error("Gemini API is not configured. Please set the VITE_GEMINI_API_KEY environment variable.");
    }
    
    if (words.length === 0) {
        return Promise.resolve([]);
    }

    try {
        const transcriptText = words.map(w => w.punctuated_word).join(' ');
        const model = genAI.getGenerativeModel({ 
            model: "gemini-1.5-flash",
            systemInstruction: `${systemPrompt}. Respond only with the edited transcript text. Do not add any explanation or comments.`
        });

        const result = await model.generateContent([transcriptText]);
        const response = await result.response;
        const editedText = response.text();

        if (!editedText || editedText.trim().length === 0) {
            throw new Error("Received empty response from Gemini API");
        }

        // Convert the edited text back into the MatchedWord structure.
        // Timestamps are lost in this process and will be null.
        const newWords: MatchedWord[] = editedText.trim().split(/\s+/).filter(w => w).map((word, i) => ({
            number: i + 1,
            punctuated_word: word,
            cleaned_word: word.toLowerCase().replace(/[.,!?]/g, ''),
            start: null,
            end: null
        }));

        return newWords;
    } catch (error) {
        console.error("Error in edit function:", error);
        throw new Error(`Edit failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};