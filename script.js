const faixaCarrossel = document.querySelector("[data-carrossel]");
const botaoAnterior = document.querySelector("[data-anterior]");
const botaoProximo = document.querySelector("[data-proximo]");
const indicadores = Array.from(
  document.querySelectorAll("[data-indicadores] .indicador")
);
const formularioPedido = document.querySelector("#formulario-pedido");
const formularioCarrinho = document.querySelector("#formulario-carrinho");
let botoesCardapio = Array.from(document.querySelectorAll(".botao-cardapio"));
const botoesMenu = Array.from(document.querySelectorAll("[data-menu-toggle]"));

botoesMenu.forEach((botao) => {
  const topo = botao.closest(".barra-topo");
  const navegacao = topo ? topo.querySelector(".navegacao") : null;
  if (!navegacao) {
    return;
  }

  const alternarMenu = () => {
    const aberto = navegacao.classList.toggle("ativo");
    botao.setAttribute("aria-expanded", aberto ? "true" : "false");
  };

  botao.addEventListener("click", alternarMenu);
  navegacao.addEventListener("click", (evento) => {
    if (evento.target instanceof HTMLAnchorElement) {
      navegacao.classList.remove("ativo");
      botao.setAttribute("aria-expanded", "false");
    }
  });
});

const storageKeys = {
  carrinho: "acai_carrinho",
  config: "acai_config",
  pedidos: "acai_pedidos",
  historico: "acai_historico_pedidos",
  fechamentos: "acai_fechamentos",
  statusLoja: "acai_status_loja",
  admin: "acai_admin_logado",
  somAdmin: "acai_som_admin",
  pedidoSequencia: "acai_pedido_sequencia",
};
const numeroWhatsApp = "5543999781913";
const supabaseConfig = {
  url: "https://gnyepyhjycsjfnixliro.supabase.co",
  anonKey:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdueWVweWhqeWNzamZuaXhsaXJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzODE3MDksImV4cCI6MjA4NDk1NzcwOX0.dBQAZylYPGVNBeT218na8N1X_vGD4jifnoKrxljfgN8",
};

const storage = {
  get: (chave, padrao = null) => {
    try {
      const bruto = localStorage.getItem(chave);
      return bruto ? JSON.parse(bruto) : padrao;
    } catch (erro) {
      return padrao;
    }
  },
  set: (chave, valor) => {
    localStorage.setItem(chave, JSON.stringify(valor));
  },
};
const criarSupabase = (opcoes = {}) => {
  if (!window.supabase?.createClient) {
    return null;
  }
  const {
    persistSession = true,
    autoRefreshToken = true,
    detectSessionInUrl = true,
    globalHeaders = null,
    storage = undefined,
  } = opcoes;
  try {
    return window.supabase.createClient(
      supabaseConfig.url,
      supabaseConfig.anonKey,
      {
        auth: {
          persistSession,
          autoRefreshToken,
          detectSessionInUrl,
          ...(storage ? { storage } : {}),
        },
        global: globalHeaders ? { headers: globalHeaders } : undefined,
      }
    );
  } catch (erro) {
    return null;
  }
};
const paginaAdmin = () => {
  const rota = window.location.pathname.split("/").pop() || "";
  return [
    "admin.html",
    "admin-pedidos.html",
    "relatorio.html",
    "admin-login.html",
  ].includes(rota);
};

const storageNulo = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};
const supabaseClient = paginaAdmin()
  ? criarSupabase({
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    })
  : criarSupabase({
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      globalHeaders: {
        apikey: supabaseConfig.anonKey,
        Authorization: `Bearer ${supabaseConfig.anonKey}`,
      },
      storage: storageNulo,
    });

const garantirAnonimoEmPaginaPublica = async () => {
  if (!paginaAdmin()) {
    return;
  }
};

const obterSessaoAdmin = async () => {
  if (!supabaseClient?.auth || !paginaAdmin()) {
    return null;
  }
  const { data, error } = await supabaseClient.auth.getSession();
  if (error) {
    console.warn("Supabase auth session failed.", error);
    return null;
  }
  return data?.session || null;
};

const exigirSessaoAdmin = async () => {
  const sessao = await obterSessaoAdmin();
  if (!sessao) {
    window.location.href = "admin-login.html";
    return null;
  }
  return sessao;
};

const registrarLogoutAdmin = () => {
  const botao = document.querySelector("#admin-logout");
  if (!botao) {
    return;
  }
  botao.addEventListener("click", async () => {
    if (!supabaseClient?.auth) {
      window.location.href = "admin-login.html";
      return;
    }
    await supabaseClient.auth.signOut();
    window.location.href = "admin-login.html";
  });
};

const buscarRegistro = async (tabela, id) => {
  if (!supabaseClient) {
    return null;
  }
  const { data, error } = await supabaseClient
    .from(tabela)
    .select("*")
    .eq("id", id)
    .limit(1);
  if (error) {
    console.warn(`Supabase load failed (${tabela}).`, error);
    return null;
  }
  return Array.isArray(data) ? data[0] : null;
};

const salvarRegistro = async (tabela, registro, conflito = "id") => {
  if (!supabaseClient) {
    return;
  }
  const { error } = await supabaseClient
    .from(tabela)
    .upsert(registro, { onConflict: conflito });
  if (error) {
    console.warn(`Supabase save failed (${tabela}).`, error);
  }
};

const sincronizarConfigRemota = async () => {
  const local = obterConfig();
  const registro = await buscarRegistro("acai_config", "principal");
  if (registro?.data) {
    storage.set(storageKeys.config, normalizarConfig(registro.data));
    return;
  }
  const sessao = await obterSessaoAdmin();
  if (!sessao) {
    return;
  }
  await salvarRegistro("acai_config", {
    id: "principal",
    data: local,
    updated_at: new Date().toISOString(),
  });
};

const salvarConfigRemoto = async (config) => {
  const sessao = await obterSessaoAdmin();
  if (!sessao) {
    return;
  }
  await salvarRegistro("acai_config", {
    id: "principal",
    data: config,
    updated_at: new Date().toISOString(),
  });
};

const sincronizarStatusLojaRemoto = async () => {
  const registro = await buscarRegistro("acai_status_loja", "principal");
  if (registro?.status) {
    aplicarStatusLoja(registro.status);
    return;
  }
  const sessao = await obterSessaoAdmin();
  if (!sessao) {
    return;
  }
  await salvarRegistro("acai_status_loja", {
    id: "principal",
    status: obterStatusLoja(),
    updated_at: new Date().toISOString(),
  });
};

const salvarStatusLojaRemoto = async (status) => {
  const sessao = await obterSessaoAdmin();
  if (!sessao) {
    return;
  }
  await salvarRegistro("acai_status_loja", {
    id: "principal",
    status,
    updated_at: new Date().toISOString(),
  });
};

const obterSequenciaPedido = async () => {
  const sequenciaLocal = Number(storage.get(storageKeys.pedidoSequencia, 0));
  if (!supabaseClient?.rpc) {
    const proxima = sequenciaLocal + 1;
    storage.set(storageKeys.pedidoSequencia, proxima);
    return proxima;
  }
  const { data, error } = await supabaseClient.rpc(
    "acai_proximo_numero_pedido"
  );
  if (error || typeof data !== "number") {
    const proxima = sequenciaLocal + 1;
    storage.set(storageKeys.pedidoSequencia, proxima);
    return proxima;
  }
  storage.set(storageKeys.pedidoSequencia, data);
  return data;
};

const configPadrao = {
  precos: {
    tradicional: {
      "P - 300 ml": 15,
      "M - 500 ml": 18,
      "G - 700 ml": 22,
    },
    tigela: {
      "600 ml": 29.9,
      "1 litro": 35.9,
    },
    garrafa: {
      base: 18,
      trufada: 22,
    },
  },
  adicionais: {
    padrao: 2.5,
    garrafaExtra: 2.5,
    itens: [
      { nome: "Leite condensado", preco: 2.5 },
      { nome: "Granola", preco: 2.5 },
      { nome: "M&M", preco: 2.5 },
      { nome: "Kit Kat", preco: 2.5 },
      { nome: "Banana", preco: 2.5 },
      { nome: "Uva", preco: 2.5 },
      { nome: "Kiwi", preco: 2.5 },
      { nome: "Morango", preco: 2.5 },
      { nome: "Manga", preco: 2.5 },
      { nome: "Maracujá", preco: 2.5 },
      { nome: "Paçoca", preco: 2.5 },
      { nome: "Leite em pó", preco: 2.5 },
      { nome: "Creme de avelã", preco: 2.5 },
      { nome: "Pasta de amendoim", preco: 2.5 },
      { nome: "Coco ralado", preco: 2.5 },
      { nome: "Castanha de caju", preco: 2.5 },
      { nome: "Amendoim", preco: 2.5 },
      { nome: "Biscoito crocante", preco: 2.5 },
      { nome: "Calda de chocolate", preco: 2.5 },
      { nome: "Calda de morango", preco: 2.5 },
    ],
    garrafaItens: [
      { nome: "Maracujá" },
      { nome: "Morango" },
      { nome: "Banana" },
      { nome: "Nutella" },
      { nome: "Creme de ninho" },
    ],
  },
  imagens: {
    tradicional: "imagens/40.jpg",
    garrafa: "imagens/10.jpg",
    tigela: "imagens/20.jpg",
    batidinha: "imagens/acai-roxo-e-amarelo.png",
  },
  produtos: [
    {
      nome: "Tradicional",
      descricao: "Combinacao deliciosa.",
      extra:
        "Em 3 tamanhos, 300 ml com 2 adicionais, 500 ml com 3 adicionais e 700 ml com 4 adicionais.",
      preco: 15,
      imagem: "imagens/40.jpg",
    },
    {
      nome: "Açai na Tigela",
      descricao: "Novidade açai na tigela.",
      extra: "600 ml com 4 adicionais e 1 litro com 5 adicionais.",
      preco: 29.9,
      imagem: "imagens/20.jpg",
    },
    {
      nome: "Açai na Garrafa",
      descricao: "Combinacao cremosa com leite condensado.",
      extra:
        "Garrafa de 300 ml, batida com leite condensado e leite em po. Pode ser trufada com frutas ou cremes.",
      preco: 18,
      imagem: "imagens/10.jpg",
    },
    {
      nome: "Batidinha de Açai",
      descricao: "Levemente alcoolica.",
      extra: "Bebida com açai, leite condensado e vodka.",
      preco: 18,
      imagem: "imagens/acai-roxo-e-amarelo.png",
    },
  ],
  destaques: [
    {
      titulo: "Tradicional",
      texto:
        "Monte seu açai com adicionais especiais e ganhe um topper exclusivo. Promo válida por tempo limitado.",
      imagem: "imagens/açai-tradicional-destaque.jpg",
    },
    {
      titulo: "Garrafa trufada",
      texto:
        "Açai na garrafa com textura cremosa e adicionais especiais para adoçar o dia.",
      imagem: "imagens/10.jpg",
    },
    {
      titulo: "Tigela premium",
      texto:
        "Escolha seus adicionais favoritos e monte uma tigela completa para compartilhar.",
      imagem: "imagens/marmita-detaque.jpg",
    },
  ],
};

const normalizarConfig = (config) => {
  const base = JSON.parse(JSON.stringify(configPadrao));
  if (!config || typeof config !== "object") {
    return base;
  }

  base.precos = {
    ...base.precos,
    ...config.precos,
    tradicional: {
      ...base.precos.tradicional,
      ...(config.precos?.tradicional || {}),
    },
    tigela: {
      ...base.precos.tigela,
      ...(config.precos?.tigela || {}),
    },
    garrafa: {
      ...base.precos.garrafa,
      ...(config.precos?.garrafa || {}),
    },
  };

  base.adicionais = {
    ...base.adicionais,
    ...(config.adicionais || {}),
  };

  if (!Array.isArray(base.adicionais.itens)) {
    base.adicionais.itens = configPadrao.adicionais.itens.slice();
  }
  if (!Array.isArray(base.adicionais.garrafaItens)) {
    base.adicionais.garrafaItens = configPadrao.adicionais.garrafaItens.slice();
  }

  base.imagens = {
    ...base.imagens,
    ...(config.imagens || {}),
  };

  base.produtos = Array.isArray(config.produtos)
    ? config.produtos
    : configPadrao.produtos.slice();

  base.destaques = Array.isArray(config.destaques)
    ? config.destaques
    : configPadrao.destaques.slice();

  return base;
};

const garantirConfig = () => {
  const existente = storage.get(storageKeys.config);
  const normalizado = normalizarConfig(existente);
  storage.set(storageKeys.config, normalizado);
};

const obterConfig = () => normalizarConfig(storage.get(storageKeys.config));

const salvarCarrinho = (itens) => {
  storage.set(storageKeys.carrinho, itens);
};

const carregarCarrinho = () => storage.get(storageKeys.carrinho, []);

