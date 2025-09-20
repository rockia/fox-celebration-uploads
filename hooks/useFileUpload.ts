'use client';

import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useCallback } from 'react';
import {
  uploadsArrayAtom,
  isUploadingAtom,
  isPreparingUploadsAtom,
  prepareUploadsAtom,
  startUploadsAtom,
  clearAllUploadsAtom,
  clearRemovableUploadsAtom,
  removeUploadAtom,
  cancelUploadAtom,
  cancelAllActiveUploadsAtom,
  addFilesAtom,
} from '@/atoms';
import {
  retryUploadAtom,
  retryAllFailedAtom,
} from '@/atoms/uploads';

export interface UploadUrlResponse {
  id: string;
  uploadUrl: string;
  method: string;
  echo: {
    filename: string;
    size: number;
    type: string;
  };
}

export interface UploadResult {
  ok: boolean;
  id: string;
  bytes: number;
  error?: string;
}

export const useFileUpload = () => {
  const uploads = useAtomValue(uploadsArrayAtom);
  const isUploading = useAtomValue(isUploadingAtom);
  const isPreparingUploads = useAtomValue(isPreparingUploadsAtom);
  
  const prepareUploads = useSetAtom(prepareUploadsAtom);
  const startUploads = useSetAtom(startUploadsAtom);
  const clearUploads = useSetAtom(clearAllUploadsAtom);
  const clearRemovableUploads = useSetAtom(clearRemovableUploadsAtom);
  const removeUpload = useSetAtom(removeUploadAtom);
  const cancelUpload = useSetAtom(cancelUploadAtom);
  const cancelAllActiveUploads = useSetAtom(cancelAllActiveUploadsAtom);
  const addFiles = useSetAtom(addFilesAtom);
  const retryUpload = useSetAtom(retryUploadAtom);
  const retryAllFailed = useSetAtom(retryAllFailedAtom);

  // Keep the old function for backward compatibility
  const uploadFiles = useCallback(async (files: File[]) => {
    await prepareUploads(files);
    // Small delay to ensure state updates
    setTimeout(() => startUploads(), 100);
  }, [prepareUploads, startUploads]);

  return {
    uploads,
    isUploading,
    isPreparingUploads,
    uploadFiles,
    prepareUploads,
    startUploads,
    clearUploads,
    clearRemovableUploads,
    removeUpload,
    cancelUpload,
    cancelAllActiveUploads,
    addFiles,
    retryUpload,
    retryAllFailed,
  };
};
