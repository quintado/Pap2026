# 🔧 Sistema de Manutenção - Instruções de Configuração

## ⚠️ Passo Obrigatório: Adicionar coluna à base de dados

O sistema de manutenção precisa de uma coluna adicional na tabela `trucks`.

### Como adicionar a coluna:

1. **Abra o Supabase Dashboard:**
   - Aceda a https://app.supabase.com/
   - Selecione o seu projeto

2. **Vá para SQL Editor:**
   - No menu lateral esquerdo, clique em "SQL Editor"
   - Clique no botão "New query"

3. **Cole este SQL:**
   ```sql
   ALTER TABLE trucks ADD COLUMN IF NOT EXISTS mileage_since_maintenance INTEGER DEFAULT 0;
   ```

4. **Execute a query:**
   - Clique no botão "Run" (ou pressione Ctrl+Enter)
   - Deverá ver a mensagem "Success" no topo

5. **Recarregue a aplicação:**
   - Feche a aplicação completamente
   - Abra novamente em http://localhost:3000

---

## ✅ Como funciona o sistema de manutenção

### Regras:
- Quando um camião atinge **20.000 km** desde a última manutenção
  - A badge de estado muda de "Disponível" para "Manutenção" (vermelho)
  - O motorista pode clicar na badge para abrir um modal de confirmação
  
### Funcionalidades:
- **Clique em "Manutenção"**: Abre modal de confirmação
- **Modal**:
  - Mostra mensagem: "Este camião atingiu 20.000 km desde a última manutenção"
  - Dois botões:
    - "Cancelar": Fecha o modal sem fazer nada
    - "✅ Manutenção Concluída": Registra manutenção e zera contador

- **Camiões em manutenção**:
  - Não aparecem na lista de camiões disponíveis para novas entregas
  - Aparecem como "Manutenção" na tabela de frota
  - Após confirmação, voltam a estar disponíveis com contador em 0

### Rastreamento:
- O sistema rastreia a quilometragem desde última manutenção
- A cada entrega concluída, o contador incrementa com os km percorridos
- A cada 20.000 km, a manutenção é solicitada
- Após manutenção, o contador volta a 0

---

## 🧪 Testar o sistema

1. **Abra camioes.html**:
   - Vá para a página de camiões
   - Procure por um camião com status "Manutenção"

2. **Se não houver nenhum em manutenção**:
   - Abra o Supabase Dashboard
   - Tabela `trucks`
   - Edite um camião e defina `mileage_since_maintenance` = 20000
   - Recarregue a página

3. **Teste a confirmação**:
   - Clique na badge "Manutenção"
   - Deverá aparecer o modal
   - Clique em "✅ Manutenção Concluída"
   - O camião deverá voltar a "Disponível"

---

## 📋 Checklist de Implementação

- [x] Adicionado `mileage_since_maintenance` ao UI (renderização de badges)
- [x] Criado modal de confirmação em camioes.html
- [x] Adicionadas funções JavaScript: `openMaintenanceModal()`, `closeMaintenance()`, `confirmMaintenance()`
- [x] Adicionado endpoint `/complete-maintenance` no servidor
- [x] Atualizado `/complete-delivery` para incrementar `mileage_since_maintenance`
- [x] Filtrados camiões em manutenção em `entregas.html` (função `openRequestModal`)
- ⏳ **PENDENTE**: Executar SQL no Supabase Dashboard para criar a coluna

---

## 🆘 Troubleshooting

**P: A badge "Manutenção" não aparece**
R: Verifique que:
1. A coluna `mileage_since_maintenance` foi criada na base de dados
2. A página foi recarregada após adicionar a coluna
3. Um camião tem `mileage_since_maintenance >= 20000`

**P: O modal não abre ao clicar em "Manutenção"**
R: Verifique a consola do navegador (F12) para erros de JavaScript

**P: A entrega finalizada não incrementa o contador**
R: Verifique que:
1. A quilometragem final é maior que a quilometragem anterior
2. O `finalMileage` está sendo enviado corretamente

---

## 📝 Notas Técnicas

- A coluna `mileage_since_maintenance` é independente de `mileage` (quilometragem total)
- O contador reseta a 0 apenas quando manutenção é concluída
- Não afeta a visualização de entregas, apenas filtra camiões disponíveis para novas solicitações