const salvarPedidosLocal = (pedidos) => {
  storage.set(storageKeys.pedidos, pedidos);
};

const salvarPedidos = async (pedidos) => {
  salvarPedidosLocal(pedidos);
  if (!supabaseClient) {
    return;
  }
  if (!paginaAdmin()) {
    const novo = pedidos[0];
    if (!novo) {
      return;
    }
    const { error } = await supabaseClient.from("acai_pedidos").insert(novo);
    if (error) {
      console.warn("Supabase save failed.", error);
    }
    return;
  }
  const { error } = await supabaseClient
    .from("acai_pedidos")
    .upsert(pedidos, { onConflict: "id" });
  if (error) {
    console.warn("Supabase save failed.", error);
  }
};

const carregarPedidos = async () => {
  if (!supabaseClient) {
    return storage.get(storageKeys.pedidos, []);
  }
  if (!paginaAdmin()) {
    return storage.get(storageKeys.pedidos, []);
  }
  const { data, error } = await supabaseClient
    .from("acai_pedidos")
    .select("*")
    .order("data", { ascending: false });
  if (error) {
    console.warn("Supabase load failed.", error);
    return storage.get(storageKeys.pedidos, []);
  }
  return Array.isArray(data) ? data : [];
};

const buscarStatusPedidoPublico = async (codigo) => {
  if (!supabaseClient || paginaAdmin()) {
    return null;
  }
  const { data, error } = await supabaseClient.rpc(
    "acai_status_pedido_publico",
    { codigo_input: codigo }
  );
  if (error) {
    console.warn("Supabase status lookup failed.", error);
    return null;
  }
  if (!data) {
    return null;
  }
  return { status: data.status || data || "" };
};

const salvarHistorico = async (pedidos) => {
  storage.set(storageKeys.historico, pedidos);
  if (!supabaseClient) {
    return;
  }
  await salvarRegistro("acai_historico_pedidos", pedidos);
};

const carregarHistorico = async () => {
  if (!supabaseClient) {
    return storage.get(storageKeys.historico, []);
  }
  const { data, error } = await supabaseClient
    .from("acai_historico_pedidos")
    .select("*")
    .order("data", { ascending: false });
  if (error) {
    console.warn("Supabase load failed (acai_historico_pedidos).", error);
    return storage.get(storageKeys.historico, []);
  }
  const lista = Array.isArray(data) ? data : [];
  storage.set(storageKeys.historico, lista);
  return lista;
};

const salvarFechamentos = async (fechamentos) => {
  storage.set(storageKeys.fechamentos, fechamentos);
  if (!supabaseClient) {
    return;
  }
  await salvarRegistro("acai_fechamentos", fechamentos);
};

const carregarFechamentos = async () => {
  if (!supabaseClient) {
    return storage.get(storageKeys.fechamentos, []);
  }
  const { data, error } = await supabaseClient
    .from("acai_fechamentos")
    .select("*")
    .order("data", { ascending: false });
  if (error) {
    console.warn("Supabase load failed (acai_fechamentos).", error);
    return storage.get(storageKeys.fechamentos, []);
  }
  const lista = Array.isArray(data) ? data : [];
  storage.set(storageKeys.fechamentos, lista);
  return lista;
};

const obterStatusLoja = () => storage.get(storageKeys.statusLoja, "fechado");

const aplicarStatusLoja = (status) => {
  const statusNormalizado = status === "aberto" ? "aberto" : "fechado";
  storage.set(storageKeys.statusLoja, statusNormalizado);
  const statusSelect = document.querySelector("#status-loja-admin");
  if (statusSelect) {
    statusSelect.value = statusNormalizado;
  }
  document.querySelectorAll("[data-status-loja]").forEach((badge) => {
    badge.textContent = statusNormalizado === "aberto" ? "Aberto" : "Fechado";
    badge.classList.remove("status-loja--aberto", "status-loja--fechado");
    badge.classList.add(
      statusNormalizado === "aberto" ? "status-loja--aberto" : "status-loja--fechado"
    );
  });
  return statusNormalizado;
};

const definirStatusLoja = (status) => {
  const statusFinal = aplicarStatusLoja(status);
  void salvarStatusLojaRemoto(statusFinal);
};

const statusLojaSelect = document.querySelector("#status-loja-admin");
if (statusLojaSelect) {
  statusLojaSelect.value = obterStatusLoja();
  statusLojaSelect.addEventListener("change", () => {
    definirStatusLoja(statusLojaSelect.value);
  });
}

aplicarStatusLoja(obterStatusLoja());
void sincronizarStatusLojaRemoto();

garantirConfig();
void sincronizarConfigRemota();

if (faixaCarrossel) {
  let indiceAtual = 0;
  let intervaloAutomatico = null;

  const atualizarCarrossel = (indice) => {
    const totalSlides = faixaCarrossel.children.length;
    indiceAtual = (indice + totalSlides) % totalSlides;
    const deslocamento = indiceAtual * -100;

    faixaCarrossel.style.transform = `translateX(${deslocamento}%)`;

    indicadores.forEach((indicador, posicao) => {
      indicador.classList.toggle("ativo", posicao === indiceAtual);
    });
  };

  const avancarCarrossel = (passo) => {
    atualizarCarrossel(indiceAtual + passo);
  };

  const iniciarAuto = () => {
    intervaloAutomatico = setInterval(() => {
      avancarCarrossel(1);
    }, 5000);
  };

  const reiniciarAuto = () => {
    clearInterval(intervaloAutomatico);
    iniciarAuto();
  };

  if (botaoAnterior && botaoProximo) {
    botaoAnterior.addEventListener("click", () => {
      avancarCarrossel(-1);
      reiniciarAuto();
    });

    botaoProximo.addEventListener("click", () => {
      avancarCarrossel(1);
      reiniciarAuto();
    });
  }

  indicadores.forEach((indicador, posicao) => {
    indicador.addEventListener("click", () => {
      atualizarCarrossel(posicao);
      reiniciarAuto();
    });
  });

  iniciarAuto();
}

const miniCarrossel = document.querySelector("[data-mini-carrossel]");
const miniIndicadoresContainer = document.querySelector("[data-mini-indicadores]");
let miniIndicadores = miniIndicadoresContainer
  ? Array.from(miniIndicadoresContainer.querySelectorAll(".mini-indicador"))
  : [];
const botaoMiniAnterior = document.querySelector("[data-mini-anterior]");
const botaoMiniProximo = document.querySelector("[data-mini-proximo]");
const destaqueTitulo = document.querySelector("#destaque-titulo");
const destaqueTexto = document.querySelector("#destaque-texto");

if (miniCarrossel) {
  let indiceMini = 0;
  const config = obterConfig();
  const destaques = Array.isArray(config.destaques) ? config.destaques : [];

  if (destaques.length) {
    miniCarrossel.innerHTML = destaques
      .map(
        (item) => `
          <figure class="mini-carrossel-slide" data-titulo="${item.titulo || ""}" data-texto="${
          item.texto || ""
        }">
            <img src="${item.imagem || ""}" alt="${item.titulo || "Destaque"}" />
          </figure>`
      )
      .join("");

    if (miniIndicadoresContainer) {
      miniIndicadoresContainer.innerHTML = destaques
        .map((_, index) =>
          index === 0
            ? '<span class="mini-indicador ativo"></span>'
            : '<span class="mini-indicador"></span>'
        )
        .join("");
    }
  }

  miniIndicadores = miniIndicadoresContainer
    ? Array.from(miniIndicadoresContainer.querySelectorAll(".mini-indicador"))
    : [];

  const atualizarMiniCarrossel = (indice) => {
    const slides = Array.from(miniCarrossel.children);
    const totalSlides = slides.length;
    if (!totalSlides) {
      return;
    }
    indiceMini = (indice + totalSlides) % totalSlides;
    const deslocamento = indiceMini * -100;

    miniCarrossel.style.transform = `translateX(${deslocamento}%)`;

    miniIndicadores.forEach((indicador, posicao) => {
      indicador.classList.toggle("ativo", posicao === indiceMini);
    });

    const slideAtual = slides[indiceMini];
    if (slideAtual && destaqueTitulo && destaqueTexto) {
      const titulo = slideAtual.dataset.titulo || "Destaque";
      const texto = slideAtual.dataset.texto || "";
      destaqueTitulo.textContent = titulo;
      destaqueTexto.textContent = texto;
    }
  };

  miniIndicadores.forEach((indicador, posicao) => {
    indicador.addEventListener("click", () => {
      atualizarMiniCarrossel(posicao);
    });
  });

  if (botaoMiniAnterior) {
    botaoMiniAnterior.addEventListener("click", () => {
      atualizarMiniCarrossel(indiceMini - 1);
    });
  }

  if (botaoMiniProximo) {
    botaoMiniProximo.addEventListener("click", () => {
      atualizarMiniCarrossel(indiceMini + 1);
    });
  }

  atualizarMiniCarrossel(0);
}

const gradeCardapio = document.querySelector("#grade-cardapio");
if (gradeCardapio) {
  const config = obterConfig();
  const formatarPrecoCardapio = (valor) =>
    `R$ ${Number(valor || 0).toFixed(2).replace(".", ",")}`;

  const produtos = Array.isArray(config.produtos) ? config.produtos : [];
  gradeCardapio.innerHTML = produtos
    .map((produto) => {
      const preco = Number.isFinite(produto.preco) ? produto.preco : 0;
      const descricao = produto.descricao || "";
      const extra = produto.extra || "";
      const imagem = produto.imagem || "";
      const nome = produto.nome || "Produto";
      return `
        <article class="item-cardapio">
          <img src="${imagem}" alt="${nome}" loading="lazy" />
          <div class="cardapio-conteudo">
            <h3>${nome}</h3>
            <p>${descricao}</p>
            <p class="cardapio-extra" aria-hidden="true">${extra}</p>
            <span class="preco">${formatarPrecoCardapio(preco)}</span>
            <div class="cardapio-acoes">
              <button class="botao-cardapio" type="button">Ver mais</button>
              <a class="botao-secundario" href="pedidos.html">Peça já</a>
            </div>
          </div>
        </article>
      `;
    })
    .join("");

}

