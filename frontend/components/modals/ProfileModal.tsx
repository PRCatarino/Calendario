'use client';

import { useEffect, useState } from 'react';
import { KeyRound, Loader2 } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { FileDropzone } from '@/components/ui/file-dropzone';
import { Input, Label } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import * as api from '@/lib/api';
import { logger } from '@/lib/logger';

interface ProfileModalProps {
  open: boolean;
  onClose: () => void;
  onUpdated?: () => void;
}

export function ProfileModal({ open, onClose, onUpdated }: ProfileModalProps) {
  const [profile, setProfile] = useState<api.Profile | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [savingInfo, setSavingInfo] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [pwMsg, setPwMsg] = useState<string | null>(null);

  function load() {
    api.getProfile().then((p) => {
      setProfile(p);
      setName(p.name);
      setEmail(p.email ?? '');
      setPhone(p.phone ?? '');
    }).catch((e) => logger.warn('getProfile failed', e));
  }

  useEffect(() => {
    if (open) {
      setMsg(null); setError(null); setPwMsg(null); setCurPw(''); setNewPw('');
      load();
    }
  }, [open]);

  async function saveInfo() {
    setSavingInfo(true); setError(null); setMsg(null);
    try {
      await api.updateProfile({ name, email, phone });
      setMsg('Informações salvas.');
      onUpdated?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao salvar');
    } finally {
      setSavingInfo(false);
    }
  }

  async function onAvatar(files: File[]) {
    setError(null); setMsg(null);
    try {
      await api.uploadAvatar(files[0]);
      setMsg('Foto atualizada.');
      load();
      onUpdated?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha no upload');
    }
  }

  async function savePassword() {
    setPwMsg(null);
    try {
      await api.changePassword(curPw, newPw);
      setPwMsg('Senha alterada.');
      setCurPw(''); setNewPw('');
    } catch (e) {
      setPwMsg(e instanceof Error ? e.message : 'Falha ao trocar senha');
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Meu perfil" description="Edite seus dados e foto.">
      {!profile ? (
        <div className="flex items-center gap-2 py-8 text-slate-400"><Loader2 className="animate-spin" size={18} /> Carregando…</div>
      ) : (
        <div className="flex flex-col gap-5">
          {/* avatar */}
          <div className="flex items-center gap-4">
            <Avatar src={profile.avatarUrl ?? undefined} alt={profile.name} size={64} />
            <div className="flex-1">
              <FileDropzone
                onFiles={onAvatar}
                accept="image/*"
                label="Trocar foto / logo"
                hint="Imagem até 100MB"
              />
            </div>
          </div>

          <div className="grid gap-3">
            <div>
              <Label htmlFor="p-name">Nome</Label>
              <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="p-email">Email</Label>
                <Input id="p-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="empresa@email.com" />
              </div>
              <div>
                <Label htmlFor="p-phone">Telefone</Label>
                <Input id="p-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 90000-0000" />
              </div>
            </div>
            <div className="flex items-center justify-between">
              {msg && <span className="text-xs text-emerald-600">{msg}</span>}
              {error && <span className="text-xs text-rose-600">{error}</span>}
              <Button className="ml-auto" onClick={saveInfo} disabled={savingInfo}>
                {savingInfo ? 'Salvando…' : 'Salvar'}
              </Button>
            </div>
          </div>

          {/* password */}
          <div className="border-t border-slate-100 pt-4">
            <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-slate-700">
              <KeyRound size={15} /> Trocar senha
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Input type="password" value={curPw} onChange={(e) => setCurPw(e.target.value)} placeholder="Senha atual" autoComplete="current-password" />
              <Input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="Nova senha" autoComplete="new-password" />
            </div>
            <div className="mt-2 flex items-center justify-between">
              {pwMsg && <span className="text-xs text-slate-500">{pwMsg}</span>}
              <Button variant="outline" className="ml-auto" onClick={savePassword} disabled={!curPw || !newPw}>
                Alterar senha
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
