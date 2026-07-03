import type { MeetingColor } from '@/types/meeting';

/** soft palette per meeting color — full static class strings so Tailwind keeps them */
interface ColorStyle {
  chip: string; // month-view chip
  event: string; // week-view block
  dot: string; // small indicator
  ring: string; // avatar ring
}

export const COLOR_STYLES: Record<MeetingColor, ColorStyle> = {
  blue: {
    chip: 'bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-100',
    event: 'bg-blue-50 border-blue-200 text-blue-800',
    dot: 'bg-blue-500',
    ring: 'ring-blue-200',
  },
  violet: {
    chip: 'bg-violet-50 text-violet-700 hover:bg-violet-100 border-violet-100',
    event: 'bg-violet-50 border-violet-200 text-violet-800',
    dot: 'bg-violet-500',
    ring: 'ring-violet-200',
  },
  emerald: {
    chip: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-100',
    event: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    dot: 'bg-emerald-500',
    ring: 'ring-emerald-200',
  },
  amber: {
    chip: 'bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-100',
    event: 'bg-amber-50 border-amber-200 text-amber-800',
    dot: 'bg-amber-500',
    ring: 'ring-amber-200',
  },
  rose: {
    chip: 'bg-rose-50 text-rose-700 hover:bg-rose-100 border-rose-100',
    event: 'bg-rose-50 border-rose-200 text-rose-800',
    dot: 'bg-rose-500',
    ring: 'ring-rose-200',
  },
  cyan: {
    chip: 'bg-cyan-50 text-cyan-700 hover:bg-cyan-100 border-cyan-100',
    event: 'bg-cyan-50 border-cyan-200 text-cyan-800',
    dot: 'bg-cyan-500',
    ring: 'ring-cyan-200',
  },
  indigo: {
    chip: 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-100',
    event: 'bg-indigo-50 border-indigo-200 text-indigo-800',
    dot: 'bg-indigo-500',
    ring: 'ring-indigo-200',
  },
  teal: {
    chip: 'bg-teal-50 text-teal-700 hover:bg-teal-100 border-teal-100',
    event: 'bg-teal-50 border-teal-200 text-teal-800',
    dot: 'bg-teal-500',
    ring: 'ring-teal-200',
  },
};
