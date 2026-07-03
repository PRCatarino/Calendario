'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { fmtMonthYear, fmtWeekRange } from '@/lib/dateUtils';
import type { CalendarView } from '@/types/meeting';

interface CalendarToolbarProps {
  view: CalendarView;
  cursor: Date;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}

export function CalendarToolbar({ view, cursor, onPrev, onNext, onToday }: CalendarToolbarProps) {
  const label = view === 'month' ? fmtMonthYear(cursor) : fmtWeekRange(cursor);
  return (
    <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={onPrev} aria-label="Anterior">
          <ChevronLeft size={18} />
        </Button>
        <Button variant="outline" size="icon" onClick={onNext} aria-label="Próximo">
          <ChevronRight size={18} />
        </Button>
        <Button variant="outline" size="sm" onClick={onToday}>
          Hoje
        </Button>
      </div>
      <h2 className="text-base font-semibold capitalize text-slate-800">{label}</h2>
    </div>
  );
}
