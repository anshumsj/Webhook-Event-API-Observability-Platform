import React, { forwardRef } from 'react';

export const Input = forwardRef(function Input(
  {
    type = 'text',
    size = 'md',
    disabled = false,
    className = '',
    leftIcon,
    rightIcon,
    ...props
  },
  ref
) {
  const heightClass = size === 'sm' ? 'h-7 text-xs' : 'h-8 text-[13px]';
  const paddingClass = leftIcon
    ? rightIcon
      ? 'pl-8 pr-8'
      : 'pl-8 pr-2.5'
    : rightIcon
    ? 'pl-2.5 pr-8'
    : 'px-2.5';

  return (
    <div className={`relative inline-flex items-center w-full ${className}`}>
      {leftIcon && (
        <span className="absolute left-2.5 flex items-center justify-center text-muted pointer-events-none">
          {leftIcon}
        </span>
      )}

      <input
        ref={ref}
        type={type}
        disabled={disabled}
        className={`w-full bg-canvas border border-border rounded text-text placeholder:text-muted/70 font-sans transition-colors duration-150 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/25 disabled:opacity-50 disabled:cursor-not-allowed ${heightClass} ${paddingClass}`}
        {...props}
      />

      {rightIcon && (
        <span className="absolute right-2.5 flex items-center justify-center text-muted pointer-events-none">
          {rightIcon}
        </span>
      )}
    </div>
  );
});

export default Input;
