import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** merge conditional + tailwind classes, deduping conflicts */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
