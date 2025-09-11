"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import Breadcrumbs from "@/components/Breadcrumbs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/Toaster";

export const metadata = {
  title: "Profile • Manthan",
  description: "Edit your creator profile and public presence.",
  openGraph: { title: "Profile • Manthan", description: "Edit your creator profile and public presence." },
};

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null);
  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [twitter, setTwitter] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    (async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data.user);
      // Fetch profile basics
      if (data.user) {
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user.id).single();
        setFullName(profile?.full_name || "");
      }
      setLoading(false);
    })();
  }, []);

  const onSave = async () => {
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );
      if (!user) return;
      await supabase.from('profiles').update({ full_name: fullName }).eq('id', user.id);
      toast('success', 'Profile updated');
    } catch (e: any) {
      toast('error', e.message || 'Failed to update');
    }
  };

  const onAvatar = async (file: File | null) => {
    if (!file || !user) return;
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );
      const path = `avatars/${user.id}/${file.name}`;
      const res = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
      if (res.error) throw res.error;
      toast('success', 'Avatar uploaded');
    } catch (e: any) {
      toast('error', 'Avatar upload failed (bucket may be missing)');
    }
  };

  if (loading) return <div className="container mx-auto px-6 py-10">Loading…</div>;
  if (!user) return <div className="container mx-auto px-6 py-10">Please sign in.</div>;

  return (
    <section className="container mx-auto px-6 py-10 max-w-2xl">
      <Breadcrumbs />
      <h1 className="text-3xl font-heading font-bold text-manthan-charcoal-800 mb-4">Edit Profile</h1>
      <div className="card-indian p-6 space-y-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-manthan-royal-100" />
          <div>
            <input type="file" aria-label="Upload avatar" accept="image/*" onChange={(e) => onAvatar(e.target.files?.[0] || null)} />
            <p className="text-xs text-manthan-charcoal-500">PNG/JPG up to 2MB</p>
          </div>
        </div>
        <div>
          <label className="block text-manthan-charcoal-800 mb-1">Full Name</label>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div>
          <label className="block text-manthan-charcoal-800 mb-1">Creator Bio</label>
          <Textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} placeholder="Short bio (coming soon to public profile)" />
        </div>
        <div>
          <label className="block text-manthan-charcoal-800 mb-1">Twitter/X</label>
          <Input value={twitter} onChange={(e) => setTwitter(e.target.value)} placeholder="https://x.com/username" />
        </div>
        <div className="flex gap-2">
          <Button className="btn-indian" type="button" onClick={onSave}>Save</Button>
          <a className="btn-outline-indian" href="#" onClick={(e) => { e.preventDefault(); toast('info','Public preview coming soon'); }}>Public Preview</a>
        </div>
      </div>
    </section>
  );
}

