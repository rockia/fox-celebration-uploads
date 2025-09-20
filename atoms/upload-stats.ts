import { atom } from "jotai";
import { uploadsAtom, overallProgressAtom } from "./uploads";

export const uploadStatsAtom = atom((get) => {
  const items = Object.values(get(uploadsAtom));
  const totalFiles = items.length;
  const inProgressFiles = items.filter((u) => u.status === "reserving" || u.status === "uploading").length;
  const queuedFiles = items.filter((u) => u.status === "queued" || u.status === "ready").length;
  const successFiles = items.filter((u) => u.status === "success").length;
  const errorFiles = items.filter((u) => u.status === "error").length;
  const canceledFiles = items.filter((u) => u.status === "canceled").length;

  const totalBytes = items.reduce((a, u) => a + (u.fileSize ?? 0), 0);
  const loadedBytes = items.reduce((a, u) => {
    const size = u.fileSize ?? 0;
    if (u.status === "success") return a + size;
    return a + Math.floor(size * (u.progress / 100));
  }, 0);

  return { 
    totalFiles, 
    inProgressFiles, 
    queuedFiles, 
    successFiles, 
    errorFiles, 
    canceledFiles, 
    totalBytes, 
    loadedBytes 
  };
});

// Legacy progress atom - now uses state machine
export const overallProgressPercentAtom = atom((get) => {
  const progress = get(overallProgressAtom);
  return progress.context.overallProgress;
});

// Legacy status type for backward compatibility
export type OverallStatus = "idle" | "queued" | "uploading" | "mixed" | "success" | "attention";

// Legacy status atom - maps state machine states to old status values
export const overallStatusAtom = atom<OverallStatus>((get) => {
  const progress = get(overallProgressAtom);
  const state = progress.state;
  
  switch (state) {
    case "idle":
      return "idle";
    case "preparing":
    case "ready":
      return "queued";
    case "uploading":
      return "uploading";
    case "completed":
      return "success";
    case "partial":
      return "mixed";
    case "failed":
    case "canceled":
      return "attention";
    default:
      return "idle";
  }
});

// Additional derived atoms for convenience
export const hasUploadsAtom = atom((get) => {
  const { totalFiles } = get(uploadStatsAtom);
  return totalFiles > 0;
});

// Updated atoms using state machine
export const isUploadingAtom = atom((get) => {
  const progress = get(overallProgressAtom);
  return progress.context.uploadingFiles > 0;
});

export const isPreparingUploadsAtom = atom((get) => {
  const progress = get(overallProgressAtom);
  return progress.context.preparingFiles > 0;
});

export const hasErrorsAtom = atom((get) => {
  const progress = get(overallProgressAtom);
  return progress.context.failedFiles > 0;
});

export const canStartUploadAtom = atom((get) => {
  const progress = get(overallProgressAtom);
  return progress.canStartUploads;
});

// New atom to track if uploads have started (either uploading or at least 1 successfully uploaded)
export const uploadsStartedAtom = atom((get) => {
  const progress = get(overallProgressAtom);
  const { uploadingFiles, completedFiles } = progress.context;
  return uploadingFiles > 0 || completedFiles > 0;
});
