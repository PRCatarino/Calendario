'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { addDays, addMonths, isAfter, isSameDay } from 'date-fns';
import * as api from '@/lib/api';
import { captureMidFrame } from '@/lib/captureFrame';
import { logger } from '@/lib/logger';
import { getMonthGrid, getWeekDays } from '@/lib/dateUtils';
import { useAuth } from '@/lib/auth-context';
import type { CalendarView, Meeting, NewMeetingInput } from '@/types/meeting';
import type { ClientAccount } from '@/lib/api';

/** visible [from, to) range for the current view */
function rangeFor(view: CalendarView, cursor: Date): { from: Date; to: Date } {
  if (view === 'month') {
    const g = getMonthGrid(cursor);
    return { from: g[0], to: addDays(g[41], 1) };
  }
  const days = getWeekDays(cursor);
  return { from: days[0], to: addDays(days[6], 1) };
}

export function useCalendar() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [view, setView] = useState<CalendarView>('month');
  const [cursor, setCursor] = useState<Date>(() => new Date());
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [upcoming, setUpcoming] = useState<Meeting[]>([]);
  const [clients, setClients] = useState<ClientAccount[]>([]);
  const [clientFilter, setClientFilter] = useState<number | null>(null); // admin only; null = all
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { from, to } = rangeFor(view, cursor);

  // load admin client list once
  useEffect(() => {
    if (!isAdmin) return;
    api.listClients().then(setClients).catch((e) => logger.warn('listClients failed', e));
  }, [isAdmin]);

  const reloadUpcoming = useCallback(() => {
    if (!user) return;
    const now = new Date();
    api
      .getMeetings(now, addDays(now, 60), isAdmin ? clientFilter : null)
      .then((rows) =>
        setUpcoming(
          rows
            .filter((m) => isAfter(m.end, now))
            .sort((a, b) => a.start.getTime() - b.start.getTime())
            .slice(0, 8),
        ),
      )
      .catch((e) => logger.warn('reloadUpcoming failed', e));
  }, [user, isAdmin, clientFilter]);

  const reload = useCallback(() => {
    if (!user) return;
    setLoading(true);
    setError(null);
    api
      .getMeetings(from, to, isAdmin ? clientFilter : null)
      .then(setMeetings)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [user, isAdmin, clientFilter, from.getTime(), to.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { reload(); }, [reload]);
  useEffect(() => { reloadUpcoming(); }, [reloadUpcoming]);

  // auto-refresh the whole calendar every 1 minute
  useEffect(() => {
    const t = setInterval(() => { reload(); reloadUpcoming(); }, 60_000);
    return () => clearInterval(t);
  }, [reload, reloadUpcoming]);

  const selected = useMemo(
    () => [...meetings, ...upcoming].find((m) => m.id === selectedId) ?? null,
    [meetings, upcoming, selectedId],
  );

  const meetingsForDay = useCallback(
    (day: Date) =>
      meetings.filter((m) => isSameDay(m.start, day)).sort((a, b) => a.start.getTime() - b.start.getTime()),
    [meetings],
  );

  const goToday = useCallback(() => setCursor(new Date()), []);
  const goPrev = useCallback(
    () => setCursor((c) => (view === 'month' ? addMonths(c, -1) : addDays(c, -7))),
    [view],
  );
  const goNext = useCallback(
    () => setCursor((c) => (view === 'month' ? addMonths(c, 1) : addDays(c, 7))),
    [view],
  );

  const addMeeting = useCallback(
    async (values: NewMeetingInput) => {
      // create the client inline if needed
      let clientId = values.clientId;
      let clientName = clients.find((c) => c.id === clientId)?.name ?? '';
      if (values.newClient) {
        const created = await api.createClient(values.newClient);
        clientId = created.id;
        clientName = created.name;
        setClients((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      }
      if (!clientId) throw new Error('Cliente obrigatório');

      const fd = new FormData();
      fd.set('client_id', String(clientId));
      fd.set('client_name', clientName);
      fd.set('title', values.title);
      fd.set('starts_at', new Date(`${values.date}T${values.startTime}`).toISOString());
      fd.set('ends_at', new Date(`${values.date}T${values.endTime}`).toISOString());
      fd.set('notes', values.notes ?? '');
      if (values.coverUrl) fd.set('cover_url', values.coverUrl);
      await api.createMeeting(fd);
      // card shows immediately; cover-type/Google are resolved server-side in the
      // background, so refresh again shortly to pick them up
      reload();
      reloadUpcoming();
      setTimeout(() => { reload(); reloadUpcoming(); }, 2500);
    },
    [clients, reload, reloadUpcoming],
  );

  // create a client company account (admin) and add it to the local list
  const addClient = useCallback(
    async (body: { name: string; username: string; password: string }) => {
      const created = await api.createClient(body);
      setClients((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      logger.info('client created', { id: created.id, name: created.name });
      return created;
    },
    [],
  );

  // capture the middle frame of a meeting's video and persist it as the cover
  const captureAndStoreFrame = useCallback(async (id: string) => {
    try {
      const blob = await captureMidFrame(api.coverProxyUrl(id));
      if (blob) {
        await api.uploadCoverFrame(id, blob);
        logger.info('mid-video frame captured & stored', { id });
      } else {
        logger.warn('frame capture returned empty', { id });
      }
    } catch (e) {
      logger.error('frame capture/upload failed', { id, e });
    }
  }, []);

  // backfill: ensure a video meeting has a stored frame; returns true if it created one
  const ensureFrame = useCallback(
    async (meeting: Meeting) => {
      if (meeting.coverType !== 'video' || meeting.hasFrame) return false;
      await captureAndStoreFrame(meeting.id);
      reload();
      reloadUpcoming();
      return true;
    },
    [captureAndStoreFrame, reload, reloadUpcoming],
  );

  const updateStatus = useCallback(
    async (id: string, status: Meeting['status'], reason?: string) => {
      const updated = await api.updateMeetingStatus(id, status, reason);
      const patch = (list: Meeting[]) => list.map((m) => (m.id === id ? updated : m));
      setMeetings(patch);
      setUpcoming(patch);
      return updated;
    },
    [],
  );

  return {
    user,
    isAdmin,
    view,
    setView,
    cursor,
    goToday,
    goPrev,
    goNext,
    selectedId,
    selectMeeting: setSelectedId,
    selected,
    meetings,
    meetingsForDay,
    upcoming,
    clients,
    clientFilter,
    setClientFilter,
    addMeeting,
    addClient,
    updateStatus,
    ensureFrame,
    loading,
    error,
  };
}

export type UseCalendar = ReturnType<typeof useCalendar>;
