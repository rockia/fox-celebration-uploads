import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import axios from "axios";
import { 
  uploadsStorage, 
  fileCache, 
  STORAGE_KEYS,
  type SerializableUploadsState 
} from "@/lib/localStorage";
import { 
  UploadStateMachine, 
  createUploadStateMachine, 
  isPlaceholderState,
  type UploadState,
  type UploadContext 
} from "./uploadStateMachine";
import {
  createOverallProgressStateMachine,
  type OverallProgressContext
} from "./overallProgressStateMachine";

// Keep the old type for backward compatibility
export type UploadStatus =
  | "queued"       // user added but not started
  | "reserving"    // requesting upload URL
  | "ready"        // URL reserved, ready to send bytes
  | "uploading"
  | "success"
  | "error"
  | "canceled";


export type UploadItem = {
  id: string;
  file: File;
  fileSize: number; // Store original file size for display (persists after refresh)
  progress: number; // 0..100
  status: UploadStatus;
  error?: string;

  // reserved target info
  remoteId?: string;
  uploadUrl?: string;
  method?: "PUT" | "POST";

  controller?: AbortController;
  
  // State machine instance
  stateMachine?: UploadStateMachine;
};

type UploadsState = Record<string, UploadItem>;

// Atom for serializable uploads (persisted to localStorage)
const serializableUploadsAtom = atomWithStorage<SerializableUploadsState>(
  STORAGE_KEYS.UPLOADS_QUEUE,
  {},
  uploadsStorage
);

// Main uploads atom that combines serializable data with File objects and state machines
export const uploadsAtom = atom<UploadsState, [UploadsState], void>(
  (get) => {
    const serializable = get(serializableUploadsAtom);
    const uploads: UploadsState = {};
    
    for (const [id, item] of Object.entries(serializable)) {
      const file = fileCache.get(id);
      let uploadItem: UploadItem;
      
      if (file) {
        // Normal file with state machine
        uploadItem = {
          ...item,
          file,
          fileSize: item.fileSize, // Use stored file size
        };
        
        // Create state machine for this upload
        const stateMachine = createUploadStateMachine(file, id);
        
        // Set the state machine to match the current status
        if (item.status === 'queued') {
          stateMachine.send("ADD_FILE");
        } else if (item.status === 'reserving') {
          stateMachine.send("ADD_FILE");
          stateMachine.send("START_RESERVE");
        } else if (item.status === 'ready') {
          stateMachine.send("ADD_FILE");
          stateMachine.send("START_RESERVE");
          stateMachine.send("RESERVE_SUCCESS", { 
            remoteId: item.remoteId, 
            uploadUrl: item.uploadUrl, 
            method: item.method 
          });
        } else if (item.status === 'uploading') {
          stateMachine.send("ADD_FILE");
          stateMachine.send("START_RESERVE");
          stateMachine.send("RESERVE_SUCCESS", { 
            remoteId: item.remoteId, 
            uploadUrl: item.uploadUrl, 
            method: item.method 
          });
          stateMachine.send("START_UPLOAD");
        } else if (item.status === 'success') {
          stateMachine.send("ADD_FILE");
          stateMachine.send("START_RESERVE");
          stateMachine.send("RESERVE_SUCCESS", { 
            remoteId: item.remoteId, 
            uploadUrl: item.uploadUrl, 
            method: item.method 
          });
          stateMachine.send("START_UPLOAD");
          stateMachine.send("UPLOAD_SUCCESS");
        } else if (item.status === 'error') {
          stateMachine.send("ADD_FILE");
          stateMachine.send("START_RESERVE");
          stateMachine.send("RESERVE_ERROR", { error: item.error });
        } else if (item.status === 'canceled') {
          stateMachine.send("ADD_FILE");
          stateMachine.send("CANCEL");
        }
        
        uploadItem.stateMachine = stateMachine;
      } else {
        // Create a placeholder file for persisted uploads without actual File objects
        // This happens after page refresh - we'll show these as "file missing" state
        const placeholderFile = new File([], item.fileName, {
          type: item.fileType,
          lastModified: item.fileLastModified,
        });
        
        const errorMessage = item.status === 'uploading' || item.status === 'reserving' 
          ? 'Upload was interrupted when the page refreshed. Please re-add this file to continue.' 
          : 'This file was lost when the page refreshed due to browser security. Please re-add it to upload.';
        
        uploadItem = {
          ...item,
          file: placeholderFile,
          fileSize: item.fileSize, // Use stored file size
          // Mark all placeholder files as error since they can't be uploaded
          status: 'error',
          error: errorMessage,
        };
        
        // Create state machine for placeholder file
        const stateMachine = createUploadStateMachine(placeholderFile, id);
        stateMachine.send("ADD_FILE");
        stateMachine.send("START_RESERVE");
        stateMachine.send("RESERVE_ERROR", { error: errorMessage });
        
        uploadItem.stateMachine = stateMachine;
      }
      
      uploads[id] = uploadItem;
    }
    
    return uploads;
  },
  (get, set, newUploads: UploadsState) => {
    const serializable: SerializableUploadsState = {};
    
    for (const [id, upload] of Object.entries(newUploads)) {
      // Store file in cache
      fileCache.set(id, upload.file);
      
      // Store serializable data
      serializable[id] = {
        id: upload.id,
        fileName: upload.file.name,
        fileSize: upload.file.size,
        fileType: upload.file.type,
        fileLastModified: upload.file.lastModified,
        progress: upload.progress,
        status: upload.status,
        error: upload.error,
        remoteId: upload.remoteId,
        uploadUrl: upload.uploadUrl,
        method: upload.method,
      };
    }
    
    set(serializableUploadsAtom, serializable);
  }
);

