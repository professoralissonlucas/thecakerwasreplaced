// Todos os textos da interface (SPEC §9.3). Nomes e descrições de produtos, unlocks e melhorias
// ficam nos JSON de src/data/; aqui ficam botões, avisos, mensagens engraçadas e rótulos.

export const ICONES = {
  robo: '🤖',
  moeda: '🪙',
  ticks: '⏱',
  chama: '🔥',
  fumaca: '💨',
  aviso: '⚠️',
  erro: '❌',
  produtoDesconhecido: '❓',
  cru: '🤢',
  lixo: '🗑️',
  produtos: { pao: '🍞', biscoito: '🍪', bolo: '🎂' } as Record<string, string>,
  /** Ícone de cada tipo de linha da lousa. */
  linhas: { info: '✨', venda: '🪙', perda: '🗑️', aviso: '⚠️', erro: '❌', dizer: '💬' },
  trancado: '🔒',
  parado: '⏳',
  proibido: '🚫',
  executar: '▶',
  parar: '⏹',
  devagar: '🐢',
  rapido: '🐇',
  setas: { Norte: '▲', Sul: '▼', Leste: '▶', Oeste: '◀' },
};

const moedas = (n: number) => `${n} ${Math.abs(n) === 1 ? 'moeda' : 'moedas'}`;
const pos = (x: number, y: number) => `(${x}, ${y})`;

/** Escolhe uma variação de forma determinística (o mesmo tick dá sempre a mesma frase). */
const variar = (opcoes: string[], semente: number) => opcoes[Math.abs(semente) % opcoes.length]!;

