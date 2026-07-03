'use client';

import { Avatar } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { COLOR_STYLES } from '@/lib/colors';
import { fmtTime, format } from '@/lib/dateUtils';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { Meeting } from '@/types/meeting';

interface UpcomingMeetingsProps {
  meetings: Meeting[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onOpen: (id: string) => void;
}

export function UpcomingMeetings({ meetings, selectedId, onSelect, onOpen }: UpcomingMeetingsProps) {
  return (
    <Card className="flex flex-col lg:min-h-0 lg:flex-1">
      <CardHeader>
        <CardTitle>Próximas Reuniões</CardTitle>
        <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
          {meetings.length}
        </span>
      </CardHeader>
      <CardContent className="max-h-80 overflow-y-auto scrollbar-thin pt-2 lg:max-h-none lg:min-h-0 lg:flex-1">
        {meetings.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-400">Nenhuma reunião agendada.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {meetings.map((m) => {
              const c = COLOR_STYLES[m.color];
              return (
                <li key={m.id}>
                  <button
                    onClick={() => onSelect(m.id)}
                    onDoubleClick={() => onOpen(m.id)}
                    title="Duplo clique abre os detalhes"
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl border border-transparent p-2 text-left transition-colors hover:bg-slate-50',
                      m.id === selectedId && 'border-brand-200 bg-brand-50',
                    )}
                  >
                    <Avatar src={m.imageUrl} alt={m.clientName} size={38} ringClassName={c.ring} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-slate-800">
                          {m.clientName}
                        </p>
                        <span className="shrink-0 text-xs font-medium text-slate-400">
                          {fmtTime(m.start)}
                        </span>
                      </div>
                      <p className="truncate text-xs text-slate-500">{m.title}</p>
                      <p className="text-[11px] capitalize text-slate-400">
                        {format(m.start, "EEE, d MMM", { locale: ptBR })}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
