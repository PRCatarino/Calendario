'use client';

import { useEffect, useState } from 'react';
import { CalendarClock, CheckCircle2, FileText, Lock, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Textarea } from '@/components/ui/input';
import { StatusBadge } from '@/components/ui/status-badge';
import { fmtFullDate, fmtTime } from '@/lib/dateUtils';
import { coverProxyUrl } from '@/lib/api';
import type { Meeting, MeetingStatus } from '@/types/meeting';

interface MeetingDetailModalProps {
  meeting: Meeting | null;
  open: boolean;
  onClose: () => void;
  isAdmin: boolean;
  onChangeStatus: (id: string, status: MeetingStatus, reason?: string) => Promise<unknown>;
}

export function MeetingDetailModal({ meeting, open, onClose, isAdmin, onChangeStatus }: MeetingDetailModalProps) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mediaError, setMediaError] = useState(false);

  useEffect(() => {
    if (open) {
      setRejecting(false);
      setReason(meeting?.rejectReason ?? '');
      setError(null);
      setMediaError(false);
    }
  }, [open, meeting]);

  if (!meeting) return null;

  async function act(status: MeetingStatus, withReason?: string) {
    setBusy(true);
    setError(null);
    try {
      await onChangeStatus(meeting!.id, status, withReason);
      setRejecting(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao atualizar');
    } finally {
      setBusy(false);
    }
  }

  function submitReject() {
    if (!reason.trim()) {
      setError('Informe o motivo da reprovação');
      return;
    }
    act('REJECTED', reason.trim());
  }

  // client (read-only owner) can only act while PENDING
  const clientCanAct = !isAdmin && meeting.status === 'PENDING';

  return (
    <Modal open={open} onClose={onClose} title={meeting.title || 'Reunião'} description={meeting.clientName}>
      <div className="flex flex-col gap-4">
        {/* media viewer */}
        {meeting.coverUrl ? (
          mediaError ? (
            <div className="flex flex-col items-center gap-1 rounded-xl border border-amber-200 bg-amber-50 px-4 py-6 text-center text-sm text-amber-700">
              <span className="font-medium">Não foi possível carregar a mídia.</span>
              <span className="text-xs">
                O arquivo do Drive precisa estar compartilhado como “qualquer pessoa com o link”.
              </span>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-900">
              {meeting.coverType === 'video' ? (
                <video
                  src={coverProxyUrl(meeting.id)}
                  poster={coverProxyUrl(meeting.id, true)}
                  controls
                  playsInline
                  preload="metadata"
                  onError={() => setMediaError(true)}
                  className="aspect-video w-full bg-black"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={coverProxyUrl(meeting.id)}
                  alt={`Capa — ${meeting.title}`}
                  onError={() => setMediaError(true)}
                  className="max-h-72 w-full object-contain"
                />
              )}
            </div>
          )
        ) : (
          <div className="flex h-28 items-center justify-center rounded-xl bg-slate-100 text-sm text-slate-400">
            Sem mídia anexada
          </div>
        )}

        {/* meta */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <CalendarClock size={16} className="text-slate-400" />
            <span className="capitalize">
              {fmtFullDate(meeting.start)} · {fmtTime(meeting.start)}–{fmtTime(meeting.end)}
            </span>
          </div>
          <StatusBadge status={meeting.status} />
        </div>

        {meeting.notes && (
          <div className="flex gap-2 text-sm text-slate-600">
            <FileText size={16} className="mt-0.5 shrink-0 text-slate-400" />
            <p>{meeting.notes}</p>
          </div>
        )}

        {meeting.status === 'REJECTED' && meeting.rejectReason && (
          <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
            <strong>Motivo da reprovação:</strong> {meeting.rejectReason}
          </div>
        )}

        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

        {/* approval area — only when there is media to review */}
        <div className="border-t border-slate-100 pt-4">
          {!meeting.coverUrl ? (
            <p className="text-center text-sm text-slate-400">
              Sem mídia anexada — nada para aprovar.
            </p>
          ) : clientCanAct ? (
            rejecting ? (
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-700">Motivo da reprovação</label>
                <Textarea
                  rows={3}
                  autoFocus
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Explique por que está reprovando…"
                />
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" onClick={() => setRejecting(false)} disabled={busy}>
                    Voltar
                  </Button>
                  <Button onClick={submitReject} disabled={busy} className="bg-rose-600 hover:bg-rose-700">
                    Confirmar reprovação
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-slate-400">
                  Ao aprovar, a decisão não poderá ser desfeita por você.
                </p>
                <div className="flex gap-2">
                  <Button onClick={() => act('APPROVED')} disabled={busy} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                    <CheckCircle2 size={18} /> Aprovar
                  </Button>
                  <Button onClick={() => setRejecting(true)} disabled={busy} variant="outline" className="flex-1 text-rose-700">
                    <XCircle size={18} /> Reprovar
                  </Button>
                </div>
              </div>
            )
          ) : !isAdmin ? (
            // client, already decided -> locked
            <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-500">
              <Lock size={15} />
              {meeting.status === 'APPROVED'
                ? 'Você aprovou esta reunião. Apenas o admin pode alterar.'
                : 'Decisão registrada. Apenas o admin pode alterar.'}
            </div>
          ) : (
            // admin -> full control
            <AdminControls
              status={meeting.status}
              busy={busy}
              reason={reason}
              setReason={setReason}
              rejecting={rejecting}
              setRejecting={setRejecting}
              onApprove={() => act('APPROVED')}
              onReject={submitReject}
              onReset={() => act('PENDING')}
            />
          )}
        </div>
      </div>
    </Modal>
  );
}

function AdminControls(props: {
  status: MeetingStatus;
  busy: boolean;
  reason: string;
  setReason: (v: string) => void;
  rejecting: boolean;
  setRejecting: (v: boolean) => void;
  onApprove: () => void;
  onReject: () => void;
  onReset: () => void;
}) {
  const { status, busy, reason, setReason, rejecting, setRejecting, onApprove, onReject, onReset } = props;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Controle do admin</p>
      {rejecting && (
        <Textarea
          rows={2}
          autoFocus
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Motivo da reprovação…"
        />
      )}
      <div className="flex flex-wrap gap-2">
        <Button onClick={onApprove} disabled={busy || status === 'APPROVED'} className="bg-emerald-600 hover:bg-emerald-700">
          <CheckCircle2 size={18} /> Aprovar
        </Button>
        {rejecting ? (
          <Button onClick={onReject} disabled={busy} className="bg-rose-600 hover:bg-rose-700">
            Confirmar
          </Button>
        ) : (
          <Button onClick={() => setRejecting(true)} disabled={busy} variant="outline" className="text-rose-700">
            <XCircle size={18} /> Reprovar
          </Button>
        )}
        <Button onClick={onReset} disabled={busy || status === 'PENDING'} variant="ghost">
          Redefinir p/ pendente
        </Button>
      </div>
    </div>
  );
}
