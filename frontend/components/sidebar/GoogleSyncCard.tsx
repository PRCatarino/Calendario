'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CalendarCheck2, CalendarX2, Info, RefreshCw, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import * as api from '@/lib/api';
import { logger } from '@/lib/logger';

export function GoogleSyncCard() {
  const [status, setStatus] = useState<api.GoogleStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState<'connected' | 'denied' | 'error' | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const autoSynced = useRef(false);

  const sync = useCallback(async (auto = false) => {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const r = await api.googleSync();
      logger.info('google sync done', r);
      setSyncMsg(
        r.synced > 0
          ? `${r.synced} reunião(ões) sincronizada(s).`
          : auto ? null : 'Tudo já estava sincronizado.',
      );
    } catch (e) {
      logger.error('google sync failed', e);
      setSyncMsg('Falha ao sincronizar.');
    } finally {
      setSyncing(false);
    }
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    api
      .googleStatus()
      .then(setStatus)
      .catch((e) => {
        logger.warn('google status failed', e);
        setStatus({ configured: false, connected: false });
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    // read ?google=... set by the OAuth callback redirect, then clean the URL
    const params = new URLSearchParams(window.location.search);
    const g = params.get('google');
    if (g === 'connected' || g === 'denied' || g === 'error') {
      setFlash(g);
      params.delete('google');
      const qs = params.toString();
      window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''));
      if (g === 'connected') load();
    }
  }, [load]);

  // once connected, backfill any meetings not yet on Google (existing ones)
  useEffect(() => {
    if (status?.connected && !autoSynced.current) {
      autoSynced.current = true;
      sync(true);
    }
  }, [status?.connected, sync]);

  function connect() {
    logger.info('google connect: redirecting to consent');
    window.location.href = api.googleConnectUrl();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sincronização Google</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {flash === 'connected' && (
          <div className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
            Google conectado com sucesso.
          </div>
        )}
        {flash === 'denied' && (
          <div className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
            Autorização cancelada.
          </div>
        )}
        {flash === 'error' && (
          <div className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
            Falha ao conectar. Tente novamente.
          </div>
        )}

        {loading ? (
          <p className="text-sm text-slate-400">Verificando…</p>
        ) : status?.connected ? (
          <>
            <div className="flex items-center gap-2 text-sm text-slate-700">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                <CalendarCheck2 size={16} />
              </span>
              <span>Google Calendar conectado.</span>
            </div>
            <p className="text-xs text-slate-400">
              Novas reuniões são enviadas automaticamente ao Google Calendar.
            </p>
            <Button variant="outline" className="w-full" onClick={() => sync(false)} disabled={syncing}>
              <RefreshCw size={15} className={syncing ? 'animate-spin' : ''} />
              {syncing ? 'Sincronizando…' : 'Sincronizar existentes'}
            </Button>
            {syncMsg && <p className="text-xs text-slate-500">{syncMsg}</p>}
          </>
        ) : !status?.configured ? (
          <>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                <TriangleAlert size={16} />
              </span>
              <span>Integração não configurada.</span>
            </div>
            <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
              <Info size={14} className="mt-0.5 shrink-0" />
              <span>
                Defina <code>GOOGLE_CLIENT_ID</code> e <code>GOOGLE_CLIENT_SECRET</code> no
                <code> .env</code> do backend para habilitar.
              </span>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                <CalendarX2 size={16} />
              </span>
              <span>Google Calendar não conectado.</span>
            </div>
            <Button variant="outline" className="w-full" onClick={connect}>
              <GoogleIcon />
              Conectar Google
            </Button>
            <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
              <Info size={14} className="mt-0.5 shrink-0" />
              <span>Sem conexão, as reuniões são armazenadas apenas localmente.</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.22V7.04H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.04l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z" />
    </svg>
  );
}
