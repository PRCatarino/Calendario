import { cn } from '@/lib/utils';

interface AvatarProps {
  src?: string;
  alt: string;
  size?: number;
  className?: string;
  ringClassName?: string;
}

/** circular client photo with graceful fallback to initials */
export function Avatar({ src, alt, size = 32, className, ringClassName }: AvatarProps) {
  const initials = alt
    .split(' ')
    .slice(0, 2)
    .map((s) => s[0])
    .join('')
    .toUpperCase();

  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-[10px] font-semibold text-slate-500 ring-2 ring-white',
        ringClassName,
        className,
      )}
      style={{ width: size, height: size }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src ? <img src={src} alt={alt} className="h-full w-full object-cover" /> : initials}
    </span>
  );
}
