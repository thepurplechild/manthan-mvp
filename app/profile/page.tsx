import { createClient } from "@/lib/supabase/server";
import Breadcrumbs from "@/components/Breadcrumbs";

export const metadata = {
  title: "Profile • Manthan",
  description: "Your creator profile.",
};

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  return (
    <section className="container mx-auto px-6 py-10 max-w-2xl">
      <Breadcrumbs items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Profile' }]} />
      <h1 className="text-3xl font-heading font-bold text-manthan-charcoal-800 mb-4">Profile</h1>
      <div className="card-indian p-6">
        <p className="text-manthan-charcoal-800"><strong>Email:</strong> {user.email}</p>
        <p className="text-manthan-charcoal-800"><strong>Name:</strong> {profile?.full_name || '—'}</p>
      </div>
    </section>
  );
}

