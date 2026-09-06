import React, { forwardRef } from 'react';

const VARIANTS = {
  primary:
    'bg-primary text-canvas font-medium hover:bg-primary-hover active:opacity-90 border border-transparent shadow-none',
  secondary:
    'bg-surface-2 text-text border border-border hover:bg-surface-3 hover:border-border-strong active:bg-surface-2',
  ghost:
    'bg-transparent text-text-secondary hover:bg-surface-2 hover:text-text active:bg-surface-3 border border-transparent',
  danger:
    'bg-failure/10 text-failure border border-failure/25 hover:bg-failure/20 active:bg-failure/15',
};

const SIZES = {
  sm: 'h-7 px-2.5 text-xs gap-1.5',
  md: 'h-8 px-3 text-[13px] gap-2',
};

export const Button = forwardRef(function Button(
  {
    children,
    variant = 'secondary',
    size = 'md',
    type = 'button',
    disabled = false,
    className = '',
    ...props
  },
  ref
) {
  const variantStyles = VARIANTS[variant] || VARIANTS.secondary;
  const sizeStyles = SIZES[size] || SIZES.md;

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled}
      className={`inline-flex items-center justify-center font-sans rounded transition-colors duration-150 select-none cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/50 disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed ${variantStyles} ${sizeStyles} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
});

export default Button;
