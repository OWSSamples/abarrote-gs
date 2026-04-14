-- Seed telegram-notifications feature flag (enabled by default)
INSERT INTO "feature_flags" ("id", "description", "enabled", "rollout_percentage", "target_user_ids", "target_role_ids", "created_by", "created_at", "updated_at")
VALUES (
  'telegram-notifications',
  'Habilita el envío de notificaciones por Telegram para todos los eventos del sistema',
  true,
  100,
  '{}',
  '{}',
  'system',
  NOW(),
  NOW()
)
ON CONFLICT ("id") DO NOTHING;
