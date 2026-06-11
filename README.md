# AcquaMaster/FOZ — Painel Masters

Painel interativo de atletas e evolução de tempos para a equipe AcquaMaster/FOZ.

## Estrutura

```
acquamaster-vercel/
├── index.html      ← aplicação completa (HTML + CSS + JS em um único arquivo)
└── vercel.json     ← configuração de deploy
```

## Deploy no Vercel

### Opção 1 — Via Vercel CLI (recomendado)

```bash
# Instalar a CLI do Vercel (se ainda não tiver)
npm install -g vercel

# Dentro da pasta do projeto
cd acquamaster-vercel

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
2. Arraste a pasta `acquamaster-vercel` inteira para a área indicada
3. Aguarde o deploy — URL gerada automaticamente

## Atualizar a lista de atletas

Peça ao Claude uma nova listagem e ele gera um `index.html` atualizado.
Basta substituir o arquivo e rodar `vercel --prod` novamente.
