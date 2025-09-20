'use client';

import { X, XCircle, RotateCcw } from 'lucide-react';
import { AnimatedButton } from '@/components/AnimatedButton';
import { Card, CardContent } from '@/components/ui/card';
import { cn, formatFileSize } from '@/lib/utils';
import type { UploadItem } from '@/atoms/uploads';
import { StatusIcon } from '@/components/StatusIcon';
import { motion, AnimatePresence } from 'motion/react';
import { isPlaceholderFile } from '@/atoms';

const getUploadStatusText = (upload: UploadItem): string => {
  if (upload.status === 'uploading' || upload.status === 'success') {
    return `${upload.progress}%`;
  }
  if (upload.status === 'canceled') {
    return 'Cancelled';
  }
  return upload.status;
};

const renderActionButtons = (
  upload: UploadItem, 
  onCancel: (id: string) => void, 
  onRetry: (id: string) => void,
  onRemove: (id: string) => void
) => {
  // Cancel button for uploading files
  if (upload.status === 'uploading') {
    return (
      <AnimatedButton
        variant="ghost"
        size="sm"
        onClick={() => onCancel(upload.id)}
        className="h-6 w-6 p-0 text-orange-500 hover:text-orange-700"
        title="Cancel upload"
        hoverScale={1.2}
      >
        <XCircle className="h-3 w-3" />
      </AnimatedButton>
    );
  }

  // Retry and Remove buttons for failed uploads
  if (upload.status === 'error' && upload.id) {
    const isFileLost = upload.error?.includes('page refresh');
    return (
      <>
        {!isFileLost && (
          <AnimatedButton
            variant="ghost"
            size="sm"
            onClick={() => onRetry(upload.id)}
            className="h-6 w-6 p-0 text-blue-500 hover:text-blue-700"
            title="Retry upload"
            hoverScale={1.2}
          >
            <RotateCcw className="h-3 w-3" />
          </AnimatedButton>
        )}
        <AnimatedButton
          variant="ghost"
          size="sm"
          onClick={() => onRemove(upload.id)}
          className="h-6 w-6 p-0"
          title="Remove from list"
          hoverScale={1.2}
        >
          <X className="h-3 w-3" />
        </AnimatedButton>
      </>
    );
  }

  // Remove button for completed, cancelled, or queued uploads (not currently uploading)
  if ((upload.status === 'success' || 
       upload.status === 'canceled' || 
       upload.status === 'queued' || 
       upload.status === 'ready' || 
       upload.status === 'reserving') && upload.id) {
    return (
      <AnimatedButton
        variant="ghost"
        size="sm"
        onClick={() => onRemove(upload.id)}
        className="h-6 w-6 p-0"
        title="Remove from list"
        hoverScale={1.2}
      >
        <X className="h-3 w-3" />
      </AnimatedButton>
    );
  }

  return null;
};

interface UploadProgressProps {
  uploads: UploadItem[];
  onRemove: (id: string) => void;
  onCancel: (id: string) => void;
  onCancelAll?: () => void;
  onRetry: (id: string) => void;
  onRetryAll: () => void;
}


