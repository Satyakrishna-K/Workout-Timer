import React from 'react';
import { ScrollPicker } from './ScrollPicker';
import { cn } from '@/lib/utils';

interface TimePickerProps {
  value: number; // in seconds
  onChange: (value: number) => void;
  className?: string;
}

export function TimePicker({ value, onChange, className }: TimePickerProps) {
  const minutes = Math.floor(value / 60);
  const seconds = value % 60;
  
  const minOptions = Array.from({ length: 60 }, (_, i) => i);
  const secOptions = Array.from({ length: 60 }, (_, i) => i);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <ScrollPicker 
        options={minOptions} 
        value={minutes} 
        onChange={(m) => onChange(m * 60 + seconds)} 
        label="m" 
        className="flex-1"
      />
      <ScrollPicker 
        options={secOptions} 
        value={seconds} 
        onChange={(s) => onChange(minutes * 60 + s)} 
        label="s" 
        className="flex-1"
      />
    </div>
  );
}
