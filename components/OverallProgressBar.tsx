'use client';

import { useAtomValue } from 'jotai';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { 
  uploadStatsAtom, 
  overallProgressPercentAtom, 
  overallStatusAtom,
  type OverallStatus 
} from '@/atoms/upload-stats';
import { motion, AnimatePresence } from 'motion/react';

interface OverallProgressBarProps {
  className?: string;
}

interface UploadStats {
  totalFiles: number;
  successFiles: number;
  errorFiles: number;
  queuedFiles: number;
  inProgressFiles: number;
  canceledFiles: number;
}

const getStatusText = (status: OverallStatus, stats: UploadStats): string => {
  switch (status) {
    case 'idle':
      return 'No uploads';
    case 'queued':
      return `${stats.queuedFiles} file${stats.queuedFiles !== 1 ? 's' : ''} ready to upload`;
    case 'uploading':
      return `${stats.successFiles} of ${stats.totalFiles} files completed`;
    case 'mixed':
      return `${stats.successFiles} of ${stats.totalFiles} files completed`;
    case 'success':
      return `All ${stats.totalFiles} files uploaded successfully`;
    case 'attention':
      return `${stats.successFiles} of ${stats.totalFiles} files completed`;
    default:
      return '';
  }
};

export const OverallProgressBar = ({ className }: OverallProgressBarProps) => {
  const stats = useAtomValue(uploadStatsAtom);
  const progress = useAtomValue(overallProgressPercentAtom);
  const status = useAtomValue(overallStatusAtom);

  // Don't show if no uploads
  if (stats.totalFiles === 0) {
    return null;
  }

  const statusText = getStatusText(status, stats);
  const showProgress = stats.totalFiles > 0; // Always show progress when there are files

  return (
    <Card className={cn("w-full", className)}>
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header with status and file count */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="text-sm font-medium">
                Overall Progress
              </h3>
              <p className="text-xs text-muted-foreground">
                {statusText}
              </p>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <div className="font-large">{progress}%</div>
            </div>
          </div>

          {/* Progress bar */}
          {showProgress && (
            <div className="relative">
              <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700 overflow-hidden">
                <motion.div
                  className="h-2 rounded-full bg-green-500"
                  style={{ width: `${progress}%` }}
                  initial={{ width: "0%" }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                />
              </div>

              {/* Fox sparks animation on completion - multiple foxes based on successful uploads */}
              <AnimatePresence>
                {status === 'success' && stats.successFiles > 0 && (
                  <>
                    {[...Array(stats.successFiles)].map((_, i) => (
                      <motion.div
                        key={`overall-fox-${i}`}
                        className="absolute text-2xl pointer-events-none z-10"
                        style={{
                          left: '100%',
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
                          x: [0, (Math.random() - 0.5) * 200],
                          y: [0, -50 + (Math.random() - 0.5) * 100]
                        }}
                        transition={{
                          duration: 2.5,
                          ease: "easeOut",
                          times: [0, 0.3, 0.7, 1],
                          delay: i * 0.15
                        }}
                        exit={{
                          opacity: 0,
                          scale: 0
                        }}
                      >
                        🦊
                      </motion.div>
                    ))}
                  </>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* File breakdown */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center space-x-4">
              {stats.successFiles > 0 && (
                <span className="flex items-center">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-1" />
                  {stats.successFiles} completed
                </span>
              )}
              {stats.inProgressFiles > 0 && (
                <span className="flex items-center">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mr-1 animate-pulse" />
                  {stats.inProgressFiles} uploading
                </span>
              )}
              {stats.queuedFiles > 0 && (
                <span className="flex items-center">
                  <div className="w-2 h-2 bg-gray-400 rounded-full mr-1" />
                  {stats.queuedFiles} queued
                </span>
              )}
              {stats.errorFiles > 0 && (
                <span className="flex items-center">
                  <div className="w-2 h-2 bg-red-500 rounded-full mr-1" />
                  {stats.errorFiles} failed
                </span>
              )}
              {stats.canceledFiles > 0 && (
                <span className="flex items-center">
                  <div className="w-2 h-2 bg-orange-500 rounded-full mr-1" />
                  {stats.canceledFiles} canceled
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
