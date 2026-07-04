'use client';

import { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { Header } from '@/components/Header';
import { LoginScreen } from '@/components/LoginScreen';
import { CalendarToolbar } from '@/components/calendar/CalendarToolbar';
import { MonthView } from '@/components/calendar/MonthView';
import { WeekView } from '@/components/calendar/WeekView';
import { NewMeetingModal } from '@/components/modals/NewMeetingModal';
import { NewClientModal } from '@/components/modals/NewClientModal';
import { MeetingDetailModal } from '@/components/modals/MeetingDetailModal';
import { ProfileModal } from '@/components/modals/ProfileModal';
import { SelectedMeetingCard } from '@/components/sidebar/SelectedMeetingCard';
import { UpcomingMeetings } from '@/components/sidebar/UpcomingMeetings';
import { GoogleSyncCard } from '@/components/sidebar/GoogleSyncCard';
import { Card } from '@/components/ui/card';
import * as api from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useCalendar } from '@/lib/hooks/useCalendar';

export default function Page() {
  const { user, loading: authLoading, logout } = useAuth();

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-400">
        Carregando…
      </div>
    );
  }
  if (!user) return <LoginScreen />;

  return <CalendarApp onLogout={logout} />;
}

function CalendarApp({ onLogout }: { onLogout: () => void }) {
  const cal = useCalendar();
  const [modalOpen, setModalOpen] = useState(false);
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [prefill, setPrefill] = useState<{ date?: string; startTime?: string }>({});

  const loadAvatar = () => api.getProfile().then((p) => setAvatarUrl(p.avatarUrl)).catch(() => {});
  useEffect(() => { loadAvatar(); }, []);

  function openDetail(id: string) {
    cal.selectMeeting(id);
    setDetailOpen(true);
  }

  // backfill mid-video frame for an opened video meeting that has no cover frame yet
  const framedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const m = cal.selected;
    if (!detailOpen || !cal.isAdmin || !m) return;
    if (m.coverType !== 'video' || m.hasFrame || framedRef.current.has(m.id)) return;
    framedRef.current.add(m.id);
    cal.ensureFrame(m);
  }, [detailOpen, cal.selected, cal.isAdmin, cal]);

  function openNew() {
    setPrefill({});
    setModalOpen(true);
  }
  function openSlot(day: Date, hour: number) {
    if (!cal.isAdmin) return;
    setPrefill({ date: format(day, 'yyyy-MM-dd'), startTime: `${hour.toString().padStart(2, '0')}:00` });
    setModalOpen(true);
  }
  function openDay(day: Date) {
    if (!cal.isAdmin) return;
    setPrefill({ date: format(day, 'yyyy-MM-dd'), startTime: '09:00' });
    setModalOpen(true);
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 lg:h-screen">
      <Header
        view={cal.view}
        onViewChange={cal.setView}
        onNewMeeting={openNew}
        onNewClient={() => setClientModalOpen(true)}
        onProfile={() => setProfileOpen(true)}
        avatarUrl={avatarUrl}
        user={cal.user!}
        isAdmin={cal.isAdmin}
        clients={cal.clients}
        clientFilter={cal.clientFilter}
        onClientFilter={cal.setClientFilter}
        onLogout={onLogout}
      />

      <main className="flex flex-1 flex-col gap-4 p-4 lg:min-h-0 lg:flex-row lg:overflow-hidden">
        <Card className="flex min-h-[70vh] flex-col overflow-hidden lg:min-h-0 lg:flex-1 lg:basis-3/4">
          <CalendarToolbar
            view={cal.view}
            cursor={cal.cursor}
            onPrev={cal.goPrev}
            onNext={cal.goNext}
            onToday={cal.goToday}
          />
          {cal.error && (
            <p className="border-b border-rose-100 bg-rose-50 px-4 py-2 text-sm text-rose-700">{cal.error}</p>
          )}
          <div className="min-h-0 flex-1 overflow-hidden">
            {cal.view === 'month' ? (
              <MonthView
                cursor={cal.cursor}
                selectedId={cal.selectedId}
                meetingsForDay={cal.meetingsForDay}
                onSelectMeeting={cal.selectMeeting}
                onOpenMeeting={openDetail}
                onDayClick={openDay}
                canCreate={cal.isAdmin}
              />
            ) : (
              <WeekView
                cursor={cal.cursor}
                selectedId={cal.selectedId}
                meetingsForDay={cal.meetingsForDay}
                onSelectMeeting={cal.selectMeeting}
                onOpenMeeting={openDetail}
                onSlotClick={openSlot}
                canCreate={cal.isAdmin}
              />
            )}
          </div>
        </Card>

        <aside className="flex flex-col gap-4 lg:min-h-0 lg:basis-1/4">
          <SelectedMeetingCard meeting={cal.selected} />
          <UpcomingMeetings
            meetings={cal.upcoming}
            selectedId={cal.selectedId}
            onSelect={cal.selectMeeting}
            onOpen={openDetail}
          />
          <GoogleSyncCard isAdmin={cal.isAdmin} />
        </aside>
      </main>

      {cal.isAdmin && (
        <>
          <NewMeetingModal
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            onSubmit={cal.addMeeting}
            clients={cal.clients}
            defaultDate={prefill.date}
            defaultStartTime={prefill.startTime}
          />
          <NewClientModal
            open={clientModalOpen}
            onClose={() => setClientModalOpen(false)}
            onSubmit={cal.addClient}
          />
        </>
      )}

      <MeetingDetailModal
        meeting={cal.selected}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        isAdmin={cal.isAdmin}
        onChangeStatus={cal.updateStatus}
      />

      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} onUpdated={loadAvatar} />
    </div>
  );
}
