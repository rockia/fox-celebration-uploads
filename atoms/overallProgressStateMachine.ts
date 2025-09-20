/**
 * Overall Progress State Machine
 * 
 * Manages the overall state of the upload session based on individual upload states
 */

export type OverallProgressState = 
  | "idle"          // No files in the system
  | "preparing"     // Files are being prepared (getting upload URLs)
  | "ready"         // All files are ready to upload
  | "uploading"     // At least one file is uploading
  | "completed"     // All files completed successfully
  | "partial"       // Some files succeeded, some failed
  | "failed"        // All files failed
  | "canceled";     // All uploads were canceled

export type OverallProgressEvent = 
  | "FILES_ADDED"
  | "PREPARATION_STARTED"
  | "PREPARATION_COMPLETED"
  | "UPLOAD_STARTED"
  | "UPLOAD_PROGRESS"
  | "ALL_COMPLETED"
  | "SOME_FAILED"
  | "ALL_FAILED"
  | "ALL_CANCELED"
  | "RESET";

export type OverallProgressContext = {
  totalFiles: number;
  completedFiles: number;
  failedFiles: number;
  canceledFiles: number;
  uploadingFiles: number;
  preparingFiles: number;
  readyFiles: number;
  overallProgress: number; // 0-100
  hasRetryableFiles: boolean;
  hasPlaceholderFiles: boolean;
};

/**
 * State transition map for overall progress
 */
export const OVERALL_STATE_TRANSITIONS: Record<OverallProgressState, Partial<Record<OverallProgressEvent, OverallProgressState>>> = {
  idle: {
    FILES_ADDED: "preparing",
  },
  preparing: {
    PREPARATION_COMPLETED: "ready",
    SOME_FAILED: "partial",
    ALL_FAILED: "failed",
    ALL_CANCELED: "canceled",
    RESET: "idle",
  },
  ready: {
    UPLOAD_STARTED: "uploading",
    SOME_FAILED: "partial",
    ALL_FAILED: "failed",
    ALL_CANCELED: "canceled",
    RESET: "idle",
  },
  uploading: {
    UPLOAD_PROGRESS: "uploading", // Stay in uploading
    ALL_COMPLETED: "completed",
    SOME_FAILED: "partial",
    ALL_FAILED: "failed",
    ALL_CANCELED: "canceled",
    RESET: "idle",
  },
  completed: {
    RESET: "idle",
    FILES_ADDED: "preparing", // Adding more files after completion
  },
  partial: {
    UPLOAD_STARTED: "uploading", // Retrying failed files
    ALL_COMPLETED: "completed",
    ALL_FAILED: "failed",
    ALL_CANCELED: "canceled",
    RESET: "idle",
    FILES_ADDED: "preparing", // Adding more files
  },
  failed: {
    UPLOAD_STARTED: "uploading", // Retrying all files
    SOME_FAILED: "partial",
    ALL_COMPLETED: "completed",
    ALL_CANCELED: "canceled",
    RESET: "idle",
    FILES_ADDED: "preparing", // Adding more files
  },
  canceled: {
    UPLOAD_STARTED: "uploading", // Retrying canceled files
    ALL_COMPLETED: "completed",
    SOME_FAILED: "partial",
    ALL_FAILED: "failed",
    RESET: "idle",
    FILES_ADDED: "preparing", // Adding more files
  },
};

/**
 * Check if a transition is valid for overall progress
 */
export function canTransitionOverall(currentState: OverallProgressState, event: OverallProgressEvent): boolean {
  const validTransitions = OVERALL_STATE_TRANSITIONS[currentState];
  return validTransitions && event in validTransitions;
}

/**
 * Get the next state for overall progress
 */
export function getNextOverallState(currentState: OverallProgressState, event: OverallProgressEvent): OverallProgressState {
  if (!canTransitionOverall(currentState, event)) {
    console.warn(`Invalid overall transition: ${currentState} -> ${event}`);
    return currentState;
  }
  
  const validTransitions = OVERALL_STATE_TRANSITIONS[currentState];
  return validTransitions[event] || currentState;
}

/**
 * Overall Progress State Machine class
 */
export class OverallProgressStateMachine {
  private state: OverallProgressState;
  private context: OverallProgressContext;
  private listeners: Array<(state: OverallProgressState, context: OverallProgressContext) => void> = [];

  constructor(initialState: OverallProgressState = "idle") {
    this.state = initialState;
    this.context = {
      totalFiles: 0,
      completedFiles: 0,
      failedFiles: 0,
      canceledFiles: 0,
      uploadingFiles: 0,
      preparingFiles: 0,
      readyFiles: 0,
      overallProgress: 0,
      hasRetryableFiles: false,
      hasPlaceholderFiles: false,
    };
  }

  /**
   * Get current state
   */
  getState(): OverallProgressState {
    return this.state;
  }

  /**
   * Get current context
   */
  getContext(): OverallProgressContext {
    return { ...this.context };
  }