if (formularioPedido) {
  const config = obterConfig();
  const produtosRadios = Array.from(
    document.querySelectorAll("input[name='tipo-produto']")
  );
  const tamanhoRadios = Array.from(document.querySelectorAll("input[name='tamanho']"));
  const tamanhoTigelaRadios = Array.from(
    document.querySelectorAll("input[name='tamanho-tigela']")
  );
  const trufadaRadios = Array.from(document.querySelectorAll("input[name='trufada']"));
  let ingredientesGratis = [];
  let adicionaisTradicional = [];
  let adicionaisGarrafa = [];
  let adicionaisGarrafaExtra = [];
  const listaAdicionaisGratis = document.querySelector("#lista-adicionais-gratis");
  const listaAdicionaisPagos = document.querySelector("#lista-adicionais-pagos");
  const listaAdicionaisGarrafa = document.querySelector("#lista-adicionais-garrafa");
  const listaAdicionaisGarrafaExtra = document.querySelector(
    "#lista-adicionais-garrafa-extra"
  );
  const campoTamanho = document.querySelector("[data-campo-tamanho]");
  const campoTamanhoTigela = document.querySelector("[data-campo-tamanho-tigela]");
  const campoTrufada = document.querySelector("[data-campo-trufada]");
  const campoIngredientes = document.querySelector("[data-campo-ingredientes]");
  const campoAdicionaisTradicional = document.querySelector("[data-campo-adicionais]");
  const campoAdicionaisGarrafa = document.querySelector(
    "[data-campo-adicionais-garrafa]"
  );
  const campoAdicionaisGarrafaExtra = document.querySelector(
    "[data-campo-adicionais-garrafa-extra]"
  );
  const infoGarrafa = document.querySelector("#garrafa-tamanho-info");
  const infoBatidinha = document.querySelector("#batidinha-tamanho-info");
  const rotuloAdicionalGarrafaExtra = document.querySelector(
    "#rotulo-adicional-garrafa-extra"
  );
  const contadorGratis = document.querySelector("#contador-gratis");
  const botaoAdicionar = document.querySelector("#adicionar-carrinho");
  const botaoIrCarrinho = document.querySelector("#ir-carrinho");
  const botaoEnviarPedido = document.querySelector("#enviar-pedido");
  const listaCarrinho = document.querySelector("#lista-carrinho");
  const carrinhoVazio = document.querySelector("#carrinho-vazio");
  const imagemProduto = document.querySelector("#pedido-imagem");
  const nomeProduto = document.querySelector("#pedido-nome");
  const detalheProduto = document.querySelector("#pedido-detalhe");
  const totalPedido = document.querySelector("#total-pedido");
  const observacoesCampo = document.querySelector("#observacoes-pedido");
  const carrinho = [];
  const precoAdicionalPadrao = config.adicionais.padrao;
  const precoAdicionalGarrafaExtra = config.adicionais.garrafaExtra;
  const precosTamanho = config.precos.tradicional;
  const precosTigela = config.precos.tigela;
  const precoBaseGarrafa = config.precos.garrafa.base;
  const precoTrufadaGarrafa = config.precos.garrafa.trufada;
  const formatarPreco = (valor) => valor.toFixed(2).replace(".", ",");
  const formatarTexto = (valor) => `R$ ${formatarPreco(valor)}`;

  const montarListaAdicionais = () => {
    if (!listaAdicionaisGratis || !listaAdicionaisPagos) {
      return;
    }
    const itens = Array.isArray(config.adicionais.itens)
      ? config.adicionais.itens
      : [];
    const gerarGratis = itens
      .map(
        (item) => `
          <label class="opcao-checagem">
            <input type="checkbox" data-ingrediente-gratis value="${item.nome}" />
            ${item.nome}
            <span class="adicional-preco">Grátis</span>
          </label>`
      )
      .join("");
    const gerarPagos = itens
      .map((item) => {
        const precoItem =
          Number.isFinite(item.preco) ? item.preco : precoAdicionalPadrao;
        return `
          <label class="opcao-checagem">
            <input
              type="checkbox"
              data-adicional
              data-preco="${precoItem}"
              value="${item.nome}"
            />
            ${item.nome}
            <span class="adicional-preco" data-preco-item="true">${formatarTexto(
              precoItem
            )}</span>
          </label>`;
      })
      .join("");
    listaAdicionaisGratis.innerHTML = gerarGratis;
    listaAdicionaisPagos.innerHTML = gerarPagos;
  };

  const montarAdicionaisGarrafa = () => {
    if (!listaAdicionaisGarrafa || !listaAdicionaisGarrafaExtra) {
      return;
    }
    const itens = Array.isArray(config.adicionais.garrafaItens)
      ? config.adicionais.garrafaItens
      : [];
    const gerarGratis = itens
      .map(
        (item) => `
          <label class="opcao-checagem">
            <input type="checkbox" data-adicional-garrafa value="${item.nome}" />
            ${item.nome}
            <span class="adicional-preco">Grátis</span>
          </label>`
      )
      .join("");
    const gerarExtras = itens
      .map(
        (item) => `
          <label class="opcao-checagem">
            <input type="checkbox" data-adicional-garrafa-extra value="${item.nome}" />
            ${item.nome}
            <span class="adicional-preco" data-preco-adicional="garrafa-extra">${formatarTexto(
              precoAdicionalGarrafaExtra
            )}</span>
          </label>`
      )
      .join("");
    listaAdicionaisGarrafa.innerHTML = gerarGratis;
    listaAdicionaisGarrafaExtra.innerHTML = gerarExtras;
  };

  const atualizarPrecoLabels = () => {
    document
      .querySelectorAll("[data-preco-tamanho]")
      .forEach((span) => {
        const chave = span.dataset.precoTamanho;
        if (precosTamanho[chave] !== undefined) {
          span.textContent = formatarTexto(precosTamanho[chave]);
        }
      });

    document
      .querySelectorAll("[data-preco-tigela]")
      .forEach((span) => {
        const chave = span.dataset.precoTigela;
        if (precosTigela[chave] !== undefined) {
          span.textContent = formatarTexto(precosTigela[chave]);
        }
      });

    document
      .querySelectorAll(".adicional-preco")
      .forEach((span) => {
        const textoAtual = span.textContent.trim();
        if (span.dataset.precoItem === "true") {
          return;
        }
        if (textoAtual.toLowerCase().includes("grátis")) {
          return;
        }
        if (span.dataset.precoAdicional === "garrafa-extra") {
          span.textContent = formatarTexto(precoAdicionalGarrafaExtra);
          return;
        }
        if (textoAtual.startsWith("R$")) {
          span.textContent = formatarTexto(precoAdicionalPadrao);
        }
      });

    if (infoGarrafa) {
      infoGarrafa.textContent = `Açai na Garrafa: tamanho único 300 ml - ${formatarTexto(
        precoBaseGarrafa
      )}.`;
    }
    if (infoBatidinha) {
      infoBatidinha.textContent = `Batidinha de Açai: tamanho único 300 ml - ${formatarTexto(
        precoBaseGarrafa
      )}.`;
    }
    if (rotuloAdicionalGarrafaExtra) {
      rotuloAdicionalGarrafaExtra.textContent = `Adicionais extras (${formatarTexto(
        precoAdicionalGarrafaExtra
      )} cada)`;
    }
  };

  const atualizarImagensProdutos = () => {
    const mapa = {
      Tradicional: config.imagens.tradicional,
      "Açai na Garrafa": config.imagens.garrafa,
      "Açai na Tigela": config.imagens.tigela,
      "Batidinha de Açai": config.imagens.batidinha,
    };

    produtosRadios.forEach((radio) => {
      const novaImagem = mapa[radio.value];
      if (!novaImagem) {
        return;
      }
      radio.dataset.imagem = novaImagem;
      const opcao = radio.closest("label");
      const img = opcao?.querySelector("img");
      if (img) {
        img.src = novaImagem;
      }
    });
  };

  montarListaAdicionais();
  montarAdicionaisGarrafa();
  atualizarPrecoLabels();
  atualizarImagensProdutos();

  const obterTipoSelecionado = () =>
    produtosRadios.find((radio) => radio.checked)?.value || "";

  const obterTamanhoSelecionado = () =>
    tamanhoRadios.find((radio) => radio.checked)?.value || "";

  const obterTamanhoTigelaSelecionado = () =>
    tamanhoTigelaRadios.find((radio) => radio.checked)?.value || "";

  const obterQuantidadeGratis = () => {
    const tipo = obterTipoSelecionado();
    if (tipo === "Açai na Tigela") {
      const tamanho = tamanhoTigelaRadios.find((radio) => radio.checked);
      return tamanho ? Number(tamanho.dataset.gratis) : 0;
    }
    const tamanho = tamanhoRadios.find((radio) => radio.checked);
    return tamanho ? Number(tamanho.dataset.gratis) : 0;
  };

  const obterTrufadaSelecionada = () =>
    trufadaRadios.find((radio) => radio.checked)?.value || "";

  const limparSelecoes = (lista) => {
    lista.forEach((item) => {
      item.checked = false;
    });
  };

  const somarAdicionaisPagos = () =>
    adicionaisTradicional
      .filter((item) => item.checked)
      .reduce((total, item) => total + Number(item.dataset.preco || 0), 0);

  const obterAdicionaisPagosDetalhes = () =>
    adicionaisTradicional
      .filter((item) => item.checked)
      .map((item) => ({
        nome: item.value,
        preco: Number(item.dataset.preco || 0),
      }));

  const atualizarOpcoesAdicionais = () => {
    // Intencionalmente vazio: visibilidade controlada em atualizarVisibilidadeCampos.
  };

  const atualizarContadorGratis = () => {
    const limite = obterQuantidadeGratis();
    let selecionados = ingredientesGratis.filter((item) => item.checked).length;

    ingredientesGratis.forEach((item) => {
      item.disabled = !limite;
    });

    if (!limite) {
      contadorGratis.textContent =
        "Escolha o tamanho para liberar os adicionais grátis.";
      return;
    }

    if (selecionados > limite) {
      let excesso = selecionados - limite;
      ingredientesGratis
        .slice()
        .reverse()
        .forEach((item) => {
          if (item.checked && excesso > 0) {
            item.checked = false;
            excesso -= 1;
          }
        });
      selecionados = ingredientesGratis.filter((item) => item.checked).length;
    }

    contadorGratis.textContent = `Selecione ${limite} adicional${
      limite > 1 ? "is" : ""
    } grátis (${selecionados}/${limite}).`;
  };

  const calcularTotalItemAtual = () => {
    const tipo = obterTipoSelecionado();
    const tamanho = obterTamanhoSelecionado();
    const tamanhoTigela = obterTamanhoTigelaSelecionado();
    let total = 0;

    if (tipo === "Tradicional") {
      total += precosTamanho[tamanho] || 0;
      total += somarAdicionaisPagos();
    }

    if (tipo === "Açai na Tigela") {
      total += precosTigela[tamanhoTigela] || 0;
      total += somarAdicionaisPagos();
    }

    if (tipo === "Açai na Garrafa" || tipo === "Batidinha de Açai") {
      const trufada = obterTrufadaSelecionada();
      if (trufada === "Sim") {
        total += precoTrufadaGarrafa;
      } else if (trufada === "Não") {
        total += precoBaseGarrafa;
      }
      if (trufada) {
        total +=
          adicionaisGarrafaExtra.filter((item) => item.checked).length *
          precoAdicionalGarrafaExtra;
      }
    }

    return total;
  };

  const atualizarMiniatura = () => {
    const produto = produtosRadios.find((radio) => radio.checked);
    if (!produto) {
      return;
    }

    const tipo = produto.value;
    const imagem = produto.dataset.imagem;
    const tamanho = obterTamanhoSelecionado();
    const tamanhoTigela = obterTamanhoTigelaSelecionado();
    const trufada = obterTrufadaSelecionada();
    const gratisSelecionados = ingredientesGratis
      .filter((item) => item.checked)
      .map((item) => item.value);
    const adicionaisSelecionados = adicionaisTradicional
      .filter((item) => item.checked)
      .map((item) => item.value);
    const adicionaisGarrafaSelecionados = adicionaisGarrafa
      .filter((item) => item.checked)
      .map((item) => item.value);
    const adicionaisGarrafaExtras = adicionaisGarrafaExtra
      .filter((item) => item.checked)
      .map((item) => item.value);

    if (imagemProduto && imagem) {
      imagemProduto.src = imagem;
    }

    if (nomeProduto) {
      nomeProduto.textContent = tipo;
    }

    if (detalheProduto) {
      const partes = [];

      if (tipo === "Açai na Garrafa" || tipo === "Batidinha de Açai") {
        partes.push(
          trufada ? `Trufada: ${trufada}` : "Selecione se deseja trufada."
        );
      } else if (tipo === "Açai na Tigela") {
        partes.push(
          tamanhoTigela ? `Tamanho: ${tamanhoTigela}` : "Selecione o tamanho."
        );
      } else {
        partes.push(tamanho ? `Tamanho: ${tamanho}` : "Selecione o tamanho.");
      }

      if (tipo === "Tradicional" || tipo === "Açai na Tigela") {
        if (gratisSelecionados.length) {
          partes.push(`Grátis: ${gratisSelecionados.join(", ")}`);
        }
        if (adicionaisSelecionados.length) {
          partes.push(`Pagos: ${adicionaisSelecionados.join(", ")}`);
        }
      }

      if (tipo === "Açai na Garrafa" || tipo === "Batidinha de Açai") {
        if (adicionaisGarrafaSelecionados.length) {
          partes.push(
            `Adicional grátis: ${adicionaisGarrafaSelecionados.join(", ")}`
          );
        }
        if (adicionaisGarrafaExtras.length) {
          partes.push(
            `Adicionais ${formatarTexto(precoAdicionalGarrafaExtra)}: ${adicionaisGarrafaExtras.join(
              ", "
            )}`
          );
        }
      }

      detalheProduto.textContent = partes.join(" | ");
    }

    if (totalPedido) {
      totalPedido.textContent = `R$ ${formatarPreco(calcularTotalItemAtual())}`;
    }
  };

  const atualizarVisibilidadeCampos = () => {
    const tipo = obterTipoSelecionado();
    const isTradicional = tipo === "Tradicional";
    const isTigela = tipo === "Açai na Tigela";
    const isGarrafa = tipo === "Açai na Garrafa";
    const isBatidinha = tipo === "Batidinha de Açai";

    if (campoTamanho) {
      campoTamanho.classList.toggle("oculto", !isTradicional);
    }
    if (campoTamanhoTigela) {
      campoTamanhoTigela.classList.toggle("oculto", !isTigela);
    }

    if (!isTradicional) {
      tamanhoRadios.forEach((radio) => {
        radio.checked = false;
      });
    }
    if (!isTigela) {
      tamanhoTigelaRadios.forEach((radio) => {
        radio.checked = false;
      });
    }

    if (campoTrufada) {
      campoTrufada.classList.toggle("oculto", !(isGarrafa || isBatidinha));
    }

    if (infoGarrafa) {
      infoGarrafa.classList.toggle("oculto", !isGarrafa);
    }
    if (infoBatidinha) {
      infoBatidinha.classList.toggle("oculto", !isBatidinha);
    }

    if (campoIngredientes) {
      campoIngredientes.classList.toggle("oculto", !(isTradicional || isTigela));
    }

    if (!isTradicional && !isTigela) {
      limparSelecoes(ingredientesGratis);
      atualizarContadorGratis();
    }

    if (isGarrafa || isBatidinha) {
      const trufada = obterTrufadaSelecionada();
      const mostrarAdicionais = trufada === "Sim";
      const selecionadosGarrafa = adicionaisGarrafa.filter((item) => item.checked).length;

      campoAdicionaisTradicional?.classList.add("oculto");
      campoAdicionaisTradicional?.classList.remove("mostrar-preco");
      campoAdicionaisGarrafa?.classList.toggle(
        "oculto",
        !mostrarAdicionais || selecionadosGarrafa >= 1
      );
      campoAdicionaisGarrafaExtra?.classList.toggle(
        "oculto",
        !mostrarAdicionais || selecionadosGarrafa < 1
      );
      atualizarOpcoesAdicionais();
      campoIngredientes?.classList.remove("mostrar-preco");
      if (!mostrarAdicionais) {
        limparSelecoes(adicionaisGarrafa);
        limparSelecoes(adicionaisGarrafaExtra);
      }
    } else if (isTradicional) {
      const limite = obterQuantidadeGratis();
      const selecionados = ingredientesGratis.filter((item) => item.checked).length;
      const mostrarAdicionais = selecionados >= limite && limite > 0;
      campoAdicionaisTradicional?.classList.toggle("oculto", !mostrarAdicionais);
      campoAdicionaisTradicional?.classList.toggle("mostrar-preco", mostrarAdicionais);
      campoIngredientes?.classList.toggle("oculto", mostrarAdicionais);
      campoAdicionaisGarrafa?.classList.add("oculto");
      campoAdicionaisGarrafaExtra?.classList.add("oculto");
      atualizarOpcoesAdicionais();
      if (!mostrarAdicionais) {
        limparSelecoes(adicionaisTradicional);
      }
    } else if (isTigela) {
      const limite = obterQuantidadeGratis();
      const selecionados = ingredientesGratis.filter((item) => item.checked).length;
      const mostrarAdicionais = selecionados >= limite && limite > 0;
      campoAdicionaisTradicional?.classList.toggle("oculto", !mostrarAdicionais);
      campoAdicionaisTradicional?.classList.toggle("mostrar-preco", mostrarAdicionais);
      campoIngredientes?.classList.toggle("oculto", mostrarAdicionais);
      campoAdicionaisGarrafa?.classList.add("oculto");
      campoAdicionaisGarrafaExtra?.classList.add("oculto");
      atualizarOpcoesAdicionais();
    } else {
      campoAdicionaisTradicional?.classList.add("oculto");
      campoAdicionaisTradicional?.classList.remove("mostrar-preco");
      campoAdicionaisGarrafa?.classList.add("oculto");
      campoAdicionaisGarrafaExtra?.classList.add("oculto");
      atualizarOpcoesAdicionais();
      limparSelecoes(adicionaisTradicional);
      limparSelecoes(adicionaisGarrafa);
      limparSelecoes(adicionaisGarrafaExtra);
    }
  };

  const registrarEventosAdicionais = () => {
    ingredientesGratis = Array.from(
      document.querySelectorAll("[data-ingrediente-gratis]")
    );
    adicionaisTradicional = Array.from(
      document.querySelectorAll("[data-adicional]")
    );
    adicionaisGarrafa = Array.from(
      document.querySelectorAll("[data-adicional-garrafa]")
    );
    adicionaisGarrafaExtra = Array.from(
      document.querySelectorAll("[data-adicional-garrafa-extra]")
    );

    ingredientesGratis.forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        const limite = obterQuantidadeGratis();
        const selecionados = ingredientesGratis.filter((item) => item.checked).length;
        if (limite && selecionados > limite) {
          checkbox.checked = false;
        }
        atualizarContadorGratis();
        atualizarVisibilidadeCampos();
        atualizarMiniatura();
      });
    });

    adicionaisTradicional.forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        atualizarMiniatura();
      });
    });

    adicionaisGarrafa.forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        const selecionados = adicionaisGarrafa.filter((item) => item.checked);
        if (selecionados.length > 1) {
          checkbox.checked = false;
        }
        atualizarVisibilidadeCampos();
        atualizarMiniatura();
      });
    });

    adicionaisGarrafaExtra.forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        atualizarMiniatura();
      });
    });
  };

  const renderizarCarrinho = () => {
    if (!listaCarrinho || !carrinhoVazio) {
      return;
    }

    listaCarrinho.innerHTML = "";
    carrinhoVazio.classList.toggle("oculto", carrinho.length > 0);

    carrinho.forEach((item) => {
      const linha = document.createElement("li");
      linha.classList.add("item-carrinho");
      linha.dataset.itemId = item.id;

      const cabecalho = document.createElement("div");
      cabecalho.classList.add("item-carrinho-cabecalho");

      const titulo = document.createElement("p");
      const tamanhoLabel =
        item.tamanhoTigela || item.tamanho || "";
      titulo.textContent = `${item.tipo}${tamanhoLabel ? ` - ${tamanhoLabel}` : ""}`;

      const botaoRemover = document.createElement("button");
      botaoRemover.type = "button";
      botaoRemover.classList.add("botao-remover");
      botaoRemover.textContent = "Remover";
      botaoRemover.dataset.removerId = item.id;

      cabecalho.append(titulo, botaoRemover);

      const detalhes = document.createElement("div");
      detalhes.classList.add("item-carrinho-detalhes");

      if (item.trufada) {
        const trufada = document.createElement("p");
        trufada.textContent = `Trufada: ${item.trufada}`;
        detalhes.append(trufada);
      }

      if (item.gratis.length) {
        const gratis = document.createElement("p");
        gratis.textContent = `Grátis: ${item.gratis.join(", ")}`;
        detalhes.append(gratis);
      }

      if (item.adicionais.length) {
        const adicionaisLinha = document.createElement("p");
        adicionaisLinha.textContent = `Adicionais: ${item.adicionais.join(", ")}`;
        detalhes.append(adicionaisLinha);
      }

      if (item.adicionaisGarrafa?.length) {
        const adicionaisGarrafa = document.createElement("p");
        adicionaisGarrafa.textContent = `Adicional grátis: ${item.adicionaisGarrafa.join(
          ", "
        )}`;
        detalhes.append(adicionaisGarrafa);
      }

      if (item.adicionaisGarrafaExtra?.length) {
        const adicionaisExtra = document.createElement("p");
        adicionaisExtra.textContent = `Adicionais ${formatarTexto(
          precoAdicionalGarrafaExtra
        )}: ${item.adicionaisGarrafaExtra.join(", ")}`;
        detalhes.append(adicionaisExtra);
      }

      const valorAdicionaisPagos =
        item.adicionaisPagosValor ??
        (item.adicionaisPagos ? item.adicionaisPagos * precoAdicionalPadrao : 0);

      if (valorAdicionaisPagos > 0) {
        const pagos = document.createElement("p");
        pagos.textContent = `Adicionais pagos: ${formatarTexto(valorAdicionaisPagos)}`;
        detalhes.append(pagos);
      }

      if (item.observacoes) {
        const observacao = document.createElement("p");
        observacao.textContent = `Obs: ${item.observacoes}`;
        detalhes.append(observacao);
      }

      linha.append(cabecalho, detalhes);
      listaCarrinho.append(linha);
    });

    if (totalPedido) {
      const totalCarrinho = carrinho.reduce(
        (soma, item) => soma + (item.total || 0),
        0
      );
      totalPedido.textContent = `R$ ${formatarPreco(totalCarrinho)}`;
    }

    salvarCarrinho(carrinho);
  };

  const validarItem = () => {
    const tipo = obterTipoSelecionado();
    const isTradicional = tipo === "Tradicional";
    const isTigela = tipo === "Açai na Tigela";
    const isGarrafa = tipo === "Açai na Garrafa";
    const isBatidinha = tipo === "Batidinha de Açai";

    if (!tipo) {
      return "Selecione o tipo de produto.";
    }

    if (isTradicional) {
      const tamanho = obterTamanhoSelecionado();
      if (!tamanho) {
        return "Selecione o tamanho.";
      }
      const limite = obterQuantidadeGratis();
      const selecionados = ingredientesGratis.filter((item) => item.checked).length;
      if (!limite) {
        return "Escolha o tamanho para liberar os adicionais grátis.";
      }
      if (selecionados < limite) {
        return `Selecione ${limite} adicionais grátis.`;
      }
    }
    if (isTigela) {
      const tamanho = obterTamanhoTigelaSelecionado();
      if (!tamanho) {
        return "Selecione o tamanho.";
      }
      const limite = obterQuantidadeGratis();
      const selecionados = ingredientesGratis.filter((item) => item.checked).length;
      if (!limite) {
        return "Escolha o tamanho para liberar os adicionais grátis.";
      }
      if (selecionados < limite) {
        return `Selecione ${limite} adicionais grátis.`;
      }
    }

    if (isGarrafa || isBatidinha) {
      const trufada = obterTrufadaSelecionada();
      if (!trufada) {
        return "Informe se deseja trufada.";
      }
      if (trufada === "Sim") {
        const selecionados = adicionaisGarrafa.filter((item) => item.checked).length;
        if (selecionados < 1) {
          return "Selecione 1 adicional grátis.";
        }
      }
    }

    return "";
  };

  const limparItemAtual = () => {
    limparSelecoes(ingredientesGratis);
    limparSelecoes(adicionaisTradicional);
    limparSelecoes(adicionaisGarrafa);
    limparSelecoes(adicionaisGarrafaExtra);
    trufadaRadios.forEach((radio) => {
      radio.checked = false;
    });
    if (observacoesCampo) {
      observacoesCampo.value = "";
    }
    atualizarContadorGratis();
    atualizarVisibilidadeCampos();
  };

  produtosRadios.forEach((radio) => {
    radio.addEventListener("change", () => {
      atualizarMiniatura();
      atualizarVisibilidadeCampos();
    });
  });

  tamanhoRadios.forEach((radio) => {
    radio.addEventListener("change", () => {
      atualizarContadorGratis();
      atualizarVisibilidadeCampos();
      atualizarMiniatura();
    });
  });

  tamanhoTigelaRadios.forEach((radio) => {
    radio.addEventListener("change", () => {
      atualizarContadorGratis();
      atualizarVisibilidadeCampos();
      atualizarMiniatura();
    });
  });

  trufadaRadios.forEach((radio) => {
    radio.addEventListener("change", () => {
      atualizarVisibilidadeCampos();
      atualizarMiniatura();
    });
  });
  registrarEventosAdicionais();

  const montarItemAtual = () => {
    const erro = validarItem();
    if (erro) {
      alert(erro);
      return null;
    }

    const tipo = obterTipoSelecionado();
    const item = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      tipo,
      tamanho: obterTamanhoSelecionado(),
      tamanhoTigela: obterTamanhoTigelaSelecionado(),
      trufada: obterTrufadaSelecionada(),
      gratis: ingredientesGratis.filter((item) => item.checked).map((item) => item.value),
      adicionais: adicionaisTradicional
        .filter((item) => item.checked)
        .map((item) => item.value),
      adicionaisGarrafa: adicionaisGarrafa
        .filter((item) => item.checked)
        .map((item) => item.value),
      adicionaisGarrafaExtra: adicionaisGarrafaExtra
        .filter((item) => item.checked)
        .map((item) => item.value),
      observacoes: observacoesCampo?.value.trim() || "",
      adicionaisPagosValor: 0,
      total: 0,
    };

    if (tipo === "Tradicional") {
      const adicionaisPagos = obterAdicionaisPagosDetalhes();
      item.adicionais = adicionaisPagos.map((adicional) => adicional.nome);
      item.adicionaisPagosValor = adicionaisPagos.reduce(
        (total, adicional) => total + adicional.preco,
        0
      );
      item.total = (precosTamanho[item.tamanho] || 0) + item.adicionaisPagosValor;
    }
    if (tipo === "Açai na Tigela") {
      const adicionaisPagos = obterAdicionaisPagosDetalhes();
      item.adicionais = adicionaisPagos.map((adicional) => adicional.nome);
      item.adicionaisPagosValor = adicionaisPagos.reduce(
        (total, adicional) => total + adicional.preco,
        0
      );
      item.total =
        (precosTigela[item.tamanhoTigela] || 0) + item.adicionaisPagosValor;
    }

    if (tipo === "Açai na Garrafa" || tipo === "Batidinha de Açai") {
      item.adicionais = [];
      if (item.trufada !== "Sim") {
        item.adicionais = [];
        item.adicionaisGarrafa = [];
        item.adicionaisGarrafaExtra = [];
        item.adicionaisPagosValor = 0;
        item.total = precoBaseGarrafa;
      } else {
        item.adicionaisPagosValor =
          item.adicionaisGarrafaExtra.length * precoAdicionalGarrafaExtra;
        item.total = precoTrufadaGarrafa + item.adicionaisPagosValor;
      }
    }

    return item;
  };

  if (botaoAdicionar) {
    botaoAdicionar.addEventListener("click", () => {
      const item = montarItemAtual();
      if (!item) {
        return;
      }
      carrinho.push(item);
      renderizarCarrinho();
      limparItemAtual();
    });
  }

  if (botaoEnviarPedido) {
    botaoEnviarPedido.addEventListener("click", () => {
      const item = montarItemAtual();
      if (!item) {
        return;
      }
      carrinho.push(item);
      salvarCarrinho(carrinho);
      window.location.href = "carrinho.html";
    });
  }

  if (botaoIrCarrinho) {
    botaoIrCarrinho.addEventListener("click", () => {
      if (!carrinho.length) {
        alert("Adicione ao menos um item no carrinho.");
        return;
      }
      salvarCarrinho(carrinho);
      window.location.href = "carrinho.html";
    });
  }

  if (listaCarrinho) {
    listaCarrinho.addEventListener("click", (evento) => {
      const alvo = evento.target;
      if (!(alvo instanceof HTMLButtonElement)) {
        return;
      }
      const id = alvo.dataset.removerId;
      if (!id) {
        return;
      }
      const indice = carrinho.findIndex((item) => item.id === id);
      if (indice >= 0) {
        carrinho.splice(indice, 1);
        renderizarCarrinho();
      }
    });
  }

  atualizarContadorGratis();
  atualizarVisibilidadeCampos();
  atualizarMiniatura();
  if (totalPedido) {
    totalPedido.textContent = `R$ ${formatarPreco(0)}`;
  }

  const carrinhoSalvo = carregarCarrinho();
  if (Array.isArray(carrinhoSalvo) && carrinhoSalvo.length) {
    carrinho.push(...carrinhoSalvo);
    renderizarCarrinho();
  }
}

