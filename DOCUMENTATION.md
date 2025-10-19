# Gemini Transcription AI Editor - Documentation

This document provides an in-depth technical overview of the Gemini Transcription AI Editor, a sophisticated tool designed to streamline audio transcription and editing workflows.

## Core Architecture

The application is built using React and TypeScript, leveraging modern frontend practices for a robust and maintainable codebase. The state management is centralized through React's Context API, which is divided into three logical domains:

1.  **`DataContext`**: Manages all core data related to the transcription project, including the audio file, transcript versions, diarization data (speaker segments), and speaker mappings. It also encapsulates the logic for data processing, such as applying timestamps and managing the version-based undo/redo system.
2.  **`UIContext`**: Handles the state of the user interface, such as the visibility of sidebars and modals, zoom levels for the editor and timeline, and global keyboard shortcut management.
3.  **`ChatContext`**: Manages the state of the AI chat interface, including message history, the system prompt used for AI edits, and loading states for asynchronous Gemini API calls.

This separation of concerns ensures that data, UI state, and AI interaction logic are decoupled, making the application easier to reason about and extend.

## Key Features & Implementation

### 1. Data Handling and Processing

-   **File Uploads**: The application accepts multiple file types (audio, MFA JSON, Whisper JSON, Pyannote JSON, Formatted TXT) via a reusable `FileUpload` component. To prevent accidental re-uploads and keep the UI clean, the upload buttons for MFA, Whisper, and Formatted TXT are conditionally rendered and will disappear after a corresponding file has been processed. File parsing is handled in `processingService.ts`.
-   **Timestamp Interpolation**: A key feature is the ability to interpolate timestamps for words that were added or edited manually. The `interpolateTimestamps` function in `processingService.ts` calculates estimated start and end times for untimed words based on their timed neighbors, ensuring every word has a timestamp for playback.
-   **Speaker Management**: The editor supports both timeline-based speaker editing (from Pyannote data) and text-based speaker label replacement. `DataContext` holds the logic for merging speakers and performing find-and-replace operations on speaker labels, which are then reflected across the UI.

### 2. Editing Workflow, Saving, and Versioning

The editor's workflow has been redesigned for stability and clarity, centered around the version history panel.

-   **Live Editing State**: The main transcript view (`TranscriptView`) always reflects a "live" or "dirty" state. Any changes you make in the text editor are held in this temporary state.
-   **Smart Saving with "Interpolate"**: The **Interpolate** button now serves as the primary "Save" or "Commit" action.
    -   It is only enabled (and colored green) when the live transcript has changes compared to the last saved version, providing clear visual feedback that you have unsaved work.
    -   When clicked, it first performs the timestamp interpolation and then saves the entire transcript as a new, immutable entry in the **Version History**.
    -   If you click it when no changes have been made, it does nothing, preventing the creation of duplicate versions.
-   **Version-Based Undo/Redo**: The fragile, granular undo/redo system has been replaced by a much more reliable model that leverages the version history.
    -   **Undo**: The "Undo" button now navigates to the *previous version* in the history list. This effectively reverts the transcript to its last saved state.
    -   **Redo**: The "Redo" button navigates to the *next version* in the history, allowing you to move forward through your committed changes.
    -   This approach provides a clear, predictable, and robust way to manage your entire editing history.

### 3. Interactive Editor Components

-   **`TranscriptView`**: This is the core text editing component.
    -   **Performance**: It virtualizes the transcript by rendering it in paragraphs (`content-visibility: auto`). This significantly improves performance for very long transcripts.
    -   **Editing Modes**: The component has two modes for each paragraph: a display mode for playback and selection, and an edit mode (triggered by a double-click) that uses a `contentEditable` div.
    -   **Rich Text Interaction**: It supports a custom context menu for actions like word playback and search. It also handles complex text pasting and parsing.

-   **`CanvasTimeline` Component**:
    -   **High-Performance Rendering**: The timeline uses the HTML Canvas API to ensure smooth rendering and interaction, even with thousands of speaker segments. It draws all elements (segments, grid lines, playhead) in a single, efficient pass.
    -   **High-DPI Support**: The canvas is scaled based on `window.devicePixelRatio` to ensure crisp, clear rendering on high-resolution displays.
    -   **Robust Sizing and Rendering**: To prevent rendering bugs related to layout timing, the canvas uses a CSS-driven sizing strategy. Its `width` style is set via a percentage (based on zoom), and the drawing logic then reads the actual `clientWidth` from the DOM to configure the drawing buffer. This guarantees the canvas dimensions are always correct.

### 4. Timeline-Driven Timestamping and Speaker Tagging
The editor integrates the speaker timeline with the text editor for a rapid, semi-automated workflow:

1.  **Navigate**: Single-click anywhere on the timeline to move the playhead to that point. This is the primary way to navigate the audio. A single click will also deselect any currently selected segment.
2.  **Select a Segment**: Double-click on a speaker segment to select it. The segment will be highlighted with a white border, and the "Add Timestamp" button in the control bar will turn green. This signals that you are ready to insert its information into the transcript.
3.  **Position Cursor**: Double-click a paragraph in the transcript to enter edit mode, and place your text cursor at the exact point where you want to insert a new speaker line.
4.  **Insert Timestamp**: Click the green "Add Timestamp" button. This will insert the selected segment's start time and speaker label (e.g., `00:01:23.4 S1:`) directly at your cursor's position. You have full control over line breaks; if you want the tag on a new line, simply press Enter in the editor before clicking the button. The segment is automatically deselected after use.

### 5. Timeline and Transcript Synchronization

- **Click to Seek & Scroll**: When a user clicks on the canvas timeline, the audio seeks to that time, and the `Editor` component calculates the corresponding word index. It then calls a method on the `TranscriptView` to instantly scroll the text to the correct position.
- **Auto-Scrolling Timeline**: When playback is active or a word is clicked in the transcript, the `CanvasTimeline` receives the updated `currentTime`. Its internal logic then automatically pans the timeline view to keep the playhead centered and visible.

### 6. AI Integration with Gemini

-   **Service Layer**: All interactions with the Gemini API are abstracted into `services/geminiService.ts`. This service is currently disabled for local testing but is structured to handle API calls for transcription (`transcribe`) and text editing (`edit`).
-   **Asynchronous Flow**: The `ChatContext` orchestrates the API calls. It sets global loading states, which are displayed in the UI as a loading spinner and message, preventing further user interaction until the AI operation is complete.
-   **State Updates**: Upon successful completion of an AI task, `ChatContext` creates a new transcript version with the AI-generated content and adds it to the version history.

### 7. Keyboard Shortcuts

The application supports a range of keyboard shortcuts to speed up the workflow. These can be customized in the Settings modal. The defaults are:
-   **Play / Pause**: `Space`
-   **Rewind 3s**: `ArrowLeft`
-   **Forward 3s**: `ArrowRight`
-   **Undo (Version)**: `Control+z`
-   **Redo (Version)**: `Control+y`
-   **Save & Interpolate**: `Control+s`
-   **Toggle Line Numbers**: `Control+l`

### 8. State Persistence

To improve the user experience, the application's state is automatically saved to `localStorage`. This includes the current transcript versions, speaker map, UI layout preferences, and chat history. When the user reloads the application, this state is restored, allowing them to pick up right where they left off.