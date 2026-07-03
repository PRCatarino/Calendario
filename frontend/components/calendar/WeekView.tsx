'use client';

import { useEffect, useRef, useState } from 'react';
import { isToday } from 'date-fns';
import { Avatar } from '@/components/ui/avatar';
import { COLOR_STYLES } from '@/lib/colors';
import { fmtTime, getWeekDays, HOURS, WEEKDAY_LABELS } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';
import type { Meeting } from '@/types/meeting';

const HOUR_PX = 60;

interface WeekViewProps {
  cursor: Date;
  selectedId: string | null;
  meetingsForDay: (day: Date) => Meeting[];
  onSelectMeeting: (id: string) => void;
  onOpenMeeting: (id: string) => void;
  onSlotClick: (day: Date, hour: number) => void;
  canCreate: boolean;
}

export function WeekView({
  cursor,
  selectedId,
  meetingsForDay,
  onSelectMeeting,
  onOpenMeeting,
  onSlotClick,
  canCreate,
}: WeekViewProps) {
  const days = getWeekDays(cursor);
  const [now, setNow] = useState<Date | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // set + tick the current-time line every minute (client-only, avoids hydration mismatch)
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  // scroll to ~08:00 on mount
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 7.5 * HOUR_PX;
  }, []);

  const nowTop = now ? (now.getHours() + now.getMinutes() / 60) * HOUR_PX : 0;

  return (
    <div className="flex h-full flex-col overflow-x-auto">
      <div className="flex h-full min-w-[640px] flex-1 flex-col">
      {/* day header row */}
      <div className="grid border-b border-slate-200" style={{ gridTemplateColumns: '56px repeat(7, 1fr)' }}>
        <div />
        {days.map((d, i) => {
          const today = isToday(d);
          return (
            <div key={d.toISOString()} className="flex flex-col items-center gap-0.5 py-2">
              <span className="text-xs font-medium text-slate-400">{WEEKDAY_LABELS[i]}</span>
              <span
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold',
                  today ? 'bg-brand-600 text-white' : 'text-slate-700',
                )}
              >
                {d.getDate()}
              </span>
            </div>
          );
        })}
      </div>

      {/* scrollable time grid */}
      <div ref={scrollRef} className="relative flex-1 overflow-y-auto scrollbar-thin">
        <div className="grid" style={{ gridTemplateColumns: '56px repeat(7, 1fr)' }}>
          {/* hour gutter */}
          <div className="relative">
            {HOURS.map((h) => (
              <div key={h} className="relative" style={{ height: HOUR_PX }}>
                <span className="absolute -top-2 right-2 text-[11px] tabular-nums text-slate-400">
                  {h.toString().padStart(2, '0')}:00
                </span>
              </div>
            ))}
          </div>

          {/* day columns */}
          {days.map((day) => {
            const items = meetingsForDay(day);
            const showNow = isToday(day);
            return (
              <div key={day.toISOString()} className="relative border-l border-slate-100">
                {HOURS.map((h) => {
                  const slot = new Date(day);
                  slot.setHours(h, 0, 0, 0);
                  const slotClickable = canCreate && (!now || slot.getTime() >= now.getTime());
                  return (
                    <div
                      key={h}
                      onClick={slotClickable ? () => onSlotClick(day, h) : undefined}
                      className={cn(
                        'border-b border-slate-100 transition-colors',
                        slotClickable ? 'cursor-pointer hover:bg-brand-50/40' : 'bg-slate-50/30',
                      )}
                      style={{ height: HOUR_PX }}
                    />
                  );
                })}

                {/* current-time line */}
                {showNow && now && (
                  <div className="pointer-events-none absolute inset-x-0 z-20" style={{ top: nowTop }}>
                    <div className="relative">
                      <div className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-rose-500" />
                      <div className="h-px w-full bg-rose-500" />
                    </div>
                  </div>
                )}

                {/* events */}
                {items.map((m) => {
                  const top = (m.start.getHours() + m.start.getMinutes() / 60) * HOUR_PX;
                  const height = Math.max(
                    24,
                    ((m.end.getTime() - m.start.getTime()) / 3_600_000) * HOUR_PX,
                  );
                  const c = COLOR_STYLES[m.color];
                  return (
                    <button
                      key={m.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectMeeting(m.id);
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        onOpenMeeting(m.id);
                      }}
                      title="Duplo clique abre os detalhes"
                      className={cn(
                        'absolute inset-x-1 z-10 flex flex-col gap-1 overflow-hidden rounded-lg border p-1.5 text-left shadow-sm transition-shadow hover:shadow-md',
                        c.event,
                        m.id === selectedId && 'ring-2 ring-brand-400',
                      )}
                      style={{ top, height }}
                    >
                      <div className="flex items-center gap-1.5">
                        <Avatar src={m.imageUrl} alt={m.clientName} size={18} ringClassName={c.ring} />
                        <span className="truncate text-xs font-semibold">{m.clientName}</span>
                      </div>
                      {height > 44 && (
                        <span className="truncate text-[11px] opacity-80">{m.title}</span>
                      )}
                      <span className="text-[10px] tabular-nums opacity-70">
                        {fmtTime(m.start)}–{fmtTime(m.end)}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      </div>
    </div>
  );
}
