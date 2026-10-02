ALTER TABLE public.colaboradores DROP COLUMN IF EXISTS cpf;

CREATE OR REPLACE FUNCTION public.criar_colaborador_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  nome_colaborador text := nullif(trim(new.raw_user_meta_data ->> 'nome'), '');
  colaborador_id bigint;
BEGIN
  IF nome_colaborador IS NULL THEN
    RAISE EXCEPTION 'Nome é obrigatório para criar a conta.';
  END IF;

  INSERT INTO public.colaboradores (nome, auth_user_id)
  VALUES (nome_colaborador, new.id)
  ON CONFLICT (lower(nome)) DO UPDATE
    SET auth_user_id = excluded.auth_user_id
    WHERE colaboradores.auth_user_id IS NULL
  RETURNING id INTO colaborador_id;

  IF colaborador_id IS NULL THEN
    RAISE EXCEPTION 'Este nome já está associado a outra conta.';
  END IF;

  RETURN new;
END;
$$;
