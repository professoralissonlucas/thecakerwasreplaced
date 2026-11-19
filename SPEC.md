# SPEC — Confeitaria do Robô (v2)

> **v2:** responde às dúvidas levantadas na revisão da v1. Mudanças principais: regra exata dos ticks (§2.4), rebalanceamento de produtos e `mover` (§2.3, §3), Rodinhas removida, roteiros de referência como teste de balanceamento (§2.6), loop sem passagem de tempo (§5.2), verificador por lista de permitidos e funções embutidas restritas (§5.3), formato do `unlocks.json` (§4.4), comportamento da cozinha entre execuções (§2.1), regras exatas das melhorias (§4.2), divisão dos textos (§9.3) e escopo do MVP (§10).

Jogo educativo de programação para navegador. O jogador escreve código Python simples para controlar um robô confeiteiro numa cozinha em grade. Cada tarefa automatizada gera moedas, e as moedas liberam novos comandos, recursos da linguagem e melhorias. Inspirado na mecânica de "programar um agente para automatizar tarefas cada vez maiores", com tema, nomes, arte e interface próprios.

- **Público:** iniciantes em programação (a partir de ~10 anos) e professores.
- **Plataforma:** site estático no GitHub Pages. Funciona 100% sem login. Login com Google (Firebase) é opcional e serve só para salvar o progresso na nuvem.
- **Idioma:** interface e comandos do jogo em português (sem acentos nos identificadores). As palavras-chave do Python continuam em inglês (`while`, `for`, `if`, `def`).

---

## 1. Ciclo principal

1. O jogador escreve um script no editor.
2. Aperta **▶ Executar**. O robô executa o script passo a passo, com a linha atual destacada e cada ação animada na grade.
3. As ações geram **moedas**.
4. Na aba **Livro de Receitas** (árvore de unlocks), o jogador gasta moedas para liberar comandos, palavras-chave do Python, produtos, aumento da cozinha e melhorias.
5. Com mais recursos, ele reescreve o script para automatizar mais e lucrar mais rápido.

Regra de design: **o jogador sente a dor antes de receber a solução.** Cada recurso da linguagem só aparece depois que o jogador já fez a mesma coisa "na mão" algumas vezes.

---

## 2. Mundo

### 2.1 Cozinha (grade)
- Grade quadrada N×N (pode ser retangular nas fases iniciais: 1×1 → 3×1 → 3×3 → 4×4 → 5×5).
- Coordenadas: `x` cresce para Leste e `y` cresce para Norte; (0,0) fica no canto inferior esquerdo.
- **As bordas dão a volta (wrap-around):** sair pela borda Leste leva ao lado Oeste, e assim por diante. Isso deixa os loops de varredura simples.
- Cada célula tem um **forno**.
- **A cozinha continua entre execuções.** Um novo ▶ Executar não zera os fornos nem a posição do robô (como uma cozinha de verdade, que continua lá). Ao recarregar a página, a cozinha começa vazia, com o robô em (0,0).
- **Quando a cozinha cresce,** os fornos existentes mantêm posição e estado, os novos começam `vazio` e o robô fica onde está.

### 2.2 Estado de cada forno
O estado é **derivado** do `progresso` (T = tempo efetivo do produto, L = tolerância efetiva):

| Estado | Condição |
|---|---|
| `vazio` | sem produto |
| `assando` | `progresso < T` |
| `pronto` | `T <= progresso <= T + L` |
| `queimado` | `progresso > T + L` |

Produto com tolerância `null` **nunca queima**.

### 2.3 Produtos (valores iniciais; validados pelos roteiros do §2.6)
| Produto | id | Custo (moedas) | Tempo T (ticks) | Tolerância L (ticks) | Venda (moedas) | Liberado por |
|---|---|---|---|---|---|---|
| Pão | `"pao"` | 0 | 3 | `null` (nunca queima) | 1 | início |
| Biscoito | `"biscoito"` | 3 | 15 | 80 | 6 | unlock "Biscoito" |
| Bolo | `"bolo"` | 15 | 60 | 80 | 40 | unlock "Bolo" |

