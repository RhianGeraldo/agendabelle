-- --------------------------------------------------------
-- CLINIQFLOW PRO / BELLA VITA CLÍNICAS - SUPABASE SCHEMA
-- --------------------------------------------------------
-- Este script cria todas as tabelas no Supabase (PostgreSQL)
-- equivalentes ao banco SQLite local, incluindo relacionamentos,
-- desativação temporária de RLS (para migração ágil).

-- 1. EXTENSÕES ÚTEIS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. LIMPEZA DE TABELAS (Caso já existam)
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS stock_movements CASCADE;
DROP TABLE IF EXISTS inventory CASCADE;
DROP TABLE IF EXISTS sales CASCADE;
DROP TABLE IF EXISTS appointments CASCADE;
DROP TABLE IF EXISTS client_packages CASCADE;
DROP TABLE IF EXISTS services CASCADE;
DROP TABLE IF EXISTS clients CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS units CASCADE;
DROP TABLE IF EXISTS franchisors CASCADE;
DROP TABLE IF EXISTS contract_templates CASCADE;
DROP TABLE IF EXISTS unit_plans CASCADE;
DROP TABLE IF EXISTS global_anamnesis_templates CASCADE;
DROP TABLE IF EXISTS laser_protocol_presets CASCADE;

-- 3. CRIAÇÃO DAS TABELAS

-- Franqueadoras / Redes (Franchisors / Networks)
CREATE TABLE franchisors (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    cnpj TEXT,
    logo_url TEXT,
    primary_color TEXT,
    email TEXT,
    phone TEXT,
    plan TEXT DEFAULT 'premium',
    appointment_duration INTEGER DEFAULT 30,
    business_hours JSONB DEFAULT '{"start": "08:00", "end": "20:00"}'::jsonb,
    cancellation_policy INTEGER DEFAULT 24,
    confirm_session_consumption TEXT DEFAULT 'required',
    notification_settings JSONB DEFAULT '{}'::jsonb,
    royalty_settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Unidades (Units)
CREATE TABLE units (
    id TEXT PRIMARY KEY,
    franchisor_id TEXT REFERENCES franchisors(id) ON DELETE CASCADE,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    cnpj TEXT,
    phone TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'onboarding', 'suspended', 'cancelled')),
    is_onboarded BOOLEAN DEFAULT false,
    street TEXT,
    city TEXT,
    state TEXT,
    zip TEXT,
    manager_id TEXT,
    monthly_revenue NUMERIC(15, 2) DEFAULT 0.0,
    royalty_status TEXT DEFAULT 'none' CHECK (royalty_status IN ('none', 'paid', 'pending')),
    opening_date DATE,
    plan TEXT DEFAULT 'Basic' CHECK (plan IN ('Basic', 'Standard', 'Premium', 'Enterprise'))
);

-- Profissionais / Usuários (Users)
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    unit_id TEXT REFERENCES units(id) ON DELETE SET NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('SUPER_ADMIN', 'FRANCHISOR_ADMIN', 'FRANCHISOR_VIEWER', 'UNIT_MANAGER', 'SENIOR_PROFESSIONAL', 'JUNIOR_PROFESSIONAL', 'RECEPTIONIST')),
    avatar_url TEXT,
    phone TEXT,
    email TEXT UNIQUE,
    bio TEXT,
    commission_rate NUMERIC(5, 2) DEFAULT 0.0,
    specialties JSONB DEFAULT '[]'::jsonb,
    working_hours JSONB DEFAULT '[]'::jsonb
);

-- Clientes (Clients)
CREATE TABLE clients (
    id TEXT PRIMARY KEY,
    unit_id TEXT REFERENCES units(id) ON DELETE SET NULL,
    full_name TEXT NOT NULL,
    cpf TEXT,
    phone TEXT,
    email TEXT,
    birth_date DATE,
    gender TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    last_visit DATE,
    total_spent NUMERIC(15, 2) DEFAULT 0.0,
    sessions_remaining INTEGER DEFAULT 0,
    contraindications JSONB DEFAULT '[]'::jsonb
);

-- Serviços (Services)
CREATE TABLE services (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT,
    duration INTEGER, -- Em minutos
    price NUMERIC(15, 2),
    requires_laser BOOLEAN DEFAULT false
);

