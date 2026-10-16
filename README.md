# O Token do Satélite Quântico (online)

Aplicação web colaborativa em tempo real. Uma única URL para Emissor, Espião e Receptor, sem instalação por parte dos alunos. Esta é uma **simulação didática**, e não um protocolo QKD real.

## Colocar na internet com Render e GitHub

1. Crie um repositório GitHub e envie **todos os arquivos desta pasta** para a raiz do repositório.
2. No [Render](https://render.com/), crie um **New > Web Service** associado ao repositório.
3. Configure ambiente **Node**, `Build Command` como `npm install`, `Start Command` como `npm start`, e escolha um plano disponível (se houver, Free). O `render.yaml` também pode ser usado para um Blueprint.
4. Publique e compartilhe a URL HTTPS disponibilizada pelo Render. Os participantes não precisam instalar nada.
5. O Emissor cria a sala e compartilha o código de 8 caracteres; Espião e Receptor usam o código. Para comparação, o Emissor também pode escolher o modo *sem Espião*.

Atenção: planos gratuitos e limites de serviços mudam. No Render, uma instância gratuita pode suspender após inatividade e reiniciar, perdendo as salas abertas. Inicie uma sala nova após reinício. **Mantenha apenas uma instância** deste servidor: as salas ficam na memória de processo e não são sincronizadas entre réplicas.

## Rodar em um computador para desenvolvimento (opcional)

Requer Node.js >=20 na máquina do servidor: `npm install` e `npm start`. Acesse `http://localhost:3000`. Participantes continuam precisando apenas do navegador.

## Arquitetura e limitações

- WebSocket para sincronização de eventos e HTTP para servir a interface.
- O servidor sorteia fótons, bases e medições com `crypto.randomInt` e mantém os dados originais para evitar revelar bases/bit internos prematuramente pelo protocolo da aplicação.
- Cada papel ocupa uma vaga, protegida por token de sessão aleatório salvo na aba (sessionStorage). O código de sala tem 32 bits e não substitui login ou controle rigoroso de acesso.
- As salas expiram após quatro horas; estado em memória, sem banco de dados ou persistência após reinício.
- Para implantação pública em larga escala, seriam recomendados autenticação de sala, limites de requisições, logs mínimos, persistência e infraestrutura própria.
- Os sinais recebidos são representados por símbolos opacos (◈), para evitar revelar o estado original no código da página. Na física real, fótons não carregam uma string ASCII legível e um atacante não tem leitura perfeita do estado. A mecânica de medição é simulada no servidor para preservar essa distinção.
- O valor de ~11% é um limite teórico ligado a versões específicas de BB84 e suposições assintóticas. Dez fótons e dois bits de amostragem **não** estabelecem segurança. A chave candidata não pode ser usada como segredo real.