Por que esses números: uma volta completa pela cozinha custa cerca de `3·N² + N` ticks (3×3 ≈ 30, 4×4 ≈ 52, 5×5 ≈ 80). Os valores garantem:
- o **pão** é o produto "seguro" do começo e nunca queima;
- o **biscoito** fica pronto em menos de uma volta da 3×3 e só queima se o script for muito lento;
- o **bolo** demora **mais que uma volta** (60 > 30 e 60 > 52). Uma varredura que retira tudo sem olhar tira bolo cru. É aqui que `if esta_pronto():` vira necessário de verdade.

Os dados dos produtos ficam em `src/data/produtos.json`, não espalhados pelo código.

### 2.4 Tempo (ticks)
- A simulação é **determinística**, medida em **ticks**. Não usa tempo real.
- **Regra exata:** cada comando (1) aplica seu efeito e (2) depois o mundo avança N ticks, onde N é o custo do comando. Todos os fornos com produto, inclusive um que acabou de receber massa, ganham +1 de progresso por tick.
  - Exemplo: `assar("pao")` deixa o progresso em 1. Com `esperar()` vai a 2 e com outro `esperar()` vai a 3, que é `pronto`. Depois `retirar()` vende.
  - `retirar()` avalia o estado **antes** de avançar o seu tick.
- A velocidade da animação (ms por tick) é ajustada num controle deslizante da interface e **não muda o resultado**, só a velocidade de exibição.
- Isso permite medir desafios em ticks (ranking justo).

### 2.5 Economia
- Uma moeda única: **moedas** 🪙.
- `assar` desconta o custo na hora. `retirar` de um forno `pronto` vende automaticamente e soma o valor.
- Retirar `assando` (cru) ou `queimado` limpa o forno e não rende nada. A interface mostra uma mensagem engraçada ("O robô serviu um bolo cru. O cliente devolveu."); o engine só emite o evento.
- **Estatísticas:** `produzidos` conta **só os vendidos**, por produto; também há `ticksTotais`. (O "recorde de moedas por 100 ticks" da v1 foi removido.)

### 2.6 Roteiros de referência (teste de balanceamento)
`tests/roteiros/` guarda um script Python de referência por etapa. Um teste roda cada um **direto no engine** (sem animação), pelo número de ticks indicado, e confere que dá lucro e que nenhum produto foi perdido (cru ou queimado), exceto quando o roteiro existe justamente para mostrar a perda.

| Roteiro | Unlocks ativos | Ticks | Espera |
|---|---|---|---|
| `01_manual.py` (assar, esperar, esperar, retirar) | começo | 4 | +1 moeda |
| `02_repeticao.py` (exemplo do §4.3) | repeticao | 400 | ≥ 90 moedas, 0 perdas |
| `03_varredura_3x1.py` | cozinha_3x1, contagem | 400 | ≥ 120 moedas, 0 perdas |
| `04_varredura_3x3.py` (exemplo do §4.3) | cozinha_3x3 | 600 | ≥ 150 moedas, 0 perdas |
| `05_biscoito_3x3.py` | biscoito | 600 | lucro maior que o 04, 0 perdas |
| `06_bolo_sem_if.py` | bolo | 600 | **tem perdas (crus)**, mostrando o problema |
| `07_bolo_com_if.py` | bolo, sensores | 600 | 0 perdas, lucro maior que o 05 |
| `08_bolo_4x4.py` | cozinha_4x4 + todas as melhorias no máximo | 1000 | 0 perdas |

Se mudar qualquer número em `src/data/`, esses testes precisam continuar passando. Para rodar os roteiros sem navegador, o runner deve conseguir executar Skulpt no Node (Vitest) com a animação desligada (`msPorTick = 0`). Se isso não for viável, os roteiros podem ser escritos como sequências equivalentes em TypeScript chamando o engine, com um comentário mostrando o Python correspondente.

---

## 3. Comandos do jogo (API exposta ao Python)

Todos são funções globais no ambiente do script. Um comando ainda não liberado **não existe** no ambiente; chamar dá um erro amigável (ver §5.3).

