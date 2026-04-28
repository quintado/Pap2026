# Backend - CamiGest

Esta é a parte do backend do sistema CamiGest, responsável pela lógica do servidor, APIs, banco de dados e processamento de dados.

## Estrutura

- `src/server.js`: Arquivo principal do servidor.
- `src/controllers/`: Controladores da API.
- `src/models/`: Modelos de dados.
- `src/routes/`: Definições de rotas.
- `src/utils/`: Utilitários e scripts auxiliares.
- `src/modules/`: Módulos específicos (veiculos, entregas, utilizadores).

## Instalação

1. Instale as dependências:
   ```
   npm install
   ```

2. Configure o arquivo `.env` com base no `.env.example`.

3. Execute o servidor:
   ```
   npm start
   ```

## Scripts Disponíveis

- `npm start`: Inicia o servidor.
- Scripts em `src/utils/`: Para manutenção, debug e migrações.