const formularioAdmin = document.querySelector("#formulario-admin");
if (formularioAdmin) {
  void exigirSessaoAdmin();

  const botaoConfig = document.querySelector("#admin-toggle-config");
  const painelConfig = document.querySelector("#admin-configuracoes");
  if (botaoConfig && painelConfig) {
    const atualizarBotaoConfig = (aberto) => {
      botaoConfig.textContent = aberto
        ? "Ocultar configurações"
        : "Configurações";
      botaoConfig.setAttribute("aria-expanded", aberto ? "true" : "false");
    };

    atualizarBotaoConfig(false);

    botaoConfig.addEventListener("click", () => {
      const aberto = !painelConfig.classList.contains("oculto");
      const novoAberto = !aberto;
      painelConfig.classList.toggle("oculto", !novoAberto);
      atualizarBotaoConfig(novoAberto);
    });
  }

  const campos = {};
  const listaAdicionais = document.querySelector("#admin-adicionais-lista");
  const botaoAdicionarAdicional = document.querySelector(
    "#admin-adicionar-adicional"
  );
  const listaAdicionaisGarrafa = document.querySelector(
    "#admin-adicionais-garrafa-lista"
  );
  const botaoAdicionarAdicionalGarrafa = document.querySelector(
    "#admin-adicionar-adicional-garrafa"
  );
  const listaProdutos = document.querySelector("#admin-produtos-lista");
  const botaoAdicionarProduto = document.querySelector(
    "#admin-adicionar-produto"
  );
  const listaDestaques = document.querySelector("#admin-destaques-lista");
  const botaoAdicionarDestaque = document.querySelector(
    "#admin-adicionar-destaque"
  );
  const status = document.querySelector("#admin-status");
  const obterPrecoPadraoAdicional = () => obterConfig().adicionais.padrao;

  const preencherCampos = () => {
    const config = obterConfig();

    if (listaAdicionais) {
      listaAdicionais.innerHTML = "";
      const itens = Array.isArray(config.adicionais.itens)
        ? config.adicionais.itens
        : [];
      itens.forEach((item) => adicionarLinhaAdicional(item));
    }

    if (listaAdicionaisGarrafa) {
      listaAdicionaisGarrafa.innerHTML = "";
      const itens = Array.isArray(config.adicionais.garrafaItens)
        ? config.adicionais.garrafaItens
        : [];
      itens.forEach((item) => adicionarLinhaAdicionalGarrafa(item));
    }

    if (listaProdutos) {
      listaProdutos.innerHTML = "";
      const produtos = Array.isArray(config.produtos) ? config.produtos : [];
      produtos.forEach((produto) => adicionarLinhaProduto(produto));
    }

    if (listaDestaques) {
      listaDestaques.innerHTML = "";
      const destaquesLista = Array.isArray(config.destaques) ? config.destaques : [];
      destaquesLista.forEach((item) => adicionarLinhaDestaque(item));
    }
  };

  const lerNumero = (valor, fallback) => {
    const numero = Number.parseFloat(valor);
    return Number.isFinite(numero) ? numero : fallback;
  };

  const adicionarLinhaAdicional = (item = {}) => {
    if (!listaAdicionais) {
      return;
    }
    const linha = document.createElement("div");
    linha.classList.add("admin-adicional");

    const campoNome = document.createElement("input");
    campoNome.type = "text";
    campoNome.placeholder = "Nome do adicional";
    campoNome.value = item.nome || "";
    campoNome.classList.add("admin-adicional-nome");

    const campoPreco = document.createElement("input");
    campoPreco.type = "number";
    campoPreco.step = "0.01";
    campoPreco.placeholder = "Preco";
    campoPreco.value =
      typeof item.preco === "number" ? item.preco : obterPrecoPadraoAdicional();
    campoPreco.classList.add("admin-adicional-preco");

    const botaoRemover = document.createElement("button");
    botaoRemover.type = "button";
    botaoRemover.classList.add("botao-secundario");
    botaoRemover.textContent = "Remover";
    botaoRemover.addEventListener("click", () => {
      linha.remove();
    });

    linha.append(campoNome, campoPreco, botaoRemover);
    listaAdicionais.append(linha);
  };

  if (botaoAdicionarAdicional) {
    botaoAdicionarAdicional.addEventListener("click", () => {
      adicionarLinhaAdicional();
    });
  }

  const adicionarLinhaAdicionalGarrafa = (item = {}) => {
    if (!listaAdicionaisGarrafa) {
      return;
    }

    const linha = document.createElement("div");
    linha.classList.add("admin-adicional");

    const campoNome = document.createElement("input");
    campoNome.type = "text";
    campoNome.placeholder = "Nome do adicional";
    campoNome.value = item.nome || "";
    campoNome.classList.add("admin-adicional-garrafa-nome");

    const botaoRemover = document.createElement("button");
    botaoRemover.type = "button";
    botaoRemover.classList.add("botao-secundario");
    botaoRemover.textContent = "Remover";
    botaoRemover.addEventListener("click", () => {
      linha.remove();
    });

    linha.append(campoNome, botaoRemover);
    listaAdicionaisGarrafa.append(linha);
  };

  if (botaoAdicionarAdicionalGarrafa) {
    botaoAdicionarAdicionalGarrafa.addEventListener("click", () => {
      adicionarLinhaAdicionalGarrafa();
    });
  }

  const adicionarLinhaProduto = (item = {}) => {
    if (!listaProdutos) {
      return;
    }

    const linha = document.createElement("div");
    linha.classList.add("admin-produto");

    const colunaInfo = document.createElement("div");
    const nome = document.createElement("input");
    nome.type = "text";
    nome.placeholder = "Nome do produto";
    nome.value = item.nome || "";
    nome.classList.add("admin-produto-nome");

    const descricao = document.createElement("textarea");
    descricao.placeholder = "Descricao curta";
    descricao.value = item.descricao || "";
    descricao.classList.add("admin-produto-descricao");

    const extra = document.createElement("textarea");
    extra.placeholder = "Texto extra";
    extra.value = item.extra || "";
    extra.classList.add("admin-produto-extra");

    colunaInfo.append(nome, descricao, extra);

    const colunaMidia = document.createElement("div");
    const preco = document.createElement("input");
    preco.type = "number";
    preco.step = "0.01";
    preco.placeholder = "Preco";
    preco.value = Number.isFinite(item.preco) ? item.preco : 0;
    preco.classList.add("admin-produto-preco");

    const aviso = document.createElement("span");
    aviso.classList.add("campo-ajuda");
    aviso.textContent = "Recomendado 800x800, JPG/PNG";

    const upload = document.createElement("input");
    upload.type = "file";
    upload.accept = "image/png,image/jpeg";
    upload.dataset.adminProdutoUpload = "true";

    const imagem = document.createElement("input");
    imagem.type = "text";
    imagem.placeholder = "URL ou caminho";
    imagem.value = item.imagem || "";
    imagem.classList.add("admin-produto-imagem");

    colunaMidia.append(preco, aviso, upload, imagem);

    const botaoRemover = document.createElement("button");
    botaoRemover.type = "button";
    botaoRemover.classList.add("botao-secundario");
    botaoRemover.textContent = "Remover";
    botaoRemover.addEventListener("click", () => {
      linha.remove();
    });

    linha.append(colunaInfo, colunaMidia, botaoRemover);
    listaProdutos.append(linha);
  };

  if (botaoAdicionarProduto) {
    botaoAdicionarProduto.addEventListener("click", () => {
      adicionarLinhaProduto();
    });
  }

  const adicionarLinhaDestaque = (item = {}) => {
    if (!listaDestaques) {
      return;
    }

    const linha = document.createElement("div");
    linha.classList.add("admin-destaque");

    const colunaInfo = document.createElement("div");
    const titulo = document.createElement("input");
    titulo.type = "text";
    titulo.placeholder = "Titulo do destaque";
    titulo.value = item.titulo || "";
    titulo.classList.add("admin-destaque-titulo");

    const descricao = document.createElement("textarea");
    descricao.placeholder = "Descricao";
    descricao.value = item.texto || "";
    descricao.classList.add("admin-destaque-texto");

    colunaInfo.append(titulo, descricao);

    const colunaMidia = document.createElement("div");
    const imagem = document.createElement("input");
    imagem.type = "text";
    imagem.placeholder = "URL da imagem";
    imagem.value = item.imagem || "";
    imagem.classList.add("admin-destaque-imagem");

    const aviso = document.createElement("span");
    aviso.classList.add("campo-ajuda");
    aviso.textContent = "Recomendado 800x800, JPG/PNG";

    const upload = document.createElement("input");
    upload.type = "file";
    upload.accept = "image/*";
    upload.dataset.adminDestaqueUpload = "true";

    colunaMidia.append(imagem, aviso, upload);

    const botaoRemover = document.createElement("button");
    botaoRemover.type = "button";
    botaoRemover.classList.add("botao-secundario");
    botaoRemover.textContent = "Remover";
    botaoRemover.addEventListener("click", () => {
      linha.remove();
    });

    linha.append(colunaInfo, colunaMidia, botaoRemover);
    listaDestaques.append(linha);
  };

  if (botaoAdicionarDestaque) {
    botaoAdicionarDestaque.addEventListener("click", () => {
      adicionarLinhaDestaque();
    });
  }

  if (listaProdutos) {
    listaProdutos.addEventListener("change", (evento) => {
      const alvo = evento.target;
      if (!(alvo instanceof HTMLInputElement)) {
        return;
      }
      if (alvo.type !== "file") {
        return;
      }
      const arquivo = alvo.files?.[0];
      if (!arquivo) {
        return;
      }
      const container = alvo.closest(".admin-produto");
      const campoImagem = container?.querySelector(".admin-produto-imagem");
      if (!(campoImagem instanceof HTMLInputElement)) {
        return;
      }
      const leitor = new FileReader();
      leitor.addEventListener("load", () => {
        campoImagem.value = leitor.result;
        if (status) {
          status.textContent = "Imagem carregada. Clique em Salvar.";
        }
      });
      leitor.readAsDataURL(arquivo);
    });
  }

  if (listaDestaques) {
    listaDestaques.addEventListener("change", (evento) => {
      const alvo = evento.target;
      if (!(alvo instanceof HTMLInputElement)) {
        return;
      }
      if (alvo.type !== "file" || !alvo.dataset.adminDestaqueUpload) {
        return;
      }
      const arquivo = alvo.files?.[0];
      if (!arquivo) {
        return;
      }
      const container = alvo.closest(".admin-destaque");
      const campoImagem = container?.querySelector(".admin-destaque-imagem");
      if (!(campoImagem instanceof HTMLInputElement)) {
        return;
      }
      const leitor = new FileReader();
      leitor.addEventListener("load", () => {
        campoImagem.value = leitor.result;
        if (status) {
          status.textContent = "Imagem carregada. Clique em Salvar.";
        }
      });
      leitor.readAsDataURL(arquivo);
    });
  }

  formularioAdmin.addEventListener("submit", (evento) => {
    evento.preventDefault();
    const atual = obterConfig();

    if (listaAdicionais) {
      const linhas = Array.from(listaAdicionais.querySelectorAll(".admin-adicional"));
      atual.adicionais.itens = linhas
        .map((linha) => {
          const nome = linha.querySelector(".admin-adicional-nome")?.value.trim();
          const preco = lerNumero(
            linha.querySelector(".admin-adicional-preco")?.value,
            atual.adicionais.padrao
          );
          if (!nome) {
            return null;
          }
          return { nome, preco };
        })
        .filter(Boolean);
    }

    if (listaAdicionaisGarrafa) {
      const linhas = Array.from(
        listaAdicionaisGarrafa.querySelectorAll(".admin-adicional")
      );
      atual.adicionais.garrafaItens = linhas
        .map((linha) => {
          const nome = linha
            .querySelector(".admin-adicional-garrafa-nome")
            ?.value.trim();
          if (!nome) {
            return null;
          }
          return { nome };
        })
        .filter(Boolean);
    }

    if (listaProdutos) {
      const linhas = Array.from(listaProdutos.querySelectorAll(".admin-produto"));
      atual.produtos = linhas
        .map((linha) => {
          const nome = linha.querySelector(".admin-produto-nome")?.value.trim();
          if (!nome) {
            return null;
          }
          const descricao = linha
            .querySelector(".admin-produto-descricao")
            ?.value.trim();
          const extra = linha.querySelector(".admin-produto-extra")?.value.trim();
          const preco = lerNumero(
            linha.querySelector(".admin-produto-preco")?.value,
            0
          );
          const imagem = linha.querySelector(".admin-produto-imagem")?.value.trim();
          return {
            nome,
            descricao,
            extra,
            preco,
            imagem,
          };
        })
        .filter(Boolean);
    }

    if (listaDestaques) {
      const linhas = Array.from(listaDestaques.querySelectorAll(".admin-destaque"));
      atual.destaques = linhas
        .map((linha) => {
          const titulo = linha.querySelector(".admin-destaque-titulo")?.value.trim();
          const texto = linha.querySelector(".admin-destaque-texto")?.value.trim();
          const imagem = linha.querySelector(".admin-destaque-imagem")?.value.trim();
          if (!titulo || !imagem) {
            return null;
          }
          return {
            titulo,
            texto,
            imagem,
          };
        })
        .filter(Boolean);
    }

    storage.set(storageKeys.config, atual);
    void salvarConfigRemoto(atual);
    if (status) {
      status.textContent = "Configuracao salva.";
    }
  });

  preencherCampos();
}

