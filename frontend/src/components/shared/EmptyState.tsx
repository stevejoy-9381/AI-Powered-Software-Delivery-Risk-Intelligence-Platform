/**
 * EmptyState Component
 * Shows when no data is available with an icon and helpful message.
 */
import { Inbox } from 'lucide-react';
import type { ReactNode } from 'react';

interface Props {
  icon?: ReactNode;
  title?: string;
  message?: string;
  action?: ReactNode;
}

export default function EmptyState({
  icon,
  title = 'No data yet',
  message = 'There is nothing to display right now.',
  action,
}: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 animate-fade-in">
      <div className="w-16 h-16 rounded-2xl bg-slate-500/10 flex items-center justify-center mb-4">
        {icon || <Inbox className="w-8 h-8 text-slate-500" />}
      </div>
      <h3 className="text-lg font-semibold text-slate-300 mb-2">{title}</h3>
      <p className="text-sm text-slate-500 text-center max-w-sm mb-6">{message}</p>
      {action}
    </div>
  );
}