-- Pacotes Adquiridos por Clientes (Client Packages)
CREATE TABLE client_packages (
    id TEXT PRIMARY KEY,
    client_id TEXT REFERENCES clients(id) ON DELETE CASCADE,
    service_id TEXT REFERENCES services(id) ON DELETE RESTRICT,
    unit_id TEXT REFERENCES units(id) ON DELETE SET NULL,
    total_sessions INTEGER DEFAULT 0,
    used_sessions INTEGER DEFAULT 0,
    expiry_date DATE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'depleted', 'expired')),
    sale_id TEXT
);

-- Agendamentos (Appointments)
CREATE TABLE appointments (
    id TEXT PRIMARY KEY,
    unit_id TEXT REFERENCES units(id) ON DELETE SET NULL,
    client_id TEXT REFERENCES clients(id) ON DELETE CASCADE,
    client_name TEXT,
    service_id TEXT REFERENCES services(id) ON DELETE RESTRICT,
    service_name TEXT,
    professional_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    professional_name TEXT,
    date DATE NOT NULL,
    time TIME NOT NULL,
    duration INTEGER DEFAULT 30,
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'completed', 'cancelled')),
    from_package BOOLEAN DEFAULT false,
    package_id TEXT REFERENCES client_packages(id) ON DELETE SET NULL
);

-- Vendas (Sales)
CREATE TABLE sales (
    id TEXT PRIMARY KEY,
    unit_id TEXT REFERENCES units(id) ON DELETE SET NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    client_name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('service', 'package', 'product')),
    items TEXT NOT NULL,
    total NUMERIC(15, 2) NOT NULL,
    payment_method TEXT NOT NULL,
    status TEXT DEFAULT 'paid' CHECK (status IN ('paid', 'pending', 'cancelled'))
);

-- Estoque / Inventário (Inventory)
CREATE TABLE inventory (
    id TEXT PRIMARY KEY,
    unit_id TEXT REFERENCES units(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT,
    current INTEGER DEFAULT 0,
    minimum INTEGER DEFAULT 0,
    maximum INTEGER DEFAULT 0
);

-- Movimentações de Estoque (Stock Movements)
CREATE TABLE stock_movements (
    id TEXT PRIMARY KEY,
    item_id TEXT REFERENCES inventory(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('in', 'out')),
    quantity INTEGER NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    professional_name TEXT DEFAULT 'Sistema',
    reason TEXT
);

-- Logs de Auditoria (Audit Logs)
CREATE TABLE audit_logs (
    id TEXT PRIMARY KEY,
    unit_id TEXT,
    user_id TEXT,
    user_name TEXT,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    description TEXT NOT NULL,
    changes JSONB,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Modelos de Contratos da Franqueadora (Contract Templates)
CREATE TABLE contract_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    content TEXT NOT NULL,
    last_updated DATE DEFAULT CURRENT_DATE
);

-- Planos das Unidades (Unit Plans)
CREATE TABLE unit_plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    modules JSONB DEFAULT '[]'::jsonb,
    price NUMERIC(15, 2) NOT NULL
);

-- Fichas de Anamnese Globais (Global Anamnesis Templates)
CREATE TABLE global_anamnesis_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    fields JSONB DEFAULT '[]'::jsonb
);

-- Parâmetros de Laser (Laser Protocol Presets)
CREATE TABLE laser_protocol_presets (
    id TEXT PRIMARY KEY,
    equipment TEXT NOT NULL,
    area TEXT NOT NULL,
    fluence TEXT,
    pulse_width TEXT,
    spot_size TEXT,
    mode TEXT,
    energy TEXT,
    time TEXT
);

-- 4. DESATIVAÇÃO DE ROW LEVEL SECURITY (RLS) PARA MIGRAÇÃO RÁPIDA
-- No Supabase, tabelas novas vêm com RLS ativo por padrão. 
-- Desativamos temporariamente para que o front-end consiga ler/escrever diretamente via anon-key.
ALTER TABLE franchisors DISABLE ROW LEVEL SECURITY;
ALTER TABLE units DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE services DISABLE ROW LEVEL SECURITY;
ALTER TABLE client_packages DISABLE ROW LEVEL SECURITY;
ALTER TABLE appointments DISABLE ROW LEVEL SECURITY;
ALTER TABLE sales DISABLE ROW LEVEL SECURITY;
ALTER TABLE inventory DISABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE contract_templates DISABLE ROW LEVEL SECURITY;
ALTER TABLE unit_plans DISABLE ROW LEVEL SECURITY;
ALTER TABLE global_anamnesis_templates DISABLE ROW LEVEL SECURITY;
ALTER TABLE laser_protocol_presets DISABLE ROW LEVEL SECURITY;

-- 5. BANCO DE DADOS LIMPO (Sem dados mockados)
-- O banco está pronto para uso em produção.
