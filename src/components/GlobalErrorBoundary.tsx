/* eslint-disable react-refresh/only-export-components */
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { WifiOff, AlertTriangle, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

/** Normalize any thrown value to an Error so we always have a message (avoids "{}" in logs). */
function normalizeThrownError(thrown: unknown): Error {
    if (thrown instanceof Error) return thrown;
    if (thrown != null && typeof thrown === 'object' && 'message' in thrown && typeof (thrown as { message: unknown }).message === 'string') {
        const e = new Error((thrown as { message: string }).message);
        if ('code' in thrown && (thrown as { code?: unknown }).code !== undefined) (e as Error & { code?: unknown }).code = (thrown as { code: unknown }).code;
        return e;
    }
    if (typeof thrown === 'string') return new Error(thrown);
    try {
        return new Error(JSON.stringify(thrown));
    } catch {
        return new Error(String(thrown));
    }
}

// Fallback UI component to use hooks (translation)
function ErrorFallback({ error, resetErrorBoundary }: { error: Error | null, resetErrorBoundary: () => void }) {
    const { t } = useTranslation();

    const isChunkLoadError = error?.name === 'ChunkLoadError' || error?.message?.includes('Loading chunk');

    return (
        <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--pp-page-bg)' }}>
            <div
                className="max-w-md w-full text-center space-y-6 p-8 rounded-2xl shadow-xl border border-gray-100"
                style={{
                    background: 'var(--pp-page-bg)',
                }}
            >
                <div className="w-20 h-20 mx-auto rounded-full bg-gray-50 flex items-center justify-center">
                    {isChunkLoadError ? (
                        // UX Exception: Error state icon rendered on a light (bg-gray-50) circle.
                        // Dark icon color required for accessibility contrast on light background.
                        // Documented exception per UX_LOGIC.md Layer 3 — "All text is white" rule.
                        <WifiOff className="w-10 h-10 text-gray-900" />
                    ) : (
                        <AlertTriangle className="w-10 h-10 text-red-400" />
                    )}
                </div>

                <div className="space-y-2">
                    <h2 className="text-2xl font-bold" style={{ color: 'var(--pp-header-title-color)' }}>
                        {isChunkLoadError ? t('error.networkTitle') : t('error.genericTitle')}
                    </h2>
                    <p style={{ color: 'var(--pp-text-secondary)' }}>
                        {isChunkLoadError
                            ? t('error.networkMessage')
                            : t('error.genericMessage')}
                    </p>
                </div>

                {error && !isChunkLoadError && import.meta.env.DEV && (
                    <div className="text-left text-xs font-mono bg-black/40 p-4 rounded-lg overflow-auto max-h-40 border border-white/5 text-red-300">
                        {error.toString()}
                    </div>
                )}

                <button
                    onClick={resetErrorBoundary}
                    className="w-full py-3.5 px-6 rounded-xl font-semibold shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2 group border border-white/20 relative overflow-hidden"
                    style={{
                        background: 'var(--pp-button-bg)',
                        color: 'var(--pp-text-primary)',
                    }}
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-black/10 pointer-events-none" />
                    <RefreshCw className="w-5 h-5 group-hover:rotate-180 transition-transform duration-500 relative z-10" />
                    <span className="relative z-10">{t('error.reload')}</span>
                </button>
            </div>
        </div>
    );
}

export class GlobalErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(thrown: unknown): State {
        const error = normalizeThrownError(thrown);
        return { hasError: true, error };
    }

    public componentDidCatch(thrown: unknown, errorInfo: ErrorInfo) {
        const error = normalizeThrownError(thrown);
        console.error('[GlobalErrorBoundary] Uncaught error:', error.message, { raw: thrown, componentStack: errorInfo.componentStack });
        // Here you would log to a service like Sentry (send error + errorInfo.componentStack)
    }

    public handleReset = () => {
        this.setState({ hasError: false, error: null });
        window.location.reload();
    };

    public render() {
        if (this.state.hasError) {
            return <ErrorFallback error={this.state.error} resetErrorBoundary={this.handleReset} />;
        }

        return this.props.children;
    }
}
