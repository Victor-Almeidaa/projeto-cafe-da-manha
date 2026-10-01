// ====== Configuração do Supabase ======
const SUPABASE_URL = "https://axjiiqllucpagohepecl.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF4amlpcWxsdWNwYWdvaGVwZWNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4NTQ1NzgsImV4cCI6MjEwNjQzMDU3OH0.6hxghy7K093wjn6PsqT5ALZ0NMsqf38UbU0BSbm_31c";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Chamada simples à API REST do Supabase
async function api(caminho, opcoes = {}) {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) throw new Error("Entre na sua conta para continuar.");
  const resposta = await fetch(`${SUPABASE_URL}/rest/v1/${caminho}`, {
    ...opcoes,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(opcoes.headers || {})
    }
  });
  if (!resposta.ok) {
    const erro = await resposta.json().catch(() => ({}));
    throw new Error(erro.message || `Erro ${resposta.status}`);
  }
  return resposta.json();
}

// ====== Estado ======
const NOMES_MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

const hoje = paraISO(new Date());
let ano = new Date().getFullYear();
let mes = new Date().getMonth();
let selecionada = hoje;
let itensDoMes = [];
let itensDoForm = [];
let colaboradorIdAtivo;

// ====== Elementos ======
const elDias = document.getElementById("dias");
const elMesTitulo = document.getElementById("mes-titulo");
const elTabelaCorpo = document.getElementById("tabela-corpo");
const elTabelaTitulo = document.getElementById("tabela-titulo");
const elData = document.getElementById("data");
const elItem = document.getElementById("item");
const elListaItens = document.getElementById("lista-itens");
const elMensagem = document.getElementById("mensagem");
const elBtnSalvar = document.getElementById("btn-salvar");
const elAuthArea = document.getElementById("auth-area");
const elAppArea = document.getElementById("app-area");
const elFormAuth = document.getElementById("form-auth");
const elAuthTitulo = document.getElementById("auth-titulo");
const elAuthNome = document.getElementById("auth-nome");
const elAuthCpf = document.getElementById("auth-cpf");
const elAuthEmail = document.getElementById("auth-email");
const elAuthSenha = document.getElementById("auth-senha");
const elCamposCadastroConta = document.getElementById("campos-cadastro-conta");
const elMensagemAuth = document.getElementById("mensagem-auth");
const elBtnAuth = document.getElementById("btn-auth");
const elBtnAlternarAuth = document.getElementById("btn-alternar-auth");
const elBtnSair = document.getElementById("btn-sair");
let modoCadastroConta = false;
let usuarioIdAtivo;

