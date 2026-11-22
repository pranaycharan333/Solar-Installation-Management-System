import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Sun, Lock, Mail, User, Phone, MapPin, ArrowRight, AlertCircle } from 'lucide-react';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: { client_id: string; callback: (response: { credential: string }) => void }) => void;
          renderButton: (element: HTMLElement, options: Record<string, string | number>) => void;
        };
      };
    };
  }
}

interface AuthModalProps {
  isOpen: boolean;
  onClose?: () => void;
  defaultMode?: 'login' | 'register';
  notice: (msg: string) => void;
}

export default function AuthModal({ isOpen, onClose, defaultMode = 'login', notice }: AuthModalProps) {
  const { login, loginWithGoogle, register } = useAuth();
  const [isRegister, setIsRegister] = useState(defaultMode === 'register');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [address, setAddress] = useState('');
  const [monthlyBill, setMonthlyBill] = useState('4500');
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!isOpen || !googleClientId || !googleButtonRef.current) return;
    let attempts = 0;
    const timer = window.setInterval(() => {
      const google = window.google?.accounts.id;
      if (google && googleButtonRef.current) {
        window.clearInterval(timer);
        google.initialize({
          client_id: googleClientId,
          callback: async ({ credential }) => {
            setError('');
            setLoading(true);
            try {
              const loggedUser = await loginWithGoogle(credential);
              notice(`Welcome, ${loggedUser.fullName} (${loggedUser.role})`);
              onClose?.();
            } catch (err: any) {
              setError(err.message || 'Google sign-in failed. Please try again.');
            } finally {
              setLoading(false);
            }
          }
        });
        google.renderButton(googleButtonRef.current, { theme: 'outline', size: 'large', shape: 'rectangular', text: 'continue_with', width: 360 });
      } else if (++attempts >= 40) {
        window.clearInterval(timer);
        setError('Google sign-in could not load. Check your connection and refresh the page.');
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [isOpen, googleClientId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegister) {
        if (password !== confirmPassword) {
          setError('Passwords do not match');
          setLoading(false);
          return;
        }

        await register({
          fullName,
          email,
          phone,
          password,
          confirmPassword,
          address,
          monthlyBillAvg: parseFloat(monthlyBill) || 3500
        });
        notice(`Account created! Logged in as ${fullName} (Customer)`);
      } else {
        const loggedUser = await login(email, password);
        notice(`Welcome back, ${loggedUser.fullName} (${loggedUser.role})`);
      }
      if (onClose) onClose();
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="auth-card">
        <div className="auth-header">
          <div className="brand-mark"><Sun size={24} /></div>
          <h2>{isRegister ? 'Create Customer Account' : 'Sign in to SolarOps'}</h2>
          <p>
            {isRegister
              ? 'Join thousands of homeowners powering their life with clean solar energy.'
              : 'Enterprise portal for customers, field technicians, and system administrators.'}
          </p>
        </div>

        {googleClientId ? (
          <div className="google-signin">
            <div ref={googleButtonRef} />
            <div className="auth-divider"><span>OR SIGN IN WITH EMAIL</span></div>
          </div>
        ) : (
          <p className="form-help">Google sign-in will appear after the Google OAuth client is configured.</p>
        )}

        {error && (
          <div className="auth-error">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          {isRegister && (
            <>
              <div className="form-group">
                <label>Full Name</label>
                <div className="input-with-icon">
                  <User size={16} />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Meera Sharma"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Phone Number</label>
                  <div className="input-with-icon">
                    <Phone size={16} />
                    <input
                      type="tel"
                      required
                      placeholder="+91 98451 22334"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Monthly Power Bill (₹)</label>
                  <input
                    type="number"
                    placeholder="4500"
                    value={monthlyBill}
                    onChange={(e) => setMonthlyBill(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Installation Address</label>
                <div className="input-with-icon">
                  <MapPin size={16} />
                  <input
                    type="text"
                    placeholder="Street, Area, City"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </div>
              </div>
            </>
          )}

          <div className="form-group">
            <label>Email Address</label>
            <div className="input-with-icon">
              <Mail size={16} />
              <input
                type="email"
                required
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <div className="label-row">
              <label>Password</label>
              {!isRegister && (
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => notice('Password reset: Contact admin@solarops.com to reset credentials.')}
                >
                  Forgot password?
                </button>
              )}
            </div>
            <div className="input-with-icon">
              <Lock size={16} />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {isRegister && (
            <div className="form-group">
              <label>Confirm Password</label>
              <div className="input-with-icon">
                <Lock size={16} />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>
          )}

          <button type="submit" className="button primary full-width" disabled={loading}>
            {loading ? 'Authenticating...' : isRegister ? 'Register as Customer' : 'Sign in'} <ArrowRight size={16} />
          </button>
        </form>

        <div className="auth-footer">
          {isRegister ? (
            <p>
              Already have an account?{' '}
              <button type="button" className="link-btn bold" onClick={() => { setIsRegister(false); setError(''); }}>
                Sign in here
              </button>
            </p>
          ) : (
            <p>
              New customer?{' '}
              <button type="button" className="link-btn bold" onClick={() => { setIsRegister(true); setError(''); }}>
                Create customer account
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
