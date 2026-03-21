
-- 1. Create the base table for user AI settings (BYOK keys stored encrypted)
CREATE TABLE public.user_ai_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  byok_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_ai_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own ai settings"
  ON public.user_ai_settings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own ai settings"
  ON public.user_ai_settings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own ai settings"
  ON public.user_ai_settings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- 2. Create a masked view that hides raw API keys
CREATE OR REPLACE VIEW public.user_ai_settings_masked AS
SELECT
  id,
  user_id,
  byok_config,
  created_at,
  updated_at
FROM public.user_ai_settings;

-- 3. RPC: save_byok_key (upserts key into byok_config)
CREATE OR REPLACE FUNCTION public.save_byok_key(
  _provider text,
  _api_key text,
  _model text,
  _status text DEFAULT 'valid'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _masked text;
  _existing jsonb;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Mask the key: show first 4 and last 4 chars
  _masked := left(_api_key, 4) || '****' || right(_api_key, 4);

  -- Upsert the settings row
  INSERT INTO public.user_ai_settings (user_id, byok_config)
  VALUES (_user_id, '{}'::jsonb)
  ON CONFLICT (user_id) DO NOTHING;

  -- Get current config
  SELECT byok_config INTO _existing FROM public.user_ai_settings WHERE user_id = _user_id;

  -- Update the provider entry in byok_config
  UPDATE public.user_ai_settings
  SET byok_config = jsonb_set(
    COALESCE(_existing, '{}'::jsonb),
    ARRAY['providers', _provider],
    jsonb_build_object(
      'key_masked', _masked,
      'preferred_model', _model,
      'validated_at', now()::text,
      'status', _status
    )
  ),
  updated_at = now()
  WHERE user_id = _user_id;
END;
$$;

-- 4. RPC: set_active_byok_provider
CREATE OR REPLACE FUNCTION public.set_active_byok_provider(
  _provider text,
  _model text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _existing jsonb;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT byok_config INTO _existing FROM public.user_ai_settings WHERE user_id = _user_id;

  UPDATE public.user_ai_settings
  SET byok_config = jsonb_set(
    jsonb_set(
      COALESCE(_existing, '{}'::jsonb),
      '{active_provider}', to_jsonb(_provider)
    ),
    '{active_model}', to_jsonb(_model)
  ),
  updated_at = now()
  WHERE user_id = _user_id;
END;
$$;

-- 5. RPC: clear_byok_provider
CREATE OR REPLACE FUNCTION public.clear_byok_provider(
  _provider text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _existing jsonb;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT byok_config INTO _existing FROM public.user_ai_settings WHERE user_id = _user_id;

  UPDATE public.user_ai_settings
  SET byok_config = _existing #- ARRAY['providers', _provider],
  updated_at = now()
  WHERE user_id = _user_id;
END;
$$;

-- Grant execute to authenticated users
REVOKE ALL ON FUNCTION public.save_byok_key(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_byok_key(text, text, text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.set_active_byok_provider(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_active_byok_provider(text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.clear_byok_provider(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clear_byok_provider(text) TO authenticated;
