import bcrypt from 'bcryptjs';

async function generateSeedSql() {
  const passwordHash = await bcrypt.hash('Admin123!', 10);
  
  const sql = `
-- 1. Tenant
INSERT INTO "tenants" ("id", "name", "slug", "createdAt", "updatedAt")
VALUES ('tenant_1', 'Grupo Oporto Forte', 'oportoforte', NOW(), NOW())
ON CONFLICT ("slug") DO UPDATE SET "name" = EXCLUDED."name";

-- 2. Admin User
INSERT INTO "users" ("id", "email", "passwordHash", "role", "firstName", "lastName", "tenantId", "createdAt", "updatedAt")
VALUES ('user_1', 'admin@oportoforte.com', '${passwordHash}', 'TENANT_ADMIN', 'Admin', 'Oporto', (SELECT "id" FROM "tenants" WHERE "slug" = 'oportoforte'), NOW(), NOW())
ON CONFLICT ("email") DO NOTHING;

-- 3. ClientOrgs
INSERT INTO "client_orgs" ("id", "name", "tenantId", "country", "createdAt", "updatedAt")
VALUES 
  ('client_1', 'Decathlon', (SELECT "id" FROM "tenants" WHERE "slug" = 'oportoforte'), 'PT', NOW(), NOW()),
  ('client_2', 'ZF Automotive', (SELECT "id" FROM "tenants" WHERE "slug" = 'oportoforte'), 'PT', NOW(), NOW()),
  ('client_3', 'Safira Services', (SELECT "id" FROM "tenants" WHERE "slug" = 'oportoforte'), 'PT', NOW(), NOW())
ON CONFLICT ("name", "tenantId") DO NOTHING;

-- 4. Courses
INSERT INTO "courses" ("id", "name", "slug", "durationHours", "format", "status", "tenantId", "createdAt", "updatedAt")
VALUES 
  ('course_1', 'Liderança e Gestão de Equipas', 'lideranca-gestao', 40, 'ELEARNING', 'PUBLISHED', (SELECT "id" FROM "tenants" WHERE "slug" = 'oportoforte'), NOW(), NOW()),
  ('course_2', 'Comunicação Assertiva', 'comunicacao-assertiva', 20, 'ELEARNING', 'PUBLISHED', (SELECT "id" FROM "tenants" WHERE "slug" = 'oportoforte'), NOW(), NOW()),
  ('course_3', 'Gestão de Tempo e Produtividade', 'gestao-tempo', 16, 'ELEARNING', 'PUBLISHED', (SELECT "id" FROM "tenants" WHERE "slug" = 'oportoforte'), NOW(), NOW()),
  ('course_4', 'Inteligência Emocional', 'inteligencia-emocional', 24, 'ELEARNING', 'PUBLISHED', (SELECT "id" FROM "tenants" WHERE "slug" = 'oportoforte'), NOW(), NOW()),
  ('course_5', 'Atendimento de Excelência', 'atendimento-excelencia', 30, 'ELEARNING', 'PUBLISHED', (SELECT "id" FROM "tenants" WHERE "slug" = 'oportoforte'), NOW(), NOW())
ON CONFLICT ("tenantId", "slug") DO NOTHING;
`;

  console.log(sql);
}

generateSeedSql();