| Comando | Ticks | Retorno | Comportamento | Liberado por |
|---|---|---|---|---|
| `assar(produto)` | 1 | `True`/`False` | Coloca massa no forno da posição atual. Falha (retorna `False` com aviso no console, sem quebrar o script) se o forno não estiver vazio, se faltar moeda ou se o produto não estiver liberado. | início |
| `retirar()` | 1 | `True`/`False` | Retira o que tiver no forno. Vende se estiver pronto. Retorna `True` só se vendeu. | início |
| `esperar()` | 1 | `None` | Passa um tick sem fazer nada. | início |
| `dizer(valor)` | 0 | `None` | Escreve no console do jogo e mostra um balão de fala no robô. | início |
| `mover(direcao)` | 1 | `None` | Move uma célula, com wrap-around. Direções: constantes `Norte`, `Sul`, `Leste`, `Oeste`. | "Cozinha 3×1" (`Leste`, `Oeste`); "Cozinha 3×3" (`Norte`, `Sul`) |
| `esta_pronto()` | 0 | `bool` | `True` se o forno atual está `pronto`. | "Sensores" |
| `estado()` | 0 | `str` | `"vazio"`, `"assando"`, `"pronto"` ou `"queimado"`. | "Sensores" |
| `produto()` | 0 | `str` ou `None` | Produto no forno atual. | "Sensores" |
| `pos_x()`, `pos_y()` | 0 | `int` | Posição do robô. | "Cozinha 3×3" |
| `tamanho()` | 0 | `int` | Largura da cozinha (lado da grade). | "Cozinha 3×3" |
| `moedas()` | 0 | `int` | Saldo atual. | "Memória" |
| `ticks()` | 0 | `int` | Ticks desde o início da execução. | "Memória" |

Notas:
- Sensores custam 0 ticks de propósito, para incentivar o uso de `if`. Como o tempo só anda com comandos que custam ticks, `while not esta_pronto(): pass` nunca termina; o §5.2 trata esse caso.
- `print` funciona como `dizer`.
- `import` é **sempre** proibido (não há plano de liberar).
- Constantes de direção também são "comandos": `Norte` e `Sul` não existem antes da Cozinha 3×3, e o verificador (§5.3) avisa **antes** de executar.
- Cada comando do jogo é uma **suspensão** (assíncrono por baixo), para que a interface anime entre os passos.

---

## 4. Livro de Receitas (árvore de unlocks)

Fica em `src/data/unlocks.json`. Cada item: `id`, `nome`, `descricao`, `custo`, `requisitos` (ids de unlocks anteriores e/ou estatísticas, ex.: `{"produzidos.biscoito": 20}`), `efeito` e `exemplo` (trecho de código mostrado ao liberar).

### 4.1 Linha principal (ordem sugerida)
| # | id | Nome | Custo | Requisito | Efeito |
|---|---|---|---|---|---|
| 0 | — | Começo | — | — | Cozinha 1×1; `assar`, `retirar`, `esperar`, `dizer`; Pão |
| 1 | `repeticao` | Repetição | 10 | — | Libera `while` e `True`/`False` |
| 2 | `cozinha_3x1` | Cozinha 3×1 | 30 | repeticao | Grade 3×1; `mover(Leste/Oeste)` |
| 3 | `contagem` | Contagem | 60 | cozinha_3x1 | Libera `for`, `in` e `range` |
| 4 | `cozinha_3x3` | Cozinha 3×3 | 120 | contagem | Grade 3×3; todas as direções; `pos_x`, `pos_y`, `tamanho` |
| 5 | `sensores` | Sensores | 200 | cozinha_3x3 | `esta_pronto`, `estado`, `produto`; libera `if`, `elif`, `else`, `not`, `and`, `or` e comparações (`==`, `!=`, `<`, `>`, `<=`, `>=`) |
| 6 | `biscoito` | Biscoito | 300 | sensores | Produto Biscoito (tolerância curta: exige `if`) |
| 7 | `memoria` | Memória | 450 | biscoito | Libera atribuição `=` (variáveis), `+=`, aritmética (`+ - * / // %`), `moedas()`, `ticks()` e as funções embutidas `int`, `str`, `abs`, `min`, `max` |
| 8 | `receitas` | Receitas Próprias | 700 | memoria | Libera `def`, `return` e parâmetros |
| 9 | `bolo` | Bolo | 1000 | receitas e `produzidos.biscoito >= 30` | Produto Bolo |
| 10 | `cozinha_4x4` | Cozinha 4×4 | 1500 | bolo | Grade 4×4 |
| 11 | `cozinha_5x5` | Cozinha 5×5 | 3000 | cozinha_4x4 | Grade 5×5 |
| 12 | `listas` | Prateleiras | 4000 | cozinha_5x5 | Libera listas `[]`, `len`, `append`, indexação |
| 13 | `desafio` | Desafio Relâmpago | 6000 | listas | Modo desafio (§8) |

