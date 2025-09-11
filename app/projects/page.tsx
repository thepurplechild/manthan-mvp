import { createClient } from "@/lib/supabase/server";
import Breadcrumbs from "@/components/Breadcrumbs";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Projects • Manthan",
  description: "Your projects and works-in-progress.",
};

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<Record<string,string>> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const q = params?.q || '';
  const status = params?.status || '';
  const page = Math.max(1, parseInt(params?.page || '1'));
  const pageSize = 10;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('projects')
    .select('id,title,created_at,status,genre,target_platforms', { count: 'exact' })
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })
    .range(from, to);
  if (q) query = query.ilike('title', `%${q}%`);
  if (status) query = query.eq('status', status);
  const { data: projects, count } = await query;

  return (
    <section className="container mx-auto px-6 py-10">
      <Breadcrumbs items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Projects' }]} />
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-heading font-bold text-manthan-charcoal-800">Projects</h1>
        <Link href="/projects/new" className="btn-indian">New Project</Link>
      </div>
      <form className="flex flex-wrap items-center gap-3 mb-4" method="get">
        <input aria-label="Search projects" name="q" defaultValue={q} placeholder="Search" className="input-indian" />
        <select aria-label="Filter status" name="status" defaultValue={status} className="input-indian">
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="submitted">Submitted</option>
          <option value="in_review">In Review</option>
          <option value="active">Active</option>
        </select>
        <button className="btn-royal" type="submit">Apply</button>
      </form>

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
        {!projects?.length && <p className="text-manthan-charcoal-600">No projects match your filters.</p>}
        {count && count > pageSize && (
          <div className="flex gap-2">
            {Array.from({ length: Math.ceil(count / pageSize) }).map((_, i) => (
              <Link key={i} href={`/projects?${new URLSearchParams({ ...(params||{}), page: String(i+1) }).toString()}`} className={`px-3 py-1 rounded ${page===i+1?'bg-manthan-royal-500 text-white':'bg-white/50'}`}>{i+1}</Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
