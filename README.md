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
├── seed-3etapa.js        ← dados históricos da 3ª Etapa (migrados na primeira carga)
└── vercel.json           ← configuração de deploy
```

Sem build step — é só HTML/CSS/JS estático, com Chart.js, SheetJS (xlsx), pdf.js e
Tesseract.js carregados via CDN.

## Abas

- **Atletas** — cadastro dos atletas do clube, com filtros e busca.
- **Balizamento** — lista de campeonatos cadastrados; cada um guarda seu próprio
  balizamento (provas, séries, atletas de todos os clubes daquele evento), preservando
  histórico entre etapas.
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

### Opção 1 — Via Vercel CLI (recomendado)

```bash
# Instalar a CLI do Vercel (se ainda não tiver)
npm install -g vercel

# Dentro da pasta do projeto
cd natacao-etapas-analytics-main

# Fazer login (abre o navegador)
vercel login

# Deploy (primeira vez — segue o wizard)
vercel

# Deploy de atualização (depois da primeira vez)
vercel --prod
```

### Opção 2 — Via GitHub + Vercel Dashboard

1. Suba esta pasta para um repositório no GitHub
2. Acesse https://vercel.com e clique em **Add New Project**
3. Conecte o repositório
4. Nas configurações, deixe tudo padrão (projeto estático, sem build)
5. Clique em **Deploy**

### Opção 3 — Arrastar e soltar (mais rápido para testes)

1. Acesse https://vercel.com/new
2. Arraste a pasta `natacao-etapas-analytics-main` inteira para a área indicada
3. Aguarde o deploy — URL gerada automaticamente

## Atualizar a lista de atletas

Use a aba **Importar Excel** dentro do próprio painel (upload → mapear colunas →
pré-visualizar → aplicar). Os dados ficam salvos no navegador (localStorage).