const formularioAdminLogin = document.querySelector("#formulario-admin-login");
if (formularioAdminLogin) {
  const emailCampo = document.querySelector("#admin-email");
  const senhaCampo = document.querySelector("#admin-senha");
  const status = document.querySelector("#admin-login-status");

  void (async () => {
    const sessao = await obterSessaoAdmin();
    if (sessao) {
      window.location.href = "admin.html";
    }
  })();

  formularioAdminLogin.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const email = emailCampo?.value.trim() || "";
    const senha = senhaCampo.value.trim();

    if (!email || !senha) {
      if (status) {
        status.textContent = "Informe email e senha.";
      }
      return;
    }

    if (!supabaseClient?.auth) {
      if (status) {
        status.textContent = "Supabase indisponivel.";
      }
      return;
    }

    const { error } = await supabaseClient.auth.signInWithPassword({
      email,
      password: senha,
    });

    if (error) {
      if (status) {
        status.textContent = "Login ou senha incorretos.";
      }
      return;
    }

    window.location.href = "admin.html";
  });
}

function registrarBotoesCardapio() {
  botoesCardapio = Array.from(document.querySelectorAll(".botao-cardapio"));
  botoesCardapio.forEach((botao) => {
    botao.addEventListener("click", (evento) => {
      evento.preventDefault();

      const conteudoCardapio = botao.closest(".cardapio-conteudo");
      const textoExtra = conteudoCardapio?.querySelector(".cardapio-extra");

      if (!textoExtra) {
        return;
      }

      const estaVisivel = textoExtra.classList.toggle("visivel");
      textoExtra.setAttribute("aria-hidden", (!estaVisivel).toString());
      botao.classList.toggle("ativo", estaVisivel);
      botao.textContent = estaVisivel ? "Ver menos" : "Ver mais";
    });
  });
}

