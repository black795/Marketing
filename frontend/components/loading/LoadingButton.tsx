'use client';

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import Spinner from './Spinner';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface LoadingButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  loadingLabel?: string;
  variant?: Variant;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
}

const VARIANT_CLASS: Record<Variant, string> = {
  primary:
    'bg-brand-pink text-white shadow-sm hover:bg-pink-600 focus:ring-brand-pink',
  secondary:
    'border border-neutral-300 bg-white text-neutral-800 shadow-sm hover:border-brand-pink hover:text-brand-pink focus:ring-brand-pink',
  danger:
    'bg-red-600 text-white shadow-sm hover:bg-red-700 focus:ring-red-500',
  ghost:
    'bg-transparent text-neutral-700 hover:bg-neutral-100 focus:ring-neutral-400',
};

const LoadingButton = forwardRef<HTMLButtonElement, LoadingButtonProps>(
  function LoadingButton(
    {
      loading = false,
      loadingLabel,
      variant = 'primary',
      leftIcon,
      rightIcon,
      fullWidth = false,
      disabled,
      className = '',
      children,
      type = 'button',
      ...rest
    },
    ref
  ) {
    const isDisabled = disabled || loading;

    return (
      <button
        {...rest}
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        data-loading={loading ? 'true' : undefined}
        className={[
          'inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60',
          fullWidth ? 'w-full' : '',
          VARIANT_CLASS[variant],
          className,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {loading ? (
          <>
            <Spinner size={16} />
            <span>{loadingLabel ?? children}</span>
          </>
        ) : (
          <>
            {leftIcon}
            <span>{children}</span>
            {rightIcon}
          </>
        )}
      </button>
    );
  }
);

export default LoadingButton;
