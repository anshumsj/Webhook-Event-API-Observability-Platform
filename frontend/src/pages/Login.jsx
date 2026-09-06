import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../utils/errorHandler';
import { Radio, AlertCircle, Loader2 } from 'lucide-react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

export default function Login() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      if (isRegistering) {
        await register(name, email, password);
      } else {
        await login(email, password);
      }
      navigate('/');
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          `${isRegistering ? 'Registration' : 'Authentication'} failed. Please verify credentials.`
        )
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas flex flex-col justify-center items-center px-4 py-12 text-text selection:bg-primary/25">
      {/* 1. Technical Branding Header */}
      <div className="flex flex-col items-center mb-6 text-center">
        <div className="w-8 h-8 rounded bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-3 shadow-xs">
          <Radio className="w-4 h-4" />
        </div>
        <div className="flex items-center gap-2">
          <span className="font-sans font-bold text-base tracking-tight text-text">
            HookSight
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-2 border border-border text-muted font-medium">
            CONSOLE
          </span>
        </div>
        <p className="text-xs text-muted mt-1 font-sans max-w-xs">
          Developer Webhook Observability & Diagnostics Platform
        </p>
      </div>

      {/* 2. Authentication Card */}
      <div className="bg-surface-1 border border-border rounded max-w-sm w-full p-6 shadow-2xl">
        <div className="border-b border-border/70 pb-3 mb-5">
          <h2 className="text-sm font-semibold text-text font-sans">
            {isRegistering ? 'Create Workspace Account' : 'Authenticate Session'}
          </h2>
          <p className="text-[11px] font-mono text-muted mt-0.5">
            {isRegistering
              ? 'Provision developer credentials'
              : 'Enter credentials to access telemetry stream'}
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {error && (
            <div className="p-2.5 bg-failure/10 border border-failure/25 text-failure text-xs font-mono rounded flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span className="leading-snug">{error}</span>
            </div>
          )}

          {isRegistering && (
            <div>
              <label className="block text-[11px] font-mono uppercase text-muted tracking-wider mb-1">
                Full Name
              </label>
              <Input
                type="text"
                required
                placeholder="Ada Lovelace"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isSubmitting}
                autoFocus={isRegistering}
              />
            </div>
          )}

          <div>
            <label className="block text-[11px] font-mono uppercase text-muted tracking-wider mb-1">
              Email Address
            </label>
            <Input
              type="email"
              required
              placeholder="developer@organization.io"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSubmitting}
              autoFocus={!isRegistering}
            />
          </div>

          <div>
            <label className="block text-[11px] font-mono uppercase text-muted tracking-wider mb-1">
              Password
            </label>
            <Input
              type="password"
              required
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div className="pt-1">
            <Button
              type="submit"
              variant="primary"
              size="md"
              className="w-full h-8 text-xs font-medium"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  <span>Authenticating...</span>
                </>
              ) : isRegistering ? (
                'Create Account'
              ) : (
                'Authenticate'
              )}
            </Button>
          </div>

          <div className="pt-2 text-center border-t border-border/50">
            <button
              type="button"
              onClick={() => {
                setIsRegistering(!isRegistering);
                setError('');
              }}
              className="text-xs font-mono text-muted hover:text-primary transition-colors cursor-pointer"
            >
              {isRegistering
                ? '← Back to existing session login'
                : 'Need credentials? Create new account →'}
            </button>
          </div>
        </form>
      </div>

      {/* 3. Footer Environment Indicator */}
      <div className="mt-8 text-center text-[10px] font-mono text-muted/60 space-y-0.5">
        <div>HookSight Observability Console • Tenant Isolated</div>
        <div>Engine v1.0.0-console</div>
      </div>
    </div>
  );
}