Na primeira fase, sem `=`, o jogador ainda não tem variáveis. Isso é intencional: os primeiros scripts são sequências de comandos e loops.

### 4.2 Melhorias repetíveis
Custo do nível n+1 (n = nível atual, começando em 0) = `Math.round(custoInicial × 1,6ⁿ)`.

| id | Nome | Custo inicial | Efeito (n = nível) | Máx. | Aparece após |
|---|---|---|---|---|---|
| `forno_turbo` | Forno Turbo | 50 | T efetivo = `max(1, ceil(T × 0,9ⁿ))` (multiplicativo) | 5 | `repeticao` |
| `receita_premium` | Receita Premium | 100 | venda efetiva = venda + n (**aditivo**, +1 moeda por nível, vale para todo produto) | 5 | `cozinha_3x1` |
| `forno_isolado` | Forno Isolado | 120 | L efetiva = L + 5·n (produtos com L `null` continuam sem queimar) | 3 | `biscoito` |

A Rodinhas da v1 foi removida porque `mover` agora custa 1 tick para todo mundo. O Forno Turbo adianta a queima (T menor), mas com as tolerâncias novas isso não quebra nenhum roteiro; o roteiro 08 confere isso com tudo no máximo.

### 4.3 Exemplos mostrados ao liberar
- **Repetição** (pão: assar leva o progresso a 1 e cada esperar soma 1, então 2 esperas bastam):
  ```python
  while True:
      assar("pao")
      esperar()
      esperar()
      retirar()
  ```
- **Cozinha 3×3 + Contagem (varredura):**
  ```python
  while True:
      for i in range(tamanho()):
          for j in range(tamanho()):
              retirar()
              assar("pao")
              mover(Norte)
          mover(Leste)
  ```
- **Sensores** (o caso de uso na hora em que são liberados: misturar produtos por posição):
  ```python
  if pos_x() == 0:
      dizer("coluna especial!")
  if estado() == "vazio":
      assar("pao")
  ```
- **Bolo** (o motivo de verdade para o `if`):
  ```python
  if esta_pronto():
      retirar()
  if estado() == "vazio":
      assar("bolo")
  ```

### 4.4 Formato do `unlocks.json`
```json
[
  {
    "id": "exemplo_formato",
    "nome": "Exemplo (não é um unlock real)",
    "descricao": "Texto curto mostrado no card.",
    "custo": 120,
    "requisitos": {
      "unlocks": ["contagem"],
      "estatisticas": { "produzidos.biscoito": 30 }
    },
    "efeitos": [
      { "tipo": "cozinha", "largura": 3, "altura": 3 },
      { "tipo": "comandos", "nomes": ["Norte", "Sul", "pos_x", "pos_y", "tamanho"] },
      { "tipo": "sintaxe", "nos": ["If", "Compare"] },
      { "tipo": "embutidas", "nomes": ["range"] },
      { "tipo": "produto", "id": "bolo" },
      { "tipo": "modo", "id": "desafio" }
    ],
    "exemplo": "for i in range(tamanho()):\n    ..."
  }
]
```
- `requisitos.estatisticas` usa chaves com ponto e a regra é sempre "≥ valor".
- Este bloco mostra **todos os tipos de efeito possíveis** num item só, só para documentar o formato. Na prática, cada unlock usa só os efeitos da tabela do §4.1.
- `melhorias.json` segue a mesma ideia: `id`, `nome`, `descricao`, `custoInicial`, `maximo`, `apareceApos`, `efeito: { "tipo": "tempoMult" | "vendaSoma" | "toleranciaSoma", "valor": ... }`.

