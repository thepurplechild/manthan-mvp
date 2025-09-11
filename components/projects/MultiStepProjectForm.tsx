"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/Toaster";
import Spinner from "@/components/ui/Spinner";

const schema = z.object({
  title: z.string().min(3, "Title is required"),
  logline: z.string().optional(),
  synopsis: z.string().optional(),
  genre: z.array(z.string()).min(1, "Choose at least one genre"),
  target_platforms: z.array(z.string()).min(1, "Choose at least one platform"),
  budget_range: z.string().optional(),
  file: z.any().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function MultiStepProjectForm() {
  const [step, setStep] = useState(1);
  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { genre: [], target_platforms: [] },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to create project')
      const { id } = await res.json();
      if (values.file && (values.file as any).size) {
        const fd = new FormData()
        fd.append('file', values.file as any)
        fd.append('project_id', id)
        const up = await fetch('/api/uploads', { method: 'POST', body: fd })
        if (!up.ok) console.warn('Upload failed')
      }
      toast('success', 'Project created')
      window.location.href = `/projects/${id}`
    } catch (e: any) {
      toast('error', e.message || 'Error')
    }
  }

  const genres = ['Bollywood Drama','Web Series','Documentary','Comedy','Thriller/Crime'];
  const platforms = ['Netflix India','Prime Video India','Disney+ Hotstar','Zee5','SonyLIV'];
  const selectedGenres = watch('genre');
  const selectedPlatforms = watch('target_platforms');

  const toggle = (name: 'genre'|'target_platforms', value: string) => {
    const current = (watch(name) as string[]) || []
    const next = current.includes(value) ? current.filter(v => v !== value) : [...current, value]
    setValue(name, next)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <label className="block text-white mb-1">Project Title *</label>
            <Input {...register('title')} className="bg-white/10 border-white/20 text-white" placeholder="Title" />
            {errors.title && <p className="text-red-300 text-sm">{errors.title.message}</p>}
          </div>
          <div>
            <label className="block text-white mb-1">Logline</label>
            <Input {...register('logline')} className="bg-white/10 border-white/20 text-white" placeholder="One-sentence summary" />
          </div>
          <div>
            <label className="block text-white mb-1">Synopsis</label>
            <Textarea {...register('synopsis')} className="bg-white/10 border-white/20 text-white" rows={4} placeholder="A brief overview" />
          </div>
          <div className="flex justify-end">
            <Button type="button" onClick={() => setStep(2)} className="btn-royal">Next</Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div>
            <label className="block text-white mb-2">Genres *</label>
            <div className="flex flex-wrap gap-2">
              {genres.map(g => (
                <button type="button" key={g} onClick={() => toggle('genre', g)} className={`px-3 py-2 rounded-xl border ${selectedGenres?.includes(g)?'bg-manthan-saffron-500/20 border-manthan-saffron-400 text-white':'bg-white/5 border-white/20 text-purple-200'}`}>{g}</button>
              ))}
            </div>
            {errors.genre && <p className="text-red-300 text-sm">{errors.genre.message as string}</p>}
          </div>
          <div>
            <label className="block text-white mb-2">Target Platforms *</label>
            <div className="flex flex-wrap gap-2">
              {platforms.map(p => (
                <button type="button" key={p} onClick={() => toggle('target_platforms', p)} className={`px-3 py-2 rounded-xl border ${selectedPlatforms?.includes(p)?'bg-manthan-royal-500/20 border-manthan-royal-400 text-white':'bg-white/5 border-white/20 text-purple-200'}`}>{p}</button>
              ))}
            </div>
            {errors.target_platforms && <p className="text-red-300 text-sm">{errors.target_platforms.message as string}</p>}
          </div>
          <div className="flex justify-between">
            <Button type="button" onClick={() => setStep(1)} className="btn-outline-indian">Back</Button>
            <Button type="button" onClick={() => setStep(3)} className="btn-royal">Next</Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div>
            <label className="block text-white mb-1">Estimated Budget</label>
            <Input {...register('budget_range')} className="bg-white/10 border-white/20 text-white" placeholder="₹ range (optional)" />
          </div>
          <div>
            <label className="block text-white mb-1">Upload Script (PDF/DOCX/TXT)</label>
            <input type="file" accept=".pdf,.docx,.txt" onChange={(e) => setValue('file', e.target.files?.[0] as any)} />
            <p className="text-xs text-purple-200 mt-1">Max 10MB.</p>
          </div>
          <div className="flex justify-between items-center">
            <Button type="button" onClick={() => setStep(2)} className="btn-outline-indian">Back</Button>
            <Button disabled={isSubmitting} type="submit" className="btn-indian flex items-center gap-2">{isSubmitting? (<><Spinner size={16} /> Creating…</>):'Create Project'}</Button>
          </div>
        </div>
      )}
    </form>
  );
}