  /**
   * Update context and determine appropriate state transition
   */
  updateFromUploads(context: Partial<OverallProgressContext>): void {
    // Update context
    this.context = { ...this.context, ...context };
    
    // Determine the appropriate event based on the new context
    const event = this.determineEventFromContext();
    
    if (event) {
      this.send(event);
    }
  }

  /**
   * Send an event to the state machine
   */
  send(event: OverallProgressEvent): boolean {
    const nextState = getNextOverallState(this.state, event);
    
    if (nextState === this.state) {
      // No state change, but still notify listeners for context updates
      this.listeners.forEach(listener => listener(this.state, this.context));
      return false;
    }

    this.state = nextState;

    // Notify listeners
    this.listeners.forEach(listener => listener(this.state, this.context));
    
    return true;
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: (state: OverallProgressState, context: OverallProgressContext) => void): () => void {
    this.listeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Determine the appropriate event based on current context
   */
  private determineEventFromContext(): OverallProgressEvent | null {
    const { totalFiles, completedFiles, failedFiles, canceledFiles, uploadingFiles, preparingFiles } = this.context;
    
    // No files
    if (totalFiles === 0) {
      return this.state !== "idle" ? "RESET" : null;
    }

    // Files were just added
    if (this.state === "idle" && totalFiles > 0) {
      return "FILES_ADDED";
    }

    // All files canceled
    if (canceledFiles === totalFiles) {
      return this.state !== "canceled" ? "ALL_CANCELED" : null;
    }

    // All files completed successfully
    if (completedFiles === totalFiles) {
      return this.state !== "completed" ? "ALL_COMPLETED" : null;
    }

    // All files failed (excluding canceled)
    const nonCanceledFiles = totalFiles - canceledFiles;
    if (nonCanceledFiles > 0 && failedFiles === nonCanceledFiles) {
      return this.state !== "failed" ? "ALL_FAILED" : null;
    }

    // Some files completed, some failed/canceled (partial completion)
    if (completedFiles > 0 && (failedFiles > 0 || canceledFiles > 0)) {
      return this.state !== "partial" ? "SOME_FAILED" : null;
    }

    // Files are uploading
    if (uploadingFiles > 0) {
      if (this.state === "ready" || this.state === "partial" || this.state === "failed") {
        return "UPLOAD_STARTED";
      }
      return this.state !== "uploading" ? "UPLOAD_PROGRESS" : null;
    }

    // Files are being prepared
    if (preparingFiles > 0) {
      return this.state !== "preparing" ? "PREPARATION_STARTED" : null;
    }

    // All files are ready to upload
    const readyFiles = totalFiles - completedFiles - failedFiles - canceledFiles - uploadingFiles - preparingFiles;
    if (readyFiles === totalFiles) {
      return this.state !== "ready" ? "PREPARATION_COMPLETED" : null;
    }

    return null;
  }

  /**
   * Get human-readable state description
   */
  getStateDescription(): string {
    const descriptions: Record<OverallProgressState, string> = {
      idle: "No files selected",
      preparing: "Preparing uploads...",
      ready: "Ready to upload",
      uploading: "Uploading files...",
      completed: "All uploads completed",
      partial: "Some uploads completed",
      failed: "All uploads failed",
      canceled: "All uploads canceled",
    };
    
    return descriptions[this.state] || this.state;
  }

  /**
   * Get progress summary text
   */
  getProgressSummary(): string {
    const { totalFiles, completedFiles, failedFiles, canceledFiles } = this.context;
    
    if (totalFiles === 0) {
      return "No files";
    }

    const parts: string[] = [];
    
    if (completedFiles > 0) {
      parts.push(`${completedFiles} completed`);
    }
    
    if (failedFiles > 0) {
      parts.push(`${failedFiles} failed`);
    }
    
    if (canceledFiles > 0) {
      parts.push(`${canceledFiles} canceled`);
    }

    if (parts.length === 0) {
      return `${totalFiles} file${totalFiles > 1 ? 's' : ''}`;
    }

    return `${parts.join(', ')} of ${totalFiles}`;
  }

  /**
   * Check if uploads can be started
   */
  canStartUploads(): boolean {
    return this.state === "ready" || this.state === "partial" || this.state === "failed";
  }

  /**
   * Check if more files can be added
   */
  canAddFiles(): boolean {
    return this.state === "idle" || this.state === "completed" || this.state === "partial" || this.state === "failed" || this.state === "canceled";
  }

  /**
   * Check if uploads can be retried
   */
  canRetry(): boolean {
    return (this.state === "partial" || this.state === "failed" || this.state === "canceled") && this.context.hasRetryableFiles;
  }

  /**
   * Check if the session is in a final state
   */
  isFinal(): boolean {
    return this.state === "completed" || this.state === "failed" || this.state === "canceled";
  }

  /**
   * Check if uploads are currently active
   */
  isActive(): boolean {
    return this.state === "preparing" || this.state === "uploading";
  }
}

/**
 * Helper function to create overall progress state machine
 */
export function createOverallProgressStateMachine(): OverallProgressStateMachine {
  return new OverallProgressStateMachine();
}
