import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import AdminInsightsPanel from './AdminInsightsPanel';
import {
  Zap,
  Users,
  Wrench,
  Package,
  ClipboardList,
  CheckCircle2,
  DollarSign,
  ArrowRight,
  Plus,
  Calendar,
  Search,
  Filter,
  X,
  ShieldCheck,
  TrendingUp,
  AlertTriangle,
  FileText
} from 'lucide-react';

export default function AdminDashboard({ search, notice, activeSection, onSectionChange }: { search: string; notice: (msg: string) => void; activeSection: string; onSectionChange: (section: string) => void }) {
  const [metrics, setMetrics] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Record<string, any> | null>(null);
  const [customerProjectTech, setCustomerProjectTech] = useState<Record<number, number>>({});
  const [customerTicketTech, setCustomerTicketTech] = useState<Record<number, number>>({});
  const [inventory, setInventory] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [serviceImages, setServiceImages] = useState<Record<number, string>>({});
  const [serviceAssignIds, setServiceAssignIds] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);

  // Active view tab
  const sectionToTab = (section: string): 'OVERVIEW' | 'PROJECTS' | 'CUSTOMERS' | 'TECHNICIANS' | 'INVENTORY' | 'SERVICES' => ({
    Overview: 'OVERVIEW', Installations: 'PROJECTS', Customers: 'CUSTOMERS', Technicians: 'TECHNICIANS', Inventory: 'INVENTORY', 'Service Desk': 'SERVICES'
  }[section] as any) || 'OVERVIEW';
  const activeTab = sectionToTab(activeSection);
  const activeTechnicians = technicians.filter((technician) => technician.status === 'ACTIVE');
  const setActiveTab = (tab: 'OVERVIEW' | 'PROJECTS' | 'CUSTOMERS' | 'TECHNICIANS' | 'INVENTORY' | 'SERVICES') => {
    onSectionChange(({ OVERVIEW: 'Overview', PROJECTS: 'Installations', CUSTOMERS: 'Customers', TECHNICIANS: 'Technicians', INVENTORY: 'Inventory', SERVICES: 'Service Desk' })[tab]);
  };

  // Modals
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isEstimateModalOpen, setIsEstimateModalOpen] = useState(false);
  const [isCreateTechModalOpen, setIsCreateTechModalOpen] = useState(false);
  const [isAdjustStockModalOpen, setIsAdjustStockModalOpen] = useState(false);
  const [isAddMaterialOpen, setIsAddMaterialOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<any | null>(null);
  const [actionProjectId, setActionProjectId] = useState<number>(0);
  const [selectedTechnician, setSelectedTechnician] = useState<any | null>(null);
  const [credentialEmail, setCredentialEmail] = useState('');
  const [credentialPassword, setCredentialPassword] = useState('');
  const selectedActionProject = projects.find((project) => project.id === actionProjectId) || projects[0] || null;

  // Form States
  const [assignTechId, setAssignTechId] = useState<number>(0);
  const [assignType, setAssignType] = useState('SURVEY');
  const [assignDate, setAssignDate] = useState('');
  const [assignNotes, setAssignNotes] = useState('');

  const [estSubsidy, setEstSubsidy] = useState('78000');
  const [estServiceCharge, setEstServiceCharge] = useState('0');
  const [estTerms, setEstTerms] = useState('Includes 5-year comprehensive warranty, DISCOM liaison and Net Metering commissioning.');
  const [estimateItems, setEstimateItems] = useState<Array<{ materialId: number; quantity: number }>>([{ materialId: 0, quantity: 1 }]);

  // Create Tech form
  const [techName, setTechName] = useState('');
  const [techEmail, setTechEmail] = useState('');
  const [techPhone, setTechPhone] = useState('');
  const [techSkills, setTechSkills] = useState('Rooftop Solar, Inverter Commissioning');
  const [techCert, setTechCert] = useState('MNRE-IN-');
  const [techPassword, setTechPassword] = useState('');
  const [createdTechCredentials, setCreatedTechCredentials] = useState<{ name: string; email: string; password: string } | null>(null);

  // Adjust stock form
  const [adjustMaterialId, setAdjustMaterialId] = useState<number>(0);
  const [adjustQuantity, setAdjustQuantity] = useState('10');
  const [adjustReason, setAdjustReason] = useState('Supplier delivery received at Central Warehouse');
  const [newMaterial, setNewMaterial] = useState({ name: '', category: 'SOLAR_COMPONENT', unit: 'piece', unitCost: '', quantityOnHand: '0' });

  const fetchAllAdminData = async () => {
    try {
      setLoading(true);
      const [metRes, projRes, techRes, custRes, invRes, srvRes] = await Promise.all([
        api.admin.getMetrics(),
        api.projects.getAll(),
        api.admin.getTechnicians(),
        api.admin.getCustomers(),
        api.inventory.getAll(),
        api.services.getAll()
      ]);

      setMetrics(metRes.data);
      setProjects(projRes.data || []);
      setActionProjectId((current) => current || projRes.data?.[0]?.id || 0);
      setTechnicians(techRes.data || []);
      setCustomers(custRes.data || []);
      setSelectedCustomer((current) => current ? (custRes.data || []).find((customer: any) => customer.id === current.id) || current : null);
      setInventory(invRes.data || []);
      setServices(srvRes.data || []);
    } catch (err: any) {
      console.error('Admin data fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllAdminData();
  }, []);

  const photoTicketIds = services.filter((ticket) => ticket.hasPhoto).map((ticket) => ticket.id).join(',');
  useEffect(() => {
    let current = true;
    const objectUrls: string[] = [];
    const loadPhotos = async () => {
      const entries = await Promise.all(services.filter((ticket) => ticket.hasPhoto).map(async (ticket) => {
        try {
          const url = await api.services.getPhoto(ticket.id);
          objectUrls.push(url);
          return [ticket.id, url] as const;
        } catch { return null; }
      }));
      if (current) setServiceImages(Object.fromEntries(entries.filter(Boolean) as Array<readonly [number, string]>));
    };
    if (activeTab === 'SERVICES' && photoTicketIds) loadPhotos();
    else setServiceImages({});
    return () => { current = false; objectUrls.forEach((url) => URL.revokeObjectURL(url)); };
  }, [activeTab, photoTicketIds]);

  // Handle Technician Assignment
  const handleAssignTechnician = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !assignTechId) {
      notice('Please select a technician');
      return;
    }

    try {
      await api.admin.assignTechnician({
        projectId: selectedProject.id,
        technicianId: Number(assignTechId),
        assignmentType: assignType,
        scheduledDate: assignDate ? new Date(assignDate).toISOString() : undefined,
        notes: assignNotes
      });
      notice(`Technician assigned to project ${selectedProject.requestNumber}`);
      setIsAssignModalOpen(false);
      fetchAllAdminData();
    } catch (err: any) {
      notice(`Assignment failed: ${err.message}`);
    }
  };

  // Handle Estimate Generation
  const handleCreateEstimate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;

    try {
      await api.estimates.create({
        projectId: selectedProject.id,
        items: estimateItems.filter((item) => item.materialId && item.quantity > 0),
        serviceCharge: Number(estServiceCharge || 0),
        subsidyAmount: parseFloat(estSubsidy) || 78000,
        terms: estTerms
      });
      notice(`Quotation generated and sent to customer for ${selectedProject.requestNumber}`);
      setIsEstimateModalOpen(false);
      setEstimateItems([{ materialId: 0, quantity: 1 }]);
      fetchAllAdminData();
    } catch (err: any) {
      notice(`Quotation creation failed: ${err.message}`);
    }
  };

  // Handle Create Technician Account
  const handleCreateTechnician = async (e: React.FormEvent) => {
    e.preventDefault();
    const generatedPassword = techPassword || generateTemporaryPassword();
    try {
      await api.admin.createTechnician({
        fullName: techName,
        email: techEmail,
        phone: techPhone,
        skills: techSkills,
        certificationNumber: techCert,
        temporaryPassword: generatedPassword
      });
      notice(`Technician account for ${techName} created successfully!`);
      setIsCreateTechModalOpen(false);
      setCreatedTechCredentials({ name: techName, email: techEmail, password: generatedPassword });
      setTechName('');
      setTechEmail('');
      setTechPhone('');
      setTechPassword('');
      fetchAllAdminData();
    } catch (err: any) {
      notice(`Failed to create technician: ${err.message}`);
    }
  };

  const handleUpdateTechnicianCredentials = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedTechnician) return;
    const changes: { email?: string; temporaryPassword?: string } = {};
    if (credentialEmail.trim().toLowerCase() !== selectedTechnician.email.toLowerCase()) changes.email = credentialEmail.trim();
    if (credentialPassword.trim()) changes.temporaryPassword = credentialPassword;
    if (!changes.email && !changes.temporaryPassword) {
      notice('Enter a different email or a new password.');
      return;
    }
    try {
      await api.admin.updateTechnicianCredentials(selectedTechnician.id, changes);
      notice(`Login details updated for ${selectedTechnician.fullName}.`);
      setSelectedTechnician(null);
      setCredentialPassword('');
      fetchAllAdminData();
    } catch (error: any) {
      notice(`Could not update login details: ${error.message}`);
    }
  };

  const assignCustomerProject = async (project: any) => {
    const technicianId = customerProjectTech[project.id] || activeTechnicians[0]?.id;
    if (!technicianId) return notice('Create or restore an active technician before assigning this project.');
    try {
      const assignmentType = project.status === 'ENQUIRY' ? 'SURVEY' : 'INSTALLATION';
      await api.admin.assignTechnician({ projectId: project.id, technicianId, assignmentType });
      notice(`${project.requestNumber} assigned to a technician.`);
      fetchAllAdminData();
    } catch (error: any) { notice(`Could not assign the project: ${error.message}`); }
  };

  const assignCustomerTicket = async (ticket: any) => {
    const technicianId = customerTicketTech[ticket.id] || activeTechnicians[0]?.id;
    if (!technicianId) return notice('Create or restore an active technician before assigning this request.');
    try {
      await api.services.update(ticket.id, { technicianId });
      notice(`${ticket.ticketNumber} assigned to a technician.`);
      fetchAllAdminData();
    } catch (error: any) { notice(`Could not assign the request: ${error.message}`); }
  };

  const generateTemporaryPassword = () => {
    const bytes = new Uint8Array(18);
    crypto.getRandomValues(bytes);
    return `Sol!${Array.from(bytes, (byte) => byte.toString(36).padStart(2, '0')).join('').slice(0, 20)}9a`;
  };

  // Handle Adjust Stock
  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustMaterialId) {
      notice('Please select a material');
      return;
    }
    try {
      await api.inventory.adjustStock({
        materialId: Number(adjustMaterialId),
        quantityChange: parseInt(adjustQuantity) || 0,
        reason: adjustReason
      });
      notice('Inventory stock updated successfully');
      setIsAdjustStockModalOpen(false);
      fetchAllAdminData();
    } catch (err: any) {
      notice(`Stock adjustment failed: ${err.message}`);
    }
  };

  const handleAddMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.inventory.createMaterial({ ...newMaterial, unitCost: Number(newMaterial.unitCost), quantityOnHand: Number(newMaterial.quantityOnHand) });
      notice('Material and unit price added. Customers can see its catalog price.');
      setNewMaterial({ name: '', category: 'SOLAR_COMPONENT', unit: 'piece', unitCost: '', quantityOnHand: '0' });
      setIsAddMaterialOpen(false);
      fetchAllAdminData();
    } catch (error: any) { notice(`Could not add material: ${error.message}`); }
  };

  const handleAssignServiceTicket = async (ticketId: number) => {
    const technicianId = serviceAssignIds[ticketId];
    if (!technicianId) {
      notice('Choose a technician first.');
      return;
    }
    try {
      await api.services.update(ticketId, { technicianId });
      notice('Customer request assigned. The technician will see it in their account.');
      fetchAllAdminData();
    } catch (err: any) {
      notice(`Could not assign request: ${err.message}`);
    }
  };

  // Filter projects by search
  const filteredProjects = projects.filter((p) =>
    (p.projectName + p.requestNumber + (p.customer?.fullName || '') + p.installationAddress + p.status)
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <div className="admin-dashboard">
      {/* KPI Metrics Row */}
      <div className="metrics">
        <div className="metric">
          <div className="metric-top">
            <span>Active Installations</span>
            <i><Zap /></i>
          </div>
          <div className="metric-number">{metrics?.activeProjects || 0}</div>
          <div className="metric-bottom">
            <span className="change up"><TrendingUp size={13} /> On Schedule</span>
            <small>Field execution</small>
          </div>
        </div>

        <div className="metric">
          <div className="metric-top">
            <span>Pending Requests</span>
            <i><ClipboardList /></i>
          </div>
          <div className="metric-number">{metrics?.pendingRequests || 0}</div>
          <div className="metric-bottom">
            <span className="change flat">Action needed</span>
            <small>Surveys to assign</small>
          </div>
        </div>

        <div className="metric">
          <div className="metric-top">
            <span>Total Revenue</span>
            <i><DollarSign /></i>
          </div>
          <div className="metric-number">₹{((metrics?.totalRevenue || 0) / 100000).toFixed(1)}L</div>
          <div className="metric-bottom">
            <span className="change up">+18.4%</span>
            <small>FY 2026</small>
          </div>
        </div>

        <div className="metric">
          <div className="metric-top">
            <span>Field Technicians</span>
            <i><Users /></i>
          </div>
          <div className="metric-number">{metrics?.totalTechnicians || 0}</div>
          <div className="metric-bottom">
            <span className="change healthy">Active team</span>
            <small>Bengaluru cluster</small>
          </div>
        </div>
      </div>

      {/* Tab Selector */}
      <div className="admin-tab-bar">
        <button className={'tab-pill ' + (activeTab === 'OVERVIEW' ? 'active' : '')} onClick={() => setActiveTab('OVERVIEW')}>
          Overview & Workflow
        </button>
        <button className={'tab-pill ' + (activeTab === 'PROJECTS' ? 'active' : '')} onClick={() => setActiveTab('PROJECTS')}>
          All Installations ({projects.length})
        </button>
        <button className={'tab-pill ' + (activeTab === 'CUSTOMERS' ? 'active' : '')} onClick={() => setActiveTab('CUSTOMERS')}>
          Customers ({customers.length})
        </button>
        <button className={'tab-pill ' + (activeTab === 'TECHNICIANS' ? 'active' : '')} onClick={() => setActiveTab('TECHNICIANS')}>
          Technicians ({technicians.length})
        </button>
        <button className={'tab-pill ' + (activeTab === 'INVENTORY' ? 'active' : '')} onClick={() => setActiveTab('INVENTORY')}>
          Inventory ({inventory.length})
        </button>
        <button className={'tab-pill ' + (activeTab === 'SERVICES' ? 'active' : '')} onClick={() => setActiveTab('SERVICES')}>
          Service Tickets ({services.length})
        </button>
      </div>

      {/* TAB 1: OVERVIEW & ACTIVE WORKFLOW */}
      {(activeTab === 'OVERVIEW' || activeTab === 'PROJECTS') && (
        <section className="panel projects-panel">
          <div className="panel-head">
            <div>
              <h2>Solar Installation Projects</h2>
              <p>End-to-end management from customer enquiry to handover & warranty.</p>
            </div>
            <div className="panel-actions">
              <select className="project-action-select" aria-label="Choose a project for an action" value={actionProjectId} onChange={(event) => setActionProjectId(Number(event.target.value))} disabled={!projects.length}>
                {!projects.length && <option value={0}>No projects available</option>}
                {projects.map((project) => <option key={project.id} value={project.id}>{project.requestNumber} · {project.customer?.fullName || 'Customer'}</option>)}
              </select>
              <button
                className="button primary small"
                disabled={!projects.length}
                onClick={() => {
                  setSelectedProject(selectedActionProject);
                  setIsAssignModalOpen(true);
                }}
              >
                <Plus size={14} /> Assign technician
              </button>
              <button
                className="button primary small"
                disabled={!selectedActionProject || selectedActionProject.status !== 'SURVEY_COMPLETED'}
                onClick={() => {
                  setSelectedProject(selectedActionProject);
                  setEstimateItems([{ materialId: inventory[0]?.id || 0, quantity: 1 }]);
                  setIsEstimateModalOpen(true);
                }}
              >
                <FileText size={14} /> Create quotation
              </button>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>PROJECT</th>
                  <th>CUSTOMER</th>
                  <th>CAPACITY</th>
                  <th>STATUS</th>
                  <th>PROGRESS</th>
                  <th>ASSIGNED TECH</th>
                </tr>
              </thead>
              <tbody>
                {filteredProjects.map((p) => (
                  <tr key={p.id} className={actionProjectId === p.id ? 'project-action-selected' : ''}>
                    <td>
                      <b>{p.requestNumber}</b>
                      <small className="block-sub">{p.systemType}</small>
                    </td>
                    <td>
                      <button type="button" className="project-customer-select" aria-pressed={actionProjectId === p.id} onClick={() => setActionProjectId(p.id)} title="Select this customer’s project for the actions above">
                        <div className="avatar mint">{p.customer?.fullName?.slice(0, 2).toUpperCase() || 'CU'}</div>
                        <div>
                          <b>{p.customer?.fullName || 'Customer'}</b>
                          <small>{p.installationAddress}</small>
                        </div>
                      </button>
                    </td>
                    <td><b>{p.systemCapacityKw} kW</b></td>
                    <td>
                      <span className={'status ' + (p.status === 'COMPLETED' ? 'green' : p.status === 'INSTALLATION_IN_PROGRESS' ? 'green' : p.status === 'ESTIMATE_SENT' ? 'blue-status' : 'amber')}>
                        {p.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td>
                      <div className="progress-label">{p.progress}%</div>
                      <div className="progress"><i style={{ width: `${p.progress}%` }} /></div>
                    </td>
                    <td>
                      {p.assignments?.[0]?.technician?.fullName ? (
                        <span>{p.assignments[0].technician.fullName}</span>
                      ) : (
                        <span className="unassigned">Unassigned</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeTab === 'OVERVIEW' && (
        <section className="panel admin-material-guide">
          <div className="panel-head">
            <div>
              <h2>Materials & component prices</h2>
              <p>Clear per-unit prices for the materials used in customer projects.</p>
            </div>
            <button className="button light small" onClick={() => setActiveTab('INVENTORY')}>View inventory <ArrowRight size={13} /></button>
          </div>
          {inventory.length ? (
            <div className="admin-material-list">
              {inventory.map((material) => (
                <div className="admin-material-item" key={material.id}>
                  <span><b>{material.name}</b><small>{material.category.replace(/_/g, ' ')}</small></span>
                  <strong>₹{Number(material.unitCost).toLocaleString('en-IN')} <small>/ {material.unit.replace(/s$/, '')}</small></strong>
                </div>
              ))}
            </div>
          ) : <p className="empty-state">No material prices have been added yet.</p>}
        </section>
      )}

      {activeTab === 'OVERVIEW' && <AdminInsightsPanel />}

      {/* TAB 2: TECHNICIANS MANAGEMENT */}
      {activeTab === 'TECHNICIANS' && (
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Field Technicians Directory</h2>
              <p>Certified solar technicians, active assignments, and onboarding.</p>
            </div>
            <button className="button primary small" onClick={() => setIsCreateTechModalOpen(true)}>
              <Plus size={14} /> Add New Technician
            </button>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>NAME</th>
                  <th>CONTACT</th>
                  <th>CERTIFICATION</th>
                  <th>SKILLS</th>
                  <th>STATUS</th>
                  <th>ACTIVE JOBS</th>
                  <th>ACCOUNT</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {technicians.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <div className="customer-cell">
                        <div className="avatar tech">{t.fullName.slice(0, 2).toUpperCase()}</div>
                        <b>{t.fullName}</b>
                      </div>
                    </td>
                    <td>
                      <div>{t.email}</div>
                      <small>{t.phone}</small>
                    </td>
                    <td><b>{t.technicianProfile?.certificationNumber || 'MNRE-IN-7842'}</b></td>
                    <td><small>{t.technicianProfile?.skills || 'Solar PV, Inverters'}</small></td>
                    <td>
                      <span className={'status ' + (t.status === 'ACTIVE' ? 'green' : 'neutral')}>
                        {t.status === 'ACTIVE' ? (t.technicianProfile?.status || 'AVAILABLE') : 'INACTIVE'}
                      </span>
                    </td>
                    <td><b>{t.activeTasksCount || 0} jobs</b></td>
                    <td><span className={'status ' + (t.status === 'ACTIVE' ? 'green' : 'neutral')}>{t.status}</span></td>
                    <td><div className="technician-admin-actions">
                      <button className="button light small" onClick={() => { setSelectedTechnician(t); setCredentialEmail(t.email); setCredentialPassword(''); }}>Change login</button>
                      <button className={'button small ' + (t.status === 'ACTIVE' ? 'danger' : 'primary')} onClick={async () => {
                        const active = t.status !== 'ACTIVE';
                        if (!active && !window.confirm(`Remove login access for ${t.fullName}? Assigned work will be unassigned.`)) return;
                        try { const result = await api.admin.setTechnicianActive(t.id, active); notice(result.message); fetchAllAdminData(); }
                        catch (error: any) { notice(`Could not update technician: ${error.message}`); }
                      }}>{t.status === 'ACTIVE' ? 'Remove access' : 'Restore access'}</button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!technicians.length && <p className="empty-state">No technician accounts yet. Create one when you are ready.</p>}
          </div>
        </section>
      )}

      {activeTab === 'CUSTOMERS' && (
        <section className="panel">
          <div className="panel-head"><div><h2>Customer accounts</h2><p>Contact details, service history, payments, and installed systems.</p></div></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>CUSTOMER</th><th>PHONE / EMAIL</th><th>PROPERTY</th><th>SERVICE REQUESTS</th><th>TOTAL PAID</th><th>CURRENTLY USING</th><th>PROFILE</th></tr></thead>
              <tbody>{customers.map((customer) => <tr key={customer.id}>
                <td><div className="customer-cell"><div className="avatar mint">{customer.fullName.slice(0, 2).toUpperCase()}</div><b>{customer.fullName}</b></div></td>
                <td><a className="customer-phone" href={customer.phone ? `tel:${customer.phone.replace(/[^+\d]/g, '')}` : undefined}>{customer.phone || 'No phone provided'}</a><small className="block-sub">{customer.email}</small></td>
                <td>{customer.address || 'Address not provided'}</td>
                <td><b>{customer.serviceCount}</b></td>
                <td><b>₹{Number(customer.totalPaid).toLocaleString('en-IN')}</b></td>
                <td>{customer.currentSystems.length ? customer.currentSystems.map((system: any) => <div className="customer-current-system" key={system.id}><b>{system.systemType}</b><small>{system.systemCapacityKw} kW · {system.requestNumber}</small></div>) : <small>No completed installation</small>}</td>
                <td><button className="button light small" onClick={() => { setSelectedCustomer(customer); setCustomerProjectTech({}); setCustomerTicketTech({}); }}>View profile</button></td>
              </tr>)}</tbody>
            </table>
            {!customers.length && <p className="empty-state">No customer accounts found.</p>}
          </div>
        </section>
      )}

      {/* TAB 3: INVENTORY MANAGEMENT */}
      {activeTab === 'INVENTORY' && (
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Materials & Warehouse Inventory</h2>
              <p>Real-time stock balance, reorder thresholds, and stock allocation.</p>
            </div>
            <div className="inventory-actions"><button className="button light small" onClick={() => setIsAddMaterialOpen(true)}><Plus size={14} /> Add material and price</button><button
              className="button primary small"
              onClick={() => {
                if (inventory.length > 0) setAdjustMaterialId(inventory[0].id);
                setIsAdjustStockModalOpen(true);
              }}
            >
              <Plus size={14} /> Adjust Stock Quantity
            </button></div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>MATERIAL NAME</th>
                  <th>SKU / CODE</th>
                  <th>CATEGORY</th>
                  <th>UNIT COST</th>
                  <th>ON HAND</th>
                  <th>REORDER LEVEL</th>
                  <th>HEALTH</th>
                </tr>
              </thead>
              <tbody>
                {inventory.map((m) => (
                  <tr key={m.id}>
                    <td><b>{m.name}</b></td>
                    <td><code>{m.code}</code></td>
                    <td><span className="badge-category">{m.category}</span></td>
                    <td>₹{m.unitCost.toLocaleString('en-IN')}</td>
                    <td><b>{m.quantityOnHand} {m.unit}</b></td>
                    <td>{m.reorderLevel} {m.unit}</td>
                    <td>
                      <span className={'status ' + (m.isLowStock ? 'amber' : 'green')}>
                        {m.isLowStock ? 'Low Stock' : 'Healthy'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TAB 4: SERVICE DESK */}
      {activeTab === 'SERVICES' && (
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Customer Service & Maintenance Desk</h2>
              <p>Reported faults, inquiries, and resolution logs.</p>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>TICKET</th>
                  <th>CUSTOMER</th>
                  <th>ISSUE DESCRIPTION</th>
                  <th>PRIORITY</th>
                  <th>STATUS</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {services.map((s) => (
                  <tr key={s.id}>
                    <td><b>{s.ticketNumber}</b></td>
                    <td>{s.customer?.fullName}</td>
                    <td><div className="service-ticket-description">{s.issueDescription}</div>{serviceImages[s.id] && <img className="admin-ticket-photo" src={serviceImages[s.id]} alt={`Customer attachment for ${s.ticketNumber}`} loading="lazy" decoding="async" />}{s.visualFinding && <small className="saved-visual-finding">Automatic photo description: {s.visualFinding.replace(/_/g, ' ').toLowerCase()}</small>}</td>
                    <td>
                      <span className={'badge-priority ' + s.priority.toLowerCase()}>{s.priority}</span>
                    </td>
                    <td>
                      <span className={'status ' + (s.status === 'RESOLVED' ? 'green' : 'amber')}>{s.status}</span>
                    </td>
                    <td>
                      {['RESOLVED', 'CLOSED'].includes(s.status) ? <span className="resolved-action-note">Resolved · no action needed</span> : <div className="service-ticket-actions">
                        <select aria-label={`Choose technician for ${s.ticketNumber}`} value={serviceAssignIds[s.id] ?? s.technicianId ?? ''} onChange={(e) => setServiceAssignIds((assignments) => ({ ...assignments, [s.id]: Number(e.target.value) }))} disabled={!activeTechnicians.length}>
                          <option value="">{activeTechnicians.length ? 'Choose technician' : 'No active technicians'}</option>
                          {activeTechnicians.map((technician) => <option key={technician.id} value={technician.id}>{technician.fullName}</option>)}
                        </select>
                        <button className="button small light" disabled={!activeTechnicians.length} onClick={() => handleAssignServiceTicket(s.id)}>{s.technicianId ? 'Reassign' : 'Assign technician'}</button>
                        <button className="button small primary" onClick={async () => {
                          try {
                            await api.services.update(s.id, { status: 'RESOLVED', resolutionNotes: 'Resolved by Administrator' });
                            notice(`Ticket ${s.ticketNumber} marked as resolved!`);
                            fetchAllAdminData();
                          } catch (err: any) { notice(`Could not resolve request: ${err.message}`); }
                        }}>Mark resolved</button>
                      </div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* MODAL: ASSIGN TECHNICIAN */}
      {isAssignModalOpen && selectedProject && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h2>Assign Technician: {selectedProject.requestNumber}</h2>
              <button className="modal-close" onClick={() => setIsAssignModalOpen(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleAssignTechnician} className="modal-form">
              <div className="form-group">
                <label>Select Certified Technician</label>
                <select value={assignTechId} onChange={(e) => setAssignTechId(Number(e.target.value))} required>
                  <option value="">-- Choose Technician --</option>
                  {activeTechnicians.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.fullName} ({t.technicianProfile?.skills || 'Solar Tech'}) - {t.activeTasksCount} active tasks
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Assignment Type</label>
                <select value={assignType} onChange={(e) => setAssignType(e.target.value)}>
                  <option value="SURVEY">Site Survey & Feasibility Measurement</option>
                  <option value="INSTALLATION">Installation & Commissioning</option>
                  <option value="MAINTENANCE">Maintenance & Service Inspection</option>
                </select>
              </div>

              <div className="form-group">
                <label>Scheduled Visit Date</label>
                <input
                  type="date"
                  value={assignDate}
                  onChange={(e) => setAssignDate(e.target.value)}
                  defaultValue={new Date().toISOString().slice(0, 10)}
                />
              </div>

              <div className="form-group">
                <label>Field Notes for Technician</label>
                <textarea
                  rows={3}
                  placeholder="e.g. Inspect western parapet shading, verify 3-phase meter distance..."
                  value={assignNotes}
                  onChange={(e) => setAssignNotes(e.target.value)}
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="button light" onClick={() => setIsAssignModalOpen(false)}>Cancel</button>
                <button type="submit" className="button primary">Assign Task</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE ESTIMATE */}
      {isEstimateModalOpen && selectedProject && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h2>Generate Quotation: {selectedProject.requestNumber}</h2>
              <button className="modal-close" onClick={() => setIsEstimateModalOpen(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleCreateEstimate} className="modal-form">
              <div className="form-group">
                <label>Customer Name</label>
                <input type="text" disabled value={selectedProject.customer?.fullName || 'Customer'} />
              </div>

              {selectedProject.surveys?.[0] && <div className="estimate-survey-summary"><b>Technician site review</b><p>Roof: {selectedProject.surveys[0].roofType}, {selectedProject.surveys[0].roofAreaSqft} sq ft · Shade: {selectedProject.surveys[0].shadingCondition} · Structure: {selectedProject.surveys[0].structuralFeasibility} · Electrical: {selectedProject.surveys[0].electricalPanelCondition} · Suggested size: {selectedProject.surveys[0].proposedCapacityKw} kW</p><small>{selectedProject.surveys[0].surveyNotes || 'No additional technician notes.'}</small></div>}
              <div className="form-group"><label>Materials and quantities</label>
                {estimateItems.map((item, index) => <div className="quote-item-row" key={index}>
                  <select required value={item.materialId || ''} onChange={(e) => setEstimateItems((rows) => rows.map((row, i) => i === index ? { ...row, materialId: Number(e.target.value) } : row))}>
                    <option value="">Choose a material</option>{inventory.map((material) => <option value={material.id} key={material.id}>{material.name} · ₹{Number(material.unitCost).toLocaleString('en-IN')} / {material.unit}</option>)}
                  </select>
                  <input aria-label="Quantity" type="number" min="0.1" step="any" value={item.quantity} onChange={(e) => setEstimateItems((rows) => rows.map((row, i) => i === index ? { ...row, quantity: Number(e.target.value) } : row))} />
                  {estimateItems.length > 1 && <button type="button" className="button light small" onClick={() => setEstimateItems((rows) => rows.filter((_, i) => i !== index))}>Remove</button>}
                </div>)}
                <button type="button" className="button light small" onClick={() => setEstimateItems((rows) => [...rows, { materialId: inventory[0]?.id || 0, quantity: 1 }])} disabled={!inventory.length}><Plus size={13} /> Add another item</button>
                {!inventory.length && <small className="form-help">Add materials in Inventory before preparing a quotation.</small>}
              </div>
              <div className="form-row"><div className="form-group"><label>Installation & service charge (₹)</label><input type="number" min="0" value={estServiceCharge} onChange={(e) => setEstServiceCharge(e.target.value)} /></div><div className="form-group"><label>Govt subsidy deduction (₹)</label><input type="number" min="0" value={estSubsidy} onChange={(e) => setEstSubsidy(e.target.value)} /></div></div>
              <div className="estimate-calc-box"><span>Quote total after subsidy:</span><b>₹{Math.max(0, estimateItems.reduce((sum, item) => sum + (Number(inventory.find((m) => m.id === item.materialId)?.unitCost || 0) * item.quantity), 0) + Number(estServiceCharge || 0) - Number(estSubsidy || 0)).toLocaleString('en-IN')}</b></div>

              <div className="form-group">
                <label>Quotation Terms & Inclusions</label>
                <textarea
                  rows={3}
                  value={estTerms}
                  onChange={(e) => setEstTerms(e.target.value)}
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="button light" onClick={() => setIsEstimateModalOpen(false)}>Cancel</button>
                <button type="submit" className="button primary" disabled={!inventory.length || !estimateItems.some((item) => item.materialId && item.quantity > 0)}>Send Quotation</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE TECHNICIAN ACCOUNT */}
      {isCreateTechModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h2>Create Technician Account</h2>
              <button className="modal-close" onClick={() => setIsCreateTechModalOpen(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleCreateTechnician} className="modal-form">
              <div className="form-group">
                <label>Technician Full Name</label>
              <input
                  type="text"
                  required
                  placeholder="Technician full name"
                  value={techName}
                  onChange={(e) => setTechName(e.target.value)}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Email Address</label>
                  <input
                    type="email"
                    required
                    placeholder="sanjay@solarops.com"
                    value={techEmail}
                    onChange={(e) => setTechEmail(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Phone Number</label>
                  <input
                    type="tel"
                    required
                    placeholder="+91 98765 33445"
                    value={techPhone}
                    onChange={(e) => setTechPhone(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Skills & Specializations</label>
                  <input
                    type="text"
                    placeholder="Rooftop, Inverters, Battery Storage"
                    value={techSkills}
                    onChange={(e) => setTechSkills(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Certification Number</label>
                  <input
                    type="text"
                    placeholder="MNRE-IN-8891"
                    value={techCert}
                    onChange={(e) => setTechCert(e.target.value)}
                  />
                </div>
              </div>

              <p className="form-help">A strong temporary password will be generated and shown once after the account is created.</p>

              <div className="modal-actions">
                <button type="button" className="button light" onClick={() => setIsCreateTechModalOpen(false)}>Cancel</button>
                <button type="submit" className="button primary">Create Account</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {createdTechCredentials && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h2>Technician login created</h2>
              <button className="modal-close" onClick={() => setCreatedTechCredentials(null)} aria-label="Close"><X size={18} /></button>
            </div>
            <p>Share these credentials securely with {createdTechCredentials.name}. The temporary password is shown only now.</p>
            <div className="detail-list">
              <div className="detail-row"><span>Email</span><b>{createdTechCredentials.email}</b></div>
              <div className="detail-row"><span>Temporary password</span><b>{createdTechCredentials.password}</b></div>
            </div>
            <div className="modal-actions">
              <button className="button light" onClick={() => navigator.clipboard.writeText(`Email: ${createdTechCredentials.email}\nTemporary password: ${createdTechCredentials.password}`).then(() => notice('Technician credentials copied.'))}>Copy credentials</button>
              <button className="button primary" onClick={() => setCreatedTechCredentials(null)}>Done</button>
            </div>
          </div>
        </div>
      )}

      {selectedCustomer && (
        <div className="modal-backdrop customer-profile-backdrop">
          <div className="modal-card customer-admin-profile">
            <div className="modal-header">
              <h2>{selectedCustomer.fullName} · Customer profile</h2>
              <button className="modal-close" onClick={() => setSelectedCustomer(null)} aria-label="Close profile"><X size={18} /></button>
            </div>
            <div className="customer-admin-contact">
              <div><small>PHONE</small><b>{selectedCustomer.phone || 'Not provided'}</b></div>
              <div><small>EMAIL</small><b>{selectedCustomer.email}</b></div>
              <div><small>PROPERTY</small><b>{selectedCustomer.address || 'Not provided'}</b></div>
              <div><small>TOTAL PAID</small><b>₹{Number(selectedCustomer.totalPaid).toLocaleString('en-IN')}</b></div>
            </div>
            <section className="customer-admin-section">
              <h3>Projects, systems & assignments</h3>
              {selectedCustomer.projects.length ? selectedCustomer.projects.map((project: any) => (
                <article className="customer-admin-entry" key={project.id}>
                  <div className="customer-admin-entry-title"><div><b>{project.requestNumber} · {project.systemType}</b><small>{project.systemCapacityKw} kW · {project.status.replace(/_/g, ' ')} · Paid ₹{Number(project.paidAmount).toLocaleString('en-IN')}</small></div></div>
                  <p>Assignment history: {project.assignments.length ? project.assignments.map((assignment: any) => `${assignment.technician.fullName} (${assignment.status.toLowerCase()})`).join(', ') : 'No technician assigned'}</p>
                  {!['COMPLETED', 'CANCELLED'].includes(project.status) && <div className="customer-assign-controls">
                    <select aria-label={`Choose technician for ${project.requestNumber}`} value={customerProjectTech[project.id] || ''} onChange={(event) => setCustomerProjectTech((current) => ({ ...current, [project.id]: Number(event.target.value) }))}>
                      <option value="">Choose active technician</option>{activeTechnicians.map((technician) => <option key={technician.id} value={technician.id}>{technician.fullName}</option>)}
                    </select>
                    <button className="button primary small" disabled={!activeTechnicians.length} onClick={() => assignCustomerProject(project)}>Assign project</button>
                  </div>}
                </article>
              )) : <p className="empty-state small">No projects yet.</p>}
            </section>
            <section className="customer-admin-section">
              <h3>Complaints & service requests ({selectedCustomer.serviceCount})</h3>
              {selectedCustomer.serviceTickets.length ? selectedCustomer.serviceTickets.map((ticket: any) => (
                <article className="customer-admin-entry" key={ticket.id}>
                  <div className="customer-admin-entry-title"><div><b>{ticket.ticketNumber} · {ticket.status.replace(/_/g, ' ')}</b><small>{ticket.priority} priority · {new Date(ticket.createdAt).toLocaleString()}</small></div></div>
                  <p className="service-ticket-description">{ticket.issueDescription}</p>
                  <p>Assigned technician: {technicians.find((technician) => technician.id === ticket.technicianId)?.fullName || 'Unassigned'}</p>
                  {ticket.status !== 'RESOLVED' && ticket.status !== 'CLOSED' && <div className="customer-assign-controls">
                    <select aria-label={`Choose technician for ${ticket.ticketNumber}`} value={customerTicketTech[ticket.id] || ''} onChange={(event) => setCustomerTicketTech((current) => ({ ...current, [ticket.id]: Number(event.target.value) }))}>
                      <option value="">Choose active technician</option>{activeTechnicians.map((technician) => <option key={technician.id} value={technician.id}>{technician.fullName}</option>)}
                    </select>
                    <button className="button primary small" disabled={!activeTechnicians.length} onClick={() => assignCustomerTicket(ticket)}>Assign request</button>
                  </div>}
                </article>
              )) : <p className="empty-state small">No complaints or service requests yet.</p>}
              {!activeTechnicians.length && (selectedCustomer.serviceTickets.some((ticket: any) => !['RESOLVED', 'CLOSED'].includes(ticket.status)) || selectedCustomer.projects.some((project: any) => !['COMPLETED', 'CANCELLED'].includes(project.status))) && <p className="form-help">There are no active technicians to assign. Create or restore one in the Technicians section first.</p>}
            </section>
            <div className="modal-actions"><button className="button light" onClick={() => setSelectedCustomer(null)}>Close profile</button></div>
          </div>
        </div>
      )}

      {selectedTechnician && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h2>Change login · {selectedTechnician.fullName}</h2>
              <button className="modal-close" onClick={() => setSelectedTechnician(null)} aria-label="Close"><X size={18} /></button>
            </div>
            <form onSubmit={handleUpdateTechnicianCredentials} className="modal-form">
              <div className="form-group"><label>Login email</label><input type="email" required value={credentialEmail} onChange={(event) => setCredentialEmail(event.target.value)} /></div>
              <div className="form-group"><label>New password</label><input type="password" minLength={8} autoComplete="new-password" placeholder="Leave blank to keep the current password" value={credentialPassword} onChange={(event) => setCredentialPassword(event.target.value)} /></div>
              <p className="form-help">Changing either field updates the technician’s next sign-in details. Passwords are stored securely and are never displayed after saving.</p>
              <div className="modal-actions"><button type="button" className="button light" onClick={() => setSelectedTechnician(null)}>Cancel</button><button type="submit" className="button primary">Save login details</button></div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADJUST INVENTORY STOCK */}
      {isAddMaterialOpen && <div className="modal-backdrop"><div className="modal-card"><div className="modal-header"><h2>Add material & customer price</h2><button className="modal-close" onClick={() => setIsAddMaterialOpen(false)}><X size={18} /></button></div><form className="modal-form" onSubmit={handleAddMaterial}>
        <div className="form-group"><label>Material name</label><input required minLength={2} value={newMaterial.name} onChange={(e) => setNewMaterial({ ...newMaterial, name: e.target.value })} placeholder="e.g. Solar mounting rail" /></div>
        <div className="form-row"><div className="form-group"><label>Category</label><input required value={newMaterial.category} onChange={(e) => setNewMaterial({ ...newMaterial, category: e.target.value })} /></div><div className="form-group"><label>Unit (piece, metre, set)</label><input required value={newMaterial.unit} onChange={(e) => setNewMaterial({ ...newMaterial, unit: e.target.value })} /></div></div>
        <div className="form-row"><div className="form-group"><label>Price per unit (₹)</label><input type="number" min="0.01" step="0.01" required value={newMaterial.unitCost} onChange={(e) => setNewMaterial({ ...newMaterial, unitCost: e.target.value })} /></div><div className="form-group"><label>Opening stock quantity</label><input type="number" min="0" step="any" required value={newMaterial.quantityOnHand} onChange={(e) => setNewMaterial({ ...newMaterial, quantityOnHand: e.target.value })} /></div></div>
        <div className="modal-actions"><button type="button" className="button light" onClick={() => setIsAddMaterialOpen(false)}>Cancel</button><button type="submit" className="button primary">Save material</button></div>
      </form></div></div>}
      {isAdjustStockModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h2>Adjust Warehouse Inventory Stock</h2>
              <button className="modal-close" onClick={() => setIsAdjustStockModalOpen(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleAdjustStock} className="modal-form">
              <div className="form-group">
                <label>Select Material</label>
                <select
                  value={adjustMaterialId}
                  onChange={(e) => setAdjustMaterialId(Number(e.target.value))}
                  required
                >
                  {inventory.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.code}) — Current: {m.quantityOnHand} {m.unit}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Quantity Change (+ for addition, - for deduction)</label>
                <input
                  type="number"
                  required
                  placeholder="+10 or -5"
                  value={adjustQuantity}
                  onChange={(e) => setAdjustQuantity(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Reason for Adjustment</label>
                <textarea
                  rows={2}
                  required
                  placeholder="e.g. Shipment arrival from manufacturer, stock count correction..."
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="button light" onClick={() => setIsAdjustStockModalOpen(false)}>Cancel</button>
                <button type="submit" className="button primary">Update Stock</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