registrarBotoesCardapio();
registrarLogoutAdmin();
void garantirAnonimoEmPaginaPublica();

if (formularioCarrinho) {
  const listaCarrinhoFinal = document.querySelector("#lista-carrinho-final");
  const carrinhoVazioFinal = document.querySelector("#carrinho-vazio-final");
  const totalFinal = document.querySelector("#total-final");
  const modalRemocao = document.querySelector("#modal-remocao");
  const botaoCancelarRemocao = document.querySelector("#cancelar-remocao");
  const botaoConfirmarRemocao = document.querySelector("#confirmar-remocao");
  const checkboxWhatsApp = document.querySelector("#enviar-whatsapp");

  const carrinho = carregarCarrinho();
  let idRemocaoPendente = "";

  const abrirModalRemocao = (id) => {
    if (!modalRemocao) {
      return;
    }
    idRemocaoPendente = id;
    modalRemocao.classList.remove("oculto");
    modalRemocao.setAttribute("aria-hidden", "false");
  };

  const fecharModalRemocao = () => {
    if (!modalRemocao) {
      return;
    }
    idRemocaoPendente = "";
    modalRemocao.classList.add("oculto");
    modalRemocao.setAttribute("aria-hidden", "true");
  };

  const renderizarCarrinhoFinal = () => {
    if (!listaCarrinhoFinal || !carrinhoVazioFinal) {
      return;
    }

    listaCarrinhoFinal.innerHTML = "";
    carrinhoVazioFinal.classList.toggle("oculto", carrinho.length > 0);

    carrinho.forEach((item) => {
      const linha = document.createElement("li");
      linha.classList.add("item-carrinho");
      linha.dataset.itemId = item.id || "";

      const cabecalho = document.createElement("div");
      cabecalho.classList.add("item-carrinho-cabecalho");

      const titulo = document.createElement("p");
      const tamanhoLabel = item.tamanhoTigela || item.tamanho || "";
      titulo.textContent = `${item.tipo}${tamanhoLabel ? ` - ${tamanhoLabel}` : ""}`;

      const botaoRemover = document.createElement("button");
      botaoRemover.type = "button";
      botaoRemover.classList.add("botao-remover");
      botaoRemover.textContent = "Remover";
      botaoRemover.dataset.removerId = item.id || "";

      cabecalho.append(titulo, botaoRemover);

      const detalhes = document.createElement("div");
      detalhes.classList.add("item-carrinho-detalhes");

      if (item.trufada) {
        const trufada = document.createElement("p");
        trufada.textContent = `Trufada: ${item.trufada}`;
        detalhes.append(trufada);
      }

      if (item.gratis?.length) {
        const gratis = document.createElement("p");
        gratis.textContent = `Grátis: ${item.gratis.join(", ")}`;
        detalhes.append(gratis);
      }

      if (item.adicionais?.length) {
        const adicionais = document.createElement("p");
        adicionais.textContent = `Adicionais: ${item.adicionais.join(", ")}`;
        detalhes.append(adicionais);
      }

      if (item.adicionaisGarrafa?.length) {
        const adicionaisGarrafa = document.createElement("p");
        adicionaisGarrafa.textContent = `Adicional grátis: ${item.adicionaisGarrafa.join(
          ", "
        )}`;
        detalhes.append(adicionaisGarrafa);
      }

      if (item.adicionaisGarrafaExtra?.length) {
        const adicionaisExtra = document.createElement("p");
        adicionaisExtra.textContent = `Adicionais R$ 2,50: ${item.adicionaisGarrafaExtra.join(
          ", "
        )}`;
        detalhes.append(adicionaisExtra);
      }

      if (item.observacoes) {
        const observacao = document.createElement("p");
        observacao.textContent = `Obs: ${item.observacoes}`;
        detalhes.append(observacao);
      }

      linha.append(cabecalho, detalhes);
      listaCarrinhoFinal.append(linha);
    });

    if (totalFinal) {
      const totalCarrinho = carrinho.reduce(
        (soma, item) => soma + (item.total || 0),
        0
      );
      totalFinal.textContent = `R$ ${totalCarrinho.toFixed(2).replace(".", ",")}`;
    }
  };

  renderizarCarrinhoFinal();

  if (listaCarrinhoFinal) {
    listaCarrinhoFinal.addEventListener("click", (evento) => {
      const alvo = evento.target;
      if (!(alvo instanceof HTMLButtonElement)) {
        return;
      }
      const id = alvo.dataset.removerId;
      if (!id) {
        return;
      }
      abrirModalRemocao(id);
    });
  }

  if (botaoCancelarRemocao) {
    botaoCancelarRemocao.addEventListener("click", () => {
      fecharModalRemocao();
    });
  }

  if (botaoConfirmarRemocao) {
    botaoConfirmarRemocao.addEventListener("click", () => {
      if (!idRemocaoPendente) {
        fecharModalRemocao();
        return;
      }
      const indice = carrinho.findIndex((item) => item.id === idRemocaoPendente);
      if (indice >= 0) {
        carrinho.splice(indice, 1);
        salvarCarrinho(carrinho);
        renderizarCarrinhoFinal();
      }
      fecharModalRemocao();
    });
  }

  if (modalRemocao) {
    modalRemocao.addEventListener("click", (evento) => {
      if (evento.target === modalRemocao) {
        fecharModalRemocao();
      }
    });
  }

  const normalizarTelefone = (texto) => texto.replace(/\D/g, "");

  formularioCarrinho.addEventListener("submit", async (evento) => {
    evento.preventDefault();

    if (!carrinho.length) {
      alert("Adicione itens no pedido antes de finalizar.");
      return;
    }

    const nomeCliente = document.querySelector("#nome-cliente")?.value.trim();
    const telefoneCliente = document.querySelector("#telefone-cliente")?.value.trim();
    const enderecoCliente = document.querySelector("#endereco-cliente")?.value.trim();
    const referenciaCliente = document.querySelector("#referencia-cliente")?.value.trim();
    const pagamentoCliente = document.querySelector("#pagamento-cliente")?.value.trim();
    const descricaoPedido = document.querySelector("#descricao-pedido")?.value.trim();

    const telefoneCodigo = normalizarTelefone(telefoneCliente || "");
    if (!telefoneCodigo) {
      alert("Informe um telefone valido para acompanhar o pedido.");
      return;
    }

    const totalCarrinho = carrinho.reduce(
      (soma, item) => soma + (item.total || 0),
      0
    );

    const codigoPedido = telefoneCodigo;
    const sequenciaAtual = await obterSequenciaPedido();
    const senhaPedido = String(sequenciaAtual).padStart(4, "0");

    const linhasMensagem = [
      "*Pedido AçaiHouse*",
      `*Senha do pedido:* ${senhaPedido}`,
      `Telefone: ${telefoneCliente || "-"}`,
      "--------------------",
      `*Nome:* ${nomeCliente || "-"}`,
      `*Telefone:* ${telefoneCliente || "-"}`,
      `*Endereço:* ${enderecoCliente || "-"}`,
      `*Referência:* ${referenciaCliente || "-"}`,
      `*Pagamento:* ${pagamentoCliente || "-"}`,
      `*Descrição:* ${descricaoPedido || "-"}`,
      "--------------------",
      "*Itens:*",
    ];

    carrinho.forEach((item, index) => {
      const tamanhoLabel = item.tamanhoTigela || item.tamanho || "";
      linhasMensagem.push(
        `${index + 1}) ${item.tipo}${tamanhoLabel ? ` - ${tamanhoLabel}` : ""}`
      );
      if (item.trufada) {
        linhasMensagem.push(`   Trufada: ${item.trufada}`);
      }
      if (item.gratis?.length) {
        linhasMensagem.push(`   Grátis: ${item.gratis.join(", ")}`);
      }
      if (item.adicionais?.length) {
        linhasMensagem.push(`   Adicionais: ${item.adicionais.join(", ")}`);
      }
      if (item.adicionaisGarrafa?.length) {
        linhasMensagem.push(
          `   Adicional grátis: ${item.adicionaisGarrafa.join(", ")}`
        );
      }
      if (item.adicionaisGarrafaExtra?.length) {
        linhasMensagem.push(
          `   Adicionais R$ 2,50: ${item.adicionaisGarrafaExtra.join(", ")}`
        );
      }
      if (item.observacoes) {
        linhasMensagem.push(`   Obs: ${item.observacoes}`);
      }
      if (item.total) {
        linhasMensagem.push(
          `   Subtotal: R$ ${item.total.toFixed(2).replace(".", ",")}`
        );
      }
    });

    linhasMensagem.push("--------------------");
    linhasMensagem.push(
      `Total do pedido: R$ ${totalCarrinho.toFixed(2).replace(".", ",")}`
    );

    const pedidosSalvos = await carregarPedidos();
    pedidosSalvos.unshift({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      codigo: codigoPedido,
      senha: senhaPedido,
      data: new Date().toISOString(),
      cliente: {
        nome: nomeCliente || "-",
        telefone: telefoneCliente || "-",
        endereco: enderecoCliente || "-",
        referencia: referenciaCliente || "-",
        pagamento: pagamentoCliente || "-",
        descricao: descricaoPedido || "-",
      },
      itens: carrinho.map((item) => ({ ...item })),
      total: totalCarrinho,
      status: "novo",
    });
    await salvarPedidos(pedidosSalvos);

    if (checkboxWhatsApp?.checked) {
      const mensagem = encodeURIComponent(linhasMensagem.join("\n"));
      const linkWhatsApp = `https://wa.me/${numeroWhatsApp}?text=${mensagem}`;
      window.open(linkWhatsApp, "_blank", "noopener");
    }
    carrinho.length = 0;
    salvarCarrinho(carrinho);
    renderizarCarrinhoFinal();
    formularioCarrinho.reset();
    localStorage.setItem("acai_ultimo_pedido", codigoPedido);
    window.location.href = "acompanhamento.html";
  });
}

