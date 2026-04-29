import React from 'react';

export function GlassButton({
    onClick,
    disabled,
    ariaLabel,
    children,
    className,
    variant = 'default',
}: Readonly<{
    onClick: () => void;
    disabled?: boolean;
    ariaLabel: string;
    children: React.ReactNode;
    className?: string;
    variant?: 'default' | 'accent';
}>) {
    const overlayClass = variant === 'accent' 
        ? 'bg-gradient-to-br from-white/30 via-transparent to-black/35' 
        : 'bg-gradient-to-br from-white/10 via-transparent to-black/35';
    
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={[
                'p-2 rounded-lg transition-all relative overflow-hidden backdrop-blur-sm border',
                disabled ? 'opacity-40 cursor-not-allowed' : 'hover:scale-105 active:scale-95',
                className,
            ].filter(Boolean).join(' ')}
            style={{
                background: 'var(--pp-button-bg)',
                borderColor: variant === 'accent' ? 'var(--pp-accent)' : 'var(--pp-border-soft)',
                color: 'var(--pp-text-primary)',
                boxShadow: 'var(--pp-surface-shadow)',
            }}
            aria-label={ariaLabel}
        >
            <div className={`absolute inset-0 ${overlayClass} pointer-events-none rounded-lg`} />
            <div className="relative z-10">{children}</div>
        </button>
    );
}
