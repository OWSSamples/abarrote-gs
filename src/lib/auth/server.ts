import { NextRequest, NextResponse } from 'next/server';

export const auth = {
  middleware: (config: { loginUrl: string }) => {
    return async (request: NextRequest) => {
      // Por ahora, permitir todas las rutas
      // El control de auth se hace client-side con useRequireAuth
      return NextResponse.next();
    };
  },
};
