ALTER TABLE public.colaboradores DROP COLUMN IF EXISTS cpf;
DROP INDEX IF EXISTS public.colaboradores_nome_unico;

CREATE OR REPLACE FUNCTION public.criar_colaborador_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  nome_colaborador text := nullif(trim(new.raw_user_meta_data ->> 'nome'), '');
BEGIN
  IF nome_colaborador IS NULL THEN
    RAISE EXCEPTION 'Nome é obrigatório para criar a conta.';
  END IF;

  INSERT INTO public.colaboradores (nome, auth_user_id)
  VALUES (nome_colaborador, new.id);

  RETURN new;
END;
$$;
