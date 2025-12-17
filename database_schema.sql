-- ============================================
-- ANJO DA GUARDA - Database Schema Completo
-- Versão SEGURA (pode rodar várias vezes)
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- PROFILES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email text,
  created_at timestamptz DEFAULT timezone('utc', now()) NOT NULL,
  updated_at timestamptz DEFAULT timezone('utc', now()) NOT NULL
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policies (drop + create para evitar conflito)
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- ============================================
-- Trigger: criar profile automaticamente
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE PROCEDURE public.handle_new_user();

-- ============================================
-- DEVICES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.devices (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('phone', 'pc', 'tablet')),
  is_third_party boolean DEFAULT false,
  third_party_email text,
  records_password text,
  recording_time_limit integer DEFAULT 1 CHECK (recording_time_limit BETWEEN 1 AND 60),
  status text DEFAULT 'offline' CHECK (status IN ('online', 'offline')),
  last_seen timestamptz,
  created_at timestamptz DEFAULT timezone('utc', now()) NOT NULL
);

ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own devices" ON public.devices;
CREATE POLICY "Users can view own devices"
  ON public.devices FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own devices" ON public.devices;
CREATE POLICY "Users can insert own devices"
  ON public.devices FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own devices" ON public.devices;
CREATE POLICY "Users can update own devices"
  ON public.devices FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own devices" ON public.devices;
CREATE POLICY "Users can delete own devices"
  ON public.devices FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- RECORDINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.recordings (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  device_id uuid REFERENCES public.devices ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  type text NOT NULL CHECK (type IN ('video', 'audio', 'location', 'panic')),
  file_path text,
  location_data jsonb,
  duration integer,
  size bigint,
  created_at timestamptz DEFAULT timezone('utc', now()) NOT NULL,
  is_downloaded boolean DEFAULT false
);

ALTER TABLE public.recordings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own recordings" ON public.recordings;
CREATE POLICY "Users can view own recordings"
  ON public.recordings FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own recordings" ON public.recordings;
CREATE POLICY "Users can insert own recordings"
  ON public.recordings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own recordings" ON public.recordings;
CREATE POLICY "Users can update own recordings"
  ON public.recordings FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own recordings" ON public.recordings;
CREATE POLICY "Users can delete own recordings"
  ON public.recordings FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- SUBSCRIPTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL UNIQUE,
  plan_type text DEFAULT 'free_trial' CHECK (plan_type IN ('free_trial', 'monthly')),
  status text DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
  started_at timestamptz DEFAULT timezone('utc', now()) NOT NULL,
  expires_at timestamptz,
  created_at timestamptz DEFAULT timezone('utc', now()) NOT NULL
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own subscription" ON public.subscriptions;
CREATE POLICY "Users can view own subscription"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own subscription" ON public.subscriptions;
CREATE POLICY "Users can insert own subscription"
  ON public.subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- Trigger: criar trial automaticamente
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.subscriptions (user_id, plan_type, status, started_at, expires_at)
  VALUES (
    NEW.id,
    'free_trial',
    'active',
    now(),
    now() + interval '3 days'
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_subscription ON auth.users;
CREATE TRIGGER on_auth_user_created_subscription
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE PROCEDURE public.handle_new_user_subscription();

-- ============================================
-- STORAGE BUCKET
-- ============================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('recordings', 'recordings', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
DROP POLICY IF EXISTS "Users can upload own recordings" ON storage.objects;
CREATE POLICY "Users can upload own recordings"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'recordings'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can view own recordings" ON storage.objects;
CREATE POLICY "Users can view own recordings"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'recordings'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can delete own recordings" ON storage.objects;
CREATE POLICY "Users can delete own recordings"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'recordings'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can update own recordings" ON storage.objects;
CREATE POLICY "Users can update own recordings"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'recordings'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