export const UploadProgress = ({ uploads, onRemove, onCancel, onCancelAll, onRetry, onRetryAll }: UploadProgressProps) => {
  if (uploads.length === 0) return null;

  const completedUploads = uploads.filter(upload => upload.status === 'success').length;
  const totalUploads = uploads.length;

  // Count retryable failed uploads (not lost due to page refresh)
  const retryableFailedUploads = uploads.filter(upload =>
    upload.status === 'error' && !upload.error?.includes('page refresh')
  ).length;
  const hasRetryableFailedUploads = retryableFailedUploads > 0;
  
  // Count active uploads that can be canceled
  const activeUploads = uploads.filter(upload => 
    upload.status === 'uploading' || upload.status === 'reserving'
  ).length;
  const hasActiveUploads = activeUploads > 0;

  return (
    <Card className="w-full">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">
            Upload Progress ({completedUploads}/{totalUploads})
          </h3>
          <div className="flex items-center gap-2">
            {hasRetryableFailedUploads && (
              <AnimatedButton 
                variant="outline" 
                size="sm" 
                onClick={onRetryAll}
                className="h-8 text-blue-600 hover:text-blue-700 hover:border-blue-300"
                hoverScale={1.2}
              >
                Retry All
              </AnimatedButton>
            )}
            {hasActiveUploads && onCancelAll && (
              <AnimatedButton 
                variant="outline" 
                size="sm" 
                onClick={onCancelAll}
                className="h-8 text-red-600 hover:text-red-700 hover:border-red-300"
                hoverScale={1.2}
              >
                Cancel All
              </AnimatedButton>
            )}
          </div>
        </div>
        
        <div className="space-y-3">
          {uploads.map((upload) => {
            const isPlaceholder = isPlaceholderFile(upload);
            return (
              <div 
                key={upload.id || upload.file.name} 
                className={cn(
                  "space-y-2 relative",
                  isPlaceholder && "bg-orange-50 border border-orange-200 rounded-lg p-3"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 flex-1 min-w-0">
                    <StatusIcon status={upload.status} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <p className="text-sm font-medium truncate">
                          {upload.file.name}
                        </p>
                        {isPlaceholder && (
                          <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full">
                            File Missing
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(upload.fileSize)}
                      </p>
                    </div>
                  </div>
                
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-muted-foreground min-w-[3rem] text-right">
                    {getUploadStatusText(upload)}
                  </span>
                  
                  {renderActionButtons(upload, onCancel, onRetry, onRemove)}
                </div>
              </div>
              
              {/* Progress bar container with fox animation */}
              {(upload.status === 'uploading' || upload.status === 'success') && (
                <div className="relative">
                  <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700 overflow-hidden">
                    <motion.div
                      className={cn(
                        "h-2 rounded-full relative",
                        upload.status === 'success'
                          ? "bg-green-500"
                          : "bg-blue-500"
                      )}
                      style={{ width: `${upload.progress}%` }}
                      initial={{ width: "0%" }}
                      animate={{ width: `${upload.progress}%` }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                    >
                      {upload.status === 'uploading' && (
                        <motion.div
                          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                          animate={{
                            x: ['-100%', '100%']
                          }}
                          transition={{
                            duration: 1.5,
                            repeat: Infinity,
                            ease: "linear"
                          }}
                          style={{
                            width: '50%'
                          }}
                        />
                      )}
                    </motion.div>
                  </div>

                  {/* Fox sparks animation on completion - positioned at end of progress bar */}
                  <AnimatePresence>
                    {upload.status === 'success' && (
                      <motion.div
                        key={`fox-${upload.id}-success`}
                        className="absolute text-2xl pointer-events-none z-10"
                        style={{
                          left: upload.status === 'success' ? '100%' : `${upload.progress}%`,
                          top: '50%',
                          transform: 'translate(-50%, -50%)'
                        }}
                        initial={{
                          scale: 0,
                          opacity: 0,
                          x: 0,
                          y: 0
                        }}
                        animate={{
                          scale: [0, 1.5, 1, 0],
                          opacity: [0, 1, 1, 0],
                          x: [0, (Math.random() - 0.5) * 60],
                          y: [0, -30 + (Math.random() - 0.5) * 20]
                        }}
                        transition={{
                          duration: 2,
                          ease: "easeOut",
                          times: [0, 0.3, 0.7, 1]
                        }}
                        exit={{
                          opacity: 0,
                          scale: 0
                        }}
                      >
                        🦊
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
              
              {/* Error message */}
              {upload.status === 'error' && upload.error && (
                <p className="text-xs text-red-500 mt-1">
                  Error: {upload.error}
                </p>
              )}
              
              {/* Cancelled message */}
              {upload.status === 'canceled' && (
                <p className="text-xs text-orange-500 mt-1">
                  Upload was cancelled
                </p>
              )}
            </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
