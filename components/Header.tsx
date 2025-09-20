'use client';

import { motion } from 'motion/react';

export const Header = () => {
  return (
    <header className="w-full bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
      <div className="max-w-4xl mx-auto px-8 py-6">
        <div className="flex items-center justify-center">
          <div className="flex items-center space-x-3">
            <motion.div
              className="text-6xl cursor-pointer"
              whileHover={{ 
                scale: 1.3, 
                rotate: -30 
              }}
              transition={{ 
                type: "spring", 
                stiffness: 400, 
                damping: 17 
              }}
            >
              🦊
            </motion.div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Fox Celebration Uploads
            </h1>
          </div>
        </div>
      </div>
    </header>
  );
};
