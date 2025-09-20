'use client';

import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { forwardRef } from 'react';
import type { ComponentProps } from 'react';

interface AnimatedButtonProps extends ComponentProps<typeof Button> {
  hoverScale?: number;
  tapScale?: number;
}

export const AnimatedButton = forwardRef<
  HTMLButtonElement,
  AnimatedButtonProps
>(({ hoverScale = 1.1, tapScale = 0.9, children, ...props }, ref) => {
  return (
    <motion.div
      whileHover={{ scale: hoverScale }}
      whileTap={{ scale: tapScale }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
    >
      <Button ref={ref} {...props} className="cursor-pointer">
        {children}
      </Button>
    </motion.div>
  );
});

AnimatedButton.displayName = 'AnimatedButton';
