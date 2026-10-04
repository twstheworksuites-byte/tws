import { useState } from 'react';
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, UserRound } from 'lucide-react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useApp } from '../context';

function PasswordField({ value, onChange, autoComplete = 'current-password' }) {
  const [visible, setVisible] = useState(false);
  return <label>Password
    <div className="input-icon password-input">
      <LockKeyhole />
      <input type={visible ? 'text' : 'password'} required minLength="6" maxLength="128" value={value} onChange={onChange} autoComplete={autoComplete} placeholder="At least 6 characters" />
      <button type="button" onClick={() => setVisible(current => !current)} aria-label={visible ? 'Hide password' : 'Show password'}>{visible ? <EyeOff /> : <Eye />}</button>
    </div>
  </label>;
}

export function Login() {
  const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [busy, setBusy] = useState(false);
  const { login, toast } = useApp(), navigate = useNavigate(), location = useLocation();
  async function submit(event) {
    event.preventDefault(); setBusy(true);
    try {
      const result = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      if (result.user.role !== 'customer') throw new Error('Operator accounts must use the Admin Portal.');
      login(result.token, result.user); toast('Welcome back');
      navigate(location.state?.from || '/customer', { replace: true });
    } catch (error) { toast(error.message, 'error'); } finally { setBusy(false); }
  }
  return <AuthShell>
    <p className="eyebrow">Customer portal</p><h1>Welcome <em>back.</em></h1>
    <p>Sign in to manage your bookings, invoices, and account details.</p>
    <form onSubmit={submit} className="auth-form">
      <label>Email address<div className="input-icon"><Mail /><input type="email" required autoFocus value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" placeholder="you@company.com" /></div></label>
      <PasswordField value={password} onChange={event => setPassword(event.target.value)} />
      <Link className="forgot-link" to="/forgot-password">Forgot password?</Link>
      <button className="btn btn-dark btn-wide" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'} <ArrowRight /></button>
    </form>
    <p className="auth-switch">New to TWS? <Link to="/register" state={location.state}>Create an account</Link></p>
  </AuthShell>;
}

export function AdminLogin() {
  const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [busy, setBusy] = useState(false);
  const { login, toast } = useApp(), navigate = useNavigate(), location = useLocation();
  async function submit(event) {
    event.preventDefault(); setBusy(true);
    try {
      const result = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      if (result.user.role !== 'super_admin') throw new Error('This account does not have admin portal access.');
      login(result.token, result.user); toast('Admin access granted');
      navigate(location.state?.from || '/admin', { replace: true });
    } catch (error) { toast(error.message, 'error'); } finally { setBusy(false); }
  }
  return <AuthShell admin>
    <p className="eyebrow">Secure operations portal</p><h1>Admin <em>access.</em></h1>
    <p>For the authorized TWS administrator only.</p>
    <form onSubmit={submit} className="auth-form">
      <label>Admin email<div className="input-icon"><Mail /><input type="email" required autoFocus value={email} onChange={event => setEmail(event.target.value)} autoComplete="username" aria-label="Admin email address" /></div></label>
      <PasswordField value={password} onChange={event => setPassword(event.target.value)} />
      <button className="btn btn-dark btn-wide" disabled={busy}>{busy ? 'Verifying access…' : 'Enter admin portal'} <ShieldCheck /></button>
    </form>
    <Link className="portal-link" to="/login"><UserRound /> Return to Customer Portal</Link>
  </AuthShell>;
}

export function Register() {
  const [name, setName] = useState(''), [email, setEmail] = useState(''), [password, setPassword] = useState(''), [busy, setBusy] = useState(false);
  const { login, toast } = useApp(), navigate = useNavigate(), location = useLocation();
  async function submit(event) {
    event.preventDefault(); setBusy(true);
    try {
      const result = await api('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) });
      login(result.token, result.user); toast('Your account is ready');
      navigate(location.state?.from || '/customer', { replace: true });
    } catch (error) { toast(error.message, 'error'); } finally { setBusy(false); }
  }
  return <AuthShell>
    <p className="eyebrow">Create your account</p><h1>Start working <em>better.</em></h1>
    <p>Create an account to reserve spaces, track bookings, and download invoices.</p>
    <form onSubmit={submit} className="auth-form">
      <label>Full name<div className="input-icon"><UserRound /><input required minLength="2" maxLength="80" autoFocus value={name} onChange={event => setName(event.target.value)} autoComplete="name" placeholder="Your full name" /></div></label>
      <label>Email address<div className="input-icon"><Mail /><input type="email" required value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" placeholder="you@company.com" /></div></label>
      <PasswordField value={password} onChange={event => setPassword(event.target.value)} autoComplete="new-password" />
      <button className="btn btn-dark btn-wide" disabled={busy}>{busy ? 'Creating account…' : 'Create account'} <ArrowRight /></button>
    </form>
    <p className="auth-switch">Already have an account? <Link to="/login" state={location.state}>Sign in</Link></p>
  </AuthShell>;
}

export function ForgotPassword(){const[email,setEmail]=useState(''),[sent,setSent]=useState(false),[busy,setBusy]=useState(false),{toast}=useApp();async function submit(event){event.preventDefault();setBusy(true);try{await api('/auth/forgot-password',{method:'POST',body:JSON.stringify({email})});setSent(true)}catch(error){toast(error.message,'error')}finally{setBusy(false)}}return <AuthShell><p className="eyebrow">Account recovery</p><h1>Reset your <em>password.</em></h1><p>{sent?'If that address has an account, a secure reset link is on its way.':'Enter your account email and we’ll send a secure, time-limited reset link.'}</p>{!sent&&<form className="auth-form" onSubmit={submit}><label>Email address<div className="input-icon"><Mail/><input type="email" required autoFocus value={email} onChange={event=>setEmail(event.target.value)}/></div></label><button className="btn btn-dark btn-wide" disabled={busy}>{busy?'Sending…':'Send reset link'}<ArrowRight/></button></form>}<Link className="portal-link" to="/login">Return to sign in</Link></AuthShell>}

export function ResetPassword(){const[params]=useSearchParams(),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[done,setDone]=useState(false),{toast}=useApp();async function submit(event){event.preventDefault();setBusy(true);try{await api('/auth/reset-password',{method:'POST',body:JSON.stringify({email:params.get('email'),token:params.get('token'),password})});setDone(true);toast('Password updated')}catch(error){toast(error.message,'error')}finally{setBusy(false)}}return <AuthShell><p className="eyebrow">Secure reset</p><h1>Choose a new <em>password.</em></h1>{done?<><p>Your password has been changed successfully.</p><Link className="btn btn-dark" to="/login">Sign in</Link></>:<form className="auth-form" onSubmit={submit}><PasswordField value={password} onChange={event=>setPassword(event.target.value)} autoComplete="new-password"/><button className="btn btn-dark btn-wide" disabled={busy}>{busy?'Updating…':'Update password'}<ArrowRight/></button></form>}</AuthShell>}

function AuthShell({ children, admin = false }) {
  return <section className={`auth-page ${admin ? 'admin-auth' : ''}`}><div className="auth-visual auth-spatial-art" aria-hidden="true"><i/><i/><i/><b>TWS</b><div><span>{admin ? 'TWS OPERATIONS · SECURE ACCESS' : 'TWS · THE WORK SUITES'}</span><p>{admin ? '“One clear view of every space, booking, and customer.”' : '“Your space. Your pace.”'}</p></div></div><div className="auth-panel">{children}</div></section>;
}
