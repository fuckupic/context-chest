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
      <p className="text-vault-muted text-lg mb-4">{message}</p>
      {actionLabel && actionTo && (
        <Link
          to={actionTo}
          className="px-4 py-2 bg-vault-accent text-white rounded-lg text-sm hover:bg-vault-accent/80 transition-colors"
        >
          {actionLabel}
        </Link>
      )}
      {children}
    </div>
  );
}