---

## 5. Execução do código

### 5.1 Interpretador
- **Skulpt** (Python 3 compilado para JS, roda no navegador, leve). Arquivos `skulpt.min.js` e `skulpt-stdlib.js` em `public/vendor/skulpt/`.
- Configuração: `Sk.configure({ output, read, __future__: Sk.python3, yieldLimit: 100, killableWhile: true, killableFor: true })`.
- Comandos do jogo registrados como funções embutidas; cada uma devolve `Sk.misceval.promiseToSuspension(promise)`. A promise:
  1. aplica a ação no motor (`engine`);
  2. avança os ticks;
  3. espera a animação (`msPorTick × ticks`);
  4. resolve com o retorno convertido para tipo Python.
- Executar com `Sk.misceval.asyncToPromise(() => Sk.importMainWithBody("<script>", false, codigo, true), handlers)`.

### 5.2 Parar e proteção contra travamento
- O botão **⏹ Parar** liga uma flag `abortar`. A próxima suspensão/yield lança uma exceção interna que encerra a execução sem mostrar erro.
- `yieldLimit` + `killableWhile`/`killableFor` devolvem o controle ao navegador, então a aba nunca congela. O Skulpt mede o `yieldLimit` em **milissegundos**, não em instruções.
- **Loop sem passagem de tempo:** o runner guarda o horário real do último tick que avançou. Num handler de suspensão chamado a cada yield (`"*"` em `asyncToPromise`), se passarem **2 segundos de tempo real sem nenhum tick avançar**, a execução é encerrada com a mensagem: "⏳ O robô ficou parado esperando, mas o tempo só passa com `esperar()` ou outras ações. Tente `while not esta_pronto(): esperar()`." Isso cobre `while True: pass`, `while not esta_pronto(): pass` e loops só com sensores ou `dizer`.
- Com `msPorTick = 0` (testes), o limite é por **contagem**: 100.000 chamadas de sensores/`dizer` seguidas sem tick → mesmo erro.

### 5.3 Bloqueio de recursos da linguagem
Antes de executar, o código passa por um **verificador** (`runner/gate.ts`) que usa **lista de permitidos**: só passa o que já foi liberado; todo o resto é bloqueado.
- Percorrer a AST do Skulpt (`Sk.parse` + `Sk.astFromParse`). Strings e comentários não geram falso positivo porque o verificador olha nós da AST, não texto.
- **Nós permitidos por unlock** (nomes da AST do Python; conferir os nomes exatos que o Skulpt usa):
  | Unlock | Nós liberados |
  |---|---|
  | começo | `Module`, `Expr`, `Call`, `Name` (leitura), `Constant`/`Str`/`Num`, `UnaryOp(USub)` só sobre número literal (`-1`) |
  | repeticao | `While`, `Break`, `Continue`, `Pass`, `NameConstant` (`True`/`False`) |
  | contagem | `For` (alvo `Name`) |
  | sensores | `If`, `Compare` e todos os operadores de comparação, `BoolOp` (`and`, `or`), `UnaryOp(Not)` |
  | memoria | `Assign`, `AugAssign`, `Name` (escrita), `BinOp` (`+ - * / // %`), `UnaryOp(USub)` geral |
  | receitas | `FunctionDef`, `arguments`/`arg`, `Return` |
  | listas | `List`, `Subscript`/`Index`, `Attribute` **só** com os nomes `append`, `pop` |
- **Nunca liberados:** `Import`, `ImportFrom`, `Lambda`, `Try`, `Raise`, `ClassDef`, `Dict`, `Set`, `Tuple`, compreensões, `JoinedStr` (f-strings), `With`, `Global`, `Nonlocal`, `Del`, `Yield`, `Await`, `Assert`, `IfExp`, `Starred`, decorators, qualquer `Attribute` fora da lista acima e qualquer nome começando com `__`. Mensagem: "🚫 Esse recurso do Python não faz parte deste jogo."
- **Nomes chamados ou lidos:** o verificador também confere cada `Name` lido com os comandos/constantes liberados, as funções embutidas liberadas, as variáveis atribuídas no script e os parâmetros das funções. Um comando do jogo não liberado (ex.: `mover` antes da 3×1, `Norte` antes da 3×3) gera, **antes** de executar: "🔒 `mover` ainda está trancado. Libere **Cozinha 3×1** no Livro de Receitas."
- Se algo não estiver liberado, **não executar** e mostrar: "🔒 Você ainda não aprendeu `for`. Libere **Contagem** no Livro de Receitas." Com destaque na linha.

