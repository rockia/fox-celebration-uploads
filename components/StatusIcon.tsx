import { CheckCircle, AlertCircle, Upload, XCircle } from 'lucide-react';
import type { UploadItem } from '@/atoms/uploads';

interface StatusIconProps {
  status: UploadItem['status'];
}

export const StatusIcon = ({ status }: StatusIconProps) => {
  switch (status) {
    case 'success':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'error':
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    case 'canceled':
      return <XCircle className="h-4 w-4 text-orange-500" />;
    case 'uploading':
      return <Upload className="h-4 w-4 text-blue-500 animate-pulse" />;
    case 'reserving':
      return <Upload className="h-4 w-4 text-blue-500 animate-pulse" />;
    case 'ready':
      return <Upload className="h-4 w-4 text-blue-500" />;
    case 'queued':
      return <Upload className="h-4 w-4 text-gray-500" />;
    default:
      return <Upload className="h-4 w-4 text-gray-500" />;
  }
};