const painelPedidos = document.querySelector("#lista-pedidos-admin");
const avisoPedidosVazio = document.querySelector("#pedidos-vazio");
if (painelPedidos) {
  void exigirSessaoAdmin();
  const botaoFecharDia = document.querySelector("#fechar-dia");
  const botaoSom = document.querySelector("#ativar-som");
  const pedidosConhecidos = new Set();
  let primeiraCarga = true;
  let somHabilitado = false;
  let contextoAudio = null;
  let somAtivo = storage.get(storageKeys.somAdmin, true);
  const campainha = new Audio(
    "data:audio/wav;base64,UklGRl4AAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YToAAAAA/////wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A"
  );

  const habilitarSom = () => {
    if (somHabilitado) {
      return;
    }
    try {
      contextoAudio = new (window.AudioContext || window.webkitAudioContext)();
      if (contextoAudio.state === "suspended") {
        contextoAudio.resume();
      }
    } catch (erro) {
      contextoAudio = null;
    }
    campainha.volume = 0;
    campainha
      .play()
      .then(() => {
        campainha.pause();
        campainha.currentTime = 0;
        campainha.volume = 0.6;
        somHabilitado = true;
      })
      .catch(() => {
        if (contextoAudio) {
          somHabilitado = true;
        }
      });
  };

  const tocarAviso = () => {
    if (!somHabilitado || !somAtivo) {
      return;
    }
    const tocarOscilador = () => {
      if (!contextoAudio) {
        return;
      }
      const agora = contextoAudio.currentTime;
      const ganho = contextoAudio.createGain();
      ganho.gain.setValueAtTime(0, agora);
      ganho.gain.linearRampToValueAtTime(0.12, agora + 0.02);
      ganho.gain.exponentialRampToValueAtTime(0.0001, agora + 0.8);

      const oscilador1 = contextoAudio.createOscillator();
      oscilador1.type = "sine";
      oscilador1.frequency.setValueAtTime(880, agora);
      oscilador1.frequency.exponentialRampToValueAtTime(660, agora + 0.7);

      const oscilador2 = contextoAudio.createOscillator();
      oscilador2.type = "triangle";
      oscilador2.frequency.setValueAtTime(1320, agora);
      oscilador2.frequency.exponentialRampToValueAtTime(990, agora + 0.7);

      oscilador1.connect(ganho);
      oscilador2.connect(ganho);
      ganho.connect(contextoAudio.destination);

      oscilador1.start(agora);
      oscilador2.start(agora);
      oscilador1.stop(agora + 0.9);
      oscilador2.stop(agora + 0.9);
    };

    campainha.currentTime = 0;
    campainha.volume = 0.6;
    campainha.play().catch(() => {
      tocarOscilador();
    });
  };

  const atualizarBotaoSom = () => {
    if (!botaoSom) {
      return;
    }
    botaoSom.textContent = somAtivo ? "Desativar som" : "Ativar som";
  };

  const tentarHabilitarSom = () => {
    if (!somAtivo) {
      return;
    }
    habilitarSom();
  };

  if (botaoSom) {
    atualizarBotaoSom();
    botaoSom.addEventListener("click", () => {
      somAtivo = !somAtivo;
      storage.set(storageKeys.somAdmin, somAtivo);
      atualizarBotaoSom();
      if (somAtivo) {
        tentarHabilitarSom();
        tocarAviso();
      }
    });
  }

  tentarHabilitarSom();
  if (somAtivo) {
    window.addEventListener("click", tentarHabilitarSom, { once: true });
  }

  const formatarData = (iso) => {
    if (!iso) {
      return "-";
    }
    const data = new Date(iso);
    if (Number.isNaN(data.getTime())) {
      return iso;
    }
    return data.toLocaleString("pt-BR");
  };

  const formatarPreco = (valor) =>
    `R$ ${Number(valor || 0).toFixed(2).replace(".", ",")}`;

  const obterDia = (dataIso) => {
    const data = new Date(dataIso);
    if (Number.isNaN(data.getTime())) {
      return "";
    }
    const ano = data.getFullYear();
    const mes = `${data.getMonth() + 1}`.padStart(2, "0");
    const dia = `${data.getDate()}`.padStart(2, "0");
    return `${ano}-${mes}-${dia}`;
  };

  const statusFinal = (status) =>
    status === "entregue" || status === "finalizado" || status === "cancelado";

  const migrarParaHistorico = async () => {
    const pedidos = await carregarPedidos();
    const historico = await carregarHistorico();
    const historicoIds = new Set(historico.map((pedido) => pedido.id));
    const ativos = [];

    pedidos.forEach((pedido) => {
      const statusAtual = pedido.status || "novo";
      if (statusFinal(statusAtual)) {
        if (!pedido.id || !historicoIds.has(pedido.id)) {
          historico.unshift({ ...pedido });
        }
      } else {
        ativos.push(pedido);
      }
    });

    if (supabaseClient) {
      salvarPedidosLocal(pedidos);
    } else {
      await salvarPedidos(ativos);
    }
    await salvarHistorico(historico);
    return ativos;
  };

  const renderizarPedidos = async () => {
    const pedidos = await migrarParaHistorico();
    painelPedidos.innerHTML = "";
    if (avisoPedidosVazio) {
      avisoPedidosVazio.classList.toggle("oculto", pedidos.length > 0);
    }

    const idsAtuais = new Set(pedidos.map((pedido) => pedido.id));
    if (!primeiraCarga) {
      const novos = pedidos.filter((pedido) => !pedidosConhecidos.has(pedido.id));
      const novosEmAberto = novos.filter((pedido) => (pedido.status || "novo") === "novo");
      if (novos.length) {
        tocarAviso();
      }
      if (novosEmAberto.length) {
        const quantidade = novosEmAberto.length;
        alert(
          quantidade === 1
            ? "Novo pedido recebido."
            : `Chegaram ${quantidade} pedidos novos.`
        );
      }
    }
    pedidosConhecidos.clear();
    idsAtuais.forEach((id) => pedidosConhecidos.add(id));
    primeiraCarga = false;

    pedidos.forEach((pedido) => {
      const card = document.createElement("div");
      card.classList.add("pedido-admin");
      const statusAtual = pedido.status || "novo";
      if (statusAtual === "cancelado") {
        card.classList.add("pedido-admin--vermelho");
      } else if (statusAtual === "aceito" || statusAtual === "preparando") {
        card.classList.add("pedido-admin--amarelo");
      } else if (
        statusAtual === "saiu para entrega" ||
        statusAtual === "entregue" ||
        statusAtual === "finalizado"
      ) {
        card.classList.add("pedido-admin--verde");
      } else {
        card.classList.add("pedido-admin--novo");
      }
      card.dataset.pedidoId = pedido.id;

      const cabecalho = document.createElement("div");
      cabecalho.classList.add("pedido-admin-cabecalho");

      const titulo = document.createElement("span");
      const senhaLabel = pedido.senha
        ? `Senha ${pedido.senha}`
        : pedido.codigo || pedido.id?.slice(-6) || "";
      titulo.textContent = `Pedido ${senhaLabel}`;

      const status = document.createElement("span");
      status.classList.add("pedido-admin-status");
      status.textContent = statusAtual;

      cabecalho.append(titulo, status);

      const info = document.createElement("div");
      info.classList.add("pedido-admin-info");
      info.innerHTML = `
        <span>Data: ${formatarData(pedido.data)}</span>
        <span>Senha: ${pedido.senha || "-"}</span>
        <span>Telefone: ${pedido.codigo || "-"}</span>
        <span>Cliente: ${pedido.cliente?.nome || "-"}</span>
        <span>Telefone cliente: ${pedido.cliente?.telefone || "-"}</span>
        <span>Endereco: ${pedido.cliente?.endereco || "-"}</span>
        <span>Referencia: ${pedido.cliente?.referencia || "-"}</span>
        <span>Pagamento: ${pedido.cliente?.pagamento || "-"}</span>
        <span>Descricao: ${pedido.cliente?.descricao || "-"}</span>
        <span>Total: ${formatarPreco(pedido.total)}</span>
      `;

      const itens = document.createElement("div");
      itens.classList.add("pedido-admin-info");
      const itensTexto = (pedido.itens || []).map((item) => {
        const tamanhoLabel = item.tamanhoTigela || item.tamanho || "";
        const base = `${item.tipo}${tamanhoLabel ? ` - ${tamanhoLabel}` : ""}`;
        const extras = [];
        if (item.trufada) {
          extras.push(`Trufada: ${item.trufada}`);
        }
        if (item.gratis?.length) {
          extras.push(`Gratis: ${item.gratis.join(", ")}`);
        }
        if (item.adicionais?.length) {
          extras.push(
            `Adicionais: <span class="tag-pago">${item.adicionais.join(", ")}</span>`
          );
        }
        if (item.adicionaisGarrafa?.length) {
          extras.push(`Adicional gratis: ${item.adicionaisGarrafa.join(", ")}`);
        }
        if (item.adicionaisGarrafaExtra?.length) {
          extras.push(
            `Adicionais extra: <span class="tag-pago">${item.adicionaisGarrafaExtra.join(
              ", "
            )}</span>`
          );
        }
        return extras.length ? `${base} (${extras.join(" | ")})` : base;
      });
      itensTexto.forEach((linha) => {
        const span = document.createElement("span");
        span.innerHTML = linha;
        itens.append(span);
      });

      const acoes = document.createElement("div");
      acoes.classList.add("pedido-admin-acoes");

      const seletor = document.createElement("select");
      seletor.classList.add("botao-secundario");
      seletor.innerHTML = [
        "novo",
        "aceito",
        "preparando",
        "saiu para entrega",
        "entregue",
        "cancelado",
      ]
        .map(
          (status) =>
            `<option value="${status}"${
              status === pedido.status ? " selected" : ""
            }>${status}</option>`
        )
        .join("");

      acoes.append(seletor);

      card.append(cabecalho, info, itens, acoes);
      painelPedidos.append(card);
    });
  };

  painelPedidos.addEventListener("change", async (evento) => {
    const alvo = evento.target;
    if (!(alvo instanceof HTMLSelectElement)) {
      return;
    }
    const card = alvo.closest(".pedido-admin");
    const id = card?.dataset.pedidoId;
    if (!id) {
      return;
    }
    const status = alvo.value;
    const pedidos = await carregarPedidos();
    const pedido = pedidos.find((item) => item.id === id);
    if (!pedido) {
      return;
    }
    pedido.status = status;
    await salvarPedidos(pedidos);
    renderizarPedidos();
  });

  renderizarPedidos();
  setInterval(() => {
    renderizarPedidos();
  }, 5000);

  if (botaoFecharDia) {
    botaoFecharDia.addEventListener("click", async () => {
      const historico = await carregarHistorico();
      const fechamentos = await carregarFechamentos();
      const hoje = obterDia(new Date().toISOString());
      const pedidosDia = historico.filter(
        (pedido) => obterDia(pedido.data) === hoje && !pedido.fechado_em
      );
      if (!pedidosDia.length) {
        alert("Nenhum pedido para fechar hoje.");
        return;
      }
      const totalDia = pedidosDia
        .filter((pedido) => pedido.status !== "cancelado")
        .reduce((soma, pedido) => soma + Number(pedido.total || 0), 0);

      fechamentos.unshift({
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        data: hoje,
        total: totalDia,
        quantidade: pedidosDia.length,
      });
      pedidosDia.forEach((pedido) => {
        pedido.fechado_em = hoje;
      });
      await salvarHistorico(historico);
      await salvarFechamentos(fechamentos);
      alert("Fechamento do dia salvo.");
    });
  }
}