// Note: isUploadingAtom and isPreparingUploadsAtom are now derived from the state machine in upload-stats.ts

// Overall progress state machine atom
const overallProgressStateMachineAtom = atom(() => createOverallProgressStateMachine());

// Overall progress atom that computes state from individual uploads
export const overallProgressAtom = atom(
  (get) => {
    const uploads = get(uploadsArrayAtom);
    const stateMachine = get(overallProgressStateMachineAtom);
    
    // Compute context from individual uploads
    const totalFiles = uploads.length;
    const completedFiles = uploads.filter(u => u.status === 'success').length;
    const failedFiles = uploads.filter(u => u.status === 'error').length;
    const canceledFiles = uploads.filter(u => u.status === 'canceled').length;
    const uploadingFiles = uploads.filter(u => u.status === 'uploading').length;
    const preparingFiles = uploads.filter(u => u.status === 'reserving').length;
    const readyFiles = uploads.filter(u => u.status === 'ready').length;
    
    // Calculate overall progress - only count progress from successful and uploading files
    const progressSum = uploads.reduce((sum, upload) => {
      if (upload.status === 'success') {
        return sum + 100; // Completed files contribute 100%
      } else if (upload.status === 'uploading') {
        return sum + upload.progress; // Uploading files contribute their current progress
      } else {
        return sum + 0; // Failed, canceled, queued, ready, and reserving files contribute 0%
      }
    }, 0);
    const overallProgress = totalFiles > 0 ? Math.round(progressSum / totalFiles) : 0;
    
    // Check for retryable and placeholder files
    const hasRetryableFiles = uploads.some(u => 
      u.status === 'error' && !u.error?.includes('page refresh')
    );
    const hasPlaceholderFiles = uploads.some(isPlaceholderFile);
    
    const context: Partial<OverallProgressContext> = {
      totalFiles,
      completedFiles,
      failedFiles,
      canceledFiles,
      uploadingFiles,
      preparingFiles,
      readyFiles,
      overallProgress,
      hasRetryableFiles,
      hasPlaceholderFiles,
    };
    
    // Update state machine with computed context
    stateMachine.updateFromUploads(context);
    
    return {
      state: stateMachine.getState(),
      context: stateMachine.getContext(),
      description: stateMachine.getStateDescription(),
      progressSummary: stateMachine.getProgressSummary(),
      canStartUploads: stateMachine.canStartUploads(),
      canAddFiles: stateMachine.canAddFiles(),
      canRetry: stateMachine.canRetry(),
      isFinal: stateMachine.isFinal(),
      isActive: stateMachine.isActive(),
    };
  }
);

// Derived atom to get uploads as array (for easier iteration)
export const uploadsArrayAtom = atom((get) => Object.values(get(uploadsAtom)));

// Helper function to detect placeholder files (created after page refresh)
export const isPlaceholderFile = (upload: UploadItem): boolean => {
  // Use state machine if available
  if (upload.stateMachine) {
    const state = upload.stateMachine.getState();
    const context = upload.stateMachine.getContext();
    return isPlaceholderState(state, context);
  }
  
  // Fallback to original logic for backward compatibility
  return upload.file.size === 0 && upload.fileSize > 0;
};

// Derived atom to get ready uploads (excluding placeholder files)
const readyUploadsAtom = atom((get) => {
  const uploads = get(uploadsAtom);
  return Object.values(uploads).filter(upload => 
    upload.uploadUrl && upload.id && upload.status !== 'error' && !isPlaceholderFile(upload)
  );
});

