'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { sileo } from 'sileo';
import { authClient } from '@/lib/auth/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Store } from 'lucide-react';

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      sileo.error({ title: 'Por favor completa todos los campos' });
      return;
    }

    setIsLoading(true);
    try {
      const result = await authClient.signIn.email({ email, password });
      console.log('SignIn result:', result);

      if (result.error) {
        sileo.error({ title: result.error.message || 'Credenciales inválidas' });
      } else {
        sileo.success({ title: 'Bienvenido' });
        router.push('/');
      }
    } catch (error: unknown) {
      console.error('SignIn error:', error);
      const err = error as { message?: string };
      sileo.error({ title: err?.message || 'Error de conexión' });
    } finally {
      setIsLoading(false);
    }
  }, [email, password, router]);

  return (
    <div className="min-h-screen relative flex flex-col items-center justify-center p-4 overflow-hidden bg-[#0a0a0a]">
      {/* Animated Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f0f23]" />
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-0 -left-4 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl animate-blob" />
          <div className="absolute top-0 -right-4 w-72 h-72 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-2000" />
          <div className="absolute -bottom-8 left-20 w-72 h-72 bg-indigo-500 rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-4000" />
        </div>
        <div 
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)`,
            backgroundSize: '40px 40px'
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center">
        {/* Logo */}
        <div className="flex items-center gap-2 mb-8">
          <div className="w-10 h-10 bg-[#27272a]/80 backdrop-blur-sm rounded-xl flex items-center justify-center border border-[#3f3f46]/50 shadow-lg">
            <Store className="w-5 h-5 text-white" />
          </div>
          <span className="text-white text-xl font-semibold tracking-tight">Consola</span>
        </div>

        {/* Card */}
        <Card className="w-full max-w-[400px] bg-[#18181b]/80 backdrop-blur-md border-[#27272a] shadow-2xl">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-white text-xl font-semibold">Welcome back</CardTitle>
            <CardDescription className="text-[#a1a1aa]">
              Login with your Apple or Google account
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Social Buttons */}
            <Button 
              variant="outline" 
              className="w-full h-11 bg-[#27272a]/50 border-[#3f3f46] text-white hover:bg-[#3f3f46] hover:text-white transition-all"
              disabled={isLoading}
            >
              <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
              </svg>
              Login with Apple
            </Button>

            <Button 
              variant="outline" 
              className="w-full h-11 bg-[#27272a]/50 border-[#3f3f46] text-white hover:bg-[#3f3f46] hover:text-white transition-all"
              disabled={isLoading}
            >
              <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Login with Google
            </Button>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#3f3f46]" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-[#18181b] px-2 text-[#71717a]">Or continue with</span>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-white text-sm">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  className="h-11 bg-[#0a0a0a] border-[#3f3f46] text-white placeholder:text-[#52525b] focus:border-[#6366f1] focus-visible:ring-1 focus-visible:ring-[#6366f1] transition-all"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-white text-sm">
                    Password
                  </Label>
                  <Link 
                    href="/auth/forgot-password" 
                    className="text-sm text-[#a1a1aa] hover:text-white transition-colors"
                  >
                    Forgot your password?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  className="h-11 bg-[#0a0a0a] border-[#3f3f46] text-white placeholder:text-[#52525b] focus:border-[#6366f1] focus-visible:ring-1 focus-visible:ring-[#6366f1] transition-all"
                />
              </div>

              <Button 
                type="submit"
                className="w-full h-11 bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] hover:from-[#5558e3] hover:to-[#7c4fe8] text-white font-medium mt-2 transition-all shadow-lg shadow-indigo-500/25"
                disabled={isLoading}
              >
                {isLoading ? 'Loading...' : 'Login'}
              </Button>
            </form>

            {/* Sign up link */}
            <p className="text-center text-sm text-[#a1a1aa] pt-2">
              Don&apos;t have an account?{' '}
              <Link href="/auth/register" className="text-[#818cf8] hover:text-[#a5b4fc] underline underline-offset-2 hover:no-underline transition-colors">
                Sign up
              </Link>
            </p>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-[#52525b] text-xs text-center mt-8 max-w-[400px]">
          By clicking continue, you agree to our{' '}
          <Link href="/terms" className="underline underline-offset-2 hover:text-[#71717a] transition-colors">Terms of Service</Link>
          {' '}and{' '}
          <Link href="/privacy" className="underline underline-offset-2 hover:text-[#71717a] transition-colors">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
}
