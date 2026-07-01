import { forwardRef } from 'react';

const Button = forwardRef(({ className = '', variant, size, ...props }, ref) => {
  const baseStyles = 'inline-flex min-w-0 max-w-full items-center justify-center rounded-md text-center text-sm font-medium leading-tight whitespace-normal transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 [&>svg]:shrink-0';
  
  const variantStyles = variant === 'ghost' 
    ? 'hover:bg-slate-100' 
    : 'bg-slate-900 text-white shadow hover:bg-slate-800';
  
  const sizeStyles = size === 'icon' ? 'h-9 w-9' : 'h-9 px-4 py-2';

  return (
    <button
      ref={ref}
      className={`${baseStyles} ${variantStyles} ${sizeStyles} ${className}`}
      {...props}
    />
  );
});

Button.displayName = 'Button';

export { Button };
