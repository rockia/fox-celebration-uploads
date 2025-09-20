'use client';

interface FeatureItemProps {
  icon: string;
  title: string;
}

export const FeatureItem = ({ icon, title }: FeatureItemProps) => {
  return (
    <div className="flex items-center space-x-2 text-gray-700 dark:text-gray-300">
      <div className="text-2xl">{icon}</div>
      <span className="font-medium">{title}</span>
    </div>
  );
};
