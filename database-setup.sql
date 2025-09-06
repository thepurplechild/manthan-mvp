-- Project Manthan Database Schema
-- Run this in Supabase SQL Editor

-- Create the profiles table to store public user data
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    role TEXT NOT NULL DEFAULT 'creator',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Set up Row Level Security for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile" 
ON public.profiles FOR SELECT 
USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles FOR INSERT 
WITH CHECK (auth.uid() = id);

-- Create the projects table (central entity)
CREATE TABLE public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    logline TEXT,
    synopsis TEXT,
    genre TEXT[], -- Array of genres
    character_breakdowns JSONB, -- Stores structured character data
    budget_range TEXT, -- e.g., 'Below 1 Cr', '1-5 Cr'
    target_platforms TEXT[], -- e.g., {'Netflix', 'YouTube'}
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Set up RLS for projects
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own projects" 
ON public.projects FOR SELECT 
USING (auth.uid() = owner_id);

CREATE POLICY "Users can insert their own projects" 
ON public.projects FOR INSERT 
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own projects" 
ON public.projects FOR UPDATE 
USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete their own projects" 
ON public.projects FOR DELETE 
USING (auth.uid() = owner_id);

-- Founder can view all projects
CREATE POLICY "Founders can view all projects" 
ON public.projects FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role = 'founder'
    )
);

-- Create the script_uploads table
CREATE TABLE public.script_uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    file_name TEXT,
    file_size BIGINT,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Set up RLS for script_uploads
ALTER TABLE public.script_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view uploads for their projects" 
ON public.script_uploads FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.projects 
        WHERE projects.id = script_uploads.project_id 
        AND projects.owner_id = auth.uid()
    )
);

CREATE POLICY "Users can insert uploads for their projects" 
ON public.script_uploads FOR INSERT 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.projects 
        WHERE projects.id = script_uploads.project_id 
        AND projects.owner_id = auth.uid()
    )
);

-- Founder can view all uploads
CREATE POLICY "Founders can view all uploads" 
ON public.script_uploads FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role = 'founder'
    )
);

-- Create the generated_assets table
CREATE TABLE public.generated_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    asset_type TEXT NOT NULL, -- 'pitch_deck', 'series_outline', 'character_bible'
    asset_url TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Set up RLS for generated_assets
ALTER TABLE public.generated_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view assets for their projects" 
ON public.generated_assets FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.projects 
        WHERE projects.id = generated_assets.project_id 
        AND projects.owner_id = auth.uid()
    )
);

-- Founder can view all assets
CREATE POLICY "Founders can view all assets" 
ON public.generated_assets FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role = 'founder'
    )
);

-- Create the platform_mandates table (Founder-only)
CREATE TABLE public.platform_mandates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform_name TEXT NOT NULL, -- e.g., 'Netflix', 'SonyLIV'
    mandate_description TEXT NOT NULL, -- The core market intelligence
    tags TEXT[], -- Searchable tags
    source TEXT, -- How the intelligence was obtained
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Set up RLS for platform_mandates (Founder-only access)
ALTER TABLE public.platform_mandates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only founders can access platform mandates" 
ON public.platform_mandates FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role = 'founder'
    )
);

-- Create the deal_pipeline table (Founder-only)
CREATE TABLE public.deal_pipeline (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    target_buyer_name TEXT NOT NULL, -- Name of the buyer/studio being pitched
    status TEXT NOT NULL DEFAULT 'introduced', -- 'introduced', 'passed', 'in_discussion', 'deal_closed'
    feedback_notes TEXT, -- Logs feedback from the buyer
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Set up RLS for deal_pipeline (Founder-only access)
ALTER TABLE public.deal_pipeline ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only founders can access deal pipeline" 
ON public.deal_pipeline FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role = 'founder'
    )
);

-- Create a trigger to automatically create a profile when a user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, role)
    VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', 'creator');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create storage buckets for files
INSERT INTO storage.buckets (id, name, public) VALUES ('scripts', 'scripts', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('generated-assets', 'generated-assets', false);

-- Set up storage policies
CREATE POLICY "Users can upload scripts for their projects"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'scripts' AND
    EXISTS (
        SELECT 1 FROM public.projects
        WHERE projects.id::text = (storage.foldername(name))[1]
        AND projects.owner_id = auth.uid()
    )
);

CREATE POLICY "Users can view their own script uploads"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'scripts' AND
    EXISTS (
        SELECT 1 FROM public.projects
        WHERE projects.id::text = (storage.foldername(name))[1]
        AND projects.owner_id = auth.uid()
    )
);

CREATE POLICY "Founders can view all scripts"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'scripts' AND
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'founder'
    )
);

CREATE POLICY "System can manage generated assets"
ON storage.objects FOR ALL
USING (bucket_id = 'generated-assets');