"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import Breadcrumbs from "@/components/Breadcrumbs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/Toaster";

export default function SettingsPageClient() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      if (data.user?.email) setEmail(data.user.email);
    });
  }, []);

  const onUpdateEmail = async () => {
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );
      const { error } = await supabase.auth.updateUser({ email });
      if (error) throw error;
      toast('success', 'Verification email sent to update email');
    } catch (e: any) {
      toast('error', e.message || 'Failed to update email');
    }
  };

  const onUpdatePassword = async () => {
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast('success', 'Password updated');
    } catch (e: any) {
      toast('error', e.message || 'Failed to update password');
    }
  };

  return (
    <section className="container mx-auto px-6 py-10 max-w-2xl">
      <Breadcrumbs />
      <h1 className="text-3xl font-heading font-bold text-manthan-charcoal-800 mb-4">Settings</h1>
      <div className="space-y-8">
        <div className="card-indian p-6 space-y-3">
          <h2 className="font-semibold text-manthan-charcoal-800">Account</h2>
          <label className="block text-sm text-manthan-charcoal-700">Email</label>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button className="btn-royal" type="button" onClick={onUpdateEmail}>Update Email</Button>
          <label className="block text-sm text-manthan-charcoal-700 mt-4">Password</label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <Button className="btn-royal" type="button" onClick={onUpdatePassword}>Update Password</Button>
        </div>
        <div className="card-indian p-6">
          <h2 className="font-semibold text-manthan-charcoal-800 mb-2">Notifications</h2>
          <p className="text-manthan-charcoal-600">Email/push preferences (coming soon).</p>
        </div>
        <div className="card-indian p-6">
          <h2 className="font-semibold text-manthan-charcoal-800 mb-2">Privacy</h2>
          <p className="text-manthan-charcoal-600">Control data sharing and visibility (coming soon).</p>
        </div>
        <div className="card-indian p-6">
          <h2 className="font-semibold text-manthan-charcoal-800 mb-2">Subscription & Billing</h2>
          <p className="text-manthan-charcoal-600">Billing portal integration placeholder.</p>
        </div>
        <div className="card-indian p-6">
          <h2 className="font-semibold text-manthan-charcoal-800 mb-2">Data Export</h2>
          <Button className="btn-outline-indian" type="button" onClick={() => toast('info','Export requested (stub)')}>Request Export</Button>
        </div>
        <div className="card-indian p-6">
          <h2 className="font-semibold text-manthan-charcoal-800 mb-2">Account Deletion</h2>
          <Button className="btn-outline-indian" type="button" onClick={() => toast('info','Deletion flow coming soon')}>Delete Account</Button>
        </div>
      </div>
    </section>
  );
}

