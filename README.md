# Zezinho

Aplicativo mobile-first para cadastrar itens, medicamentos e registrar entradas de estoque.

O logo usa uma ilustração cartoon personalizada do Zezinho.

## O que já está pronto

- Cadastro de itens em unidade, mililitros ou quilos
- Cadastro em modal com escolha inicial entre Item e Medicamento
- Medicamentos com posologia diária, por dias da semana ou livre; via de administração; período definido ou indeterminado; e dosagem
- Um horário por dose nas posologias diária e semanal, exibido também nas Entradas
- Próxima compra de medicamentos estimada pela última entrada, quantidade por dose, horários, dias da semana e período de uso; alerta vermelho quando restam 5 dias ou menos
- Estoque de medicamentos em unidades, ml, mg, g ou gotas, independente da dosagem
- Edição do nome e da unidade dos itens, mantendo os valores das entradas
- Arquivamento e desarquivamento de itens
- Registro de compras com a quantidade adquirida e o saldo que ainda restava
- Nova entrada em modal, com opções filtradas por tipo
- Edição e exclusão de entradas já registradas
- Última reposição calculada automaticamente
- Estimativa de consumo médio por dia após duas compras do mesmo item
- Histórico das entradas mais recentes
- Interface responsiva, otimizada para celular
- Banco preparado para Supabase
- Projeto pronto para publicar na Vercel

A posologia é informativa: não gera recomendações médicas nem baixa automática de estoque. Medicamentos também podem ser editados e arquivados.

A previsão de compra é uma estimativa, não um registro de doses tomadas. Ela usa o total da última entrada (comprado + saldo anterior) e conta as doses previstas desde essa data, no fuso de Recife. Informe a quantidade de estoque por dose no cadastro para representar, por exemplo, 2 comprimidos de 500 mg por tomada. Sem esse valor, dosagem em comprimidos/cápsulas ou unidades compatíveis é usada diretamente; estoque em unidades com dosagem em mg considera 1 unidade por dose, com essa hipótese indicada na tela. Posologia livre ou unidades incompatíveis precisam de informações adicionais; não há conversão de mg em ml/gotas nem interpretação automática das orientações. Um estoque que cobre o fim do período de uso não gera alerta de recompra. O contador se atualiza enquanto a página está aberta.

## Rodar localmente

```bash
npm install
cp .env.example .env.local
npm run dev
```

Sem as variáveis do Supabase, o app abre em modo de demonstração e não salva alterações.

Para verificar validações e tipos: `npm test`, `npm run lint` e `npm run build`.

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
