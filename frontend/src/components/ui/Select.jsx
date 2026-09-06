import React, { forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';

export const Select = forwardRef(function Select(
  {
    children,
    size = 'md',
    disabled = false,
    className = '',
    ...props
  },
  ref
) {
  const heightClass = size === 'sm' ? 'h-7 text-xs' : 'h-8 text-[13px]';

  return (
    <div className={`relative inline-flex items-center w-full ${className}`}>
      <select
        ref={ref}
        disabled={disabled}
        className={`w-full appearance-none bg-canvas border border-border rounded text-text font-sans pl-2.5 pr-8 transition-colors duration-150 cursor-pointer focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/25 disabled:opacity-50 disabled:cursor-not-allowed ${heightClass}`}
        {...props}
      >
        {children}
      </select>
      <span className="absolute right-2.5 flex items-center justify-center text-muted pointer-events-none">
        <ChevronDown className="w-3.5 h-3.5" />
      </span>
    </div>
  );
});

export default Select;
