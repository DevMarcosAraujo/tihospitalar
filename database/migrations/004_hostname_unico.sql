-- Anti-duplicidade: o hostname identifica o computador (sem diferenciar maiúsculas)
CREATE UNIQUE INDEX IF NOT EXISTS uq_equip_hostname ON equipamentos (upper(trim(hostname))) WHERE hostname IS NOT NULL;