export const TEXTOS = {
  titulo: 'Confeitaria do Robô',

  topo: {
    moedas: (n: number) => (n === 1 ? 'moeda' : 'moedas'),
    ticks: (n: number) => (n === 1 ? 'tick' : 'ticks'),
    rotuloMoedas: (n: number) => `Saldo: ${moedas(n)}`,
    rotuloTicks: (n: number) => `Tempo: ${n} ${n === 1 ? 'tick' : 'ticks'}`,
  },

  cozinha: {
    titulo: 'Cozinha',
    rotulo: (largura: number, altura: number) => `Cozinha ${largura}×${altura}`,
    posicaoRobo: (x: number, y: number) => `Robô na posição ${pos(x, y)}`,
    coordenada: (x: number, y: number) => `${x},${y}`,
    forno: {
      vazio: (x: number, y: number) => `Forno ${pos(x, y)}: vazio`,
      assando: (x: number, y: number, nome: string, pct: number) => `Forno ${pos(x, y)}: ${nome} assando, ${pct}%`,
      pronto: (x: number, y: number, nome: string) => `Forno ${pos(x, y)}: ${nome} pronto`,
      prontoQuaseQueimando: (x: number, y: number, nome: string) => `Forno ${pos(x, y)}: ${nome} pronto, quase queimando`,
      queimado: (x: number, y: number, nome: string) => `Forno ${pos(x, y)}: ${nome} queimado`,
    },
  },

  console: {
    titulo: 'Lousa',
    vazio: 'Nada escrito ainda. O que o robô fizer aparece aqui.',
    apagar: 'Apagar lousa',
  },

  eventos: {
    vendeu: (nome: string, valor: number, x: number, y: number) => `${nome} vendido em ${pos(x, y)}: +${moedas(valor)}`,
    retirouCru: (nome: string, semente: number) =>
      variar(
        [
          `${nome} cru! O cliente devolveu na hora.`,
          `O robô serviu ${nome.toLowerCase()} cru. O cliente devolveu.`,
          `${nome} ainda mole por dentro. Ninguém quis.`,
        ],
        semente,
      ),
    retirouQueimado: (nome: string, semente: number) =>
      variar(
        [
          `${nome} queimado! O cliente pediu outro.`,
          `Isso era ${nome.toLowerCase()}? Agora é carvão.`,
          `${nome} tostado demais. Foi direto para o lixo.`,
        ],
        semente,
      ),
    queimou: (nome: string, x: number, y: number) => `${nome} queimou no forno ${pos(x, y)}. Retire e asse de novo.`,
    fornoOcupado: (x: number, y: number) => `O forno ${pos(x, y)} já está ocupado. Retire o que tem dentro antes de assar.`,
    semMoedas: (nome: string, custo: number, saldo: number) =>
      `${nome} custa ${moedas(custo)} e você tem ${moedas(saldo)}. Venda mais um pouco antes.`,
    produtoTrancado: (nome: string) => `${nome} ainda está trancado. Libere no Livro de Receitas.`,
    produtoDesconhecido: (pedido: string, conhecidos: string[]) =>
      `Não existe produto "${pedido}". Os produtos são: ${conhecidos.map((id) => `"${id}"`).join(', ')}.`,
    produtoSemAcento: (pedido: string, certo: string) => `Não existe produto "${pedido}". Você quis dizer "${certo}"? Os nomes vão sem acento.`,
    cozinhaCresceu: (largura: number, altura: number) => `A cozinha cresceu: agora é ${largura}×${altura}!`,
    comprouUnlock: (nome: string) => `Liberado: ${nome}!`,
    comprouMelhoria: (nome: string, nivel: number) => `${nome} subiu para o nível ${nivel}.`,
    compra: {
      desconhecido: (id: string) => `Não existe "${id}" no Livro de Receitas.`,
      jaComprado: (nome: string) => `Você já tem ${nome}.`,
      requisitos: (nome: string) => `${nome} ainda pede outros itens do Livro de Receitas antes.`,
      semMoedas: (nome: string) => `Faltam moedas para ${nome}.`,
      naoDisponivel: (nome: string) => `${nome} ainda não apareceu no Livro de Receitas.`,
      nivelMaximo: (nome: string) => `${nome} já está no nível máximo.`,
    },
  },

  editor: {
    titulo: 'Seu script',
    rotulo: 'Código Python do robô',
    executar: 'Executar',
    parar: 'Parar',
    atalhoExecutar: 'Ctrl+Enter',
    atalhoParar: 'Ctrl+Shift+Enter',
    dica: (atalho: string) => `Atalho: ${atalho}`,
    velocidade: 'Velocidade',
    msPorTick: (ms: number) => `${ms} ms por tick`,
  },

  execucao: {
    carregando: 'Preparando o Python…',
    falhaCarregar: 'Não deu para carregar o Python. Confira a internet e recarregue a página.',
    terminou: 'O robô terminou o script.',
    parou: 'Execução parada.',
    limiteTicks: (n: number) => `Parou no limite de ${n} ticks.`,
    roboParado:
      'O robô ficou parado esperando, mas o tempo só passa com esperar() ou outras ações. Tente: while not esta_pronto(): esperar()',
  },

  // Erros do script, já traduzidos (SPEC §5.4). A linha entra pelo prefixo `naLinha`.
  erros: {
    naLinha: (linha: number, texto: string) => `Linha ${linha}: ${texto}`,
    semArgumentos: (cmd: string) => `${cmd}() não leva nada entre os parênteses.`,
    umArgumento: (cmd: string, exemplo: string) => `${cmd}() precisa de um valor entre os parênteses, como ${cmd}(${exemplo}).`,
    texto: (cmd: string, exemplo: string) => `${cmd}() precisa de um texto entre aspas, como ${cmd}(${exemplo}).`,
    direcao: 'mover() precisa de uma direção: Norte, Sul, Leste ou Oeste (sem aspas).',
    naoConhece: (nome: string) => `O robô não conhece ${nome}. Confira se está escrito certo.`,
    naoConheceSugestao: (nome: string, sugestao: string) => `O robô não conhece ${nome}. Você quis dizer ${sugestao}?`,
    trancado: (nome: string, unlock: string) => `${nome} ainda está trancado. Libere ${unlock} no Livro de Receitas.`,
    sintaxe: 'tem algo que o Python não entende aqui. Confira parênteses, aspas e os dois-pontos (:) no fim do while, for ou if.',
    recuo:
      'o recuo (os espaços no começo da linha) está errado. Dentro de um while, for, if ou def, as linhas vão um pouco para a direita, todas alinhadas.',
    semImport: 'import não faz parte deste jogo.',
    divisaoPorZero: 'divisão por zero.',
    generico: (tipo: string, mensagem: string) => `${tipo}: ${mensagem}`,
  },

  // Painel temporário de testes; some quando o Livro de Receitas chegar.
  debug: {
    titulo: 'Controles de teste',
    nota: 'Temporário: atalhos para testar a cozinha enquanto o Livro de Receitas não existe.',
    grupoRobo: 'Robô',
    grupoAndar: 'Andar',
    grupoTruques: 'Truques de teste',
    assar: (nome: string) => `Assar ${nome.toLowerCase()}`,
    retirar: 'Retirar',
    esperar: 'Esperar',
    esperarVarios: (n: number) => `Esperar ${n}×`,
    direcoes: { Norte: 'Norte', Sul: 'Sul', Leste: 'Leste', Oeste: 'Oeste' },
    dicaSetas: 'As setas do teclado também movem o robô.',
    darMoedas: (n: number) => `+${n} moedas`,
    liberarProximo: (nome: string) => `Liberar ${nome}`,
    tudoLiberado: 'Tudo liberado',
    melhoria: (nome: string) => `${nome} +1`,
    recomecar: 'Recomeçar do zero',
    ganhouMoedas: (n: number) => `Truque de teste: +${moedas(n)}.`,
    recomecou: 'Cozinha nova em folha.',
  },
};
