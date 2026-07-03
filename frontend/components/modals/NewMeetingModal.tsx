'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { ImageOff, Link2, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Label, Textarea } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { driveLinkToImage, extractDriveId } from '@/lib/drive';
import type { NewMeetingInput } from '@/types/meeting';
import type { ClientAccount } from '@/lib/api';

interface NewMeetingModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: NewMeetingInput) => Promise<void> | void;
  clients: ClientAccount[];
  defaultDate?: string;
  defaultStartTime?: string;
}

interface FormFields {
  clientId: string;
  newName: string;
  newUsername: string;
  newPassword: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  notes: string;
  driveLink: string;
}

export function NewMeetingModal({
  open,
  onClose,
  onSubmit,
  clients,
  defaultDate,
  defaultStartTime,
}: NewMeetingModalProps) {
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [cover, setCover] = useState<{ url: string | null; error: boolean }>({ url: null, error: false });
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormFields>();

  const driveLink = watch('driveLink');

  useEffect(() => {
    if (open) {
      reset({
        clientId: '',
        newName: '',
        newUsername: '',
        newPassword: '',
        title: '',
        date: defaultDate ?? new Date().toISOString().slice(0, 10),
        startTime: defaultStartTime ?? '09:00',
        endTime: addHour(defaultStartTime ?? '09:00'),
        notes: '',
        driveLink: '',
      });
      setMode(clients.length ? 'existing' : 'new');
      setCover({ url: null, error: false });
      setSubmitError(null);
    }
  }, [open, defaultDate, defaultStartTime, clients.length, reset]);

  // preview = Drive thumbnail (still frame for videos, the image for photos)
  useEffect(() => {
    const url = driveLinkToImage(driveLink || '');
    setCover({ url, error: false });
  }, [driveLink]);

  async function submit(data: FormFields) {
    setSubmitError(null);
    const start = new Date(`${data.date}T${data.startTime}`);
    const end = new Date(`${data.date}T${data.endTime}`);
    if (start.getTime() < Date.now()) {
      setSubmitError('Não é possível agendar em data/horário no passado');
      return;
    }
    if (end <= start) {
      setSubmitError('A hora final deve ser depois da inicial');
      return;
    }
    const id = extractDriveId(data.driveLink || '');
    const coverUrl = id ? `https://drive.google.com/file/d/${id}/view` : undefined;
    const base = {
      title: data.title,
      date: data.date,
      startTime: data.startTime,
      endTime: data.endTime,
      notes: data.notes,
      coverUrl,
    };
    try {
      if (mode === 'new') {
        await onSubmit({
          ...base,
          newClient: { name: data.newName, username: data.newUsername, password: data.newPassword },
        });
      } else {
        await onSubmit({ ...base, clientId: Number(data.clientId) });
      }
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Falha ao salvar');
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Nova Reunião" description="Agende uma reunião para um cliente.">
      <form onSubmit={handleSubmit(submit)} className="flex flex-col gap-4">
        {/* cover preview banner (still frame / photo) */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
          <div className="flex h-32 items-center justify-center bg-slate-100">
            {cover.url && !cover.error ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={cover.url}
                alt="Capa da reunião"
                className="h-full w-full object-cover"
                onError={() => setCover((c) => ({ ...c, error: true }))}
              />
            ) : (
              <div className="flex flex-col items-center gap-1 text-slate-400">
                <ImageOff size={22} />
                <span className="text-xs">
                  {cover.error ? 'Não consegui carregar a capa do Drive' : 'Capa da reunião'}
                </span>
              </div>
            )}
          </div>
          <div className="px-3 py-2">
            <Label htmlFor="driveLink" className="mb-1 flex items-center gap-1.5">
              <Link2 size={14} /> Link do Google Drive (foto ou vídeo)
            </Label>
            <Input
              id="driveLink"
              placeholder="https://drive.google.com/file/d/.../view"
              {...register('driveLink')}
            />
            <p className="mt-1 text-[11px] text-slate-400">
              Foto ou vídeo — detectamos automático. Arquivo precisa estar “qualquer pessoa com o link”.
            </p>
          </div>
        </div>

        {/* client: existing or new */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <Label className="mb-0">Cliente</Label>
            <button
              type="button"
              onClick={() => setMode((m) => (m === 'existing' ? 'new' : 'existing'))}
              className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
            >
              {mode === 'existing' ? (
                <><UserPlus size={13} /> Novo cliente</>
              ) : (
                <>Escolher existente</>
              )}
            </button>
          </div>

          {mode === 'existing' ? (
            <>
              <select
                aria-invalid={!!errors.clientId}
                className={selectCls}
                {...register('clientId', {
                  validate: (v) => mode !== 'existing' || !!v || 'Selecione o cliente',
                })}
              >
                <option value="">Selecione um cliente…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {errors.clientId && <FieldError msg={errors.clientId.message} />}
            </>
          ) : (
            <div className="flex flex-col gap-2 rounded-xl border border-dashed border-slate-200 p-3">
              <div>
                <Input
                  placeholder="Nome da empresa (ex.: HSBC)"
                  aria-invalid={!!errors.newName}
                  {...register('newName', {
                    validate: (v) => mode !== 'new' || !!v || 'Informe o nome',
                  })}
                />
                {errors.newName && <FieldError msg={errors.newName.message} />}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Input
                    placeholder="Usuário (login)"
                    autoComplete="off"
                    aria-invalid={!!errors.newUsername}
                    {...register('newUsername', {
                      validate: (v) => mode !== 'new' || !!v || 'Informe o usuário',
                    })}
                  />
                  {errors.newUsername && <FieldError msg={errors.newUsername.message} />}
                </div>
                <div>
                  <Input
                    type="password"
                    placeholder="Senha"
                    autoComplete="new-password"
                    aria-invalid={!!errors.newPassword}
                    {...register('newPassword', {
                      validate: (v) =>
                        mode !== 'new' || (v && v.length >= 4) || 'Mín. 4 caracteres',
                    })}
                  />
                  {errors.newPassword && <FieldError msg={errors.newPassword.message} />}
                </div>
              </div>
              <p className="text-[11px] text-slate-400">
                Cria um acesso para o cliente ver a própria agenda.
              </p>
            </div>
          )}
        </div>

        <div>
          <Label htmlFor="title">Título da reunião</Label>
          <Input id="title" placeholder="Ex.: Apresentação de proposta" aria-invalid={!!errors.title}
            {...register('title', { required: 'Informe o título' })} />
          {errors.title && <FieldError msg={errors.title.message} />}
        </div>

        <div>
          <Label htmlFor="date">Data</Label>
          <Input
            id="date"
            type="date"
            min={new Date().toISOString().slice(0, 10)}
            {...register('date', { required: true })}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="startTime">Hora inicial</Label>
            <Input id="startTime" type="time" {...register('startTime', { required: true })} />
          </div>
          <div>
            <Label htmlFor="endTime">Hora final</Label>
            <Input id="endTime" type="time" {...register('endTime', { required: true })} />
          </div>
        </div>

        <div>
          <Label htmlFor="notes">Observações</Label>
          <Textarea id="notes" rows={3} placeholder="Detalhes, pauta, links…" {...register('notes')} />
        </div>

        {submitError && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{submitError}</p>}

        <div className="mt-1 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Salvando…' : 'Salvar'}</Button>
        </div>
      </form>
    </Modal>
  );
}

const selectCls =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm ' +
  'focus-visible:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-100';

function FieldError({ msg }: { msg?: string }) {
  return <p className="mt-1 text-xs text-rose-600">{msg}</p>;
}

function addHour(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  return `${((h + 1) % 24).toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}
