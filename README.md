# Zezinho

Aplicativo mobile-first para cadastrar itens, medicamentos e registrar entradas de estoque.

O logo usa uma ilustração cartoon personalizada do Zezinho.

## O que já está pronto

- Cadastro de itens em unidade, mililitros ou quilos
- Abas separadas de Itens e Medicamentos, cada uma com cadastro em modal, lista de ativos e consulta dos arquivados em modal separado com busca e desarquivamento
- Medicamentos com posologia diária, por dias da semana ou livre; via de administração; período definido ou indeterminado; e dosagem
- Um horário por dose nas posologias diária e semanal, exibido também nas Entradas
- Opção “Imprimir A4” em Medicamentos, com prévia ajustada a uma única folha e grupos por horário; cada medicamento aparece em todas as suas tomadas, com princípio ativo, nomes comerciais, dosagem, posologia, quantidade por tomada quando cadastrada, via e orientações. Medicamentos sem horário aparecem ao final; permite imprimir ou salvar como PDF pelo navegador
- Agenda de medicamentos acessível por “Ver agenda” como ação destacada e separada das abas na barra inferior, em modal de tela inteira em `/agenda`, com visualizações de dia e semana, navegação por data e horário atual de Recife; fechar ou voltar retorna à tela anterior, e links diretos também abrem a agenda em tela inteira. Doses seguem os dias e o período de uso cadastrados, com detalhes ao tocar e indicação dos medicamentos sem horário definido
- Medicamentos identificados pelo princípio ativo e dosagem, com nomes comerciais em destaque logo abaixo do título
- Dosagem com até 10 componentes, cada um com princípio ativo, quantidade e unidade próprios; associações exibidas como 400 mg + 80 mg
- Nomes comerciais opcionais cadastrados um a um, com inclusão por botão/Enter, remoção individual e busca pelo princípio ativo ou marca no cadastro e nas Entradas
- Próxima compra de medicamentos estimada pela última entrada, quantidade por dose, horários, dias da semana e período de uso; alerta vermelho quando restam 5 dias ou menos
- Estoque de medicamentos em unidades, ml, mg, g ou gotas, independente da dosagem
- Edição do nome e da unidade dos itens, mantendo os valores das entradas
- Arquivamento e desarquivamento de itens
- Registro de compras com a quantidade adquirida e o saldo que ainda restava
- Nova entrada em modal, com opções filtradas por tipo
- Data e hora da entrada editáveis, no fuso de Recife, para registrar compras passadas ou agendar compras futuras
- Edição e exclusão de entradas já registradas
- Última reposição calculada automaticamente
- Estimativa de consumo médio por dia após duas compras do mesmo item
- Histórico das entradas mais recentes
- Interface responsiva, otimizada para celular
- Resumo denso de medicamentos no Início, com princípio ativo, nomes comerciais, dosagem e quantidade em estoque, sem blocos repetidos de reposição ou consumo
- Banco preparado para Supabase
- Projeto pronto para publicar na Vercel

A posologia é informativa: não gera recomendações médicas nem baixa automática de estoque. Medicamentos também podem ser editados e arquivados.

O campo booleano `items.requires_special_control` registra apenas medicamentos sujeitos a controle especial, e não a exigência geral de receita ou a retenção de receita de antibióticos. A migração `20261026013847_replace_prescription_with_special_control.sql` substitui o campo anterior e mantém marcadas somente quetiapina e mirtazapina entre os medicamentos ativos revisados. O valor `false` não significa que o medicamento seja isento de receita. Novos registros começam com `false` e precisam de revisão manual — o aplicativo não classifica automaticamente pelo nome. A leitura do estoque expõe esse campo como `requiresSpecialControl`, e editar a posologia ou dosagem não o sobrescreve. O selo “Controle especial” aparece no resumo do Início, no cadastro de medicamentos, nos cartões e detalhes da agenda e na impressão/PDF A4 somente quando o campo está marcado. Na impressão, o selo usa texto e contorno para continuar identificável em preto e branco. Ainda não há edição desse campo na interface.

