"use client";

import { useEffect, useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { PlayerAvatar } from "./PlayerAvatar";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { shortAddress } from "../lib/format";
import { getNonce, getPlayer, putProfile } from "../lib/api";

export function ProfileEditor() {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [name, setName] = useState("");
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
