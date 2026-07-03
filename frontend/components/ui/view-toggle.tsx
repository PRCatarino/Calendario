'use client';

import { cn } from '@/lib/utils';
import type { CalendarView } from '@/types/meeting';

interface ViewToggleProps {
  value: CalendarView;
  onChange: (v: CalendarView) => void;
}

const options: { value: CalendarView; label: string }[] = [
  { value: 'month', label: 'Mês' },
  { value: 'week', label: 'Semana' },
];

export function ViewToggle({ value, onChange }: ViewToggleProps) {
  return (
    <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            'rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors',
            value === opt.value
              ? 'bg-white text-brand-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-700',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
