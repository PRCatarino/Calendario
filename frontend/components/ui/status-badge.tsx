import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MeetingStatus } from '@/types/meeting';

const MAP: Record<MeetingStatus, { label: string; cls: string; Icon: typeof Clock }> = {
  PENDING: { label: 'Pendente', cls: 'bg-amber-50 text-amber-700 ring-amber-200', Icon: Clock },
  APPROVED: { label: 'Aprovada', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200', Icon: CheckCircle2 },
  REJECTED: { label: 'Reprovada', cls: 'bg-rose-50 text-rose-700 ring-rose-200', Icon: XCircle },
};

export function StatusBadge({ status, className }: { status: MeetingStatus; className?: string }) {
  const { label, cls, Icon } = MAP[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1',
        cls,
        className,
      )}
    >
      <Icon size={13} />
      {label}
    </span>
  );
}
