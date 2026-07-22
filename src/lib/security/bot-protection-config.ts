export const BOT_ID_CHECK_LEVEL = 'basic' as const;

interface BotIdProtectedRoute {
  path: string;
  method: string;
  advancedOptions: {
    checkLevel: typeof BOT_ID_CHECK_LEVEL;
  };
}

export const BOT_ID_PROTECTED_ROUTES: BotIdProtectedRoute[] = [
  { path: '/auth/login', method: 'POST', advancedOptions: { checkLevel: BOT_ID_CHECK_LEVEL } },
  { path: '/auth/register', method: 'POST', advancedOptions: { checkLevel: BOT_ID_CHECK_LEVEL } },
  { path: '/auth/forgot-password', method: 'POST', advancedOptions: { checkLevel: BOT_ID_CHECK_LEVEL } },
  { path: '/auth/reset-password', method: 'POST', advancedOptions: { checkLevel: BOT_ID_CHECK_LEVEL } },
  { path: '/auth/mfa-recovery', method: 'POST', advancedOptions: { checkLevel: BOT_ID_CHECK_LEVEL } },
  { path: '/auth/accept-invitation', method: 'POST', advancedOptions: { checkLevel: BOT_ID_CHECK_LEVEL } },
  { path: '/api/auth/session', method: 'POST', advancedOptions: { checkLevel: BOT_ID_CHECK_LEVEL } },
  { path: '/api/extract-receipt', method: 'POST', advancedOptions: { checkLevel: BOT_ID_CHECK_LEVEL } },
  { path: '/api/generate-description', method: 'POST', advancedOptions: { checkLevel: BOT_ID_CHECK_LEVEL } },
  { path: '/api/support-chat', method: 'POST', advancedOptions: { checkLevel: BOT_ID_CHECK_LEVEL } },
  { path: '/api/upload', method: 'POST', advancedOptions: { checkLevel: BOT_ID_CHECK_LEVEL } },
  { path: '/api/upload', method: 'DELETE', advancedOptions: { checkLevel: BOT_ID_CHECK_LEVEL } },
  { path: '/dashboard/businesses/new', method: 'POST', advancedOptions: { checkLevel: BOT_ID_CHECK_LEVEL } },
  { path: '/dashboard/settings/roles', method: 'POST', advancedOptions: { checkLevel: BOT_ID_CHECK_LEVEL } },
  { path: '/dashboard/settings', method: 'POST', advancedOptions: { checkLevel: BOT_ID_CHECK_LEVEL } },
];