### 5.3.1 Funções embutidas do Python
- O ambiente do script começa **sem nenhuma função embutida**. Remover/sobrescrever do `Sk.builtins` acessível ao script tudo o que não estiver liberado. Isso inclui `input`, `eval`, `exec`, `compile`, `open`, `getattr`, `setattr`, `globals`, `locals`, `vars`, `dir`, `type`, `__import__`, `help`.
- Liberadas: `print` (começo), `range` (contagem), `int`, `str`, `abs`, `min`, `max` (memoria), `len` (listas).
- Isso fecha o buraco do `exec("for ...")`. Mesmo assim, o verificador da AST é a primeira barreira; o ambiente restrito é a segunda.

### 5.4 Erros amigáveis
- Traduzir os erros mais comuns do Python para português simples, com linha destacada: `NameError` (incluindo comando não liberado), `SyntaxError`, `IndentationError`, `TypeError` de argumentos.
- Falhas de jogo (forno ocupado, sem moedas) **não quebram o script**: aparecem como aviso ⚠️ no console e um ícone na grade.

---

## 6. Interface

Layout desktop (mobile: abas empilhadas; o jogo deve funcionar no tablet):

```
┌───────────────────────────────┬───────────────────────────┐
│ 🪙 123   ⏱ ticks   [Cozinha|Livro de Receitas]  [Entrar]  │
├───────────────────────────────┼───────────────────────────┤
│ Editor (CodeMirror 6, Python) │  Grade da cozinha         │
│ abas de scripts: + novo       │  robô animado, fornos com │
│                               │  barra de progresso       │
│ [▶ Executar] [⏹ Parar] vel.▭  │                           │
├───────────────────────────────┴───────────────────────────┤
│ Console (dizer/print, avisos ⚠️, erros ❌)                 │
└───────────────────────────────────────────────────────────┘
```

- **Grade:** DOM + CSS Grid (mais simples que canvas). Primeira versão com emojis (🤖 🔥 🍞 🍪 🎂 💨 para queimado); sprites SVG próprios depois. Barra de progresso no forno; brilho quando `pronto`; fumaça quando `queimado`.
- **Editor:** CodeMirror 6 com destaque Python, numeração, linha ativa destacada durante a execução e autocompletar só com os comandos liberados.
- **Vários scripts:** abas com nomes. Scripts não importam uns aos outros (nunca: `import` é proibido).
- **Livro de Receitas:** cards em árvore/colunas, com estados bloqueado (cinza, mostra requisito), disponível (preço) e comprado. Ao comprar: modal com explicação curta + exemplo + botão "Copiar exemplo".
- **Ajuda:** painel "Comandos" que lista só o que está liberado, cada um com descrição e exemplo.
- **Tutorial:** dicas contextuais curtas nas primeiras etapas (ex.: depois do 5º pão retirado à mão, sugerir guardar moedas para a Repetição).
- **Acessibilidade:** contraste AA, tudo acessível pelo teclado. `Ctrl+Enter` executa e `Ctrl+Shift+Enter` para. **Não usar `Esc`**, que o CodeMirror usa para fechar o autocompletar e para sair do editor (`Esc` seguido de `Tab`). Os atalhos aparecem como dica nos botões.

---

## 7. Persistência

### 7.1 Formato do save
```json
{
  "versao": 1,
  "moedas": 0,
  "unlocks": ["repeticao"],
  "melhorias": { "forno_turbo": 2 },
  "estatisticas": { "produzidos": { "pao": 120 }, "ticksTotais": 5000 },
  "scripts": [{ "nome": "principal", "codigo": "..." }],
  "scriptAtivo": "principal",
  "config": { "msPorTick": 200 },
  "atualizadoEm": 1731970000000
}
```
- Validar ao carregar. Ter uma função `migrar(save)` por número de versão.
- A cozinha (estado dos fornos) **não** é salva: ao recarregar, começa vazia.