// ====== Utilidades ======
function paraISO(d) {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${dia}`;
}

function formatarData(iso) {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

function cpfValido(cpf) {
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  for (let tamanho = 9; tamanho <= 10; tamanho++) {
    let soma = 0;
    for (let i = 0; i < tamanho; i++) soma += Number(cpf[i]) * (tamanho + 1 - i);
    const digito = ((soma * 10) % 11) % 10;
    if (digito !== Number(cpf[tamanho])) return false;
  }
  return true;
}

function mostrarMensagem(texto, tipo) {
  elMensagem.textContent = texto;
  elMensagem.className = `mensagem ${tipo || ""}`;
}

function criar(tag, texto, classe) {
  const el = document.createElement(tag);
  if (texto) el.textContent = texto;
  if (classe) el.className = classe;
  return el;
}

// ====== Calendário ======
async function carregarMes() {
  const inicio = `${ano}-${String(mes + 1).padStart(2, "0")}-01`;
  const fim = paraISO(new Date(ano, mes + 1, 0));
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    const [colaborador] = await api(`colaboradores?select=id&auth_user_id=eq.${session.user.id}`);
    colaboradorIdAtivo = colaborador?.id;
    itensDoMes = await api(
      `itens_cafe?select=id,item,data_cafe,trouxe,colaboradores(id,nome)` +
      `&data_cafe=gte.${inicio}&data_cafe=lte.${fim}&order=data_cafe,id`
    );
  } catch (erro) {
    itensDoMes = [];
    mostrarMensagem("Não foi possível carregar os dados: " + erro.message, "erro");
  }
  desenharCalendario();
  desenharTabela();
}

function desenharCalendario() {
  elMesTitulo.textContent = `${NOMES_MESES[mes]} de ${ano}`;
  elDias.innerHTML = "";

  const primeiroDiaSemana = new Date(ano, mes, 1).getDay();
  const totalDias = new Date(ano, mes + 1, 0).getDate();

  for (let i = 0; i < primeiroDiaSemana; i++) elDias.appendChild(criar("span", "", "dia vazio"));

  for (let dia = 1; dia <= totalDias; dia++) {
    const iso = paraISO(new Date(ano, mes, dia));
    const quantidade = itensDoMes.filter(i => i.data_cafe === iso).length;
    const botao = criar("button", String(dia), "dia");
    botao.type = "button";
    if (iso === hoje) botao.classList.add("hoje");
    if (iso === selecionada) botao.classList.add("selecionado");
    if (quantidade > 0) {
      botao.classList.add("tem-cafe");
      botao.dataset.qtd = quantidade;
    }
    botao.addEventListener("click", () => selecionarDia(iso));
    elDias.appendChild(botao);
  }
}

function selecionarDia(iso) {
  selecionada = iso;
  if (iso > hoje) elData.value = iso;
  desenharCalendario();
  desenharTabela();
}

document.getElementById("mes-anterior").addEventListener("click", () => {
  mes--;
  if (mes < 0) { mes = 11; ano--; }
  carregarMes();
});

document.getElementById("mes-proximo").addEventListener("click", () => {
  mes++;
  if (mes > 11) { mes = 0; ano++; }
  carregarMes();
});

// ====== Tabela ======
function desenharTabela() {
  elTabelaTitulo.textContent = `Participantes do café de ${formatarData(selecionada)}`;
  elTabelaCorpo.innerHTML = "";

  const doDia = itensDoMes.filter(i => i.data_cafe === selecionada);
  if (doDia.length === 0) {
    const linha = criar("tr");
    const celula = criar("td", "Ninguém cadastrado para este dia.", "vazia");
    celula.colSpan = 3;
    linha.appendChild(celula);
    elTabelaCorpo.appendChild(linha);
    return;
  }

  // agrupa os itens por colaborador
  const grupos = {};
  doDia.forEach(i => {
    const c = i.colaboradores;
    if (!grupos[c.id]) grupos[c.id] = { colaborador: c, itens: [] };
    grupos[c.id].itens.push(i);
  });

  Object.values(grupos).forEach(grupo => {
    const linha = criar("tr");
    linha.appendChild(criar("td", grupo.colaborador.nome));

    const celulaItens = criar("td");
    const celulaSituacao = criar("td");

    grupo.itens.forEach(i => {
      const linhaItem = criar("div", "", "item-linha");

      const caixa = document.createElement("input");
      caixa.type = "checkbox";
      caixa.checked = i.trouxe;
      const proprio = i.colaboradores.id === colaboradorIdAtivo;
      caixa.disabled = selecionada !== hoje || !proprio;
      caixa.title = !proprio ? "Só quem cadastrou pode alterar este item" : caixa.disabled ? "Só dá para marcar no dia do café" : "Marcar como trouxe";
      caixa.addEventListener("change", () => marcarTrouxe(i.id, caixa.checked));
      linhaItem.appendChild(caixa);
      linhaItem.appendChild(criar("span", i.item));

      if (selecionada > hoje && proprio) {
        const remover = criar("button", "×", "remover");
        remover.type = "button";
        remover.title = "Remover item";
        remover.addEventListener("click", () => removerItem(i.id));
        linhaItem.appendChild(remover);
      }
      celulaItens.appendChild(linhaItem);

      let texto = "Pendente", classe = "pendente";
      if (i.trouxe) { texto = "Trouxe"; classe = "trouxe"; }
      else if (selecionada < hoje) { texto = "Não trouxe"; classe = "nao"; }
      celulaSituacao.appendChild(criar("span", texto, `selo ${classe}`));
    });

    linha.appendChild(celulaItens);
    linha.appendChild(celulaSituacao);
    elTabelaCorpo.appendChild(linha);
  });
}

async function marcarTrouxe(id, valor) {
  try {
    await api(`itens_cafe?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ trouxe: valor }) });
    await carregarMes();
  } catch (erro) {
    mostrarMensagem("Erro ao atualizar: " + erro.message, "erro");
  }
}

async function removerItem(id) {
  if (!confirm("Remover este item da lista?")) return;
  try {
    await api(`itens_cafe?id=eq.${id}`, { method: "DELETE" });
    await carregarMes();
  } catch (erro) {
    mostrarMensagem("Erro ao remover: " + erro.message, "erro");
  }
}

// ====== Formulário ======
elAuthCpf.addEventListener("input", () => {
  const d = elAuthCpf.value.replace(/\D/g, "").slice(0, 11);
  elAuthCpf.value = d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
});

elData.min = paraISO(new Date(Date.now() + 86400000)); // só datas futuras
elData.addEventListener("change", () => {
  if (!elData.value) return;
  selecionada = elData.value;
  const [a, m] = elData.value.split("-").map(Number);
  if (a !== ano || m - 1 !== mes) { ano = a; mes = m - 1; carregarMes(); }
  else { desenharCalendario(); desenharTabela(); }
});

function desenharChips() {
  elListaItens.innerHTML = "";
  itensDoForm.forEach((item, indice) => {
    const chip = criar("li", "", "chip");
    chip.appendChild(criar("span", item));
    const x = criar("button", "×");
    x.type = "button";
    x.setAttribute("aria-label", `Remover ${item}`);
    x.addEventListener("click", () => { itensDoForm.splice(indice, 1); desenharChips(); });
    chip.appendChild(x);
    elListaItens.appendChild(chip);
  });
}

function adicionarItem() {
  const texto = elItem.value.trim();
  if (!texto) return;
  if (itensDoForm.some(i => i.toLowerCase() === texto.toLowerCase())) {
    mostrarMensagem("Esse item já está na sua lista.", "erro");
    return;
  }
  itensDoForm.push(texto);
  elItem.value = "";
  mostrarMensagem("");
  desenharChips();
  elItem.focus();
}

