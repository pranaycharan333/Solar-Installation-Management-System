import React, { Suspense, useState } from 'react';
import { useAuth } from './context/AuthContext';
import AuthModal from './components/AuthModal';
import { api } from './services/api';
import {
  Sun,
  Menu,
  Search,
  Bell,
  Settings,
  ChevronDown,
  LogOut,
  Home,
  Zap,
  Users,
  CalendarDays,
  Package,
  Wrench,
  Activity,
  CircleHelp,
  ArrowRight,
  ShieldCheck,
  Check,
  UserRound
} from 'lucide-react';

const AdminDashboard = React.lazy(() => import('./components/AdminDashboard'));
const CustomerDashboard = React.lazy(() => import('./components/CustomerDashboard'));
const TechnicianDashboard = React.lazy(() => import('./components/TechnicianDashboard'));

class DashboardErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Dashboard failed to render:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return <section className="panel dashboard-error" role="alert"><h2>This dashboard could not load</h2><p>{this.state.error.message || 'An unexpected display error occurred.'}</p><button className="button primary" onClick={() => window.location.reload()}>Reload SolarOps</button></section>;
    }
    return this.props.children;
  }
}

function getTimeGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function App() {
  const { user, token, isLoading, logout } = useAuth();
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState('');
  const [activeAdminSection, setActiveAdminSection] = useState('Overview');
  const [activeTechSection, setActiveTechSection] = useState('My Work Queue');
  const [techNavigationVersion, setTechNavigationVersion] = useState(0);
  const [activeCustomerSection, setActiveCustomerSection] = useState('My Solar Journey');
  const [customerNavigationVersion, setCustomerNavigationVersion] = useState(0);
  const supportPhone = '+91 91604 36054';
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  React.useEffect(() => {
    if (!token) return;
    const refreshNotifications = () => api.auth.getNotifications().then((res) => setNotifications(res.data || [])).catch(() => setNotifications([]));
    refreshNotifications();
    const timer = window.setInterval(refreshNotifications, 20000);
    return () => window.clearInterval(timer);
  }, [token]);

  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 3000);
  };

  // If verifying token, show splash loader
  if (isLoading) {
    return (
      <div className="panel loading-panel" style={{ minHeight: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <Sun size={38} style={{ color: '#387553', animation: 'spin 3s linear infinite' }} />
          <p style={{ marginTop: '12px', color: '#56665c', fontWeight: 600 }}>Connecting to SolarOps Database...</p>
        </div>
      </div>
    );
  }

  // If not logged in, show Common Login Page
  if (!user || !token) {
    return (
      <div className="app-shell" style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', background: 'radial-gradient(circle at 50% 20%, #edf5ef, #e4ece5)' }}>
        <AuthModal isOpen={true} notice={showNotice} />
        {notice && (
          <div className="toast">
            <Check size={17} /> {notice}
          </div>
        )}
      </div>
    );
  }

  const role = user.role;
  const isCustomer = role === 'CUSTOMER';
  const isTech = role === 'TECHNICIAN';
  const isAdmin = role === 'ADMIN';

  const navItems = isCustomer
    ? ['My Solar Journey', 'Quotations & Payments', 'Service Desk', 'Materials & Prices', 'Warranty', 'My Profile']
    : isTech
    ? ['My Work Queue', 'Installation Checklists', 'Site Surveys', 'Field Reports']
    : ['Overview', 'Customers', 'Installations', 'Technicians', 'Inventory', 'Service Desk'];

  const selectSection = (item: string) => {
    if (isTech) {
      setActiveTechSection(item);
      setTechNavigationVersion((version) => version + 1);
    } else if (isCustomer) {
      setActiveCustomerSection(item);
      setCustomerNavigationVersion((version) => version + 1);
    } else {
      setActiveAdminSection(item);
    }
  };

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Sun size={20} /></div>
          <div>
            <b>SolarOps</b>
            <small>INTELLIGENCE 2026</small>
          </div>
        </div>

        <div className="workspace">
          <div className="workspace-logo">S</div>
          <div>
            <b>SunPower Solutions</b>
            <small>Enterprise Workspace</small>
          </div>
          <ChevronDown size={15} />
        </div>

        <div className="nav-label">WORKSPACE PORTAL</div>
        {navItems.map((item, i) => (
          <button key={item} className={'nav-item ' + ((isAdmin ? activeAdminSection === item : isTech ? activeTechSection === item : activeCustomerSection === item) ? 'selected' : '')} onClick={() => selectSection(item)}>
            <span className="nav-icon">
              {i === 0 ? <Home size={17} /> :
               item.includes('Solar') || item.includes('Installations') || item.includes('Work') ? <Zap size={17} /> :
               item.includes('Technicians') ? <Users size={17} /> :
               item.includes('Customers') ? <UserRound size={17} /> :
               item.includes('Inventory') ? <Package size={17} /> :
               item.includes('Profile') ? <UserRound size={17} /> :
               item.includes('Materials') ? <Package size={17} /> :
               item.includes('Service') ? <Wrench size={17} /> :
               <Activity size={17} />}
            </span>
            {item}
            {item.includes('Installations') && <span className="nav-count">12</span>}
          </button>
        ))}

        <div className="side-bottom">
          <div className="help-card">
            <div className="help-icon"><CircleHelp size={17} /></div>
            <b>Need Assistance?</b>
            <p>Questions or concerns? Call our customer support team.</p>
            <a className="support-phone" href="tel:+919160436054">{supportPhone} <ArrowRight size={13} /></a>
          </div>

          <div className="profile">
            <div className={'avatar ' + (isAdmin ? 'admin' : isTech ? 'lavender' : 'mint')}>
              {user.fullName ? user.fullName.slice(0, 2).toUpperCase() : 'SO'}
            </div>
            <div>
              <b>{user.fullName}</b>
              <small>{user.role}</small>
            </div>
            <button className="logout-btn" title="Sign out" onClick={logout}>
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Panel */}
      <main className="main">
        {/* Topbar */}
        <header className="topbar">
          <button className="mobile-menu" aria-label="Menu"><Menu /></button>
          <div className="crumb">
            SolarOps Intelligence <span>/</span> <b>{role} Portal</b>
          </div>

          <div className="top-actions">
            <label className="search">
              <Search size={16} />
              <input
                placeholder="Search installations, customers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <kbd>⌘ K</kbd>
            </label>

            <div className="notification-wrap">
            <button className="icon-button" onClick={async () => {
              const opening = !notificationsOpen;
              setNotificationsOpen(opening);
              if (opening && notifications.some((item) => !item.isRead)) {
                try { await api.auth.markNotificationsRead(); setNotifications((items) => items.map((item) => ({ ...item, isRead: true }))); }
                catch { showNotice('Could not update notification status.'); }
              }
            }} aria-label="Notifications" aria-expanded={notificationsOpen}>
              <Bell size={18} />
              {notifications.some((item) => !item.isRead) && <i />}
            </button>
            {notificationsOpen && <div className="notification-menu">
              <b>Notifications</b>
              {notifications.length ? notifications.map((item) => <div className="notification-item" key={item.id}>
                <strong>{item.title}</strong><p>{item.message}</p><small>{new Date(item.createdAt).toLocaleString()}</small>
              </div>) : <p className="notification-empty">No notifications yet.</p>}
            </div>}
            </div>

            <button className="button light small" onClick={logout}>
              <LogOut size={14} /> Sign out
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="content">
          <div className="welcome-row">
            <div>
              <div className="eyebrow">
                {isCustomer ? 'YOUR CLEAN ENERGY PORTAL' : isTech ? 'FIELD OPERATIONS · TODAY' : 'EXECUTIVE CONTROL CENTER'}
                <span className="live-dot" />
              </div>
              <h1>
                {isCustomer ? `Welcome home, ${user.fullName.split(' ')[0]}` :
                 isTech ? `Field Station · ${user.fullName}` :
                 `${getTimeGreeting()}, ${user.fullName.split(' ')[0]}`}{' '}
                <span>{isCustomer ? '☀️' : isTech ? '⚡' : '✦'}</span>
              </h1>
              <p>
                {isCustomer ? 'Real-time solar generation tracking, milestone updates, and warranty certification.' :
                 isTech ? 'Review today’s site visits, submit digital surveys, and complete verified installation checklists.' :
                 'Operational metrics, customer installation pipelines, field dispatch, and warehouse inventory control.'}
              </p>
            </div>
          </div>

          {/* Role-Specific Connected Dashboard */}
          <DashboardErrorBoundary key={role}>
            <Suspense fallback={<div className="dashboard-loading">Loading your workspace…</div>}>
              {isAdmin ? (
                <AdminDashboard search={search} notice={showNotice} activeSection={activeAdminSection} onSectionChange={setActiveAdminSection} />
              ) : isTech ? (
                <TechnicianDashboard notice={showNotice} activeSection={activeTechSection} navigationVersion={techNavigationVersion} />
              ) : (
                <CustomerDashboard notice={showNotice} activeSection={activeCustomerSection} navigationVersion={customerNavigationVersion} supportPhone={supportPhone} />
              )}
            </Suspense>
          </DashboardErrorBoundary>

          <footer>
            SolarOps Intelligence <span>·</span> Connected to PostgreSQL Database (Port 5432){' '}
            <span className="footer-note">Enterprise Edition · Verified Role: {user.role}</span>
          </footer>
        </div>
      </main>

      {/* Toast Notification */}
      {notice && (
        <div className="toast">
          <Check size={17} /> {notice}
        </div>
      )}
    </div>
  );
}
