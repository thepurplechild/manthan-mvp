import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: project, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !project) {
    notFound();
  }

  const anyProj = project as Record<string, unknown>
  const displayName = (anyProj.name as string) || (anyProj.title as string) || "Untitled Project";
  const displayDescription = (anyProj.description as string) || (anyProj.synopsis as string) || (anyProj.logline as string) || null;
  const createdAt = project.created_at ? new Date(project.created_at).toLocaleString() : undefined;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
      <div className="container mx-auto px-6 py-10 max-w-3xl">
        <h1 className="text-4xl font-bold mb-3">{displayName}</h1>
        {displayDescription && (
          <p className="text-purple-200 mb-6">{displayDescription}</p>
        )}
        {createdAt && (
          <div className="text-sm text-purple-300 mb-10">Created at: {createdAt}</div>
        )}

        <div className="flex gap-3">
          <Link href="/projects/new" className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 px-4 py-2 rounded-xl text-white">
            Create Another Project
          </Link>
          <Link href="/dashboard" className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl text-white border border-white/20">
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .single();

  const title = (project as Record<string, unknown>)?.name as string || (project as Record<string, unknown>)?.title as string || "Project";
  return { title } as const;
}
