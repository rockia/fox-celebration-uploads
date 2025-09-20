'use client';

export const Footer = () => {
  return (
    <footer className="w-full bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 mt-16">
      <div className="max-w-4xl mx-auto px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Logo and Description */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <div className="text-2xl">🦊</div>
              <span className="text-lg font-semibold text-gray-900 dark:text-white">
                Fox Celebration Uploads
              </span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              A demo file upload application showcasing modern web development with React, Next.js, and delightful fox-powered celebrations.
            </p>
          </div>

          {/* Features */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
              Features
            </h3>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <li>• Multiple file uploads</li>
              <li>• Real-time progress tracking</li>
              <li>• Drag & drop interface</li>
              <li>• Upload resumption</li>
              <li>• Fox emoji celebrations</li>
            </ul>
          </div>

          {/* Tech Stack */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
              Tech Stack
            </h3>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <li>• Next.js 15 & React 19</li>
              <li>• TypeScript & Tailwind CSS</li>
              <li>• Motion animations</li>
              <li>• Jotai state management</li>
              <li>• Axios & mock APIs</li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-800">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div className="text-center md:text-left">
         
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                This is not a real company or service. Made with React, Next.js, and fox emojis.
              </p>
            </div>

          </div>
        </div>
      </div>
    </footer>
  );
};
