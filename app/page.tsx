'use client';

import { Dropzone, DropzoneContent, DropzoneEmptyState } from '@/components/ui/shadcn-io/dropzone';
import { UploadProgress } from '@/components/UploadProgress';
import { OverallProgressBar } from '@/components/OverallProgressBar';
import { useFileUpload } from '@/hooks/useFileUpload';
import { useState } from 'react';
import { useAtomValue } from 'jotai';
import { overallStatusAtom, uploadsStartedAtom } from '@/atoms/upload-stats';
import { hasPlaceholderFilesAtom } from '@/atoms';
import { AnimatedButton } from '@/components/AnimatedButton';
import { Header } from '@/components/Header';
import { Hero } from '@/components/Hero';
import { Footer } from '@/components/Footer';

export default function Home() {
  const [selectedFiles, setSelectedFiles] = useState<File[] | undefined>();
  const { uploads, isUploading, isPreparingUploads, prepareUploads, startUploads, clearUploads, clearRemovableUploads, removeUpload, cancelUpload, cancelAllActiveUploads, retryUpload, retryAllFailed } = useFileUpload();
  const overallStatus = useAtomValue(overallStatusAtom);
  const uploadsStarted = useAtomValue(uploadsStartedAtom);
  const hasPlaceholderFiles = useAtomValue(hasPlaceholderFilesAtom);

  const handleDrop = (files: File[]) => {
    // Prevent adding files when uploads have started
    if (uploadsStarted) {
      return;
    }

    // Get existing files from both selectedFiles and uploads
    const existingFiles = [
      ...(selectedFiles || []),
      ...uploads.map(upload => upload.file)
    ];

    // Filter out duplicates based on name and size
    const newFiles = files.filter(newFile => 
      !existingFiles.some(existingFile => 
        existingFile.name === newFile.name && 
        existingFile.size === newFile.size
      )
    );

    if (newFiles.length === 0) {
      return;
    }

    // Combine existing selected files with new files
    const allFiles = [...(selectedFiles || []), ...newFiles];
    setSelectedFiles(allFiles);
    
    // Only prepare uploads for the new files
    prepareUploads(newFiles);
  };

  const handleUpload = () => {
    startUploads();
    setSelectedFiles(undefined); // Clear the dropzone after starting upload
  };

  const handleUploadMore = () => {
    clearUploads(); // Clear completed uploads
    setSelectedFiles(undefined); // Clear selected files
  };

  const handleRemoveUpload = (id: string) => {
    // Remove from uploads atom
    removeUpload(id);
    
    // Also remove from selectedFiles if it exists there
    if (selectedFiles) {
      const uploadToRemove = uploads.find(u => u.id === id);
      if (uploadToRemove) {
        const updatedSelectedFiles = selectedFiles.filter(file => 
          !(file.name === uploadToRemove.file.name && file.size === uploadToRemove.file.size)
        );
        setSelectedFiles(updatedSelectedFiles.length > 0 ? updatedSelectedFiles : undefined);
      }
    }
  };

  const getUploadButtonText = () => {
    if (hasPlaceholderFiles) {
      return 'Cannot upload - files lost after refresh';
    }
    if (isUploading) return 'Uploading...';
    if (isPreparingUploads) return 'Preparing...';
    
    const readyUploads = uploads.filter(u => u.uploadUrl && u.id).length;
    if (readyUploads > 0) {
      return `Upload ${uploads.length} file${uploads.length > 1 ? 's' : ''}`;
    }
    
    return 'Preparing uploads...';
  };

  const isUploadButtonDisabled = () => {
    return hasPlaceholderFiles ||
           uploadsStarted || 
           isUploading || 
           isPreparingUploads || 
           uploads.filter(u => u.uploadUrl && u.id).length === 0;
  };

  const getClearButtonInfo = () => {
    const removableUploads = uploads.filter(u => 
      u.status === 'queued' || 
      u.status === 'ready' || 
      u.status === 'reserving' || 
      u.status === 'success' || 
      u.status === 'canceled' || 
      u.status === 'error'
    );
    const uploadingCount = uploads.filter(u => u.status === 'uploading').length;
    
    if (removableUploads.length === 0) {
      return { show: false, text: '', action: () => {} };
    }
    
    if (uploadingCount > 0) {
      // Some files are uploading, only clear removable ones
      return {
        show: true,
        text: `Clear ${removableUploads.length} file${removableUploads.length > 1 ? 's' : ''}`,
        action: () => {
          setSelectedFiles(undefined);
          clearRemovableUploads();
        }
      };
    } else {
      // No files uploading, can clear all
      return {
        show: true,
        text: 'Clear All',
        action: () => {
          setSelectedFiles(undefined);
          clearUploads();
        }
      };
    }
  };


  return (
    <div className="font-sans min-h-screen flex flex-col">
      {/* Header */}
      <Header />

      {/* Hero Section */}
      <Hero />

      {/* Main Content */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-8 py-16 space-y-8">
        {/* File Dropzone */}
        <div className="space-y-4">
          <Dropzone
            maxFiles={0}
            onDrop={handleDrop}
            onError={() => {}}
            src={selectedFiles}
            className="min-h-[200px] hover:cursor-pointer"
            disabled={isUploading || uploadsStarted}
          >
            <DropzoneEmptyState />
            <DropzoneContent />
          </Dropzone>

          {/* Upload Controls */}
          {(selectedFiles && selectedFiles.length > 0) || uploads.length > 0 ? (
            <div className="flex gap-2 justify-center">
              {overallStatus === 'success' ? (
                // All uploads completed successfully - show "Upload More" button
                <AnimatedButton 
                  onClick={handleUploadMore}
                  className="min-w-[120px]"
                >
                  Upload More Files
                </AnimatedButton>
              ) : (
                // Show upload button and clear all button
                <>
                  <AnimatedButton 
                    onClick={handleUpload}
                    disabled={isUploadButtonDisabled()}
                    className="min-w-[120px]"
                  >
                    {getUploadButtonText()}
                  </AnimatedButton>
                    {(() => {
                      const clearInfo = getClearButtonInfo();
                      return clearInfo.show ? (
                        <AnimatedButton 
                          variant="outline" 
                          onClick={clearInfo.action}
                        >
                          {clearInfo.text}
                        </AnimatedButton>
                      ) : null;
                    })()}
                </>
              )}
            </div>
          ) : null}

          {/* Placeholder files warning */}
          {hasPlaceholderFiles && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-center">
              <div className="flex items-center justify-center space-x-2 text-orange-700">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span className="font-medium">Files lost after page refresh</span>
              </div>
              <p className="text-orange-600 text-sm mt-2">
                When you refresh the page, browsers automatically clear file selections for security reasons. Please remove these failed uploads and re-select your files to continue.
              </p>
            </div>
          )}
        </div>

        {/* Overall Progress Bar */}
        <OverallProgressBar />

        <UploadProgress 
          uploads={uploads}
          onRemove={handleRemoveUpload}
          onCancel={cancelUpload}
          onCancelAll={cancelAllActiveUploads}
          onRetry={retryUpload}
          onRetryAll={retryAllFailed}
        />
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