// Derived atom to check if there are any placeholder files
export const hasPlaceholderFilesAtom = atom((get) => {
  const uploads = get(uploadsAtom);
  return Object.values(uploads).some(isPlaceholderFile);
});

export const addFilesAtom = atom(null, (get, set, files: File[] | FileList) => {
  // Check if uploads have already started
  const currentUploads = get(uploadsAtom);
  const uploadValues = Object.values(currentUploads);
  const inProgressFiles = uploadValues.filter(u => u.status === "reserving" || u.status === "uploading").length;
  const successFiles = uploadValues.filter(u => u.status === "success").length;
  const uploadsStarted = inProgressFiles > 0 || successFiles > 0;
  
  // Prevent adding files when uploads have already started
  if (uploadsStarted) {
    return;
  }

  const next = { ...get(uploadsAtom) };
  Array.from(files).forEach((file) => {
    const id = crypto.randomUUID();
    
    // Create state machine for new file
    const stateMachine = createUploadStateMachine(file, id);
    stateMachine.send("ADD_FILE");
    
    next[id] = { 
      id, 
      file, 
      fileSize: file.size, 
      progress: 0, 
      status: "queued",
      stateMachine 
    };
  });
  set(uploadsAtom, next);
});

export const removeUploadAtom = atom(null, (get, set, id: string) => {
  const s = { ...get(uploadsAtom) };
  const upload = s[id];
  
  if (upload) {
    // Cancel any ongoing operation
    if (upload.controller) {
      upload.controller.abort();
    }
    
    // Send REMOVE event to state machine if available
    if (upload.stateMachine) {
      upload.stateMachine.send("REMOVE");
    }
    
    // Clean up memory: remove from file cache
    fileCache.delete(id);
  }
  
  delete s[id];
  set(uploadsAtom, s);
  
  // Update serializable state
  const serializable = { ...get(serializableUploadsAtom) };
  delete serializable[id];
  set(serializableUploadsAtom, serializable);
});

export const clearCompletedAtom = atom(null, (get, set) => {
  const s = get(uploadsAtom);
  const next: UploadsState = {};
  for (const u of Object.values(s)) {
    if (u.status !== "success" && u.status !== "canceled") next[u.id] = u;
  }
  set(uploadsAtom, next);
});

export const updateUploadAtom = atom(null, (get, set, id: string, updates: Partial<UploadItem>) => {
  const s = { ...get(uploadsAtom) };
  if (s[id]) {
    s[id] = { ...s[id], ...updates };
    set(uploadsAtom, s);
  }
});

export const cancelUploadAtom = atom(null, (get, set, id: string) => {
  const s = { ...get(uploadsAtom) };
  const upload = s[id];
  
  if (upload) {
    // Cancel the upload if controller exists
    if (upload.controller) {
      upload.controller.abort();
    }
    
    // Send CANCEL event to state machine
    if (upload.stateMachine) {
      upload.stateMachine.send("CANCEL");
    }
    
    // Clean up memory: remove from file cache if needed
    // Note: We keep the file in cache for potential retry, but clean up controller
    
    s[id] = { ...upload, status: "canceled", controller: undefined };
    set(uploadsAtom, s);
    
    // Update serializable state
    const serializable = { ...get(serializableUploadsAtom) };
    if (serializable[id]) {
      serializable[id] = {
        ...serializable[id],
        status: "canceled"
      };
      set(serializableUploadsAtom, serializable);
    }
  }
});

// Cancel all active uploads (uploading or reserving) without removing them
export const cancelAllActiveUploadsAtom = atom(null, (get, set) => {
  const s = { ...get(uploadsAtom) };
  const serializable = { ...get(serializableUploadsAtom) };
  let hasChanges = false;
  
  Object.values(s).forEach(upload => {
    if (upload.status === "uploading" || upload.status === "reserving") {
      // Cancel the upload if controller exists
      if (upload.controller) {
        upload.controller.abort();
      }
      
      // Send CANCEL event to state machine
      if (upload.stateMachine) {
        upload.stateMachine.send("CANCEL");
      }
      
      // Update upload state
      s[upload.id] = { ...upload, status: "canceled", controller: undefined };
      
      // Update serializable state
      if (serializable[upload.id]) {
        serializable[upload.id] = {
          ...serializable[upload.id],
          status: "canceled"
        };
      }
      
      hasChanges = true;
    }
  });
  
  if (hasChanges) {
    set(uploadsAtom, s);
    set(serializableUploadsAtom, serializable);
  }
});

