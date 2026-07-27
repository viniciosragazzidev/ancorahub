"use client";

import { useCallback, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Camera01Icon, Cancel01Icon } from "@hugeicons/core-free-icons";

type Props = {
  defaultValue: string | null;
  name: string;
  disabled?: boolean;
};

export function LogoUpload({ defaultValue, name, disabled = false }: Props) {
  const [preview, setPreview] = useState(defaultValue);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hiddenInputRef = useRef<HTMLInputElement>(null);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp", "image/svg+xml"].includes(file.type)) {
      setError("Escolha um arquivo PNG, JPG, WebP ou SVG.");
      return;
    }
    if (file.size > 512 * 1024) {
      setError("O logo deve ter no máximo 512 KB.");
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setPreview(dataUrl);
      if (hiddenInputRef.current) hiddenInputRef.current.value = dataUrl;
    };
    reader.readAsDataURL(file);
  }, []);

  const handleClear = useCallback(() => {
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (hiddenInputRef.current) hiddenInputRef.current.value = "";
  }, []);

  return (
    <div className="grid gap-2">
      <input
        ref={hiddenInputRef}
        name={name}
        type="hidden"
        value={preview ?? ""}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleChange}
      />
      {preview ? (
        <div className="relative flex aspect-[20/9] w-full max-w-[400px] items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/30">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Logo" className="h-full w-full object-contain p-2" />
          <button
            disabled={disabled}
            type="button"
            onClick={handleClear}
            className="absolute right-1 top-1 rounded-md bg-background/80 p-1 backdrop-blur-sm hover:bg-background"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={14} />
          </button>
        </div>
      ) : (
        <button
          disabled={disabled}
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex aspect-[20/9] w-full max-w-[400px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/20 transition-colors hover:border-primary/50 hover:bg-muted/40"
        >
          <HugeiconsIcon icon={Camera01Icon} size={20} className="text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Carregar logo</span>
        </button>
      )}
      <p className="text-xs text-muted-foreground">400 × 180 px · PNG, JPG, WebP ou SVG · máximo 512 KB</p>
      {error ? <p className="text-xs text-destructive" role="alert">{error}</p> : null}
    </div>
  );
}
