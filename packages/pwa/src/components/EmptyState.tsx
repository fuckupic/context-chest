import { Link } from 'react-router-dom';

interface EmptyStateProps {
  message: string;
  actionLabel?: string;
  actionTo?: string;
  children?: React.ReactNode;
}

export function EmptyState({ message, actionLabel, actionTo, children }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-center px-8">
      <svg className="w-14 h-14 mb-4 text-vault-muted opacity-20" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.2">
        <rect x="8" y="6" width="32" height="36" rx="3" />
        <line x1="14" y1="16" x2="34" y2="16" />
        <line x1="14" y1="22" x2="34" y2="22" />
        <line x1="14" y1="28" x2="26" y2="28" />
      </svg>
      <p className="text-vault-muted text-sm mb-4 max-w-sm">{message}</p>
      {actionLabel && actionTo && (
        <Link
          to={actionTo}
          className="px-4 py-1.5 bg-vault-pink text-vault-crust rounded text-[13px] font-medium hover:bg-vault-pink-hover transition-colors"
        >
          {actionLabel}
        </Link>
      )}
      {children}
    </div>
  );
}
