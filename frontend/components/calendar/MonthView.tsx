'use client';

import { isSameMonth, isToday, startOfDay } from 'date-fns';
import { getMonthGrid, WEEKDAY_LABELS } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';
import type { Meeting } from '@/types/meeting';
import { EventChip } from './EventChip';

interface MonthViewProps {
  cursor: Date;
  selectedId: string | null;
  meetingsForDay: (day: Date) => Meeting[];
  onSelectMeeting: (id: string) => void;
  onOpenMeeting: (id: string) => void;
  onDayClick: (day: Date) => void;
  /** admins can create on a day; clients can't (no-op) */
  canCreate: boolean;
}

export function MonthView({
  cursor,
  selectedId,
  meetingsForDay,
  onSelectMeeting,
  onOpenMeeting,
  onDayClick,
  canCreate,
}: MonthViewProps) {
  const days = getMonthGrid(cursor);
  const todayStart = startOfDay(new Date());

  return (
    <div className="flex h-full flex-col">
      {/* weekday header */}
      <div className="grid grid-cols-7 border-b border-slate-200">
        {WEEKDAY_LABELS.map((w) => (
          <div key={w} className="py-2.5 text-center text-xs font-semibold text-slate-400">
            {w}
          </div>
        ))}
      </div>

      {/* 6-week grid */}
      <div className="grid flex-1 auto-rows-fr grid-cols-7">
        {days.map((day) => {
          const items = meetingsForDay(day);
          const inMonth = isSameMonth(day, cursor);
          const today = isToday(day);
          const isPast = day < todayStart;
          const clickable = canCreate && !isPast;
          return (
            <div
              key={day.toISOString()}
              role={clickable ? 'button' : undefined}
              tabIndex={clickable ? 0 : undefined}
              onClick={clickable ? () => onDayClick(day) : undefined}
              onKeyDown={(e) => {
                if (clickable && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  onDayClick(day);
                }
              }}
              className={cn(
                'group flex min-h-[3.5rem] flex-col gap-1 border-b border-r border-slate-100 p-1.5 text-left transition-colors',
                clickable && 'cursor-pointer hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-300',
                !inMonth && 'bg-slate-50/50',
                isPast && 'bg-slate-50/40',
              )}
            >
              <div className="flex justify-end">
                <span
                  className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium',
                    today && 'bg-brand-600 text-white',
                    !today && inMonth && 'text-slate-700',
                    !today && !inMonth && 'text-slate-300',
                  )}
                >
                  {day.getDate()}
                </span>
              </div>
              <div className="flex flex-col gap-1 overflow-hidden">
                {items.slice(0, 3).map((m) => (
                  <EventChip
                    key={m.id}
                    meeting={m}
                    selected={m.id === selectedId}
                    onSelect={() => onSelectMeeting(m.id)}
                    onOpen={() => onOpenMeeting(m.id)}
                  />
                ))}
                {items.length > 3 && (
                  <span className="px-1 text-[11px] font-medium text-slate-400">
                    +{items.length - 3} mais
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
