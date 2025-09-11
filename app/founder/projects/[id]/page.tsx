import { createClient } from "@/lib/supabase/server";
import Breadcrumbs from "@/components/Breadcrumbs";

export const metadata = {
  title: "Founder • Project Detail • Manthan",
  description: "Review project details, uploads, and generated assets (founder view).",
};

export default async function FounderProjectDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: project } = await supabase
    .from('projects')
    .select('*, script_uploads (*), generated_assets (*)')
    .eq('id', id)
    .single();

  return (
    <section className="container mx-auto px-6 py-10">
      <Breadcrumbs items={[
        { label: 'Founder', href: '/founder/dashboard' },
        { label: 'Projects', href: '/founder/dashboard' },
        { label: project?.title || 'Project' }
      ]} />

      {!project ? (
        <p className="text-manthan-charcoal-600">Project not found or access denied.</p>
      ) : (
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-heading font-bold text-manthan-charcoal-800 mb-1">{project.title}</h1>
            {project.logline && (<p className="text-manthan-charcoal-600">{project.logline}</p>)}
            <p className="text-sm text-manthan-charcoal-500 mt-2">Owner: {project.owner_id?.slice(0,8)}… • Created {new Date(project.created_at).toLocaleString()}</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="card-indian p-5">
              <h2 className="font-semibold text-manthan-charcoal-800 mb-2">Script Uploads</h2>
              <ul className="text-sm text-manthan-charcoal-700 space-y-1">
                {(project.script_uploads || []).map((u: any) => (
                  <li key={u.id}>{u.file_name} • {Math.round((u.file_size||0)/1024)} KB • {new Date(u.uploaded_at).toLocaleString()}</li>
                ))}
                {!project.script_uploads?.length && <li>No uploads yet.</li>}
              </ul>
            </div>
            <div className="card-indian p-5">
              <h2 className="font-semibold text-manthan-charcoal-800 mb-2">Generated Assets</h2>
              <ul className="text-sm text-manthan-charcoal-700 space-y-1">
                {(project.generated_assets || []).map((a: any) => (
                  <li key={a.id}>{a.asset_type} • v{a.version} • {new Date(a.created_at).toLocaleString()}</li>
                ))}
                {!project.generated_assets?.length && <li>No assets yet.</li>}
              </ul>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

