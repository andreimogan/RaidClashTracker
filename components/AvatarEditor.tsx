"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Check, X, Loader2, Trash2 } from "lucide-react";
import { Avatar } from "./Avatar";

const OUTPUT_SIZE = 256;

// Load a File into an HTMLImageElement, center-crop to a square, and re-encode
// at OUTPUT_SIZE as a small data URL (webp, falling back to png).
function fileToSquareDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const side = Math.min(img.width, img.height);
      const sx = (img.width - side) / 2;
      const sy = (img.height - side) / 2;
      const canvas = document.createElement("canvas");
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas not supported."));
      ctx.drawImage(img, sx, sy, side, side, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
      resolve(canvas.toDataURL("image/webp", 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that image."));
    };
    img.src = url;
  });
}

// Why the camera / remove buttons are gone. Same two reasons, two different
// fixes, as the rest of the write surface.
type ReadOnlyReason = "anonymous" | "demo" | null;

type Ring = "gold" | "hydra" | "chimera" | "none";

type AvatarEditorProps = {
  memberId: string;
  name: string;
  avatarUrl?: string | null;
  ring?: Ring;
  readOnly: boolean;
  readOnlyReason: ReadOnlyReason;
};

/**
 * The member avatar, editable only for the signed-in clan admin on a live
 * database. Splits before AvatarUploader's hooks so nothing sits behind a
 * conditional hook call — and so the file picker, the POST and the pending state
 * do not exist at all for a reader who could never save.
 */
export function AvatarEditor({ readOnly, readOnlyReason, ...props }: AvatarEditorProps) {
  if (readOnly) {
    return (
      <div className="flex items-center gap-3">
        <Avatar name={props.name} size={56} ring={props.ring ?? "none"} src={props.avatarUrl} />
        <span className="max-w-[11rem] text-xs text-muted">
          {readOnlyReason === "demo"
            ? "Sample-data photo — connect the clan database to change it"
            : "Sign in as the clan admin to change this photo"}
        </span>
      </div>
    );
  }
  return <AvatarUploader {...props} />;
}

function AvatarUploader({
  memberId,
  name,
  avatarUrl,
  ring = "none",
}: {
  memberId: string;
  name: string;
  avatarUrl?: string | null;
  ring?: Ring;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasImage = preview ?? avatarUrl;
  const dirty = preview !== null;

  async function onFile(file: File) {
    setError(null);
    try {
      setPreview(await fileToSquareDataUrl(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read that image.");
    }
  }

  async function save(value: string | null) {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/members/${encodeURIComponent(memberId)}/avatar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl: value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Save failed.");
      setPreview(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <div className="relative">
        <Avatar name={name} size={56} ring={ring} src={preview ?? avatarUrl} />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={pending}
          aria-label="Change avatar"
          className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full border border-border bg-panel-2 text-muted transition-colors hover:text-text disabled:opacity-40"
        >
          <Camera size={13} />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
        />
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          {dirty ? (
            <>
              <button
                type="button"
                onClick={() => save(preview)}
                disabled={pending}
                className="btn-accent bg-gold"
              >
                {pending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setPreview(null);
                  setError(null);
                }}
                disabled={pending}
                className="btn-ghost"
              >
                <X size={14} /> Cancel
              </button>
            </>
          ) : (
            hasImage && (
              <button
                type="button"
                onClick={() => save(null)}
                disabled={pending}
                className="btn-ghost"
              >
                {pending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Remove photo
              </button>
            )
          )}
        </div>
        {error && <span className="text-xs text-down">{error}</span>}
      </div>
    </div>
  );
}
