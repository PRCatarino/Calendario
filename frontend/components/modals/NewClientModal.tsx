'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';

interface NewClientModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (body: { name: string; username: string; password: string }) => Promise<unknown>;
}

interface FormFields {
  name: string;
  username: string;
  password: string;
}

export function NewClientModal({ open, onClose, onSubmit }: NewClientModalProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormFields>();

  useEffect(() => {
    if (open) {
      reset({ name: '', username: '', password: '' });
      setSubmitError(null);
    }
  }, [open, reset]);

  async function submit(data: FormFields) {
    setSubmitError(null);
    try {
      await onSubmit({
        name: data.name.trim(),
        username: data.username.trim(),
        password: data.password,
      });
      onClose();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Falha ao criar cliente');
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Novo Cliente"
      description="Cria um acesso para o cliente ver a própria agenda."
    >
      <form onSubmit={handleSubmit(submit)} className="flex flex-col gap-4">
        <div>
          <Label htmlFor="c-name">Nome da empresa</Label>
          <Input id="c-name" placeholder="Ex.: HSBC" autoFocus aria-invalid={!!errors.name}
            {...register('name', { required: 'Informe o nome' })} />
          {errors.name && <p className="mt-1 text-xs text-rose-600">{errors.name.message}</p>}
        </div>

        <div>
          <Label htmlFor="c-user">Usuário (login)</Label>
          <Input id="c-user" placeholder="ex.: hsbc" autoComplete="off" aria-invalid={!!errors.username}
            {...register('username', { required: 'Informe o usuário' })} />
          {errors.username && <p className="mt-1 text-xs text-rose-600">{errors.username.message}</p>}
        </div>

        <div>
          <Label htmlFor="c-pass">Senha</Label>
          <Input id="c-pass" type="password" placeholder="mín. 4 caracteres" autoComplete="new-password"
            aria-invalid={!!errors.password}
            {...register('password', { required: 'Informe a senha', minLength: { value: 4, message: 'Mín. 4 caracteres' } })} />
          {errors.password && <p className="mt-1 text-xs text-rose-600">{errors.password.message}</p>}
        </div>

        {submitError && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{submitError}</p>}

        <div className="mt-1 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Criando…' : 'Criar cliente'}</Button>
        </div>
      </form>
    </Modal>
  );
}
