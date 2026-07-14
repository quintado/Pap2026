require('dotenv').config();

const fs = require('fs');
const path = require('path');
const express = require("express");
const bcrypt = require("bcrypt");
const cors = require("cors");
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');

const app = express();
const PORT = process.env.PORT || 3000;
const frontendPath = path.resolve(__dirname, '..', '..', 'frontend');

const { supabase, testConnection } = require("./config/database");
const {
  validateLogin,
  validateRegister,
  validateTruck,
  validateDelivery,
  validateUserCreation
} = require("./middleware/validation");

app.use(helmet({
  contentSecurityPolicy: false,
}));

app.use(compression());

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.ALLOWED_ORIGINS?.split(',')
    : '*',
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(express.static(frontendPath));
app.use('/css', express.static(path.join(frontendPath, 'src', 'styles')));
app.use(express.static(path.join(frontendPath, 'src', 'pages')));
app.use('/public', express.static(path.join(frontendPath, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

app.get(/^\/([\w\-]+\.html)$/, (req, res, next) => {
  const pageFile = path.join(frontendPath, 'src', 'pages', req.params[0]);
  if (fs.existsSync(pageFile)) {
    return res.sendFile(pageFile);
  }
  next();
});

app.post("/register", async (req, res) => {
  const { name, password, company } = req.body;

  // Validação detalhada
  if (!name || !password || !company) {
    return res.status(400).json({ message: "Preencha todos os campos." });
  }
  if (name.trim().length < 2 || name.trim().length > 100) {
    return res.status(400).json({ message: "O nome deve ter entre 2 e 100 caracteres." });
  }
  if (password.length < 6) {
    return res.status(400).json({ message: "A palavra-passe deve ter no mínimo 6 caracteres." });
  }
  if (company.trim().length < 2 || company.trim().length > 100) {
    return res.status(400).json({ message: "O nome da empresa deve ter entre 2 e 100 caracteres." });
  }

  try {
    // Verificar se usuário já existe
    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .eq("name", name)
      .eq("company", company)
      .single();

    if (existingUser) {
      return res.status(400).json({
        message: "Já existe um utilizador com este nome nesta empresa."
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const { error } = await supabase.from("users").insert([
      {
        name: name,
        password: hashedPassword,
        company: company,
        role: "CEO",
        created_at: new Date().toISOString()
      },
    ]);

    if (error) {
      console.error('Erro ao criar utilizador:', error);
      return res.status(400).json({
        message: "Erro ao criar utilizador. Tente novamente."
      });
    }

    res.json({ message: "Conta criada com sucesso!" });
  } catch (err) {
    console.error('Erro no registro:', err);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
});

app.get("/users", async (req, res) => {
  const { company } = req.query;

  if (!company) {
    return res.status(400).json({ message: "Empresa não especificada." });
  }

  try {
    const { data, error } = await supabase
      .from("users")
      .select("id, name, role, created_at")
      .eq("company", company);

    if (error) throw error;

    res.json(data);
  } catch (err) {
    res.status(500).json({ message: "Erro ao buscar usuários: " + err.message });
  }
});

app.post("/login", async (req, res) => {
  const { name, password } = req.body;

  // Validação básica manual (mais permissiva que express-validator)
  if (!name || !password) {
    return res.status(400).json({ message: "Preencha todos os campos." });
  }

  try {
    const { data: users, error } = await supabase
      .from("users")
      .select("*")
      .eq("name", name)
      .limit(1);

    if (error) {
      console.error('Erro na busca do utilizador:', error);
      return res.status(500).json({ message: "Erro ao processar login." });
    }

    if (!users || users.length === 0) {
      return res.status(404).json({ message: "Utilizador não encontrado." });
    }

    const user = users[0];

    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return res.status(401).json({ message: "Palavra-passe incorreta." });
    }

    // Retornar dados do usuário (sem a senha)
    res.json({
      message: `Bem-vindo, ${user.name}!`,
      user: {
        id: user.id,
        name: user.name,
        company: user.company,
        role: user.role,
        created_at: user.created_at,
      },
    });
  } catch (err) {
    console.error('Erro no login:', err);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
});

app.post("/create-user", async (req, res) => {
  const { name, password, role, createdBy } = req.body;

  if (!name || !password || !role || !createdBy) {
    return res.status(400).json({ message: "Preenche todos os campos." });
  }

  const { data: creator } = await supabase
    .from("users")
    .select("role, company")
    .eq("id", createdBy)
    .single();

  if (!creator || creator.role !== "CEO") {
    return res.status(403).json({ message: "Apenas CEOs podem criar novos usuários." });
  }

  try {
    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .eq("name", name)
      .eq("company", creator.company)
      .single();

    if (existingUser) {
      return res.status(400).json({ message: "Já existe um usuário com este nome na empresa." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const { error } = await supabase.from("users").insert([
      {
        name,
        password: hashedPassword,
        role,
        company: creator.company,
        created_by: createdBy,
        created_at: new Date().toISOString()
      }
    ]);

    if (error) throw error;

    res.json({ message: "Usuário criado com sucesso!" });
  } catch (err) {
    res.status(500).json({ message: "Erro ao criar usuário: " + err.message });
  }
});

// Atualizar usuário
app.put("/update-user/:id", async (req, res) => {
  const { name, password, role, updatedBy } = req.body;
  const userId = req.params.id;

  const { data: updater } = await supabase
    .from("users")
    .select("role, company")
    .eq("id", updatedBy)
    .single();

  if (!updater || updater.role !== "CEO") {
    return res.status(403).json({ message: "Apenas CEOs podem atualizar usuários." });
  }

  try {
    const { data: user } = await supabase
      .from("users")
      .select("company, role")
      .eq("id", userId)
      .single();

    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado." });
    }

    if (user.company !== updater.company) {
      return res.status(403).json({ message: "Sem permissão para atualizar este usuário." });
    }

    // CEOs podem atualizar qualquer utilizador, incluindo outros CEOs
    // (Restrição removida para permitir gestão completa)

    const updateData = {
      name,
      role,
      updated_by: updatedBy,
      updated_at: new Date().toISOString()
    };

    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    const { error } = await supabase
      .from("users")
      .update(updateData)
      .eq("id", userId);

    if (error) throw error;

    res.json({ message: "Usuário atualizado com sucesso!" });
  } catch (err) {
    res.status(500).json({ message: "Erro ao atualizar usuário: " + err.message });
  }
});

// Excluir usuário
app.delete("/delete-user/:id", async (req, res) => {
  const { deletedBy } = req.body;
  const userId = req.params.id;
  try {
    console.log(`[DELETE USER] Tentando eliminar userId=${userId} por deletedBy=${deletedBy}`);

    const { data: deleter } = await supabase
      .from("users")
      .select("role, company")
      .eq("id", deletedBy)
      .single();

    const { data: deletedUser } = await supabase
      .from("users")
      .select("role, company")
      .eq("id", userId)
      .single();

    console.log(`[DELETE USER] Deleter: role=${deleter?.role}, company=${deleter?.company}`);
    console.log(`[DELETE USER] Target: role=${deletedUser?.role}, company=${deletedUser?.company}`);

    // Verificar se quem está eliminando existe e tem permissão básica
    if (!deleter) {
      console.log('[DELETE USER] ERRO: Deleter não encontrado');
      return res.status(403).json({
        message: "Utilizador não encontrado."
      });
    }

    // Trabalhadores não podem eliminar ninguém
    if (deleter.role === "camionista") {
      console.log('[DELETE USER] ERRO: Camionista tentou eliminar');
      return res.status(403).json({
        message: "Trabalhadores não têm permissão para eliminar utilizadores."
      });
    }

    // Verificar se o usuário a ser eliminado existe
    if (!deletedUser) {
      console.log('[DELETE USER] ERRO: Usuário a eliminar não encontrado');
      return res.status(404).json({
        message: "Utilizador não encontrado."
      });
    }

    // Verificar se são da mesma empresa
    if (deleter.company !== deletedUser.company) {
      console.log('[DELETE USER] ERRO: Empresas diferentes');
      return res.status(403).json({
        message: "Não pode eliminar utilizador de outra empresa."
      });
    }

    // REGRAS DE PERMISSÃO:
    // - CEOs podem eliminar TODOS (CEOs, supervisores, camionistas)
    // - Supervisores podem eliminar APENAS camionistas

    if (deleter.role === "supervisor") {
      // Supervisores só podem eliminar trabalhadores
      if (deletedUser.role !== "camionista") {
        console.log('[DELETE USER] ERRO: Supervisor tentou eliminar não-trabalhador');
        return res.status(403).json({
          message: "Supervisores só podem eliminar trabalhadores."
        });
      }
    }

    // Se chegou aqui, é CEO ou supervisor eliminando camionista - permitido!
    console.log('[DELETE USER] Permissões OK, executando delete...');

    const { error } = await supabase
      .from("users")
      .delete()
      .eq("id", userId);

    if (error) {
      console.log('[DELETE USER] ERRO do Supabase:', error);
      throw error;
    }

    console.log('[DELETE USER] Sucesso!');
    res.json({ message: "Usuário excluído com sucesso!" });
  } catch (err) {
    res.status(500).json({ message: "Erro ao excluir usuário: " + err.message });
  }
});


// ===============================
// Eliminar empresa (apenas CEO)
// ===============================

app.delete("/delete-company", async (req, res) => {
  const { userId, company } = req.body;

  if (!userId || !company) {
    return res.status(400).json({ message: "Dados em falta." });
  }

  try {
    // Verificar que o utilizador é CEO e pertence à empresa
    const { data: requester } = await supabase
      .from("users")
      .select("role, company")
      .eq("id", userId)
      .single();

    if (!requester || requester.role !== "CEO") {
      return res.status(403).json({ message: "Sem permissão para eliminar a empresa." });
    }

    if (requester.company !== company) {
      return res.status(403).json({ message: "Não podes eliminar uma empresa que não é a tua." });
    }

    console.log(`[DELETE COMPANY] CEO userId=${userId} a eliminar empresa "${company}"`);

    // Eliminar entregas
    const { error: delDeliveries } = await supabase
      .from("deliveries")
      .delete()
      .eq("company", company);
    if (delDeliveries) throw delDeliveries;

    // Eliminar camiões
    const { error: delTrucks } = await supabase
      .from("trucks")
      .delete()
      .eq("company", company);
    if (delTrucks) throw delTrucks;

    // Eliminar todos os utilizadores da empresa
    const { error: delUsers } = await supabase
      .from("users")
      .delete()
      .eq("company", company);
    if (delUsers) throw delUsers;

    console.log(`[DELETE COMPANY] Empresa "${company}" eliminada com sucesso.`);
    res.json({ message: `Empresa "${company}" e todos os dados associados foram eliminados.` });
  } catch (err) {
    console.error("[DELETE COMPANY] Erro:", err);
    res.status(500).json({ message: "Erro ao eliminar empresa: " + err.message });
  }
});

app.get("/deliveries", async (req, res) => {
  const { company } = req.query;

  if (!company) {
    console.warn(`[GET DELIVERIES] Aviso: Empresa não especificada na query.`);
    return res.status(400).json({ message: "Empresa não especificada." });
  }

  const queryCompany = company.trim();
  console.log(`[GET DELIVERIES] Buscando para empresa: "${queryCompany}"`);

  try {
    // Buscar entregas diretamente pela coluna company (case-insensitive)
    const { data: deliveries, error } = await supabase
      .from("deliveries")
      .select(`
        *,
        worker:users!assigned_to(id, name),
        creator:users!created_by(name)
      `)
      .ilike("company", queryCompany)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(`[GET DELIVERIES] Erro Supabase:`, error);
      throw error;
    }

    // Diagnostic log of the first few rows
    if (deliveries && deliveries.length > 0) {
      console.log(`[DEBUG] Primária entrega recebida:`, JSON.stringify(deliveries[0], null, 2));
    }

    console.log(`[GET DELIVERIES] Sucesso: Encontradas ${(deliveries && deliveries.length) || 0} entregas para "${queryCompany}".`);
    res.json(deliveries || []);
  } catch (err) {
    console.error(`[GET DELIVERIES] Erro fatal:`, err);
    console.trace(err);
    res.status(500).json({
      message: "Erro ao buscar entregas: " + err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

app.post("/create-delivery", validateDelivery, async (req, res) => {
  const { tipo, origem, destino, estado, dataPrevista, dataSaida, observacoes, createdBy } = req.body;

  console.log(`[CREATE DELIVERY] Início: createdBy=${createdBy}`);

  // Validação de datas
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (dataSaida) {
    const saida = new Date(dataSaida); saida.setHours(0, 0, 0, 0);
    if (saida < today) {
      return res.status(400).json({ message: "A data de saída não pode ser anterior ao dia de hoje." });
    }
    if (dataPrevista) {
      const prevista = new Date(dataPrevista); prevista.setHours(0, 0, 0, 0);
      if (prevista <= saida) {
        return res.status(400).json({ message: "A data prevista deve ser obrigatoriamente posterior à data de saída." });
      }
    }
  }

  try {
    const { data: creator } = await supabase
      .from("users")
      .select("role, company")
      .eq("id", createdBy)
      .single();

    if (!creator || (creator.role !== "CEO" && creator.role !== "supervisor")) {
      console.log(`[CREATE DELIVERY] Erro: Creator not found or no permission. Creator:`, creator);
      return res.status(403).json({ message: "Sem permissão para criar entregas." });
    }

    console.log(`[CREATE DELIVERY] Inserindo:`, {
      tipo, origem, destino,
      company: creator.company,
      createdBy
    });

    // Verificar se já existe uma entrega com os mesmos campos (evitar duplicados)
    const { data: existing } = await supabase
      .from("deliveries")
      .select("id, estado")
      .eq("company", creator.company)
      .eq("tipo", tipo)
      .eq("origem", origem)
      .eq("destino", destino)
      .eq("data_saida", dataSaida || null)
      .eq("data_prevista", dataPrevista || null)
      .neq("estado", "concluido");  // ignorar entregas já concluídas

    if (existing && existing.length > 0) {
      return res.status(409).json({
        message: `Já existe uma entrega ativa com os mesmos dados: ${tipo} de ${origem} para ${destino} (${dataSaida ? new Date(dataSaida).toLocaleDateString('pt-PT') : '—'} → ${dataPrevista ? new Date(dataPrevista).toLocaleDateString('pt-PT') : '—'}). Não é possível criar entregas duplicadas.`
      });
    }

    const { error } = await supabase.from("deliveries").insert([
      {
        tipo,
        origem,
        destino,
        estado: estado || "pendente",
        data_prevista: dataPrevista || null,
        data_saida: dataSaida || null,
        observacoes,
        company: creator.company || "CamiGest",
        created_by: createdBy,
        created_at: new Date().toISOString()
      }
    ]);

    if (error) {
      console.error('[CREATE DELIVERY] Erro Supabase:', error);
      throw error;
    }

    res.json({ message: "A entrega foi criada com êxito." });
  } catch (err) {
    console.error('[CREATE DELIVERY] Erro no catch:', err);
    res.status(500).json({ message: "Erro ao criar entrega: " + err.message });
  }
});

app.get("/deliveries/:id", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("deliveries")
      .select("*")
      .eq("id", req.params.id)
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ message: "Entrega não encontrada." });

    res.json(data);
  } catch (err) {
    res.status(500).json({ message: "Erro ao obter entrega: " + err.message });
  }
});

app.put("/update-delivery/:id", validateDelivery, async (req, res) => {
  const { tipo, origem, destino, estado, dataPrevista, dataSaida, observacoes, updatedBy } = req.body;
  const deliveryId = req.params.id;

  // Validação de datas
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (dataSaida) {
    const saida = new Date(dataSaida); saida.setHours(0, 0, 0, 0);
    if (saida < today) {
      return res.status(400).json({ message: "A data de saída não pode ser anterior ao dia de hoje." });
    }
    if (dataPrevista) {
      const prevista = new Date(dataPrevista); prevista.setHours(0, 0, 0, 0);
      if (prevista <= saida) {
        return res.status(400).json({ message: "A data prevista deve ser obrigatoriamente posterior à data de saída." });
      }
    }
  }

  try {
    const { data: updater } = await supabase
      .from("users")
      .select("role, company")
      .eq("id", updatedBy)
      .single();

    if (!updater || (updater.role !== "CEO" && updater.role !== "supervisor")) {
      return res.status(403).json({ message: "Sem permissão para atualizar entregas." });
    }

    const updateData = {
      tipo,
      origem,
      destino,
      estado,
      data_prevista: dataPrevista || null,
      data_saida: dataSaida || null,
      observacoes,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from("deliveries")
      .update(updateData)
      .eq("id", deliveryId);

    if (error) throw error;

    res.json({ message: "Entrega atualizada com sucesso!" });
  } catch (err) {
    res.status(500).json({ message: "Erro ao atualizar entrega: " + err.message });
  }
});

app.delete("/delete-delivery/:id", async (req, res) => {
  const { deletedBy } = req.body;
  const deliveryId = req.params.id;

  try {
    const { data: deleter } = await supabase
      .from("users")
      .select("role")
      .eq("id", deletedBy)
      .single();

    if (!deleter || (deleter.role !== "CEO" && deleter.role !== "supervisor")) {
      return res.status(403).json({ message: "Sem permissão para eliminar entregas." });
    }

    const { error } = await supabase
      .from("deliveries")
      .delete()
      .eq("id", deliveryId);

    if (error) throw error;

    res.json({ message: "Entrega eliminada com sucesso!" });
  } catch (err) {
    res.status(500).json({ message: "Erro ao eliminar entrega: " + err.message });
  }
});

app.post("/create-truck", validateTruck, async (req, res) => {
  const { plate, model, mileage, createdBy } = req.body;

  try {
    const { data: creator } = await supabase
      .from("users")
      .select("role, company")
      .eq("id", createdBy)
      .single();

    if (!creator || (creator.role !== "CEO" && creator.role !== "supervisor")) {
      return res.status(403).json({ message: "Sem permissão para adicionar camiões." });
    }

    // Normalizar matrícula (maiúsculas, sem espaços extra)
    const normalizedPlate = (plate || "").trim().toUpperCase();

    // Verificar se já existe um camião com a mesma matrícula na empresa
    // Usar .maybeSingle() que retorna null sem erro quando não há resultados
    const { data: existingTruck } = await supabase
      .from("trucks")
      .select("id")
      .ilike("plate", normalizedPlate)
      .eq("company", creator.company)
      .maybeSingle();

    if (existingTruck) {
      return res.status(409).json({
        message: `A matrícula ${normalizedPlate} já se encontra registada na frota. Por favor, verifique e tente novamente.`
      });
    }

    const initialMileage = Number(mileage);
    const initialMileageSinceMaintenance = initialMileage % 20000;
    const needsMaintenanceOnCreate = initialMileage >= 20000;

    const { error } = await supabase.from("trucks").insert([
      {
        plate: normalizedPlate,
        model,
        mileage: initialMileage,
        mileage_since_maintenance: initialMileageSinceMaintenance,
        status: needsMaintenanceOnCreate ? "manutencao" : "disponivel",
        company: creator.company,
        created_by: createdBy,
        created_at: new Date().toISOString()
      }
    ]);

    if (error) {
      console.error('[CREATE TRUCK] Erro Supabase:', error);
      throw error;
    }

    res.json({ message: "Camião adicionado com sucesso!" });
  } catch (err) {
    console.error('[CREATE TRUCK] Erro:', err);

    // Intercectar erro de constraint única da base de dados (código Postgres 23505)
    if (err.code === "23505" || (err.message && err.message.includes("unique constraint"))) {
      return res.status(409).json({
        message: "Esta matrícula já se encontra registada na frota. Por favor, verifique e tente novamente."
      });
    }

    res.status(500).json({ message: "Ocorreu um erro ao registar o camião. Por favor, tente novamente." });
  }
});



app.post("/request-delivery", async (req, res) => {
  const { deliveryId, truckId, workerId } = req.body;

  // Validação de campos obrigatórios
  if (!deliveryId || !truckId || !workerId) {
    return res.status(400).json({ message: "deliveryId, truckId e workerId são obrigatórios." });
  }
  if (!Number.isInteger(Number(deliveryId)) || !Number.isInteger(Number(truckId)) || !Number.isInteger(Number(workerId))) {
    return res.status(400).json({ message: "IDs inválidos." });
  }

  try {
    const { data: worker } = await supabase
      .from("users")
      .select("role")
      .eq("id", workerId)
      .single();

    if (!worker || worker.role !== "camionista") {
      return res.status(403).json({ message: "Apenas camionistas podem solicitar entregas." });
    }

    const { data: truck } = await supabase
      .from("trucks")
      .select("status")
      .eq("id", truckId)
      .single();

    if (!truck || truck.status !== "disponivel") {
      return res.status(403).json({ message: "Camião não está disponível." });
    }

    // Buscar a entrega que está a ser pedida para obter as suas datas
    const { data: newDelivery, error: newDeliveryErr } = await supabase
      .from("deliveries")
      .select("id, data_saida, data_prevista, tipo, origem, destino")
      .eq("id", parseInt(deliveryId))
      .single();

    if (newDeliveryErr || !newDelivery) {
      return res.status(404).json({ message: "Entrega não encontrada." });
    }

    const newStart = newDelivery.data_saida ? new Date(newDelivery.data_saida) : null;
    const newEnd   = newDelivery.data_prevista ? new Date(newDelivery.data_prevista) : null;

    // Só validar conflito se a entrega tiver datas definidas
    if (newStart && newEnd) {
      // Buscar todas as entregas activas deste camionista (em-curso ou pendente com ele atribuído)
      const { data: activeDeliveries } = await supabase
        .from("deliveries")
        .select("id, data_saida, data_prevista, tipo, origem, destino, estado")
        .eq("assigned_to", parseInt(workerId))
        .in("estado", ["em-curso", "pendente"]);

      const conflict = (activeDeliveries || []).find(d => {
        const dStart = d.data_saida ? new Date(d.data_saida) : null;
        const dEnd   = d.data_prevista ? new Date(d.data_prevista) : null;
        if (!dStart || !dEnd) return false;
        // Sobreposição: nova entrega começa antes da existente acabar E acaba depois dela começar
        return newStart <= dEnd && newEnd >= dStart;
      });

      if (conflict) {
        const conflictStart = conflict.data_saida
          ? new Date(conflict.data_saida).toLocaleDateString('pt-PT') : '—';
        const conflictEnd   = conflict.data_prevista
          ? new Date(conflict.data_prevista).toLocaleDateString('pt-PT') : '—';
        return res.status(409).json({
          message: `Não é possível aceitar esta entrega. Já tens uma entrega atribuída de ${conflict.origem} para ${conflict.destino} entre ${conflictStart} e ${conflictEnd} que coincide com este período.`
        });
      }
    }

    const { error } = await supabase.from("delivery_requests").insert([
      {
        delivery_id: deliveryId,
        truck_id: truckId,
        worker_id: workerId,
        status: "pendente"
      }
    ]);

    if (error) throw error;

    res.json({ message: "Solicitação enviada com sucesso!" });
  } catch (err) {
    res.status(500).json({ message: "Erro ao solicitar entrega: " + err.message });
  }
});

app.get("/pending-requests", async (req, res) => {
  const { company } = req.query;
  console.log(`[API] Buscando solicitações pendentes para empresa: "${company}"`);

  try {
    const { data: requests, error } = await supabase
      .from("delivery_requests")
      .select(`
        *,
        delivery:delivery_id(*),
        worker:worker_id(name),
        truck:truck_id(plate, model)
      `)
      .eq("status", "pendente");

    if (error) throw error;

    // Filtragem por empresa no lado do servidor (case-insensitive + trim)
    const filteredRequests = (requests || []).filter(r => {
      const match = r && r.delivery && r.delivery.company &&
        r.delivery.company.trim().toLowerCase() === (company || "").trim().toLowerCase();
      return match;
    });

    console.log(`[API] Encontradas ${filteredRequests.length} solicitações após filtragem.`);
    res.json(filteredRequests);
  } catch (err) {
    console.error(`[API] Erro ao buscar solicitações:`, err);
    res.status(500).json({ message: "Erro ao buscar solicitações: " + err.message });
  }
});

app.post("/respond-request", async (req, res) => {
  const { requestId, approved, responderId } = req.body;

  // Validação de campos
  if (requestId === undefined || requestId === null || approved === undefined || !responderId) {
    return res.status(400).json({ message: "requestId, approved e responderId são obrigatórios." });
  }
  if (typeof approved !== 'boolean') {
    return res.status(400).json({ message: "O campo 'approved' deve ser boolean." });
  }

  try {
    const { data: responder } = await supabase
      .from("users")
      .select("role")
      .eq("id", responderId)
      .single();

    if (!responder || (responder.role !== "CEO" && responder.role !== "supervisor")) {
      return res.status(403).json({ message: "Sem permissão para responder solicitações." });
    }

    const { data: request } = await supabase
      .from("delivery_requests")
      .select("*")
      .eq("id", requestId)
      .single();

    if (!request) {
      return res.status(404).json({ message: "Solicitação não encontrada." });
    }

    if (approved) {
      // Buscar a entrega deste pedido para verificar as suas datas
      const { data: targetDelivery } = await supabase
        .from("deliveries")
        .select("id, data_saida, data_prevista, origem, destino")
        .eq("id", request.delivery_id)
        .single();

      // Validar conflito de datas com outras entregas activas do mesmo camionista
      if (targetDelivery?.data_saida && targetDelivery?.data_prevista) {
        const newStart = new Date(targetDelivery.data_saida);
        const newEnd   = new Date(targetDelivery.data_prevista);

        const { data: activeDeliveries } = await supabase
          .from("deliveries")
          .select("id, data_saida, data_prevista, origem, destino, estado")
          .eq("assigned_to", request.worker_id)
          .eq("estado", "em-curso");

        const conflict = (activeDeliveries || []).find(d => {
          if (!d.data_saida || !d.data_prevista) return false;
          const dStart = new Date(d.data_saida);
          const dEnd   = new Date(d.data_prevista);
          return newStart <= dEnd && newEnd >= dStart;
        });

        if (conflict) {
          const conflictStart = new Date(conflict.data_saida).toLocaleDateString('pt-PT');
          const conflictEnd   = new Date(conflict.data_prevista).toLocaleDateString('pt-PT');
          return res.status(409).json({
            message: `Não é possível aprovar esta entrega. O camionista já tem uma entrega activa de ${conflict.origem} para ${conflict.destino} entre ${conflictStart} e ${conflictEnd}, que coincide com este período.`
          });
        }
      }

      await supabase
        .from("delivery_requests")
        .update({ status: "aprovada" })
        .eq("id", requestId);

      await supabase
        .from("trucks")
        .update({ status: "em_uso", assigned_to: request.worker_id })
        .eq("id", request.truck_id);

      const updateData = {
        estado: "em-curso",
        truck_id: request.truck_id,
        assigned_to: request.worker_id
      };

      console.log(`[RESPOND REQUEST] Atualizando entrega ${request.delivery_id} com worker_id ${request.worker_id}`);

      const { error: updateError } = await supabase
        .from("deliveries")
        .update(updateData)
        .eq("id", request.delivery_id);

      if (updateError) {
        console.error(`[RESPOND REQUEST] Erro ao atualizar entrega:`, updateError);
        throw updateError;
      }
    } else {
      await supabase
        .from("delivery_requests")
        .update({ status: "rejeitada" })
        .eq("id", requestId);
    }

    res.json({
      message: approved ? "A solicitação foi aprovada com êxito." : "A solicitação foi rejeitada."
    });
  } catch (err) {
    res.status(500).json({ message: "Erro ao processar solicitação: " + err.message });
  }
});

app.get("/trucks/:id", async (req, res) => {
  const truckId = parseInt(req.params.id);
  if (!Number.isInteger(truckId) || truckId <= 0) {
    return res.status(400).json({ message: "ID de camião inválido." });
  }
  try {
    const { data, error } = await supabase
      .from("trucks")
      .select("id, plate, model, mileage, status")
      .eq("id", truckId)
      .single();
    if (error) throw error;
    if (!data) return res.status(404).json({ message: "Camião não encontrado." });
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: "Erro ao obter camião: " + err.message });
  }
});

app.post("/complete-delivery", async (req, res) => {
  const { deliveryId, finalMileage, workerId } = req.body;

  try {
    // Validação básica de campos
    if (!deliveryId || finalMileage === undefined || finalMileage === null) {
      return res.status(400).json({ message: "Faltam parâmetros obrigatórios." });
    }
    const mileageNum = Number(finalMileage);
    if (!Number.isFinite(mileageNum) || mileageNum < 0) {
      return res.status(400).json({ message: "A quilometragem final deve ser um número positivo." });
    }
    if (mileageNum > 9_999_999) {
      return res.status(400).json({ message: "Quilometragem final inválida (valor demasiado alto)." });
    }

    // Buscar a entrega na BD para obter truck_id e assigned_to reais
    const { data: deliveryData, error: deliveryFetchError } = await supabase
      .from("deliveries")
      .select("id, truck_id, assigned_to")
      .eq("id", parseInt(deliveryId))
      .single();

    if (deliveryFetchError || !deliveryData) {
      return res.status(404).json({ message: "Entrega não encontrada." });
    }

    const realTruckId = deliveryData.truck_id;
    const originalWorkerId = deliveryData.assigned_to; // guardar para preservar no historial
    let maintenanceFlag = false;

    if (realTruckId) {
      // Buscar quilometragem ATUAL do camião directamente da BD
      const { data: truckData, error: fetchError } = await supabase
        .from("trucks")
        .select("mileage, mileage_since_maintenance")
        .eq("id", realTruckId)
        .single();

      if (fetchError) {
        console.error("[COMPLETE DELIVERY] Erro ao buscar camião:", fetchError);
        return res.status(500).json({ message: "Erro ao verificar quilometragem do camião." });
      }

      const currentMileage = typeof truckData?.mileage === 'number' ? truckData.mileage : 0;
      console.log(`[COMPLETE DELIVERY] Camião ${realTruckId}: km_atual=${currentMileage}, km_finais=${mileageNum}`);

      // VALIDAÇÃO: km finais têm de ser ESTRITAMENTE maiores que os km atuais
      if (mileageNum <= currentMileage) {
        return res.status(400).json({
          message: `Quilometragem inválida! O camião tem actualmente ${currentMileage.toLocaleString('pt-PT')} km. O valor introduzido (${mileageNum.toLocaleString('pt-PT')} km) tem de ser superior.`
        });
      }

      const currentMaintenanceKm = (truckData?.mileage_since_maintenance != null)
        ? truckData.mileage_since_maintenance
        : (currentMileage % 20000);
      const mileageIncrease = mileageNum - currentMileage;
      const newMileageSinceMaintenance = currentMaintenanceKm + mileageIncrease;
      const needsMaintenance = newMileageSinceMaintenance >= 20000;
      maintenanceFlag = needsMaintenance;

      const updateData = {
        mileage: mileageNum,
        status: needsMaintenance ? "manutencao" : "disponivel",
        assigned_to: null
      };
      if (truckData && 'mileage_since_maintenance' in truckData) {
        updateData.mileage_since_maintenance = newMileageSinceMaintenance;
      }

      console.log(`[COMPLETE DELIVERY] Camião ${realTruckId}: km_manutencao=${newMileageSinceMaintenance}, precisa_manutencao=${needsMaintenance}`);

      const { error: truckError } = await supabase
        .from("trucks")
        .update(updateData)
        .eq("id", realTruckId);

      if (truckError) {
        console.error("[COMPLETE DELIVERY] Erro ao atualizar camião:", truckError);
      }
    }

    // Marcar entrega como concluída (NÃO apagar)
    // Apenas muda o estado — truck_id e assigned_to são preservados como historial
    // (o camião já foi libertado na tabela trucks acima)
    const { data: updatedDelivery, error: updateDeliveryError } = await supabase
      .from("deliveries")
      .update({ estado: "concluido" })
      .eq("id", parseInt(deliveryId))
      .select();

    console.log(`[COMPLETE DELIVERY] Entrega ${deliveryId} marcada como concluida:`, updatedDelivery, "Erro:", updateDeliveryError);

    if (updateDeliveryError) throw updateDeliveryError;

    if (maintenanceFlag) {
      return res.json({
        message: "Entrega finalizada com sucesso!",
        maintenanceRequired: true,
        truckId: realTruckId
      });
    }

    res.json({ message: "Entrega finalizada com sucesso!" });
  } catch (err) {
    console.error("[COMPLETE DELIVERY] Erro:", err);
    res.status(500).json({ message: "Erro ao finalizar entrega: " + err.message });
  }
});

app.post("/complete-maintenance", async (req, res) => {
  const { truckId } = req.body;

  try {
    if (!truckId) {
      return res.status(400).json({ message: "ID do camião não fornecido." });
    }

    // Preparar objeto de atualização
    const updateData = {
      status: "disponivel"
    };

    // Tentar atualizar mileage_since_maintenance se a coluna existir
    // Primeiro, verificar se a coluna existe
    const { data: truckData, error: fetchError } = await supabase
      .from("trucks")
      .select("id, mileage_since_maintenance")
      .eq("id", parseInt(truckId))
      .single();

    if (!fetchError && truckData && 'mileage_since_maintenance' in truckData) {
      updateData.mileage_since_maintenance = 0;
    }

    const { error } = await supabase
      .from("trucks")
      .update(updateData)
      .eq("id", parseInt(truckId));

    if (error) throw error;

    res.json({ message: "Manutenção concluída com sucesso!" });
  } catch (err) {
    console.error("[COMPLETE MAINTENANCE] Erro:", err);
    res.status(500).json({ message: "Erro ao completar manutenção: " + err.message });
  }
});

// Marcar camião como "em manutenção" (bloqueado, sem reset de km)
app.post("/set-maintenance", async (req, res) => {
  const { truckId } = req.body;

  try {
    if (!truckId) {
      return res.status(400).json({ message: "ID do camião não fornecido." });
    }

    const { error } = await supabase
      .from("trucks")
      .update({ status: "manutencao" })
      .eq("id", parseInt(truckId));

    if (error) throw error;

    res.json({ message: "Camião marcado como em manutenção." });
  } catch (err) {
    console.error("[SET MAINTENANCE] Erro:", err);
    res.status(500).json({ message: "Erro ao marcar manutenção: " + err.message });
  }
});

app.get("/stats/worker/:workerId", async (req, res) => {
  const { workerId } = req.params;

  try {
    // Nota: Como 'assigned_to' está em falta na tabela 'deliveries', 
    // usamos 'created_by' ou filtramos no código se necessário.
    // Por agora, assumimos que 'created_by' identifica o camionista para as estatísticas.
    const { data: completed } = await supabase
      .from("deliveries")
      .select("*")
      .eq("created_by", workerId)
      .eq("estado", "concluido");

    const { data: ongoing } = await supabase
      .from("deliveries")
      .select("*")
      .eq("created_by", workerId)
      .eq("estado", "em-curso");

    const totalKm = completed?.reduce((acc, delivery) => {
      return acc + ((delivery.final_mileage || 0) - (delivery.initial_mileage || 0));
    }, 0) || 0;

    const { data: recentDeliveries } = await supabase
      .from("deliveries")
      .select(`*`)
      .eq("created_by", workerId)
      .order("created_at", { ascending: false })
      .limit(5);

    const chartData = await getDeliveriesChartData(workerId);

    // Como trucks(plate) também pode falhar se não houver relação definida:
    // Fazemos uma busca manual ou deixamos N/A por agora.
    res.json({
      completed: completed?.length || 0,
      ongoing: ongoing?.length || 0,
      totalKm,
      chartData,
      recentActivities: recentDeliveries?.map(delivery => ({
        title: delivery.tipo,
        description: `De ${delivery.origem} para ${delivery.destino}`,
        status: delivery.estado,
        truck: "N/A"
      })) || []
    });
  } catch (err) {
    console.error(`[STATS WORKER] Erro:`, err);
    res.status(500).json({ message: "Erro ao buscar estatísticas: " + err.message });
  }
});

// Estatísticas empresa
app.get("/stats/company/:company", async (req, res) => {
  const { company } = req.params;

  try {
    // Buscar entregas filtrando pela coluna 'company' diretamente
    const { data: deliveries } = await supabase
      .from("deliveries")
      .select("*")
      .eq("company", company);

    const { data: trucks } = await supabase
      .from("trucks")
      .select("*")
      .eq("status", "em_uso")
      .eq("company", company);

    const completed = deliveries?.filter(d => d.estado === "concluido").length || 0;
    const ongoing = deliveries?.filter(d => d.estado === "em-curso").length || 0;
    const totalKm = deliveries?.reduce((acc, delivery) => {
      return acc + ((delivery.final_mileage || 0) - (delivery.initial_mileage || 0));
    }, 0) || 0;

    const chartData = await getCompanyDeliveriesChartData(company);

    const { data: recentActivities } = await supabase
      .from("deliveries")
      .select("*")
      .eq("company", company)
      .order("created_at", { ascending: false })
      .limit(5);

    res.json({
      completed,
      ongoing,
      activeTrucks: trucks?.length || 0,
      totalKm,
      chartData,
      recentActivities: recentActivities?.map(activity => ({
        title: activity.tipo || activity.title || "Entrega",
        description: `De ${activity.origem} para ${activity.destino}`,
        status: activity.estado || activity.status
      })) || []
    });
  } catch (err) {
    console.error(`[STATS COMPANY] Erro:`, err);
    res.status(500).json({ message: "Erro ao buscar estatísticas: " + err.message });
  }
});

app.get("/trucks", async (req, res) => {
  const { status, company } = req.query;

  if (!company) {
    return res.status(400).json({ message: "Empresa não especificada." });
  }

  try {
    let query = supabase
      .from("trucks")
      .select("*")
      .ilike("company", company.trim());

    if (status) {
      query = query.eq("status", status);
    }

    const { data: trucks, error } = await query.order("created_at", { ascending: false });

    if (error) throw error;

    res.json(trucks || []);
  } catch (err) {
    console.error("[GET TRUCKS] Erro:", err.message);
    res.status(500).json({ message: "Erro ao buscar frota: " + err.message });
  }
});

// Histórico do camião
app.get("/truck-history/:id", async (req, res) => {
  const truckId = req.params.id;

  try {
    const { data: history, error } = await supabase
      .from("truck_history")
      .select(`
        *,
        delivery:delivery_id(title),
        driver:driver_id(name)
      `)
      .eq("truck_id", truckId)
      .order("date", { ascending: false });

    if (error) throw error;

    const formattedHistory = history.map(entry => ({
      date: entry.date,
      delivery_title: entry.delivery?.title || "N/A",
      driver_name: entry.driver?.name || "N/A",
      mileage: entry.mileage,
      status: entry.status
    }));

    res.json(formattedHistory);
  } catch (err) {
    res.status(500).json({ message: "Erro ao buscar histórico: " + err.message });
  }
});

// Atualizar status camião
app.post("/update-truck-status", async (req, res) => {
  const { truckId, status, updatedBy } = req.body;

  const VALID_STATUSES = ['disponivel', 'em_uso', 'manutencao'];
  if (!truckId || !status || !updatedBy) {
    return res.status(400).json({ message: "truckId, status e updatedBy são obrigatórios." });
  }
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ message: `Estado inválido. Valores aceites: ${VALID_STATUSES.join(', ')}.` });
  }

  try {
    const { data: user } = await supabase
      .from("users")
      .select("role")
      .eq("id", updatedBy)
      .single();

    if (!user || (user.role !== "CEO" && user.role !== "supervisor")) {
      return res.status(403).json({ message: "Sem permissão para atualizar status." });
    }

    const { error } = await supabase
      .from("trucks")
      .update({
        status,
        updated_by: updatedBy,
        updated_at: new Date().toISOString()
      })
      .eq("id", truckId);

    if (error) throw error;

    await supabase
      .from("truck_history")
      .insert([
        {
          truck_id: truckId,
          status,
          date: new Date().toISOString(),
          updated_by: updatedBy
        }
      ]);

    res.json({ message: "Status atualizado com sucesso!" });
  } catch (err) {
    res.status(500).json({ message: "Erro ao atualizar status: " + err.message });
  }
});

// Atualizar km camião
app.put("/update-truck-mileage", async (req, res) => {
  const { truckId, mileage, updatedBy } = req.body;

  if (!truckId || mileage === undefined || mileage === null || !updatedBy) {
    return res.status(400).json({ message: "truckId, mileage e updatedBy são obrigatórios." });
  }
  const mileageNum = Number(mileage);
  if (!Number.isFinite(mileageNum) || mileageNum < 0) {
    return res.status(400).json({ message: "A quilometragem deve ser um número positivo." });
  }
  if (mileageNum > 9_999_999) {
    return res.status(400).json({ message: "Quilometragem inválida (valor demasiado alto)." });
  }

  try {
    const { data: user } = await supabase
      .from("users")
      .select("role")
      .eq("id", updatedBy)
      .single();

    if (!user || (user.role !== "CEO" && user.role !== "supervisor")) {
      return res.status(403).json({ message: "Sem permissão para atualizar km." });
    }

    const { error } = await supabase
      .from("trucks")
      .update({
        mileage: Number(mileage),
        updated_by: updatedBy,
        updated_at: new Date().toISOString()
      })
      .eq("id", truckId);

    if (error) throw error;

    res.json({ message: "Quilometragem atualizada com sucesso!" });
  } catch (err) {
    res.status(500).json({ message: "Erro ao atualizar km: " + err.message });
  }
});

// ===============================
// Funções auxiliares para gráficos
// ===============================

async function getDeliveriesChartData(workerId) {
  try {
    const { data } = await supabase
      .from("deliveries")
      .select("created_at, status")
      .eq("assigned_to", workerId)
      .order("created_at", { ascending: true });

    // Agrupar por mês
    const monthlyData = {};
    data?.forEach(delivery => {
      const month = new Date(delivery.created_at).toLocaleDateString('pt-PT', { month: 'short', year: 'numeric' });
      if (!monthlyData[month]) {
        monthlyData[month] = 0;
      }
      monthlyData[month]++;
    });

    return Object.keys(monthlyData).map(month => ({
      month,
      deliveries: monthlyData[month]
    }));
  } catch (err) {
    return [];
  }
}

async function getCompanyDeliveriesChartData(company) {
  try {
    const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    // Gerar os últimos 7 dias com o mesmo formato de label que o frontend
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const diaSemana = diasSemana[d.getDay()];
      const dd = d.getDate().toString().padStart(2, '0');
      const mm = (d.getMonth() + 1).toString().padStart(2, '0');
      const yyyy = d.getFullYear();
      days.push({
        label: `${diaSemana} ${dd}/${mm}`,
        dateStr: `${yyyy}-${mm}-${dd}`,
        total: 0,
        concluidas: 0
      });
    }

    const since = `${days[0].dateStr}T00:00:00.000Z`;

    const { data } = await supabase
      .from("deliveries")
      .select("created_at, estado")
      .eq("company", company)
      .gte("created_at", since);

    (data || []).forEach(delivery => {
      const d = new Date(delivery.created_at);
      const dd = d.getUTCDate().toString().padStart(2, '0');
      const mm = (d.getUTCMonth() + 1).toString().padStart(2, '0');
      const yyyy = d.getUTCFullYear();
      const dateStr = `${yyyy}-${mm}-${dd}`;
      const day = days.find(x => x.dateStr === dateStr);
      if (day) {
        day.total++;
        if (delivery.estado === 'concluido') day.concluidas++;
      }
    });

    return days.map(d => ({
      month: d.label,
      deliveries: d.total,
      completed: d.concluidas
    }));
  } catch (err) {
    console.error('[CHART DATA] Erro:', err);
    return [];
  }
}

// ===============================
// Atualizar nome do próprio utilizador
// ===============================

app.put("/update-own-name", async (req, res) => {
  const { userId, newName } = req.body;

  if (!userId || !newName) {
    return res.status(400).json({ message: "Dados em falta." });
  }

  const trimmedName = newName.trim();
  if (trimmedName.length < 2 || trimmedName.length > 100) {
    return res.status(400).json({ message: "O nome deve ter entre 2 e 100 caracteres." });
  }

  try {
    const { data: user } = await supabase
      .from("users")
      .select("name, company")
      .eq("id", userId)
      .single();

    if (!user) {
      return res.status(404).json({ message: "Utilizador não encontrado." });
    }

    if (user.name.trim().toLowerCase() === trimmedName.toLowerCase()) {
      return res.status(400).json({ message: "O novo nome é igual ao nome atual." });
    }

    // Verificar se já existe outro utilizador com o mesmo nome na mesma empresa
    const { data: existing } = await supabase
      .from("users")
      .select("id")
      .eq("name", trimmedName)
      .eq("company", user.company)
      .neq("id", userId)
      .maybeSingle();

    if (existing) {
      return res.status(409).json({ message: "Já existe um utilizador com este nome na empresa." });
    }

    const { error } = await supabase
      .from("users")
      .update({ name: trimmedName })
      .eq("id", userId);

    if (error) throw error;

    console.log(`[UPDATE OWN NAME] userId=${userId} alterou nome para "${trimmedName}"`);
    res.json({ message: "Nome atualizado com sucesso!", newName: trimmedName });
  } catch (err) {
    res.status(500).json({ message: "Erro ao atualizar nome: " + err.message });
  }
});

// ===============================
// Atualizar palavra-passe do próprio utilizador
// ===============================

app.post("/update-password", async (req, res) => {
  const { userId, newPassword } = req.body;

  if (!userId || !newPassword) {
    return res.status(400).json({ message: "Dados em falta." });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ message: "A nova palavra-passe deve ter no mínimo 6 caracteres." });
  }
  if (newPassword.length > 128) {
    return res.status(400).json({ message: "A palavra-passe não pode ter mais de 128 caracteres." });
  }

  try {
    // Fetch current user password
    const { data: user } = await supabase
      .from("users")
      .select("password")
      .eq("id", userId)
      .single();

    console.log('DEBUG - User from DB:', { userId, hasPassword: !!user?.password });

    if (!user) {
      return res.status(404).json({ message: "Utilizador não encontrado." });
    }

    // Check if new password is same as current
    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    console.log('DEBUG - Password comparison:', { newPassword: newPassword.substring(0, 3) + '***', isSamePassword });

    if (isSamePassword) {
      console.log('DEBUG - Rejecting: same password');
      return res.status(400).json({ message: "A nova palavra-passe é igual à atual. Introduza uma palavra-passe diferente." });
    }

    const hashed = await bcrypt.hash(newPassword, 10);

    const { error } = await supabase
      .from("users")
      .update({ password: hashed })
      .eq("id", userId);
    if (error) throw error;

    console.log('DEBUG - Password updated successfully');
    res.json({ message: "Palavra-passe atualizada com sucesso!" });
  } catch (err) {
    console.error('DEBUG - Error:', err.message);
    res.status(500).json({ message: "Erro ao atualizar palavra-passe: " + err.message });
  }
});

// Alterar nome da empresa (apenas CEO)
app.put("/update-company", async (req, res) => {
  const { newCompanyName, updatedBy } = req.body;

  if (!newCompanyName || !updatedBy) {
    return res.status(400).json({ message: "Dados em falta." });
  }

  const trimmedName = newCompanyName.trim();
  if (trimmedName.length < 2 || trimmedName.length > 100) {
    return res.status(400).json({ message: "O nome da empresa deve ter entre 2 e 100 caracteres." });
  }

  try {
    // Verificar se quem faz o pedido é CEO
    const { data: requester } = await supabase
      .from("users")
      .select("role, company")
      .eq("id", updatedBy)
      .single();

    if (!requester || requester.role !== "CEO") {
      return res.status(403).json({ message: "Apenas o CEO pode alterar o nome da empresa." });
    }

    const oldCompany = requester.company;

    if (oldCompany.trim().toLowerCase() === trimmedName.toLowerCase()) {
      return res.status(400).json({ message: "O novo nome é igual ao nome atual." });
    }

    // Atualizar todos os utilizadores da empresa
    const { error: usersError } = await supabase
      .from("users")
      .update({ company: trimmedName })
      .eq("company", oldCompany);

    if (usersError) throw usersError;

    // Atualizar todas as entregas da empresa
    const { error: deliveriesError } = await supabase
      .from("deliveries")
      .update({ company: trimmedName })
      .ilike("company", oldCompany);

    if (deliveriesError) throw deliveriesError;

    // Atualizar todos os camiões da empresa
    const { error: trucksError } = await supabase
      .from("trucks")
      .update({ company: trimmedName })
      .ilike("company", oldCompany);

    if (trucksError) throw trucksError;

    console.log(`[UPDATE COMPANY] "${oldCompany}" → "${trimmedName}" por userId=${updatedBy}`);

    res.json({
      message: `Nome da empresa atualizado com sucesso!`,
      newCompanyName: trimmedName
    });
  } catch (err) {
    console.error("[UPDATE COMPANY] Erro:", err.message);
    res.status(500).json({ message: "Erro ao atualizar nome da empresa: " + err.message });
  }
});

app.use((err, req, res, next) => {
  console.error('Erro não tratado:', err);
  res.status(500).json({
    message: 'Erro interno do servidor',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

app.use((req, res) => {
  res.status(404).json({ message: 'Rota não encontrada' });
});

async function startServer() {
  try {
    const connected = await testConnection();
    if (!connected) {
      console.error('Falha na conexão com Supabase.');
    }

    app.listen(PORT, () => {
      console.log(`Servidor rodando em: http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Erro ao iniciar servidor:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));

startServer();

