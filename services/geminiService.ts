import type { MatchedWord } from '../types';

const API_BASE_URL = 'http://localhost:3001/api';

/**
 * Transcribes an audio file using the backend proxy.
 * @param {File} file The audio file to transcribe.
 * @param {string} prompt A prompt to guide the transcription.
 * @returns {Promise<string>} The transcribed text.
 */
export const transcribe = async (file: File, prompt: string): Promise<string> => {
    try {
        // 1. Upload the audio file to the backend
        const formData = new FormData();
        formData.append('audio', file);

        const uploadResponse = await fetch(`${API_BASE_URL}/upload-audio`, {
            method: 'POST',
            body: formData,
        });

        if (!uploadResponse.ok) {
            const errorData = await uploadResponse.json();
            throw new Error(`Audio upload failed: ${errorData.error || uploadResponse.statusText}`);
        }

        const { fileUri } = await uploadResponse.json();

        // 2. Request transcription from the backend using the uploaded file URI
        const transcribeResponse = await fetch(`${API_BASE_URL}/generate-content`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fileUri,
                prompt: `Transcribe this audio file. ${prompt}`,
                systemInstruction: 'You are a highly accurate audio transcription service.',
                config: {
                    model: 'gemini-1.5-pro',
                    temperature: 0.2,
                }
            }),
        });

        if (!transcribeResponse.ok) {
            const errorData = await transcribeResponse.json();
            throw new Error(`Transcription failed: ${errorData.error || transcribeResponse.statusText}`);
        }

        const { text } = await transcribeResponse.json();

        if (!text || text.trim().length === 0) {
            throw new Error("Received empty response from the backend");
        }

        return text.trim();
    } catch (error) {
        console.error("Error in transcribe function:", error);
        throw new Error(`Transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};

/**
 * Edits a transcript based on a system prompt using the backend proxy.
 * @param {MatchedWord[]} words The array of words representing the current transcript.
 * @param {string} systemPrompt The instructions for how to edit the transcript.
 * @returns {Promise<MatchedWord[]>} A new array of words representing the edited transcript.
 */
export const edit = async (words: MatchedWord[], systemPrompt: string): Promise<MatchedWord[]> => {
    if (words.length === 0) {
        return Promise.resolve([]);
    }

    try {
        const transcriptText = words.map(w => w.punctuated_word).join(' ');

        const editResponse = await fetch(`${API_BASE_URL}/generate-content`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt: transcriptText,
                systemInstruction: `${systemPrompt}. Respond only with the edited transcript text. Do not add any explanation or comments.`,
                config: {
                    model: 'gemini-1.5-flash',
                    temperature: 0.5,
                }
            }),
        });

        if (!editResponse.ok) {
            const errorData = await editResponse.json();
            throw new Error(`Edit failed: ${errorData.error || editResponse.statusText}`);
        }

        const { text: editedText } = await editResponse.json();

        if (!editedText || editedText.trim().length === 0) {
            throw new Error("Received empty response from the backend");
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