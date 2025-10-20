// Patch-based text editing service for AI text editing
// Handles diff generation, patch application, and conflict resolution

import DiffMatchPatch from 'diff-match-patch';

export interface TextPatch {
  id: string;
  timestamp: number;
  original: string;
  modified: string;
  patches: any[]; // DiffMatchPatch patch format
  description?: string;
  source: 'gemini' | 'openai' | 'manual';
  applied: boolean;
}

export interface PatchResult {
  success: boolean;
  text?: string;
  error?: string;
  conflicts?: string[];
}

class PatchService {
  private dmp: DiffMatchPatch;
  private patchHistory: TextPatch[] = [];

  constructor() {
    this.dmp = new DiffMatchPatch();
    this.dmp.Patch_Margin = 4; // Context around patches
    this.dmp.Match_Distance = 1000; // How far to search for a match
  }

  /**
   * Create a patch from original to modified text
   */
  createPatch(
    original: string, 
    modified: string, 
    source: 'gemini' | 'openai' | 'manual' = 'manual',
    description?: string
  ): TextPatch {
    const patches = this.dmp.patch_make(original, modified);
    
    const patch: TextPatch = {
      id: this.generatePatchId(),
      timestamp: Date.now(),
      original,
      modified,
      patches,
      description,
      source,
      applied: false
    };

    this.patchHistory.push(patch);
    return patch;
  }

  /**
   * Apply a patch to text
   */
  applyPatch(text: string, patch: TextPatch): PatchResult {
    try {
      const [newText, results] = this.dmp.patch_apply(patch.patches, text);
      
      // Check if all patches were applied successfully
      const allSuccess = results.every(r => r);
      
      if (allSuccess) {
        patch.applied = true;
        return {
          success: true,
          text: newText
        };
      } else {
        // Some patches failed - identify conflicts
        const conflicts: string[] = [];
        results.forEach((success, index) => {
          if (!success) {
            conflicts.push(`Patch ${index + 1} failed to apply`);
          }
        });
        
        return {
          success: false,
          text: newText, // Partially applied
          conflicts
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to apply patch: ${error.message}`
      };
    }
  }

  /**
   * Parse diff string (unified diff format) and create patches
   */
  parseDiff(originalText: string, diffString: string, source: 'gemini' | 'openai'): TextPatch | null {
    try {
      // Apply unified diff format to original text
      // This is a simplified implementation - you may need a proper diff parser
      const lines = diffString.split('\n');
      let modified = originalText;
      
      // Process diff hunks
      lines.forEach(line => {
        if (line.startsWith('@@')) {
          // Parse hunk header
          // Format: @@ -l,s +l,s @@ optional section heading
          const match = line.match(/@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@/);
          if (match) {
            // Extract line numbers and sizes
            const [, oldStart, oldSize, newStart, newSize] = match;
            // Process the hunk...
          }
        } else if (line.startsWith('-')) {
          // Line to remove
          const lineContent = line.substring(1);
          modified = modified.replace(lineContent, '');
        } else if (line.startsWith('+')) {
          // Line to add
          const lineContent = line.substring(1);
          // This is simplified - proper implementation would track position
          modified += '\n' + lineContent;
        }
      });

      return this.createPatch(originalText, modified, source, 'AI-generated edit');
    } catch (error) {
      console.error('Failed to parse diff:', error);
      return null;
    }
  }

  /**
   * Generate a visual diff between two texts
   */
  generateVisualDiff(original: string, modified: string): string {
    const diffs = this.dmp.diff_main(original, modified);
    this.dmp.diff_cleanupSemantic(diffs);
    return this.dmp.diff_prettyHtml(diffs);
  }

  /**
   * Generate a unified diff string
   */
  generateUnifiedDiff(original: string, modified: string, contextLines: number = 3): string {
    const patches = this.dmp.patch_make(original, modified);
    return this.dmp.patch_toText(patches);
  }

  /**
   * Merge multiple patches into one
   */
  mergePatchs(patches: TextPatch[]): TextPatch | null {
    if (patches.length === 0) return null;
    if (patches.length === 1) return patches[0];

    // Start with the first patch's original
    let currentText = patches[0].original;
    
    // Apply all patches sequentially
    for (const patch of patches) {
      const result = this.applyPatch(currentText, patch);
      if (!result.success) {
        console.error('Failed to merge patch:', result.error);
        return null;
      }
      currentText = result.text!;
    }

    // Create a merged patch
    return this.createPatch(
      patches[0].original,
      currentText,
      patches[0].source,
      `Merged ${patches.length} patches`
    );
  }

  /**
   * Get patch history
   */
  getHistory(): TextPatch[] {
    return [...this.patchHistory];
  }

  /**
   * Clear patch history
   */
  clearHistory(): void {
    this.patchHistory = [];
  }

  /**
   * Revert a patch
   */
  revertPatch(patch: TextPatch): TextPatch {
    return this.createPatch(
      patch.modified,
      patch.original,
      'manual',
      `Revert: ${patch.description || patch.id}`
    );
  }

  /**
   * Generate patch ID
   */
  private generatePatchId(): string {
    return `patch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Smart patch application with conflict resolution
   */
  smartApplyPatch(text: string, patch: TextPatch, strategy: 'force' | 'skip' | 'merge' = 'merge'): PatchResult {
    const result = this.applyPatch(text, patch);
    
    if (result.success || strategy === 'skip') {
      return result;
    }

    if (strategy === 'force') {
      // Force apply by using the modified text directly
      return {
        success: true,
        text: patch.modified
      };
    }

    if (strategy === 'merge') {
      // Try to merge conflicts
      try {
        // Create a three-way merge
        const diffs = this.dmp.diff_main(patch.original, text);
        const patches = this.dmp.patch_make(patch.original, text);
        const [mergedText] = this.dmp.patch_apply(patches, patch.modified);
        
        return {
          success: true,
          text: mergedText,
          conflicts: ['Automatically merged conflicts']
        };
      } catch (error) {
        return {
          success: false,
          error: `Merge failed: ${error.message}`,
          text: text
        };
      }
    }

    return result;
  }
}

// Export singleton instance
export const patchService = new PatchService();

// Export convenience functions
export const createPatch = (original: string, modified: string, source?: 'gemini' | 'openai' | 'manual', description?: string) => 
  patchService.createPatch(original, modified, source, description);

export const applyPatch = (text: string, patch: TextPatch) => 
  patchService.applyPatch(text, patch);

export const generateVisualDiff = (original: string, modified: string) =>
  patchService.generateVisualDiff(original, modified);

export const parseDiff = (originalText: string, diffString: string, source: 'gemini' | 'openai') =>
  patchService.parseDiff(originalText, diffString, source);