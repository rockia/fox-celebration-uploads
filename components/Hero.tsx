'use client';

import { FeatureItem } from './FeatureItem';

const features = [
  { icon: '⚡', title: 'Lightning Fast' },
  { icon: '📊', title: 'Real-time Progress' },
  { icon: '🎯', title: 'Drag & Drop' },
  { icon: '🎉', title: 'Fox Celebrations' },
];

export const Hero = () => {
  return (
    <section className="w-full py-16 bg-gradient-to-br from-orange-50 to-red-50 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-4xl mx-auto px-8 text-center">
        <div className="space-y-6">
          <div className="space-y-4">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white leading-tight">
              Upload Files with
              <span className="text-orange-600 dark:text-orange-400"> Foxy Speed</span>
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto leading-relaxed">
              Upload multiple files with progress tracking. Drag and drop files to add them to your upload queue! Watch the fox emojis celebrate when your uploads complete!
            </p>
          </div>
          
          <div className="flex flex-wrap justify-center gap-8 pt-8">
            {features.map((feature, index) => (
              <FeatureItem 
                key={index}
                icon={feature.icon}
                title={feature.title}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
