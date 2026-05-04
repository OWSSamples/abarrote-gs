'use client';

import { useEffect, useState } from 'react';

interface SessionExpiredScreenProps {
  /** Path to redirect to when "Iniciar sesión" is clicked. Defaults to /auth */
  loginPath?: string;
  /** Optional reference code (error.digest) to display for support */
  reference?: string;
  /** Auto-redirect countdown in seconds. 0 disables. Defaults to 10. */
  autoRedirectSeconds?: number;
}

/**
 * Premium "session expired" experience inspired by Stripe / Linear / Vercel.
 *
 * - Full-viewport gradient backdrop with subtle animated orbs
 * - Glassmorphism card with animated lock icon
 * - Countdown auto-redirect to login
 * - Accessible: role=alertdialog, aria-live, focus trap on primary CTA
 */
export function SessionExpiredScreen({
  loginPath = '/auth',
  reference,
  autoRedirectSeconds = 10,
}: SessionExpiredScreenProps) {
  const [secondsLeft, setSecondsLeft] = useState(autoRedirectSeconds);

  useEffect(() => {
    if (autoRedirectSeconds <= 0) return;
    const interval = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(interval);
          window.location.href = loginPath;
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [autoRedirectSeconds, loginPath]);

  const progress = autoRedirectSeconds > 0 ? ((autoRedirectSeconds - secondsLeft) / autoRedirectSeconds) * 100 : 0;

  return (
    <div
      role="alertdialog"
      aria-labelledby="session-expired-title"
      aria-describedby="session-expired-desc"
      style={styles.root}
    >
      {/* Animated background orbs */}
      <div style={styles.orb1} aria-hidden="true" />
      <div style={styles.orb2} aria-hidden="true" />
      <div style={styles.orb3} aria-hidden="true" />
      <div style={styles.grid} aria-hidden="true" />

      {/* Card */}
      <div style={styles.card}>
        {/* Animated lock icon */}
        <div style={styles.iconWrap} aria-hidden="true">
          <div style={styles.iconRing} />
          <div style={styles.iconRing2} />
          <svg style={styles.icon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M16 11V7a4 4 0 1 0-8 0v4M5 11h14a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="12" cy="16" r="1.4" fill="currentColor" />
          </svg>
        </div>

        <div style={styles.eyebrow}>SESIÓN FINALIZADA</div>

        <h1 id="session-expired-title" style={styles.title}>
          Tu sesión expiró
        </h1>

        <p id="session-expired-desc" style={styles.desc} aria-live="polite">
          Por seguridad, cerramos tu sesión después de un periodo de inactividad. Inicia sesión nuevamente para
          continuar.
        </p>

        {/* Countdown */}
        {autoRedirectSeconds > 0 && secondsLeft > 0 && (
          <div style={styles.countdown} aria-live="polite">
            <div style={styles.countdownLabel}>
              Redirigiendo en{' '}
              <span style={styles.countdownNumber}>
                {secondsLeft}s
              </span>
            </div>
            <div style={styles.progressBar}>
              <div style={{ ...styles.progressFill, width: `${progress}%` }} />
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={styles.actions}>
          <a
            href={loginPath}
            style={styles.primaryBtn}
            onMouseOver={(e) => Object.assign(e.currentTarget.style, styles.primaryBtnHover)}
            onMouseOut={(e) => Object.assign(e.currentTarget.style, styles.primaryBtn)}
            autoFocus
          >
            <span>Iniciar sesión</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M5 12h14M13 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
          <a
            href="/dashboard"
            style={styles.secondaryBtn}
            onMouseOver={(e) => Object.assign(e.currentTarget.style, styles.secondaryBtnHover)}
            onMouseOut={(e) => Object.assign(e.currentTarget.style, styles.secondaryBtn)}
          >
            Ir al inicio
          </a>
        </div>

        {/* Reference */}
        {reference && (
          <div style={styles.reference}>
            <span style={styles.referenceLabel}>Referencia:</span>
            <code style={styles.referenceCode}>{reference}</code>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={styles.footer}>
        <span style={styles.footerDot} aria-hidden="true" />
        Sistema seguro · Conexión cifrada
      </div>

      <style>{keyframes}</style>
    </div>
  );
}

const keyframes = `
@keyframes se-float-1 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(40px,-30px) scale(1.1); } }
@keyframes se-float-2 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-50px,20px) scale(1.05); } }
@keyframes se-float-3 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(20px,40px) scale(1.08); } }
@keyframes se-fade-up { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
@keyframes se-ring { 0% { transform: scale(0.8); opacity: 0.8; } 100% { transform: scale(1.6); opacity: 0; } }
@keyframes se-icon-bob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
@keyframes se-shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
.se-card { animation: se-fade-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) both; }
`;

const styles = {
  root: {
    position: 'fixed' as const,
    inset: 0,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    background: 'radial-gradient(ellipse at top, #1a1d2e 0%, #0a0c14 60%, #050608 100%)',
    overflow: 'hidden',
    fontFamily: 'var(--font-inter), -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
    color: '#e6e8ee',
    zIndex: 9999,
  },
  orb1: {
    position: 'absolute' as const,
    width: '500px',
    height: '500px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(99, 102, 241, 0.25) 0%, transparent 70%)',
    top: '-100px',
    left: '-100px',
    filter: 'blur(60px)',
    animation: 'se-float-1 18s ease-in-out infinite',
  },
  orb2: {
    position: 'absolute' as const,
    width: '600px',
    height: '600px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(245, 158, 11, 0.18) 0%, transparent 70%)',
    bottom: '-150px',
    right: '-150px',
    filter: 'blur(70px)',
    animation: 'se-float-2 22s ease-in-out infinite',
  },
  orb3: {
    position: 'absolute' as const,
    width: '400px',
    height: '400px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(168, 85, 247, 0.15) 0%, transparent 70%)',
    top: '40%',
    left: '50%',
    filter: 'blur(80px)',
    animation: 'se-float-3 25s ease-in-out infinite',
  },
  grid: {
    position: 'absolute' as const,
    inset: 0,
    backgroundImage:
      'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
    backgroundSize: '48px 48px',
    maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
    WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
  },
  card: {
    position: 'relative' as const,
    maxWidth: '480px',
    width: '100%',
    padding: '48px 40px 36px',
    background: 'linear-gradient(180deg, rgba(28, 31, 46, 0.85) 0%, rgba(20, 22, 33, 0.85) 100%)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '20px',
    boxShadow:
      '0 20px 60px -20px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04) inset, 0 1px 0 rgba(255,255,255,0.08) inset',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    textAlign: 'center' as const,
    animation: 'se-fade-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) both',
  },
  iconWrap: {
    position: 'relative' as const,
    width: '72px',
    height: '72px',
    margin: '0 auto 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '20px',
    background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.18), rgba(245, 158, 11, 0.06))',
    border: '1px solid rgba(245, 158, 11, 0.25)',
    color: '#fbbf24',
  },
  iconRing: {
    position: 'absolute' as const,
    inset: 0,
    borderRadius: '20px',
    border: '2px solid rgba(245, 158, 11, 0.4)',
    animation: 'se-ring 2.4s ease-out infinite',
  },
  iconRing2: {
    position: 'absolute' as const,
    inset: 0,
    borderRadius: '20px',
    border: '2px solid rgba(245, 158, 11, 0.3)',
    animation: 'se-ring 2.4s ease-out infinite 1.2s',
  },
  icon: {
    width: '36px',
    height: '36px',
    position: 'relative' as const,
    animation: 'se-icon-bob 2.4s ease-in-out infinite',
  },
  eyebrow: {
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.14em',
    color: '#fbbf24',
    marginBottom: '12px',
  },
  title: {
    fontSize: '28px',
    fontWeight: 600,
    letterSpacing: '-0.02em',
    lineHeight: 1.2,
    margin: '0 0 12px',
    color: '#f4f5f8',
    background: 'linear-gradient(180deg, #ffffff 0%, #c8ccd6 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  desc: {
    fontSize: '15px',
    lineHeight: 1.55,
    color: '#9da3b3',
    margin: '0 0 28px',
  },
  countdown: {
    marginBottom: '28px',
  },
  countdownLabel: {
    fontSize: '13px',
    color: '#7c8195',
    marginBottom: '10px',
  },
  countdownNumber: {
    color: '#fbbf24',
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums' as const,
  },
  progressBar: {
    width: '100%',
    height: '3px',
    background: 'rgba(255,255,255,0.06)',
    borderRadius: '999px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #f59e0b, #fbbf24)',
    borderRadius: '999px',
    transition: 'width 1s linear',
    boxShadow: '0 0 12px rgba(251, 191, 36, 0.5)',
  },
  actions: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px',
  },
  primaryBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '13px 20px',
    borderRadius: '12px',
    background: 'linear-gradient(180deg, #4f46e5 0%, #4338ca 100%)',
    color: '#ffffff',
    fontSize: '15px',
    fontWeight: 600,
    textDecoration: 'none',
    border: '1px solid rgba(255,255,255,0.12)',
    boxShadow: '0 4px 12px rgba(79, 70, 229, 0.4), 0 1px 0 rgba(255,255,255,0.18) inset',
    transition: 'transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease',
    cursor: 'pointer',
  },
  primaryBtnHover: {
    transform: 'translateY(-1px)',
    boxShadow: '0 6px 18px rgba(79, 70, 229, 0.55), 0 1px 0 rgba(255,255,255,0.22) inset',
    background: 'linear-gradient(180deg, #5b52ea 0%, #4f46e5 100%)',
  },
  secondaryBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '12px 20px',
    borderRadius: '12px',
    background: 'rgba(255,255,255,0.04)',
    color: '#c4c8d4',
    fontSize: '14px',
    fontWeight: 500,
    textDecoration: 'none',
    border: '1px solid rgba(255,255,255,0.08)',
    transition: 'background 0.15s ease, color 0.15s ease, border-color 0.15s ease',
    cursor: 'pointer',
  },
  secondaryBtnHover: {
    background: 'rgba(255,255,255,0.08)',
    color: '#ffffff',
    borderColor: 'rgba(255,255,255,0.15)',
  },
  reference: {
    marginTop: '24px',
    paddingTop: '20px',
    borderTop: '1px solid rgba(255,255,255,0.06)',
    fontSize: '12px',
    color: '#6b7185',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
  referenceLabel: {
    color: '#6b7185',
  },
  referenceCode: {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    fontSize: '11px',
    padding: '2px 8px',
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '6px',
    color: '#a8aebf',
  },
  footer: {
    position: 'relative' as const,
    marginTop: '24px',
    fontSize: '12px',
    color: '#5b6075',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  footerDot: {
    display: 'inline-block',
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: '#22c55e',
    boxShadow: '0 0 8px rgba(34, 197, 94, 0.6)',
  },
};
