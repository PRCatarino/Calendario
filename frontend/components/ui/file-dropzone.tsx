'use client';

import { useRef, useState } from 'react';
import { UploadCloud } from 'lucide-react';
import { cn } from '@/lib/utils';

const MAX_BYTES = 100 * 1024 * 1024;

interface FileDropzoneProps {
  onFiles: (files: File[]) => void;
  accept?: string; // e.g. 'image/*,video/*' or 'image/*'
  disabled?: boolean;
  label?: string;
  hint?: string;
}

/** click-to-select + drag-and-drop. Client-side pre-filter only (server revalidates). */
export function FileDropzone({
  onFiles,
  accept = 'image/*,video/*',
  disabled,
  label = 'Arraste arquivos aqui ou clique para selecionar',
  hint = 'Fotos e vídeos até 100MB',
}: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [warn, setWarn] = useState<string | null>(null);

  const kinds = accept.split(',').map((a) => a.trim().replace('/*', ''));

  function accepted(files: FileList | File[]) {
    const arr = Array.from(files);
    const ok: File[] = [];
    for (const f of arr) {
      const kindOk = kinds.some((k) => f.type.startsWith(k + '/'));
      if (!kindOk) { setWarn('Só fotos ou vídeos são aceitos.'); continue; }
      if (f.size > MAX_BYTES) { setWarn(`"${f.name}" passa de 100MB.`); continue; }
      ok.push(f);
    }
    return ok;
  }

  function handle(files: FileList | File[]) {
    setWarn(null);
    const ok = accepted(files);
    if (ok.length) onFiles(ok);
  }

  return (
    <div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          if (e.dataTransfer.files?.length) handle(e.dataTransfer.files);
        }}
        className={cn(
          'flex w-full flex-col items-center gap-1 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors',
          over ? 'border-brand-400 bg-brand-50' : 'border-slate-200 bg-slate-50 hover:bg-slate-100',
          disabled && 'pointer-events-none opacity-50',
        )}
      >
        <UploadCloud size={22} className="text-slate-400" />
        <span className="text-sm font-medium text-slate-600">{label}</span>
        <span className="text-xs text-slate-400">{hint}</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        className="hidden"
        onChange={(e) => { if (e.target.files) handle(e.target.files); e.target.value = ''; }}
      />
      {warn && <p className="mt-1 text-xs text-amber-600">{warn}</p>}
    </div>
  );
}
