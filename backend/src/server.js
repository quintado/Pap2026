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

  // Validação básica
  if (!name || !password || !company) {
    return res.status(400).json({ message: "Preencha todos os campos." });
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
        role: "fundador",
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

  if (!creator || creator.role !== "fundador") {
    return res.status(403).json({ message: "Apenas fundadores podem criar novos usuários." });
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

  if (!updater || updater.role !== "fundador") {
    return res.status(403).json({ message: "Apenas fundadores podem atualizar usuários." });
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

    // Fundadores podem atualizar qualquer utilizador, incluindo outros fundadores
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
    if (deleter.role === "trabalhador") {
      console.log('[DELETE USER] ERRO: Trabalhador tentou eliminar');
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
    // - Fundadores podem eliminar TODOS (fundadores, supervisores, trabalhadores)
    // - Supervisores podem eliminar APENAS trabalhadores

    if (deleter.role === "supervisor") {
      // Supervisores só podem eliminar trabalhadores
      if (deletedUser.role !== "trabalhador") {
        console.log('[DELETE USER] ERRO: Supervisor tentou eliminar não-trabalhador');
        return res.status(403).json({
          message: "Supervisores só podem eliminar trabalhadores."
        });
      }
    }

    // Se chegou aqui, é fundador ou supervisor eliminando trabalhador - permitido!
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
  const { tipo, origem, destino, estado, dataPrevista, observacoes, createdBy } = req.body;

  console.log(`[CREATE DELIVERY] Início: createdBy=${createdBy}`);

  try {
    const { data: creator } = await supabase
      .from("users")
      .select("role, company")
      .eq("id", createdBy)
      .single();

    if (!creator || (creator.role !== "fundador" && creator.role !== "supervisor")) {
      console.log(`[CREATE DELIVERY] Erro: Creator not found or no permission. Creator:`, creator);
      return res.status(403).json({ message: "Sem permissão para criar entregas." });
    }

    console.log(`[CREATE DELIVERY] Inserindo:`, {
      tipo, origem, destino,
      company: creator.company,
      createdBy
    });

    const { error } = await supabase.from("deliveries").insert([
      {
        tipo,
        origem,
        destino,
        estado: estado || "pendente",
        data_prevista: dataPrevista,
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

    res.json({ message: "Entrega criada com sucesso!" });
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
  const { tipo, origem, destino, estado, dataPrevista, observacoes, updatedBy } = req.body;
  const deliveryId = req.params.id;

  try {
    const { data: updater } = await supabase
      .from("users")
      .select("role, company")
      .eq("id", updatedBy)
      .single();

    if (!updater || (updater.role !== "fundador" && updater.role !== "supervisor")) {
      return res.status(403).json({ message: "Sem permissão para atualizar entregas." });
    }

    const updateData = {
      tipo,
      origem,
      destino,
      estado,
      data_prevista: dataPrevista,
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

    if (!deleter || (deleter.role !== "fundador" && deleter.role !== "supervisor")) {
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

    if (!creator || (creator.role !== "fundador" && creator.role !== "supervisor")) {
      return res.status(403).json({ message: "Sem permissão para adicionar camiões." });
    }

    const initialMileage = Number(mileage);
    const initialMileageSinceMaintenance = initialMileage % 20000;
    const initialStatus = initialMileage >= 20000 && initialMileageSinceMaintenance === 0
      ? "manutencao"
      : (initialMileage >= 20000 ? "manutencao" : "disponivel");
    // Se a quilometragem inicial já passou de 20000, colocar em manutenção
    const needsMaintenanceOnCreate = initialMileage >= 20000;

    const { error } = await supabase.from("trucks").insert([
      {
        plate,
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
    res.status(500).json({ message: "Erro ao adicionar camião: " + err.message });
  }
});

app.post("/request-delivery", async (req, res) => {
  const { deliveryId, truckId, workerId } = req.body;

  try {
    const { data: worker } = await supabase
      .from("users")
      .select("role")
      .eq("id", workerId)
      .single();

    if (!worker || worker.role !== "trabalhador") {
      return res.status(403).json({ message: "Apenas trabalhadores podem solicitar entregas." });
    }

    const { data: truck } = await supabase
      .from("trucks")
      .select("status")
      .eq("id", truckId)
      .single();

    if (!truck || truck.status !== "disponivel") {
      return res.status(403).json({ message: "Camião não está disponível." });
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

  try {
    const { data: responder } = await supabase
      .from("users")
      .select("role")
      .eq("id", responderId)
      .single();

    if (!responder || (responder.role !== "fundador" && responder.role !== "supervisor")) {
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
      message: approved ? "Solicitação aprovada com sucesso!" : "Solicitação rejeitada."
    });
  } catch (err) {
    res.status(500).json({ message: "Erro ao processar solicitação: " + err.message });
  }
});

app.post("/complete-delivery", async (req, res) => {
  const { deliveryId, truckId, finalMileage, workerId } = req.body;

  try {
    // Validação básica
    if (!deliveryId || !finalMileage) {
      return res.status(400).json({ message: "Faltam parâmetros obrigatórios." });
    }

    // Atualizar entrega
    const { error: deliveryError } = await supabase
      .from("deliveries")
      .update({
        estado: "concluido"
      })
      .eq("id", parseInt(deliveryId));

    if (deliveryError) throw deliveryError;

    // Se houver truckId, atualizar camião
    if (truckId) {
      // Buscar quilometragem anterior do camião para calcular a diferença
      const { data: truckData, error: fetchError } = await supabase
        .from("trucks")
        .select("mileage, mileage_since_maintenance")
        .eq("id", parseInt(truckId))
        .single();

      if (fetchError && !fetchError.message.includes('mileage_since_maintenance')) {
        throw fetchError;
      }

      const currentMileage = truckData?.mileage || 0;
      // Se mileage_since_maintenance for null, inicializar com base na quilometragem atual
      // usando módulo 20000 para respeitar ciclos anteriores já cumpridos
      const currentMaintenanceKm = (truckData?.mileage_since_maintenance != null)
        ? truckData.mileage_since_maintenance
        : (currentMileage % 20000);
      const mileageIncrease = Math.max(0, parseInt(finalMileage) - currentMileage);
      const newMileageSinceMaintenance = currentMaintenanceKm + mileageIncrease;

      // Se acumulou >= 20000 km desde a última manutenção, bloquear o camião
      const needsMaintenance = newMileageSinceMaintenance >= 20000;

      // Preparar objeto de atualização
      const updateData = {
        mileage: parseInt(finalMileage),
        status: needsMaintenance ? "manutencao" : "disponivel",
        assigned_to: null
      };

      // Adicionar mileage_since_maintenance apenas se a coluna existir
      if (truckData && 'mileage_since_maintenance' in truckData) {
        updateData.mileage_since_maintenance = newMileageSinceMaintenance;
      }

      console.log(`[COMPLETE DELIVERY] Camião ${truckId}: km_manutencao=${newMileageSinceMaintenance}, precisa_manutencao=${needsMaintenance}`);

      const { error: truckError } = await supabase
        .from("trucks")
        .update(updateData)
        .eq("id", parseInt(truckId));

      if (truckError) {
        console.error("[COMPLETE DELIVERY] Erro ao atualizar camião:", truckError);
      }

      // Informar o frontend se o camião precisa de manutenção
      if (needsMaintenance) {
        return res.json({
          message: "Entrega finalizada com sucesso!",
          maintenanceRequired: true,
          truckId: parseInt(truckId)
        });
      }
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
    // Por agora, assumimos que 'created_by' identifica o trabalhador para as estatísticas.
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

  try {
    const { data: user } = await supabase
      .from("users")
      .select("role")
      .eq("id", updatedBy)
      .single();

    if (!user || (user.role !== "fundador" && user.role !== "supervisor")) {
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

  try {
    const { data: user } = await supabase
      .from("users")
      .select("role")
      .eq("id", updatedBy)
      .single();

    if (!user || (user.role !== "fundador" && user.role !== "supervisor")) {
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
    const { data: users } = await supabase
      .from("users")
      .select("id")
      .eq("company", company);

    if (!users || users.length === 0) return [];

    const userIds = users.map(u => u.id);

    const { data } = await supabase
      .from("deliveries")
      .select("created_at, status, assigned_to")
      .in("assigned_to", userIds)
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

// ===============================
// Atualizar palavra-passe do próprio utilizador
// ===============================

app.post("/update-password", async (req, res) => {
  const { userId, newPassword } = req.body;

  if (!userId || !newPassword) {
    return res.status(400).json({ message: "Dados em falta." });
  }

  try {
    const hashed = await bcrypt.hash(newPassword, 10);

    const { error } = await supabase
      .from("users")
      .update({ password: hashed })
      .eq("id", userId);
    if (error) throw error;

    res.json({ message: "Palavra-passe atualizada com sucesso!" });
  } catch (err) {
    res.status(500).json({ message: "Erro ao atualizar palavra-passe: " + err.message });
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