### 7.2 Local (sempre)
- `localStorage` com a chave `confeitaria-save-v1`. Salvar a cada 10 s se houver mudança, ao comprar unlock e em `visibilitychange`/`pagehide`.
- Exportar/importar save como arquivo `.json` (útil para professores).

### 7.3 Nuvem (opcional, Firebase)
- **Firebase Authentication** com provedor Google, usando `signInWithPopup` (o site não está hospedado no Firebase Hosting, então o popup é o caminho recomendado; o redirect tem problemas com bloqueio de armazenamento de terceiros).
- **Cloud Firestore**, documento `saves/{uid}` com o mesmo JSON do save.
- Firebase JS SDK modular v10+ via npm, importando só `app`, `auth` e `firestore`.
- **Fluxo ao entrar:**
  1. lê `saves/{uid}`;
  2. se não existe → envia o save local;
  3. se existe e o local está vazio/novo → usa o da nuvem;
  4. se os dois têm progresso → modal "Qual progresso manter?" mostrando moedas e unlocks de cada um.
- **Gravação:** com debounce de 60 s durante o jogo + imediata ao comprar unlock + em `visibilitychange`. Nunca gravar a cada tick.
- **Sem login, o jogo funciona inteiro.** O botão "Entrar com Google" é opcional, e a interface explica que serve para continuar em outro computador.
- **Privacidade:** guardar só `uid` e o progresso. Não salvar nome, e-mail ou foto no Firestore (mostrar a foto só na interface, vinda do `auth`).
- **Configuração** em `src/firebase/config.ts`. A config web do Firebase não é segredo (a segurança vem das regras), mas a chave deve ser restringida por domínio no Google Cloud Console.
- Se a config estiver ausente, esconder o botão de login (o build continua funcionando para quem fizer fork).

#### Regras do Firestore (`firestore.rules`)
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /saves/{uid} {
      allow read, delete: if request.auth != null && request.auth.uid == uid;
      allow create, update: if request.auth != null
        && request.auth.uid == uid
        && request.resource.data.versao is int
        && request.resource.data.moedas is number
        && request.resource.data.scripts is list
        && request.resource.data.scripts.size() <= 20;
    }
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

#### Cota gratuita (plano Spark)
Leituras/gravações por dia no Firestore: 50 mil / 20 mil. Com debounce de 60 s, cada hora de jogo usa ~60–80 gravações, então isso cobre algumas centenas de horas de jogo por dia, o suficiente para uso em sala de aula. Se a cota estourar, o Spark só recusa as operações até o dia seguinte (não gera cobrança); o jogo deve continuar salvando localmente e mostrar "Nuvem indisponível, progresso salvo neste computador".

---

## 8. Desafio Relâmpago (fim de jogo, pós-MVP)
- Modo separado: cozinha 5×5 zerada, 0 moedas, todos os unlocks comprados.
- Meta: chegar a 1000 moedas no **menor número de ticks**.
- Recorde pessoal salvo no save.
- Opcional: ranking em `ranking/{uid}` no Firestore (`{ ticks, apelido, data }`), com regra que só permite gravar se `ticks` for menor que o anterior. Aviso: um ranking aberto pode ser fraudado pelo cliente; para uso educativo isso é aceitável, mas tem que estar documentado.

---

## 9. Arquitetura

### 9.1 Stack
- **Vite + TypeScript** (vanilla, sem framework de UI; componentes simples em TS).
- **CodeMirror 6** (`@codemirror/lang-python`).
- **Skulpt** (vendor em `public/`).
- **Firebase** modular (`firebase/app`, `firebase/auth`, `firebase/firestore`).
- **Vitest** para testes do motor e do verificador.
- **GitHub Actions** → GitHub Pages (`actions/deploy-pages`). `base` do Vite = `/<nome-do-repo>/`.