export const clearAllUploadsAtom = atom(null, (get, set) => {
  const s = get(uploadsAtom);
  
  // Cancel any ongoing uploads and clean up memory
  Object.values(s).forEach(upload => {
    if (upload.controller && (upload.status === "uploading" || upload.status === "reserving")) {
      upload.controller.abort();
    }
    // Clean up file cache
    fileCache.delete(upload.id);
  });
  
  set(uploadsAtom, {});
  set(serializableUploadsAtom, {});
  // State is now managed by the overall progress state machine
});

// New atom to clear only removable files (not currently uploading)
export const clearRemovableUploadsAtom = atom(null, (get, set) => {
  const s = get(uploadsAtom);
  const next: typeof s = {};
  
  // Keep only files that are currently uploading (cannot be removed)
  Object.values(s).forEach(upload => {
    if (upload.status === "uploading") {
      next[upload.id] = upload;
    }
  });
  
  set(uploadsAtom, next);
  
  // If no uploads remain, reset the preparing state
  if (Object.keys(next).length === 0) {
    // State is now managed by the overall progress state machine
  }
});

// Helper function to reserve upload URL for a single file
const reserveUploadUrl = async (
  file: File, 
  uploadId: string, 
  get: any, 
  set: any
): Promise<{ file: File; result: any }> => {
  try {
    const requestBody = {
      filename: file.name,
      size: file.size,
      type: file.type,
    };

    const response = await axios.post('/api/upload-url', requestBody);
    const result = response.data;
    
    // Update upload with URL and mark as ready
    const currentUploads = get(uploadsAtom);
    const upload = currentUploads[uploadId];
    
    // Send RESERVE_SUCCESS event to state machine
    if (upload?.stateMachine) {
      upload.stateMachine.send("RESERVE_SUCCESS", {
        remoteId: result.id,
        uploadUrl: result.uploadUrl,
        method: "PUT"
      });
    }
    
    set(updateUploadAtom, uploadId, {
      remoteId: result.id,
      uploadUrl: result.uploadUrl,
      method: "PUT",
      status: "ready"
    });

    return { file, result };
  } catch (error) {
    // Send RESERVE_ERROR event to state machine
    const currentUploads = get(uploadsAtom);
    const upload = currentUploads[uploadId];
    const errorMessage = error instanceof Error ? error.message : 'Failed to get upload URL';
    
    if (upload?.stateMachine) {
      upload.stateMachine.send("RESERVE_ERROR", { error: errorMessage });
    }
    
    // Update upload with error
    set(updateUploadAtom, uploadId, {
      status: "error",
      error: errorMessage
    });
    throw error;
  }
};

// New atoms for the upload process
export const prepareUploadsAtom = atom(null, async (get, set, files: File[]) => {
  if (files.length === 0) return;

  // Check if uploads have already started by looking at current upload stats
  const currentUploads = get(uploadsAtom);
  const uploadValues = Object.values(currentUploads);
  const inProgressFiles = uploadValues.filter(u => u.status === "reserving" || u.status === "uploading").length;
  const successFiles = uploadValues.filter(u => u.status === "success").length;
  const uploadsStarted = inProgressFiles > 0 || successFiles > 0;
  
  // Prevent adding files when uploads have already started
  if (uploadsStarted) {
    return;
  }

  // Add files to uploads with pending status
  const uploads = { ...get(uploadsAtom) };
  const newUploadIds: string[] = [];
  
  files.forEach((file) => {
    const id = crypto.randomUUID();
    
    // Create state machine and transition to reserving
    const stateMachine = createUploadStateMachine(file, id);
    stateMachine.send("ADD_FILE");
    stateMachine.send("START_RESERVE");
    
    uploads[id] = { 
      id, 
      file, 
      fileSize: file.size,
      progress: 0, 
      status: "reserving" as const,
      stateMachine
    };
    newUploadIds.push(id);
  });
  
  set(uploadsAtom, uploads);

  try {
    // Get upload URLs for all files
    const urlPromises = files.map((file, index) => 
      reserveUploadUrl(file, newUploadIds[index], get, set)
    );

    // Wait for all upload URLs to be ready
    await Promise.allSettled(urlPromises);
    
  } catch (error) {
    // Error handling is done in individual promises
  }
});

