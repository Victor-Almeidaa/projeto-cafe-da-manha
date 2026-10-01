-- Rode no Supabase: SQL Editor > New query > Run

create table if not exists colaboradores (
  id bigint generated always as identity primary key,
  nome text not null,
  cpf char(11) not null unique,
  auth_user_id uuid unique references auth.users(id)
);
alter table colaboradores add column if not exists auth_user_id uuid unique references auth.users(id);
create unique index if not exists colaboradores_nome_unico on colaboradores (lower(nome));

create table if not exists itens_cafe (
  id bigint generated always as identity primary key,
  colaborador_id bigint not null references colaboradores(id) on delete cascade,
  item text not null,
  data_cafe date not null,
  trouxe boolean not null default false
);
-- o mesmo item não repete na mesma data
create unique index if not exists item_unico_por_data on itens_cafe (data_cafe, lower(item));

-- Vincula cada conta autenticada ao colaborador cadastrado no Supabase Auth.
create or replace function public.criar_colaborador_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  nome_colaborador text := nullif(trim(new.raw_user_meta_data ->> 'nome'), '');
  cpf_colaborador text := new.raw_user_meta_data ->> 'cpf';
  colaborador_id bigint;
begin
  if nome_colaborador is null or cpf_colaborador !~ '^[0-9]{11}$' then
    raise exception 'Nome e CPF válidos são obrigatórios para criar a conta.';
  end if;

  insert into public.colaboradores (nome, cpf, auth_user_id)
  values (nome_colaborador, cpf_colaborador, new.id)
  on conflict (cpf) do update
    set auth_user_id = excluded.auth_user_id
    where colaboradores.auth_user_id is null
      and lower(colaboradores.nome) = lower(excluded.nome)
  returning id into colaborador_id;

  if colaborador_id is null then
    raise exception 'Este CPF já está associado a outro cadastro ou o nome não confere.';
  end if;

  return new;
end;
$$;

drop trigger if exists ao_criar_usuario_auth on auth.users;
create trigger ao_criar_usuario_auth
  after insert on auth.users
  for each row execute function public.criar_colaborador_auth();

-- Remova o acesso anônimo anterior e conceda apenas acesso autenticado.
alter table colaboradores enable row level security;
alter table itens_cafe enable row level security;

drop policy if exists "anon acessa colaboradores" on colaboradores;
drop policy if exists "anon acessa itens_cafe" on itens_cafe;
drop policy if exists "colaboradores visiveis autenticados" on colaboradores;
drop policy if exists "itens visiveis autenticados" on itens_cafe;
drop policy if exists "inserir itens proprios" on itens_cafe;
drop policy if exists "atualizar itens proprios" on itens_cafe;
drop policy if exists "remover itens proprios futuros" on itens_cafe;

create policy "colaboradores visiveis autenticados" on colaboradores
  for select to authenticated using (true);
create policy "itens visiveis autenticados" on itens_cafe
  for select to authenticated using (true);
create policy "inserir itens proprios" on itens_cafe
  for insert to authenticated
  with check (
    data_cafe > current_date
    and exists (
      select 1 from colaboradores c
      where c.id = colaborador_id and c.auth_user_id = auth.uid()
    )
  );
create policy "atualizar itens proprios" on itens_cafe
  for update to authenticated
  using (
    data_cafe = current_date
    and exists (
      select 1 from colaboradores c
      where c.id = colaborador_id and c.auth_user_id = auth.uid()
    )
  )
  with check (
    data_cafe = current_date
    and exists (
      select 1 from colaboradores c
      where c.id = colaborador_id and c.auth_user_id = auth.uid()
    )
  );
create policy "remover itens proprios futuros" on itens_cafe
  for delete to authenticated
  using (
    data_cafe > current_date
    and exists (
      select 1 from colaboradores c
      where c.id = colaborador_id and c.auth_user_id = auth.uid()
    )
  );

revoke all on table public.colaboradores, public.itens_cafe from anon;
revoke all on table public.colaboradores, public.itens_cafe from authenticated;
grant select (id, nome, auth_user_id) on table public.colaboradores to authenticated;
grant select on table public.itens_cafe to authenticated;
grant insert (colaborador_id, item, data_cafe) on table public.itens_cafe to authenticated;
grant update (trouxe), delete on table public.itens_cafe to authenticated;
