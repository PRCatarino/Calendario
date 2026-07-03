'use client';

import { Avatar } from '@/components/ui/avatar';
import { COLOR_STYLES } from '@/lib/colors';
import { fmtTime } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';
import type { Meeting } from '@/types/meeting';

interface EventChipProps {
  meeting: Meeting;
  selected?: boolean;
  /** single click — just select */
  onSelect?: () => void;
  /** double click — open detail */
  onOpen?: () => void;
}

/** compact month-cell chip: [photo] HH:mm Nome */
export function EventChip({ meeting, selected, onSelect, onOpen }: EventChipProps) {
  const c = COLOR_STYLES[meeting.color];
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.();
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onOpen?.();
      }}
      title={`${fmtTime(meeting.start)} · ${meeting.clientName} — ${meeting.title} (duplo clique abre)`}
      className={cn(
        'flex w-full items-center gap-1.5 rounded-lg border px-1.5 py-1 text-left transition-colors',
        c.chip,
        selected && 'ring-2 ring-brand-400 ring-offset-1',
      )}
    >
      <Avatar src={meeting.imageUrl} alt={meeting.clientName} size={18} ringClassName={c.ring} />
      <span className="text-[11px] font-semibold tabular-nums">{fmtTime(meeting.start)}</span>
      <span className="truncate text-[11px] font-medium">{meeting.clientName}</span>
    </button>
  );
}