document.getElementById("btn-add-item").addEventListener("click", adicionarItem);
elItem.addEventListener("keydown", e => {
  if (e.key === "Enter") { e.preventDefault(); adicionarItem(); }
});

function mostrarMensagemAuth(texto, tipo) {
  elMensagemAuth.textContent = texto;
  elMensagemAuth.className = `mensagem ${tipo || ""}`;
}

elBtnAlternarAuth.addEventListener("click", () => {
  modoCadastroConta = !modoCadastroConta;
  elCamposCadastroConta.hidden = !modoCadastroConta;
  elAuthNome.required = modoCadastroConta;
  elAuthCpf.required = modoCadastroConta;
  elAuthSenha.autocomplete = modoCadastroConta ? "new-password" : "current-password";
  elAuthTitulo.textContent = modoCadastroConta ? "Criar conta" : "Entrar";
  elBtnAuth.textContent = modoCadastroConta ? "Criar conta" : "Entrar";
  elBtnAlternarAuth.textContent = modoCadastroConta ? "Já tenho uma conta" : "Criar conta";
  mostrarMensagemAuth("");
});

elFormAuth.addEventListener("submit", async e => {
  e.preventDefault();
  const email = elAuthEmail.value.trim();
  const senha = elAuthSenha.value;
  elBtnAuth.disabled = true;
  mostrarMensagemAuth(modoCadastroConta ? "Criando conta…" : "Entrando…");

  try {
    if (modoCadastroConta) {
      const nome = elAuthNome.value.trim();
      const cpf = elAuthCpf.value.replace(/\D/g, "");
      if (nome.length < 3) throw new Error("Digite seu nome completo.");
      if (!cpfValido(cpf)) throw new Error("CPF inválido. Confira os 11 dígitos.");
      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password: senha,
        options: { data: { nome, cpf } }
      });
      if (error) throw error;
      mostrarMensagemAuth(data.session
        ? "Conta criada. Você já pode cadastrar o café."
        : "Conta criada. Confira seu e-mail para confirmar o cadastro.", "ok");
    } else {
      const { error } = await supabaseClient.auth.signInWithPassword({ email, password: senha });
      if (error) throw error;
      mostrarMensagemAuth("Login realizado.", "ok");
    }
  } catch (erro) {
    mostrarMensagemAuth(erro.message || "Não foi possível autenticar.", "erro");
  } finally {
    elBtnAuth.disabled = false;
  }
});

function atualizarAcesso(session) {
  const usuarioId = session?.user.id || null;
  if (usuarioIdAtivo === usuarioId) return;
  usuarioIdAtivo = usuarioId;
  elAuthArea.hidden = Boolean(session);
  elAppArea.hidden = !session;
  elBtnSair.hidden = !session;
  if (session) {
    carregarMes();
  } else {
    itensDoMes = [];
    colaboradorIdAtivo = undefined;
    elTabelaCorpo.innerHTML = "";
  }
}

supabaseClient.auth.onAuthStateChange((_evento, session) => {
  setTimeout(() => atualizarAcesso(session), 0);
});
supabaseClient.auth.getSession().then(({ data: { session } }) => atualizarAcesso(session));
elBtnSair.addEventListener("click", async () => {
  const { error } = await supabaseClient.auth.signOut();
  if (error) mostrarMensagemAuth("Erro ao sair: " + error.message, "erro");
});

document.getElementById("form-cadastro").addEventListener("submit", async e => {
  e.preventDefault();
  adicionarItem(); // aproveita o que ficou digitado no campo

  const data = elData.value;

  if (!data || data <= hoje) return mostrarMensagem("Escolha uma data depois de hoje.", "erro");
  if (itensDoForm.length === 0) return mostrarMensagem("Adicione pelo menos um item.", "erro");

  elBtnSalvar.disabled = true;
  mostrarMensagem("Salvando…");

  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    const [colaborador] = await api(`colaboradores?select=id,nome&auth_user_id=eq.${session.user.id}`);
    if (!colaborador) throw new Error("Não encontramos seu cadastro de colaborador. Entre em contato com o responsável.");

    const existentes = await api(`itens_cafe?select=item&data_cafe=eq.${data}`);
    const repetidos = itensDoForm.filter(i => existentes.some(x => x.item.toLowerCase() === i.toLowerCase()));
    if (repetidos.length) {
      throw new Error(`Já tem na lista desse dia: ${repetidos.join(", ")}.`);
    }

    const linhas = itensDoForm.map(item => ({ colaborador_id: colaborador.id, item, data_cafe: data }));
    await api("itens_cafe", { method: "POST", body: JSON.stringify(linhas) });

    itensDoForm = [];
    desenharChips();
    mostrarMensagem("Cadastro salvo!", "ok");
    await carregarMes();
  } catch (erro) {
    const duplicado = /duplicate|unique/i.test(erro.message);
    mostrarMensagem(duplicado ? "Já existe um colaborador com esse nome ou CPF." : erro.message, "erro");
  } finally {
    elBtnSalvar.disabled = false;
  }
});
