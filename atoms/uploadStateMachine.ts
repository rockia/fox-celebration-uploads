export type UploadState = 
  | "idle"          // Initial state, no file selected
  | "queued"        // File added to queue, waiting to be processed
  | "reserving"     // Requesting upload URL from server
  | "ready"         // Upload URL obtained, ready to upload
  | "uploading"     // Currently uploading file
  | "success"       // Upload completed successfully
  | "error"         // Upload failed
  | "canceled"      // Upload was canceled by user
  | "retrying";     // Retrying a failed upload

export type UploadEvent = 
  | "ADD_FILE"
  | "START_RESERVE"
  | "RESERVE_SUCCESS"
  | "RESERVE_ERROR"
  | "START_UPLOAD"
  | "UPLOAD_PROGRESS"
  | "UPLOAD_SUCCESS"
  | "UPLOAD_ERROR"
  | "CANCEL"
  | "RETRY"
  | "REMOVE";

export type UploadContext = {
  id: string;
  file: File;
  fileSize: number;
  progress: number;
  error?: string;
  remoteId?: string;
  uploadUrl?: string;
  method?: "PUT" | "POST";
  controller?: AbortController;
};

export const STATE_TRANSITIONS: Record<UploadState, Partial<Record<UploadEvent, UploadState>>> = {
  idle: {
    ADD_FILE: "queued",
  },
  queued: {
    START_RESERVE: "reserving",
    REMOVE: "idle",
    CANCEL: "canceled",
  },
  reserving: {
    RESERVE_SUCCESS: "ready",
    RESERVE_ERROR: "error",
    CANCEL: "canceled",
    REMOVE: "idle",
  },
  ready: {
    START_UPLOAD: "uploading",
    CANCEL: "canceled",
    REMOVE: "idle",
  },
  uploading: {
    UPLOAD_PROGRESS: "uploading", // Stay in uploading state
    UPLOAD_SUCCESS: "success",
    UPLOAD_ERROR: "error",
    CANCEL: "canceled",
  },
  success: {
    REMOVE: "idle",
  },
  error: {
    RETRY: "retrying",
    REMOVE: "idle",
  },
  canceled: {
    RETRY: "retrying",
    REMOVE: "idle",
  },
  retrying: {
    START_RESERVE: "reserving", // Retry starts with reserving again
    RESERVE_SUCCESS: "ready",   // Direct to ready if URL still valid
    START_UPLOAD: "uploading",  // Direct to uploading if ready
    UPLOAD_SUCCESS: "success",
    UPLOAD_ERROR: "error",
    CANCEL: "canceled",
    REMOVE: "idle",
  },
};

/**
 * Check if a transition is valid
 */
export function canTransition(currentState: UploadState, event: UploadEvent): boolean {
  const validTransitions = STATE_TRANSITIONS[currentState];
  return validTransitions && event in validTransitions;
}

/**
 * Get the next state for a given current state and event
 */
export function getNextState(currentState: UploadState, event: UploadEvent): UploadState {
  if (!canTransition(currentState, event)) {
    console.warn(`Invalid transition: ${currentState} -> ${event}`);
    return currentState;
  }
  
  const validTransitions = STATE_TRANSITIONS[currentState];
  return validTransitions[event] || currentState;
}

/**
 * State machine class for managing upload state
 */
export class UploadStateMachine {
  private state: UploadState;
  private context: UploadContext;
  private listeners: Array<(state: UploadState, context: UploadContext) => void> = [];

  constructor(initialContext: UploadContext, initialState: UploadState = "idle") {
    this.state = initialState;
    this.context = { ...initialContext };
  }

  /**
   * Get current state
   */
  getState(): UploadState {
    return this.state;
  }

  /**
   * Get current context
   */
  getContext(): UploadContext {
    return { ...this.context };
  }

  /**
   * Send an event to the state machine
   */
  send(event: UploadEvent, payload?: Partial<UploadContext>): boolean {
    const nextState = getNextState(this.state, event);
    
    if (nextState === this.state && !payload) {
      // No state change and no context update
      return false;
    }

    // Update context if payload provided
    if (payload) {
      this.context = { ...this.context, ...payload };
    }

    // Update state if it changed
    if (nextState !== this.state) {
      this.state = nextState;
    }

    // Notify listeners
    this.listeners.forEach(listener => listener(this.state, this.context));
    
    return true;
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: (state: UploadState, context: UploadContext) => void): () => void {
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
   * Check if the upload can be retried
   */
  canRetry(): boolean {
    return canTransition(this.state, "RETRY");
  }

  /**
   * Check if the upload can be canceled
   */
  canCancel(): boolean {
    return canTransition(this.state, "CANCEL");
  }

  /**
   * Check if the upload can be removed
   */
  canRemove(): boolean {
    return canTransition(this.state, "REMOVE");
  }

  /**
   * Check if the upload is in a final state
   */
  isFinal(): boolean {
    return this.state === "success" || this.state === "error" || this.state === "canceled";
  }

  /**
   * Check if the upload is active (in progress)
   */
  isActive(): boolean {
    return this.state === "reserving" || this.state === "uploading" || this.state === "retrying";
  }

  /**
   * Get human-readable state description
   */
  getStateDescription(): string {
    const descriptions: Record<UploadState, string> = {
      idle: "No file selected",
      queued: "Waiting in queue",
      reserving: "Preparing upload...",
      ready: "Ready to upload",
      uploading: "Uploading...",
      success: "Upload complete",
      error: "Upload failed",
      canceled: "Upload canceled",
      retrying: "Retrying upload...",
    };
    
    return descriptions[this.state] || this.state;
  }
}

/**
 * Helper function to create a new upload state machine
 */
export function createUploadStateMachine(file: File, id: string): UploadStateMachine {
  const context: UploadContext = {
    id,
    file,
    fileSize: file.size,
    progress: 0,
  };
  
  return new UploadStateMachine(context, "idle");
}

/**
 * Helper function to determine if a state represents a placeholder file
 */
export function isPlaceholderState(state: UploadState, context: UploadContext): boolean {
  return state === "error" && 
         context.file.size === 0 && 
         context.fileSize > 0 &&
         (context.error?.includes("page refresh") ?? false);
}
