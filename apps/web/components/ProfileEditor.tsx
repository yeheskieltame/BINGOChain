"use client";

import { useEffect, useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { PlayerAvatar } from "./PlayerAvatar";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { shortAddress } from "../lib/format";
import { getNonce, getPlayer, putProfile } from "../lib/api";

// Downscale + square-crop a picked image to a compact JPEG data-URI (~160px),
// shrinking quality until it fits the backend's data-URI cap. Keeps avatars tiny
// so they store inline with no file hosting.
async function fileToAvatarDataUrl(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error("read failed"));
    r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error("decode failed"));
    im.src = dataUrl;
  });
  const SIZE = 160;
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  const side = Math.min(img.width, img.height);
  ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
  let q = 0.82;
  let out = canvas.toDataURL("image/jpeg", q);
  while (out.length > 60_000 && q > 0.4) {
    q -= 0.1;
    out = canvas.toDataURL("image/jpeg", q);
  }
  return out;
}

export function ProfileEditor() {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [bio, setBio] = useState("");
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!address) return;
    let on = true;
    setReady(false);
    getPlayer(address)
      .then((d) => {
        if (!on) return;
        setName(d.profile?.name ?? "");
        setAvatarUrl(d.profile?.avatar_url ?? "");
        setBio(d.profile?.bio ?? "");
      })
      .catch(() => {})
      .finally(() => on && setReady(true));
    return () => {
      on = false;
    };
  }, [address]);

  async function save() {
    if (!address) return;
    setSaving(true);
    setMsg(null);
    try {
      const { message } = await getNonce(address);
      const signature = await signMessageAsync({ message });
      await putProfile(address, { name, bio, signature });
      setMsg("Saved ✓");
    } catch (e) {
      const m = e instanceof Error ? e.message : "error";
      setMsg(/reject|denied/i.test(m) ? "Signature cancelled" : `Failed: ${m}`);
    } finally {
      setSaving(false);
    }
  }

  if (!address) return null;

  return (
    <section className="glass space-y-4 rounded-xl p-5">
      <div className="flex items-center gap-3">
        <PlayerAvatar address={address} size={44} />
        <div className="min-w-0">
          <p className="truncate font-display text-lg font-bold text-foreground">{name || "Your profile"}</p>
          <p className="font-mono text-xs text-muted-foreground">{shortAddress(address)}</p>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs uppercase tracking-wider text-muted-foreground">Display name</label>
        <Input value={name} maxLength={32} onChange={(e) => setName(e.target.value)} placeholder="e.g. lance.eth" />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs uppercase tracking-wider text-muted-foreground">Bio</label>
        <textarea
          value={bio}
          maxLength={200}
          rows={2}
          onChange={(e) => setBio(e.target.value)}
          placeholder="A short bio"
          className="flex w-full rounded-lg border border-border bg-card/60 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        />
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving || !ready}>
          {saving ? "Sign in wallet…" : "Save profile"}
        </Button>
        {msg && (
          <span className={msg.startsWith("Saved") ? "text-sm text-state-open" : "text-sm text-destructive"}>{msg}</span>
        )}
      </div>
    </section>
  );
}
