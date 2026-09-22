# Zezinho

Aplicativo mobile-first para cadastrar itens e registrar entradas de estoque.

O logo usa uma ilustração cartoon personalizada do Zezinho.

## O que já está pronto

- Cadastro de itens em unidade, mililitros ou quilos
- Arquivamento e desarquivamento de itens
- Registro de compras com a quantidade adquirida e o saldo que ainda restava
- Última reposição calculada automaticamente
- Estimativa de consumo médio por dia após duas compras do mesmo item
- Histórico das entradas mais recentes
- Interface responsiva, otimizada para celular
- Banco preparado para Supabase
- Projeto pronto para publicar na Vercel

## Rodar localmente

```bash
npm install
cp .env.example .env.local
npm run dev
```

Sem as variáveis do Supabase, o app abre em modo de demonstração e não salva alterações.

## Configurar o Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. Abra o **SQL Editor** e execute, em ordem, os arquivos da pasta `supabase/migrations`.
3. No painel do projeto, abra **Connect** e copie a URL e a chave publicável.
4. Preencha `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_sua_chave
```

> Esta primeira versão é um estoque compartilhado e não possui login. As políticas do banco permitem leitura e cadastro com a chave publicável. Antes de usar com dados sensíveis ou abrir o endereço ao público, adicione autenticação.

## Publicar na Vercel

1. Envie este projeto para um repositório Git.
2. Importe o repositório em [vercel.com/new](https://vercel.com/new).
3. Cadastre as duas variáveis do `.env.example` em **Environment Variables**.
4. Publique. A Vercel detecta o Next.js automaticamente.
