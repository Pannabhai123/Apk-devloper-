import type { Request } from 'express';
import type { DB } from '../db.js';

export function audit(
  db: DB,
  req: Request,
  action: string,
  entity: string,
  entityId?: string | number | null,
  metadata?: unknown,
) {
  const user = req.auth?.user;
  db.prepare(
    `INSERT INTO audit_logs (actor_id, actor_email, actor_role, action, entity, entity_id, metadata, ip)
     VALUES (?,?,?,?,?,?,?,?)`,
  ).run(
    user?.id ?? null,
    user?.email ?? null,
    user?.role_key ?? null,
    action,
    entity,
    entityId == null ? null : String(entityId),
    metadata == null ? null : JSON.stringify(metadata).slice(0, 4000),
    req.ip || null,
  );
}