### 9.2 Pastas
```
/
├─ index.html
├─ public/vendor/skulpt/        # skulpt.min.js, skulpt-stdlib.js
├─ src/
│  ├─ main.ts                   # monta a app
│  ├─ data/
│  │  ├─ produtos.json
│  │  ├─ unlocks.json
│  │  └─ melhorias.json
│  ├─ engine/                   # REGRAS PURAS, sem DOM, 100% testável
│  │  ├─ estado.ts              # tipos: Jogo, Cozinha, Forno, Robo
│  │  ├─ acoes.ts               # assar, retirar, mover, esperar → novo estado + eventos
│  │  ├─ tempo.ts               # avancarTicks
│  │  ├─ economia.ts            # custos, vendas, melhorias
│  │  └─ unlocks.ts             # podeComprar, comprar, comandosLiberados, sintaxeLiberada
│  ├─ runner/
│  │  ├─ skulpt.ts              # configura Skulpt, registra builtins
│  │  ├─ comandos.ts            # ponte comando Python → engine → animação
│  │  ├─ gate.ts                # verificador de sintaxe liberada
│  │  └─ erros.ts               # tradução de erros
│  ├─ ui/
│  │  ├─ grade.ts
│  │  ├─ editor.ts
│  │  ├─ console.ts
│  │  ├─ livro.ts               # árvore de unlocks
│  │  ├─ ajuda.ts
│  │  ├─ topo.ts                # moedas, login
│  │  └─ estilos.css
│  ├─ persistencia/
│  │  ├─ save.ts                # formato, validação, migrar()
│  │  ├─ local.ts
│  │  └─ nuvem.ts               # Firebase auth + Firestore
│  └─ firebase/config.ts
├─ tests/
├─ firestore.rules
├─ .github/workflows/deploy.yml
├─ SPEC.md
└─ CLAUDE.md
```

### 9.3 Princípios
- **O engine não conhece o DOM, o Skulpt nem o Firebase.** Ele recebe ações e devolve o novo estado + uma lista de **eventos** (`{tipo:"vendeu", produto, valor, x, y}`), que a UI usa para animar.
- Um único `store` simples (estado + `subscribe`) liga engine, UI e persistência.
- Dados de jogo (produtos, unlocks, melhorias) em JSON, para balancear sem mexer em código.
- **Divisão dos textos:**
  - **conteúdo do jogo** (nome, descrição e exemplo de unlocks, produtos e melhorias) fica no JSON de `src/data/`;
  - **textos da interface** (botões, mensagens de erro, avisos, as mensagens engraçadas, o tutorial) ficam em `src/ui/textos.ts`;
  - **o engine não tem texto para o jogador.** Ele emite eventos com códigos (`{tipo: "retirouCru", produto: "bolo", x, y}`, `{tipo: "falhou", motivo: "fornoOcupado"}`), e a UI traduz.

### 9.4 Testes mínimos
- Engine: assar/retirar em cada estado; regra exata do §2.4 (progresso 1 depois de assar; pronto em T; ainda pronto em T+L; queimado em T+L+1); pão nunca queima; wrap-around das bordas; crescimento da cozinha preservando fornos; custos e as fórmulas das melhorias do §4.2.
- Roteiros de referência do §2.6.
- Gate: cada nó bloqueado é detectado; strings/comentários com "for" não disparam falso positivo; comando não liberado é detectado antes de rodar; `exec`/`eval`/`__import__` indisponíveis.
- Runner: loop sem passagem de tempo encerra com a mensagem do §5.2.
- Save: validação e migração.

---

## 10. Escopo

### MVP (versão 1)
Itens **0–10** da linha principal (até a Cozinha 4×4), as 3 melhorias, Pão/Biscoito/Bolo, editor com várias abas, console, erros amigáveis, save local **com exportar/importar .json**, roteiros de referência, deploy no GitHub Pages.

### Versão 1.1
Login Google + save na nuvem, cozinha 5×5, Prateleiras (listas).

### Depois
Desafio Relâmpago + ranking, sprites e sons próprios, pedidos de clientes (ex.: "3 bolos em 100 ticks") como missões opcionais, modo professor (lista de desafios por link).

### Fora de escopo
Multiplayer, `import`, editor externo, backend próprio.