const painelAcompanhamento = document.querySelector("#painel-acompanhamento");
if (painelAcompanhamento) {
  const inputCodigo = document.querySelector("#acompanhamento-codigo");
  const botaoBuscar = document.querySelector("#acompanhamento-buscar");
  const resultado = document.querySelector("#acompanhamento-resultado");
  const chipStatus = document.querySelector("#acompanhamento-status");
  const ultimo = localStorage.getItem("acai_ultimo_pedido");
  if (inputCodigo && ultimo) {
    inputCodigo.value = ultimo;
  }

  const classeStatus = (status) => {
    if (!status) {
      return "status-chip--novo";
    }
    if (status === "aceito" || status === "preparando") {
      return "status-chip--preparando";
    }
    if (
      status === "saiu para entrega" ||
      status === "entregue" ||
      status === "finalizado"
    ) {
      return "status-chip--entregue";
    }
    if (status === "cancelado") {
      return "status-chip--cancelado";
    }
    return "status-chip--novo";
  };

  const atualizarChip = (status) => {
    if (!chipStatus) {
      return;
    }
    chipStatus.className = `status-chip ${classeStatus(status)}`;
    chipStatus.textContent = `Status: ${status || "-"}`;
  };

  const buscarPedido = async () => {
    const codigoBruto = inputCodigo?.value.trim();
    if (!codigoBruto || !resultado) {
      return;
    }
    const codigo = codigoBruto.replace(/\D/g, "");
    let pedido = null;
    if (!paginaAdmin()) {
      pedido = await buscarStatusPedidoPublico(codigo);
    } else {
      const pedidos = await carregarPedidos();
      pedido = pedidos.find((item) => item.codigo === codigo);
    }
    if (!pedido) {
      resultado.textContent = "Pedido não encontrado.";
      atualizarChip("");
      return;
    }
    resultado.textContent = `Status: ${pedido.status}`;
    atualizarChip(pedido.status);
  };

  if (botaoBuscar) {
    botaoBuscar.addEventListener("click", (evento) => {
      evento.preventDefault();
      buscarPedido();
    });
  }

  setInterval(() => {
    if (inputCodigo?.value.trim()) {
      buscarPedido();
    }
  }, 5000);
}

const relatorioResumo = document.querySelector("#relatorio-resumo");
if (relatorioResumo) {
  void exigirSessaoAdmin();
  const relatorioPagamentos = document.querySelector("#relatorio-pagamentos");
  const relatorioItem = document.querySelector("#relatorio-item-mais-vendido");
  const relatorioPedidos = document.querySelector("#relatorio-pedidos");
  const relatorioFechamentos = document.querySelector("#relatorio-fechamentos");
  const filtroAno = document.querySelector("#relatorio-filtro-ano");
  const filtroMes = document.querySelector("#relatorio-filtro-mes");
  const filtroInicio = document.querySelector("#relatorio-filtro-inicio");
  const filtroFim = document.querySelector("#relatorio-filtro-fim");
  const botaoFiltrar = document.querySelector("#relatorio-filtrar");

  const formatarPreco = (valor) =>
    `R$ ${Number(valor || 0).toFixed(2).replace(".", ",")}`;

  const agruparPorMes = (lista) => {
    return lista.reduce((acc, item) => {
      const data = new Date(item.data);
      if (Number.isNaN(data.getTime())) {
        return acc;
      }
      const chave = `${data.getFullYear()}-${`${data.getMonth() + 1}`.padStart(
        2,
        "0"
      )}`;
      if (!acc[chave]) {
        acc[chave] = [];
      }
      acc[chave].push(item);
      return acc;
    }, {});
  };

  const obterAnoMes = (dataIso) => {
    const data = new Date(dataIso);
    if (Number.isNaN(data.getTime())) {
      return { ano: "", mes: "" };
    }
    return {
      ano: `${data.getFullYear()}`,
      mes: `${data.getMonth() + 1}`.padStart(2, "0"),
    };
  };

  const preencherFiltros = (historico, fechamentos) => {
    if (!filtroAno || !filtroMes) {
      return;
    }
    const anos = new Set();
    const meses = new Set();
    historico.forEach((pedido) => {
      const { ano, mes } = obterAnoMes(pedido.data);
      if (ano) {
        anos.add(ano);
      }
      if (mes) {
        meses.add(mes);
      }
    });
    fechamentos.forEach((fechamento) => {
      const { ano, mes } = obterAnoMes(fechamento.data);
      if (ano) {
        anos.add(ano);
      }
      if (mes) {
        meses.add(mes);
      }
    });

    const anoSelecionado = filtroAno.value || "todos";
    const mesSelecionado = filtroMes.value || "todos";

    filtroAno.innerHTML = ['<option value="todos">Todos</option>']
      .concat(Array.from(anos).sort().map((ano) => `<option value="${ano}">${ano}</option>`))
      .join("");
    filtroMes.innerHTML = ['<option value="todos">Todos</option>']
      .concat(Array.from(meses).sort().map((mes) => `<option value="${mes}">${mes}</option>`))
      .join("");

    filtroAno.value = anoSelecionado;
    filtroMes.value = mesSelecionado;
  };

  const filtrarPorPeriodo = (lista, anoSelecionado, mesSelecionado) => {
    return lista.filter((item) => {
      const { ano, mes } = obterAnoMes(item.data);
      if (anoSelecionado !== "todos" && ano !== anoSelecionado) {
        return false;
      }
      if (mesSelecionado !== "todos" && mes !== mesSelecionado) {
        return false;
      }
      return true;
    });
  };

  const filtrarPorData = (lista, inicio, fim) => {
    if (!inicio && !fim) {
      return lista;
    }
    const inicioData = inicio ? new Date(`${inicio}T00:00:00`) : null;
    const fimData = fim ? new Date(`${fim}T23:59:59`) : null;
    return lista.filter((item) => {
      const data = new Date(item.data);
      if (Number.isNaN(data.getTime())) {
        return false;
      }
      if (inicioData && data < inicioData) {
        return false;
      }
      if (fimData && data > fimData) {
        return false;
      }
      return true;
    });
  };

  const normalizarPagamento = (texto) => {
    const valor = (texto || "").toLowerCase();
    if (valor.includes("dinheiro")) {
      return "Dinheiro";
    }
    if (valor.includes("pix")) {
      return "Pix";
    }
    if (valor.includes("débito") || valor.includes("debito")) {
      return "Debito";
    }
    if (valor.includes("crédito") || valor.includes("credito")) {
      return "Credito";
    }
    return "Outro";
  };

  const resumoItens = (pedidos) => {
    const contagem = {};
    pedidos.forEach((pedido) => {
      (pedido.itens || []).forEach((item) => {
        const tamanhoLabel = item.tamanhoTigela || item.tamanho || "";
        const chave = `${item.tipo}${tamanhoLabel ? ` - ${tamanhoLabel}` : ""}`;
        contagem[chave] = (contagem[chave] || 0) + 1;
      });
    });
    const ordenado = Object.entries(contagem).sort((a, b) => b[1] - a[1]);
    return ordenado[0] || null;
  };

  const renderizarRelatorio = async (usarDatas = false) => {
    const historico = await carregarHistorico();
    const fechamentos = await carregarFechamentos();
    preencherFiltros(historico, fechamentos);

    const anoSelecionado = filtroAno?.value || "todos";
    const mesSelecionado = filtroMes?.value || "todos";
    let historicoFiltrado = filtrarPorPeriodo(
      historico,
      anoSelecionado,
      mesSelecionado
    );
    let fechamentosFiltrados = filtrarPorPeriodo(
      fechamentos,
      anoSelecionado,
      mesSelecionado
    );
    if (usarDatas) {
      historicoFiltrado = filtrarPorData(
        historicoFiltrado,
        filtroInicio?.value,
        filtroFim?.value
      );
      fechamentosFiltrados = filtrarPorData(
        fechamentosFiltrados,
        filtroInicio?.value,
        filtroFim?.value
      );
    }

    const pedidosValidos = historicoFiltrado.filter(
      (pedido) => pedido.status !== "cancelado"
    );

    const totalPedidos = pedidosValidos.length;
    const totalVendas = pedidosValidos.reduce(
      (soma, pedido) => soma + Number(pedido.total || 0),
      0
    );

    const pagamentos = {
      Dinheiro: 0,
      Pix: 0,
      Debito: 0,
      Credito: 0,
      Outro: 0,
    };

    pedidosValidos.forEach((pedido) => {
      const metodo = normalizarPagamento(pedido.cliente?.pagamento || "");
      pagamentos[metodo] += Number(pedido.total || 0);
    });

    if (relatorioResumo) {
      relatorioResumo.innerHTML = `
        <div class="historico-card">
          <strong>Total de pedidos</strong>
          <span>${totalPedidos}</span>
        </div>
        <div class="historico-card">
          <strong>Total vendido</strong>
          <span>${formatarPreco(totalVendas)}</span>
        </div>
      `;
    }

    if (relatorioPagamentos) {
      relatorioPagamentos.innerHTML = Object.entries(pagamentos)
        .map(
          ([metodo, valor]) => `
          <div class="historico-card">
            <strong>${metodo}</strong>
            <span>${formatarPreco(valor)}</span>
          </div>
        `
        )
        .join("");
    }

    const maisVendido = resumoItens(pedidosValidos);
    if (relatorioItem) {
      relatorioItem.innerHTML = `
        <div class="historico-card">
          <strong>Item mais vendido</strong>
          <span>${maisVendido ? maisVendido[0] : "-"}</span>
          <span>Quantidade: ${maisVendido ? maisVendido[1] : 0}</span>
        </div>
      `;
    }

    if (relatorioPedidos) {
      relatorioPedidos.innerHTML = "";
      const grupos = agruparPorMes(historicoFiltrado);
      Object.keys(grupos)
        .sort()
        .reverse()
        .forEach((mes) => {
          const titulo = document.createElement("h3");
          titulo.classList.add("pedido-subtitulo");
          titulo.textContent = `Mes ${mes}`;
          relatorioPedidos.append(titulo);
          grupos[mes].forEach((pedido) => {
            const card = document.createElement("div");
            card.classList.add("historico-card");
            const itensTexto = (pedido.itens || []).map((item) => {
              const tamanhoLabel = item.tamanhoTigela || item.tamanho || "";
              const base = `${item.tipo}${tamanhoLabel ? ` - ${tamanhoLabel}` : ""}`;
              const extras = [];
              if (item.trufada) {
                extras.push(`Trufada: ${item.trufada}`);
              }
              if (item.gratis?.length) {
                extras.push(`Gratis: ${item.gratis.join(", ")}`);
              }
              if (item.adicionais?.length) {
                extras.push(`Adicionais: ${item.adicionais.join(", ")}`);
              }
              if (item.adicionaisGarrafa?.length) {
                extras.push(`Adicional gratis: ${item.adicionaisGarrafa.join(", ")}`);
              }
              if (item.adicionaisGarrafaExtra?.length) {
                extras.push(
                  `Adicionais extra: ${item.adicionaisGarrafaExtra.join(", ")}`
                );
              }
              if (item.observacoes) {
                extras.push(`Obs: ${item.observacoes}`);
              }
              return extras.length ? `${base} (${extras.join(" | ")})` : base;
            });
            card.innerHTML = `
              <strong>Pedido ${pedido.codigo || "-"}</strong>
              <span>Data: ${pedido.data ? new Date(pedido.data).toLocaleString("pt-BR") : "-"}</span>
              <span>Status: ${pedido.status || "-"}</span>
              <span>Cliente: ${pedido.cliente?.nome || "-"}</span>
              <span>Telefone: ${pedido.cliente?.telefone || "-"}</span>
              <span>Total: ${formatarPreco(pedido.total)}</span>
              <span>Itens: ${itensTexto.join(" | ") || "-"}</span>
            `;
            relatorioPedidos.append(card);
          });
        });
    }

    if (relatorioFechamentos) {
      relatorioFechamentos.innerHTML = "";
      const grupos = agruparPorMes(fechamentosFiltrados);
      Object.keys(grupos)
        .sort()
        .reverse()
        .forEach((mes) => {
          const titulo = document.createElement("h3");
          titulo.classList.add("pedido-subtitulo");
          titulo.textContent = `Mes ${mes}`;
          relatorioFechamentos.append(titulo);
          grupos[mes].forEach((fechamento) => {
            const card = document.createElement("div");
            card.classList.add("historico-card");
            card.innerHTML = `
              <strong>Fechamento ${fechamento.data}</strong>
              <span>Pedidos: ${fechamento.quantidade}</span>
              <span>Total: ${formatarPreco(fechamento.total)}</span>
            `;
            relatorioFechamentos.append(card);
          });
        });
    }
  };

  void renderizarRelatorio();

  if (filtroAno) {
    filtroAno.addEventListener("change", () => {
      void renderizarRelatorio();
    });
  }
  if (filtroMes) {
    filtroMes.addEventListener("change", () => {
      void renderizarRelatorio();
    });
  }
  if (botaoFiltrar) {
    botaoFiltrar.addEventListener("click", () => {
      void renderizarRelatorio(true);
    });
  }
}
