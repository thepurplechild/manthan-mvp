import { createClient } from "@/lib/supabase/server";
import Breadcrumbs from "@/components/Breadcrumbs";
import Link from "next/link";

export const metadata = {
  title: "Projects • Manthan",
  description: "Your projects and works-in-progress.",
};

export default async function ProjectsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: projects } = await supabase
    .from('projects')
    .select('id,title,created_at,status,genre')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false });

  return (
    <section className="container mx-auto px-6 py-10">
      <Breadcrumbs items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Projects' }]} />
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-heading font-bold text-manthan-charcoal-800">Projects</h1>
        <Link href="/projects/new" className="btn-indian">New Project</Link>
      </div>
      <div className="space-y-4">
        {(projects || []).map((p: any) => (
          <Link key={p.id} href={`/projects/${p.id}`} className="block card-indian p-5 hover:shadow-indian">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold text-manthan-charcoal-800">{p.title}</h3>
                <p className="text-sm text-manthan-charcoal-600">Created {new Date(p.created_at).toLocaleDateString()}</p>
              </div>
              <span className="text-sm text-manthan-charcoal-700">{p.status}</span>
            </div>
          </Link>
        ))}
        {!projects?.length && <p className="text-manthan-charcoal-600">No projects yet.</p>}
      </div>
    </section>
  );
}

