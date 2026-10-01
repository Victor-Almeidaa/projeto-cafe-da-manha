/*
# Create café da manhã tables and security policies

This migration sets up the database for the team breakfast planner app.

1. New Tables
   - `colaboradores`: stores each team member's name, CPF, and link to their auth account.
     - `id` (bigint, primary key, auto-generated)
     - `nome` (text, not null) — unique case-insensitive
     - `cpf` (char(11), not null, unique) — Brazilian tax ID
     - `auth_user_id` (uuid, unique, references auth.users) — links to Supabase Auth account
   - `itens_cafe`: stores breakfast items each person will bring on a given date.
     - `id` (bigint, primary key, auto-generated)
     - `colaborador_id` (bigint, not null, references colaboradores) — who is bringing it
     - `item` (text, not null) — description of the item
     - `data_cafe` (date, not null) — the breakfast date
     - `trouxe` (boolean, default false) — whether the person actually brought it

2. Indexes
   - Unique index on `colaboradores(lower(nome))` to prevent duplicate names.
   - Unique index on `itens_cafe(data_cafe, lower(item))` to prevent the same item being listed twice on the same date.

3. Trigger
   - `criar_colaborador_auth()`: a SECURITY DEFINER trigger function that runs after a new auth.users row is inserted. It reads the `nome` and `cpf` from the user's signup metadata and creates a matching `colaboradores` row. If the CPF already exists and the name matches, it links the existing record to the new auth account.
   - Trigger `ao_criar_usuario_auth` fires the function on `auth.users` INSERT.

4. Security (RLS)
   - Both tables have RLS enabled.
   - `colaboradores`: SELECT allowed for authenticated users (so everyone can see who is participating).
   - `itens_cafe`: SELECT allowed for all authenticated users; INSERT only for the owner and only for future dates; UPDATE (mark as brought) only on the day of the café and only by the owner; DELETE only for future dates and only by the owner.
   - Column-level grants restrict which fields authenticated users can write.

5. Notes
   - Anon role has no access to either table (app requires sign-in).
   - The trigger validates that nome is non-empty and cpf is exactly 11 digits before inserting.
*/

CREATE TABLE IF NOT EXISTS colaboradores (
  id bigint generated always as identity primary key,
  nome text not null,
  cpf char(11) not null unique,
  auth_user_id uuid unique references auth.users(id)
);

ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS auth_user_id uuid unique references auth.users(id);

CREATE UNIQUE INDEX IF NOT EXISTS colaboradores_nome_unico ON colaboradores (lower(nome));

CREATE TABLE IF NOT EXISTS itens_cafe (
  id bigint generated always as identity primary key,
  colaborador_id bigint not null references colaboradores(id) on delete cascade,
  item text not null,
  data_cafe date not null,
  trouxe boolean not null default false
);

CREATE UNIQUE INDEX IF NOT EXISTS item_unico_por_data ON itens_cafe (data_cafe, lower(item));

-- Trigger function: creates a colaboradores row when a new auth user signs up
CREATE OR REPLACE FUNCTION public.criar_colaborador_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  nome_colaborador text := nullif(trim(new.raw_user_meta_data ->> 'nome'), '');
  cpf_colaborador text := new.raw_user_meta_data ->> 'cpf';
  colaborador_id bigint;
BEGIN
  IF nome_colaborador IS NULL OR cpf_colaborador !~ '^[0-9]{11}$' THEN
    RAISE EXCEPTION 'Nome e CPF válidos são obrigatórios para criar a conta.';
  END IF;

  INSERT INTO public.colaboradores (nome, cpf, auth_user_id)
  VALUES (nome_colaborador, cpf_colaborador, new.id)
  ON CONFLICT (cpf) DO UPDATE
    SET auth_user_id = excluded.auth_user_id
    WHERE colaboradores.auth_user_id IS NULL
      AND lower(colaboradores.nome) = lower(excluded.nome)
  RETURNING id INTO colaborador_id;

  IF colaborador_id IS NULL THEN
    RAISE EXCEPTION 'Este CPF já está associado a outro cadastro ou o nome não confere.';
  END IF;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS ao_criar_usuario_auth ON auth.users;
CREATE TRIGGER ao_criar_usuario_auth
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.criar_colaborador_auth();

-- Enable RLS
ALTER TABLE colaboradores ENABLE ROW LEVEL SECURITY;
ALTER TABLE itens_cafe ENABLE ROW LEVEL SECURITY;

-- Drop old policies if they exist
DROP POLICY IF EXISTS "anon acessa colaboradores" ON colaboradores;
DROP POLICY IF EXISTS "anon acessa itens_cafe" ON itens_cafe;
DROP POLICY IF EXISTS "colaboradores visiveis autenticados" ON colaboradores;
DROP POLICY IF EXISTS "itens visiveis autenticados" ON itens_cafe;
DROP POLICY IF EXISTS "inserir itens proprios" ON itens_cafe;
DROP POLICY IF EXISTS "atualizar itens proprios" ON itens_cafe;
DROP POLICY IF EXISTS "remover itens proprios futuros" ON itens_cafe;

-- Policies
CREATE POLICY "colaboradores visiveis autenticados" ON colaboradores
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "itens visiveis autenticados" ON itens_cafe
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "inserir itens proprios" ON itens_cafe
  FOR INSERT TO authenticated
  WITH CHECK (
    data_cafe > current_date
    AND EXISTS (
      SELECT 1 FROM colaboradores c
      WHERE c.id = colaborador_id AND c.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "atualizar itens proprios" ON itens_cafe
  FOR UPDATE TO authenticated
  USING (
    data_cafe = current_date
    AND EXISTS (
      SELECT 1 FROM colaboradores c
      WHERE c.id = colaborador_id AND c.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    data_cafe = current_date
    AND EXISTS (
      SELECT 1 FROM colaboradores c
      WHERE c.id = colaborador_id AND c.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "remover itens proprios futuros" ON itens_cafe
  FOR DELETE TO authenticated
  USING (
    data_cafe > current_date
    AND EXISTS (
      SELECT 1 FROM colaboradores c
      WHERE c.id = colaborador_id AND c.auth_user_id = auth.uid()
    )
  );

-- Column-level grants
REVOKE ALL ON TABLE public.colaboradores, public.itens_cafe FROM anon;
REVOKE ALL ON TABLE public.colaboradores, public.itens_cafe FROM authenticated;
GRANT SELECT (id, nome, auth_user_id) ON TABLE public.colaboradores TO authenticated;
GRANT SELECT ON TABLE public.itens_cafe TO authenticated;
GRANT INSERT (colaborador_id, item, data_cafe) ON TABLE public.itens_cafe TO authenticated;
GRANT UPDATE (trouxe), DELETE ON TABLE public.itens_cafe TO authenticated;