A agenda destaca os grupos “Agora” e “Próximo”, com contagem regressiva, e identifica horários passados e posteriores. A linha abaixo da data permite saltar para o próximo grupo, inclusive em outro dia; ao abrir hoje, a agenda posiciona a rolagem perto do próximo horário. Os rótulos acompanham o horário de Recife e não indicam se as doses foram tomadas. Medicamentos sem horário ficam em um grupo próprio dentro de cada dia.

Para cadastrar uma associação, informe o nome completo no campo “Princípio ativo ou associação” e use “Adicionar componente” na dosagem. Identifique cada princípio ativo e sua quantidade/unidade; a lista mantém a ordem informada e aceita unidades diferentes. O nome do componente é opcional quando há apenas um. As dosagens antigas continuam legíveis e passam para o formato de componentes ao salvar uma edição. A busca também encontra os nomes dos componentes.

Medicamentos com múltiplos componentes precisam da quantidade de estoque por dose para gerar a previsão de compra. Por exemplo, uma associação de 400 mg + 80 mg que usa 1 comprimido por tomada deve ter estoque em unidades e quantidade por dose igual a 1. O app não soma as dosagens nem usa a quantidade de um ingrediente para deduzir o consumo da associação.

Entradas futuras aparecem como agendadas no histórico. Só passam a contar no estoque, na última reposição, no consumo médio e na previsão de medicamentos na data e hora escolhidas. A tela se atualiza quando chega esse horário; não é preciso registrar a entrada novamente. Compras passadas são ordenadas pela data informada, não pelo momento em que foram cadastradas. Ao registrar uma entrada passada ou futura, informe o saldo que restava antes daquela compra, na data escolhida.

A previsão de compra é uma estimativa, não um registro de doses tomadas. Ela usa o total da última entrada (comprado + saldo anterior) e conta as doses previstas desde essa data, no fuso de Recife. Informe a quantidade de estoque por dose no cadastro para representar, por exemplo, 2 comprimidos de 500 mg por tomada. Sem esse valor, dosagem em comprimidos/cápsulas ou unidades compatíveis é usada diretamente; estoque em unidades com dosagem em mg considera 1 unidade por dose, com essa hipótese indicada na tela. Posologia livre ou unidades incompatíveis precisam de informações adicionais; não há conversão de mg em ml/gotas nem interpretação automática das orientações. Um estoque que cobre o fim do período de uso não gera alerta de recompra. O contador se atualiza enquanto a página está aberta.

## Rodar localmente

```bash
npm install
cp .env.example .env.local
npm run dev
```

Sem as variáveis do Supabase, o app abre em modo de demonstração e não salva alterações.

Para verificar validações e tipos: `npm test`, `npm run lint` e `npm run build`.

Para verificar as restrições de dosagem no banco, execute `tests/medication-dosage.sql` em um banco de teste com todas as migrações aplicadas. O teste usa o papel `anon` e desfaz as próprias inserções e alterações ao terminar.

## Configurar o Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. Abra o **SQL Editor** e execute, em ordem, os arquivos da pasta `supabase/migrations`.
3. No painel do projeto, abra **Connect** e copie a URL e a chave publicável.
4. Preencha `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_sua_chave
```

Ao atualizar uma instalação existente, aplique `20261025173749_add_medication_dosage_components.sql` antes de publicar a versão com múltiplos componentes. A migração aceita os dois formatos de dosagem, preserva os demais campos e não reescreve medicamentos ou entradas de estoque.

> Esta primeira versão é um estoque compartilhado e não possui login. As políticas do banco permitem leitura e cadastro com a chave publicável. Antes de usar com dados sensíveis ou abrir o endereço ao público, adicione autenticação.

## Publicar na Vercel

1. Envie este projeto para um repositório Git.
2. Importe o repositório em [vercel.com/new](https://vercel.com/new).
3. Cadastre as duas variáveis do `.env.example` em **Environment Variables**.
4. Publique. A Vercel detecta o Next.js automaticamente.
