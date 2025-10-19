// import { GoogleGenAI } from "@google/genai";
import type { MatchedWord } from '../types';

// Initialize the Google Gemini API client.
// The API key is sourced from the environment variable `process.env.API_KEY`.
// const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

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
    console.log("Gemini transcribe service is currently disabled for testing.");
    // const audioPart = await fileToGenerativePart(file);
    // const textPart = { text: `Transcribe this audio. ${prompt}` };

    // // FIX: Using gemini-2.5-pro for higher quality transcription of audio files.
    // const response = await ai.models.generateContent({
    //     model: 'gemini-2.5-pro',
    //     contents: { parts: [audioPart, textPart] },
    // });
    
    // return response.text;
    return Promise.resolve("Transcription is currently disabled for testing purposes.");
};

/**
 * Edits a transcript based on a system prompt using the Gemini API.
 * @param {MatchedWord[]} words The array of words representing the current transcript.
 * @param {string} systemPrompt The instructions for how to edit the transcript.
 * @returns {Promise<MatchedWord[]>} A new array of words representing the edited transcript.
 */
export const edit = async (words: MatchedWord[], systemPrompt: string): Promise<MatchedWord[]> => {
    console.log("Gemini edit service is currently disabled for testing.");
    if (words.length === 0) {
        return Promise.resolve([]);
    }

    // const transcriptText = words.map(w => w.punctuated_word).join(' ');

    // // FIX: Using gemini-2.5-flash for efficient text editing tasks with a system instruction.
    // const response = await ai.models.generateContent({
    //     model: 'gemini-2.5-flash',
    //     contents: transcriptText,
    //     config: {
    //         systemInstruction: `${systemPrompt}. Respond only with the edited transcript text.`,
    //     },
    // });

    // const editedText = response.text;

    // // Convert the edited text back into the MatchedWord structure.
    // // Timestamps are lost in this process and will be null.
    // const newWords: MatchedWord[] = editedText.split(/\s+/).filter(w => w).map((word, i) => ({
    //     number: i + 1,
    //     punctuated_word: word,
    //     cleaned_word: word.toLowerCase().replace(/[.,!?]/g, ''),
    //     start: null,
    //     end: null
    // }));

    // return newWords;
    return Promise.resolve(words); // Return original words
};