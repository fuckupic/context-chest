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
      <img src="/chest-white.png" alt="" className="w-16 h-16 mb-5 opacity-10" style={{ imageRendering: 'auto' }} />
      <p className="text-cc-muted text-sm mb-5 max-w-sm">{message}</p>
      {actionLabel && actionTo && (
        <Link
          to={actionTo}
          className="px-5 py-2 bg-cc-pink text-cc-black font-pixel text-xs tracking-wider hover:bg-cc-pink-dim transition-colors"
        >
          {actionLabel}
        </Link>
      )}
      {children}
    </div>
  );
}
