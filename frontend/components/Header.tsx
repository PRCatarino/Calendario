'use client';

import { CalendarDays, LogOut, Plus, UserPlus } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ViewToggle } from '@/components/ui/view-toggle';
import type { CalendarView } from '@/types/meeting';
import type { AuthUser, ClientAccount } from '@/lib/api';

interface HeaderProps {
  view: CalendarView;
  onViewChange: (v: CalendarView) => void;
  onNewMeeting: () => void;
  onNewClient: () => void;
  onProfile: () => void;
  avatarUrl?: string | null;
  user: AuthUser;
  isAdmin: boolean;
  clients: ClientAccount[];
  clientFilter: number | null;
  onClientFilter: (id: number | null) => void;
  onLogout: () => void;
}

export function Header({
  view,
  onViewChange,
  onNewMeeting,
  onNewClient,
  onProfile,
  avatarUrl,
  user,
  isAdmin,
  clients,
  clientFilter,
  onClientFilter,
  onLogout,
}: HeaderProps) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-6 py-3">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm">
          <CalendarDays size={22} />
        </span>
        <div>
          <h1 className="text-lg font-semibold leading-tight text-slate-900">Calendário</h1>
          <p className="text-sm text-slate-500">
            {isAdmin ? 'Gerenciar reuniões com clientes' : `Agenda · ${user.name}`}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {/* admin-only: filter by client company */}
        {isAdmin && (
          <select
            value={clientFilter ?? ''}
            onChange={(e) => onClientFilter(e.target.value ? Number(e.target.value) : null)}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm focus-visible:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-100"
          >
            <option value="">Todos os clientes</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}

        <ViewToggle value={view} onChange={onViewChange} />

        {/* clients are read-only — only admin can create */}
        {isAdmin && (
          <>
            <Button variant="outline" onClick={onNewClient}>
              <UserPlus size={18} />
              Novo Cliente
            </Button>
            <Button onClick={onNewMeeting}>
              <Plus size={18} />
              Nova Reunião
            </Button>
          </>
        )}

        <div className="flex items-center gap-2 border-l border-slate-200 pl-3">
          <button
            onClick={onProfile}
            title="Meu perfil"
            className="flex items-center gap-2 rounded-xl px-1.5 py-1 transition-colors hover:bg-slate-100"
          >
            <Avatar src={avatarUrl ?? undefined} alt={user.name} size={32} />
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium leading-tight text-slate-700">{user.name}</p>
              <p className="text-xs text-slate-400">{user.role === 'ADMIN' ? 'Administrador' : 'Cliente'}</p>
            </div>
          </button>
          <Button variant="ghost" size="icon" onClick={onLogout} aria-label="Sair" title="Sair">
            <LogOut size={18} />
          </Button>
        </div>
      </div>
    </header>
  );
}
