import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

const WEEK_OPTS = { weekStartsOn: 0 } as const; // Sunday-first, like Google Calendar

/** 42 days (6 weeks) covering the month, Sunday-first */
export function getMonthGrid(cursor: Date): Date[] {
  const gridStart = startOfWeek(startOfMonth(cursor), WEEK_OPTS);
  const gridEnd = endOfWeek(endOfMonth(cursor), WEEK_OPTS);
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
  // normalize to exactly 42 cells
  while (days.length < 42) days.push(addDays(days[days.length - 1], 1));
  return days.slice(0, 42);
}

/** 7 days of the week containing `cursor`, Sunday-first */
export function getWeekDays(cursor: Date): Date[] {
  const start = startOfWeek(cursor, WEEK_OPTS);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export const HOURS: number[] = Array.from({ length: 24 }, (_, i) => i);

export const WEEKDAY_LABELS = ['Dom.', 'Seg.', 'Ter.', 'Qua.', 'Qui.', 'Sex.', 'Sáb.'];

export function fmtTime(d: Date): string {
  return format(d, 'HH:mm');
}

export function fmtMonthYear(d: Date): string {
  return format(d, "MMMM 'de' yyyy", { locale: ptBR });
}

export function fmtWeekRange(cursor: Date): string {
  const days = getWeekDays(cursor);
  const first = days[0];
  const last = days[6];
  return `${format(first, 'd MMM', { locale: ptBR })} – ${format(last, 'd MMM', { locale: ptBR })}`;
}

export function fmtFullDate(d: Date): string {
  return format(d, "EEEE, d 'de' MMMM", { locale: ptBR });
}

export { isSameDay, format };
