'use client';

import { CalendarClock, FileText, MousePointerClick } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { COLOR_STYLES } from '@/lib/colors';
import { fmtFullDate, fmtTime } from '@/lib/dateUtils';
import type { Meeting } from '@/types/meeting';

export function SelectedMeetingCard({ meeting }: { meeting: Meeting | null }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Reunião Selecionada</CardTitle>
      </CardHeader>
      <CardContent>
        {!meeting ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <MousePointerClick className="text-slate-300" size={28} />
            <p className="text-sm text-slate-400">Nenhuma reunião selecionada.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {meeting.coverUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={meeting.imageUrl}
                alt={`Capa — ${meeting.title}`}
                className="h-32 w-full rounded-xl object-cover ring-1 ring-slate-100"
              />
            )}
            <div className="flex items-center gap-3">
              <Avatar
                src={meeting.imageUrl}
                alt={meeting.clientName}
                size={48}
                ringClassName={COLOR_STYLES[meeting.color].ring}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-slate-900">{meeting.clientName}</p>
                <p className="truncate text-sm text-slate-500">{meeting.title}</p>
              </div>
            </div>

            <StatusBadge status={meeting.status} className="self-start" />

            <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
              <CalendarClock size={16} className="shrink-0 text-slate-400" />
              <span className="capitalize">
                {fmtFullDate(meeting.start)} · {fmtTime(meeting.start)}–{fmtTime(meeting.end)}
              </span>
            </div>

            {meeting.notes && (
              <div className="flex gap-2 text-sm text-slate-600">
                <FileText size={16} className="mt-0.5 shrink-0 text-slate-400" />
                <p>{meeting.notes}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