// Simple upload function without retry logic
const performSimpleUpload = async (
  upload: UploadItem,
  set: (atom: any, ...args: any[]) => void
): Promise<void> => {
  const abortController = new AbortController();
  
  // Update upload with controller and uploading status
  set(updateUploadAtom, upload.id, {
    controller: abortController,
    status: "uploading"
  });

  try {
    // Use axios for upload with progress tracking
    await axios({
      method: upload.method || 'PUT',
      url: upload.uploadUrl!,
      data: upload.file,
      headers: {
        'Content-Type': upload.file.type,
      },
      signal: abortController.signal,
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total) {
          const progress = Math.round((progressEvent.loaded / progressEvent.total) * 100);
          set(updateUploadAtom, upload.id, { progress });
        }
      },
    });

    // Notify API about upload completion
    try {
      await axios.post(`/api/upload-complete/${upload.remoteId}`, {
        bytes: upload.fileSize,
        success: true,
      });
    } catch (completionError) {
      console.error('Failed to notify upload completion:', completionError);
    }

    // Mark upload as successful
    set(updateUploadAtom, upload.id, {
      progress: 100,
      status: "success",
      controller: undefined,
      error: undefined // Clear any previous error
    });

  } catch (error) {
    // Clear controller reference
    set(updateUploadAtom, upload.id, {
      controller: undefined
    });
    throw error; // Re-throw for caller to handle
  }
};

export const startUploadsAtom = atom(null, async (get, set) => {
  const readyUploads = get(readyUploadsAtom);
  
  if (readyUploads.length === 0) {
    return;
  }

  try {
    // Upload all prepared files without retry
    const uploadPromises = readyUploads.map(async (upload) => {
      try {
        await performSimpleUpload(upload, set);
        return { upload, result: null };
        
      } catch (error) {
        if ((error as any).name === 'AbortError') {
          set(updateUploadAtom, upload.id, {
            status: "canceled",
            controller: undefined
          });
          throw new Error('Upload cancelled');
        }

        let errorMsg = 'Upload failed';
        if (error instanceof Error) {
          errorMsg = error.message;
        }
        
        // Notify API about upload failure
        try {
          await axios.post(`/api/upload-complete/${upload.remoteId}`, {
            bytes: 0,
            success: false,
            error: errorMsg
          });
        } catch (completionError) {
          console.error('Failed to notify upload failure:', completionError);
        }
        
        // Update final error state
        set(updateUploadAtom, upload.id, {
          status: "error",
          error: errorMsg,
          controller: undefined
        });
        
        throw new Error(errorMsg);
      }
    });

    // Wait for all uploads to complete
    await Promise.allSettled(uploadPromises);

  } catch (error) {
    // Error handling is done in individual promises
  }
});

// Simple retry atom for individual uploads
export const retryUploadAtom = atom(null, async (get, set, id: string) => {
  const uploads = get(uploadsAtom);
  const upload = uploads[id];
  
  if (!upload || upload.status !== "error") {
    return; // Can't retry if upload doesn't exist or isn't in error state
  }

  // Check if this is a placeholder file (created after page refresh)
  if (isPlaceholderFile(upload)) {
    set(updateUploadAtom, id, {
      status: "error",
      error: "Cannot retry - file was lost during page refresh. Please re-add the file."
    });
    return;
  }

  try {
    // Reset the upload to ready state and perform simple upload
    set(updateUploadAtom, id, {
      status: "ready",
      progress: 0,
      error: undefined,
      controller: undefined
    });

    // Perform the upload
    await performSimpleUpload(upload, set);

  } catch (error) {
    if ((error as any).name === 'AbortError') {
      set(updateUploadAtom, id, {
        status: "canceled",
        controller: undefined
      });
      return;
    }

    let errorMsg = 'Upload retry failed';
    if (error instanceof Error) {
      errorMsg = error.message;
    }
    
    // Notify API about upload failure if we have a remoteId
    if (upload.remoteId) {
      try {
        await axios.post(`/api/upload-complete/${upload.remoteId}`, {
          bytes: 0,
          success: false,
          error: errorMsg
        });
      } catch (completionError) {
        console.error('Failed to notify upload failure:', completionError);
      }
    }
    
    set(updateUploadAtom, id, {
      status: "error",
      error: errorMsg,
      controller: undefined
    });
  }
});

// Simple retry all failed uploads atom
export const retryAllFailedAtom = atom(null, async (get, set) => {
  const uploads = get(uploadsAtom);
  const failedUploads = Object.entries(uploads).filter(([_, upload]) => 
    upload.status === "error" && !upload.error?.includes('page refresh')
  );
  
  if (failedUploads.length === 0) return;
  
  // Retry each failed upload
  const retryPromises = failedUploads.map(([id, _]) => {
    return set(retryUploadAtom, id);
  });
  
  await Promise.allSettled(retryPromises);
});

