import React, { useRef, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface ScrollPickerProps {
  options: number[];
  value: number;
  onChange: (value: number) => void;
  className?: string;
  label?: string;
}

export function ScrollPicker({ options, value, onChange, className, label }: ScrollPickerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const itemHeight = 64; // h-16 = 4rem = 64px
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeout = useRef<NodeJS.Timeout>(null);

  useEffect(() => {
    if (scrollRef.current && !isScrolling) {
      const index = options.indexOf(value);
      if (index !== -1) {
        scrollRef.current.scrollTop = index * itemHeight;
      }
    }
  }, [value, options, isScrolling]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setIsScrolling(true);
    if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    
    const scrollTop = e.currentTarget.scrollTop;
    const index = Math.round(scrollTop / itemHeight);
    
    if (options[index] !== undefined && options[index] !== value) {
      onChange(options[index]);
    }

    scrollTimeout.current = setTimeout(() => {
      setIsScrolling(false);
      if (scrollRef.current) {
        const exactTop = index * itemHeight;
        if (scrollRef.current.scrollTop !== exactTop) {
          scrollRef.current.scrollTo({
            top: exactTop,
            behavior: 'smooth'
          });
        }
      }
    }, 150);
  };

  return (
    <div className={cn("relative flex items-center justify-center h-[192px] overflow-hidden", className)}>
      {/* Selection Highlight Overlay */}
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-16 bg-white/10 rounded-xl pointer-events-none" />
      
      <div 
        ref={scrollRef}
        onScroll={handleScroll}
        className="w-full h-full overflow-y-scroll snap-y snap-mandatory hide-scrollbar relative z-10"
      >
        <div style={{ height: `${itemHeight}px` }} />
        {options.map((opt) => (
          <div 
            key={opt} 
            className="snap-center flex items-center justify-center text-3xl sm:text-4xl font-mono font-bold transition-all duration-200"
            style={{ 
              height: `${itemHeight}px`,
              opacity: opt === value ? 1 : 0.3,
              transform: opt === value ? 'scale(1.1)' : 'scale(0.9)'
            }}
          >
            {opt.toString().padStart(2, '0')} {label && <span className="text-sm ml-1 opacity-50 font-sans font-normal">{label}</span>}
          </div>
        ))}
        <div style={{ height: `${itemHeight}px` }} />
      </div>
    </div>
  );
}
