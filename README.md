# AcquaMaster/FOZ — Painel Masters

Painel interativo de atletas, campeonatos e balizamento para a equipe AcquaMaster/FOZ.

## Estrutura

```
natacao-etapas-analytics-main/
├── index.html            ← estrutura da página
├── styles.css            ← estilos (tema claro)
├── app.js                ← lógica da aplicação (atletas, campeonatos, balizamento, import)
├── pdf-parser.js         ← extração do balizamento a partir do PDF (render + OCR)
├── default-athletes.js   ← lista padrão de atletas do clube
├── seed-3etapa.js        ← dados históricos da 3ª Etapa (fallback local se o servidor cair)
├── api/campeonatos.js    ← função serverless (Node) — GET/PUT dos campeonatos no Postgres
├── package.json          ← dependência da função serverless (@neondatabase/serverless)
└── vercel.json           ← configuração de deploy
```

Front-end sem build step — é só HTML/CSS/JS estático, com Chart.js, SheetJS (xlsx),
pdf.js e Tesseract.js carregados via CDN. A única parte com build é a função
serverless em `api/`, que a própria Vercel empacota.

## Abas

- **Atletas** — cadastro dos atletas do clube, com filtros e busca. Fica salvo só no
  navegador de cada pessoa (localStorage) — ver "Atualizar a lista de atletas" abaixo.
- **Balizamento** — lista de campeonatos cadastrados; cada um guarda seu próprio
  balizamento (provas, séries, atletas de todos os clubes daquele evento), preservando
  histórico entre etapas. **Guardado num banco Postgres compartilhado** — todo mundo que
  acessa o painel vê os mesmos campeonatos (ver "Banco de dados" abaixo).
- **Importar Excel** — atualiza a lista de atletas do clube a partir de uma planilha.
- **Evolução de Tempos** — oculta por enquanto (aba fica pronta no código pra retomar
  depois; ver `sec-evolucao` em `index.html` e `renderChart`/`provas` em `app.js`).

## Importar balizamento de um campeonato (PDF)

Os PDFs de balizamento gerados pela federação **não têm texto selecionável** — o
conteúdo é desenhado como vetores, não como texto extraível. Por isso, dentro de um
campeonato, "📄 Importar balizamento (PDF)":

1. Renderiza cada página do PDF como imagem no navegador (pdf.js).
2. Roda OCR sobre essa imagem (Tesseract.js, em português).
3. Reconstrói cada linha (prova → série → atleta) usando a posição das palavras
   reconhecidas, alinhando pelas colunas do cabeçalho `RAIA MATR. FAIXA ATLETA EQUIPE TEMPO`.
4. Mostra uma tela de revisão **editável**, com linhas marcadas quando algum campo
   parece suspeito (ex: tempo em formato inesperado, campo vazio).

**OCR não é perfeito** — sempre confira a revisão antes de confirmar. Erros mais comuns:
dígitos parecidos trocados (ex: "7" ↔ "T") e nomes muito longos que colidem com a coluna
do clube no PDF original. Depois de salvo, cada inscrição também pode ser corrigida
individualmente pelo ✏ na tabela do campeonato.

Processar um PDF de ~10 páginas pode levar vários minutos (o OCR roda no seu navegador,
não em um servidor) — a tela mostra o progresso página a página.

## Deploy no Vercel

### 1. Deploy do projeto

Via Vercel CLI:

```bash
npm install -g vercel
cd natacao-etapas-analytics-main
vercel login
vercel          # primeira vez — segue o wizard, vincula ao repo do GitHub
vercel --prod   # deploys seguintes
```

Ou via GitHub + Dashboard: acesse https://vercel.com → **Add New Project** → conecte o
repositório `natacao-etapas-analytics` → **Deploy** (configurações padrão, sem
framework). Assim, todo `git push` na branch principal já gera um deploy novo.

### 2. Banco de dados (Postgres/Neon) — obrigatório pra Balizamento funcionar

Os campeonatos ficam num banco Postgres compartilhado (provisionado como Neon, pelo
Marketplace da Vercel), pra todos os colegas verem o mesmo balizamento.

No dashboard do projeto: aba **Storage** → **Marketplace** → **Neon** → criar banco e
conectar a este projeto. Isso adiciona automaticamente a variável de ambiente
`DATABASE_URL`. Ou pela CLI:

```bash
vercel integration add neon
```

A tabela `campeonatos` é criada sozinha na primeira chamada da API — não tem migração
manual pra rodar. Depois de conectar o banco, faça mais um `vercel --prod` pra função
`api/campeonatos.js` enxergar a variável de ambiente nova.

**Primeiro acesso depois de conectar o banco:** se algum navegador já tinha campeonatos
salvos localmente (de antes da migração), o painel publica esses dados automaticamente
pro banco assim que detecta que ele está vazio — não precisa reimportar nada na mão.

## Atualizar a lista de atletas

Use a aba **Importar Excel** dentro do próprio painel (upload → mapear colunas →
pré-visualizar → aplicar). Os dados ficam salvos só no navegador de quem importou
(localStorage) — cada colega precisa importar a planilha no seu próprio navegador pra
ver a lista atualizada.
