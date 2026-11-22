import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Sun, Check, ArrowRight, ShieldCheck, Wrench, Plus, FileText, Zap, X, CreditCard, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import WarrantyModal from './WarrantyModal';

const steps = ['Request', 'Site survey', 'Estimate', 'Installation', 'Handover'];

export default function CustomerDashboard({ notice, activeSection, navigationVersion, supportPhone }: { notice: (msg: string) => void; activeSection: string; navigationVersion: number; supportPhone: string }) {
  const { user, updateProfile } = useAuth();
  const [projects, setProjects] = useState<any[]>([]);
  const [warranties, setWarranties] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [selectedWarranty, setSelectedWarranty] = useState<any | null>(null);

  // Request form state
  const [requestType, setRequestType] = useState<'INSTALLATION' | 'MAINTENANCE' | 'COMPLAINT'>('INSTALLATION');
  const [address, setAddress] = useState(user?.address || 'Indiranagar, Bengaluru');
  const [requestNotes, setRequestNotes] = useState('');
  const [roofLength, setRoofLength] = useState('');
  const [roofWidth, setRoofWidth] = useState('');
  const [roofUnit, setRoofUnit] = useState<'feet' | 'inches'>('feet');
  const [roofSizeUnknown, setRoofSizeUnknown] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Service ticket form state
  const [issueDescription, setIssueDescription] = useState('');
  const [ticketPriority, setTicketPriority] = useState('MEDIUM');
  const [servicePhoto, setServicePhoto] = useState('');
  const [servicePhotoName, setServicePhotoName] = useState('');
  const [servicePhotoError, setServicePhotoError] = useState('');
  const [profileName, setProfileName] = useState(user?.fullName || '');
  const [profilePhone, setProfilePhone] = useState(user?.phone || '');
  const [profileAddress, setProfileAddress] = useState(user?.address || '');
  const [savingProfile, setSavingProfile] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [projRes, wrtRes, srvRes, catalogRes] = await Promise.all([
        api.projects.getAll(),
        api.warranties.getAll(),
        api.services.getAll(),
        api.inventory.getCatalog()
      ]);
      setProjects(projRes.data || []);
      setWarranties(wrtRes.data || []);
      setServices(srvRes.data || []);
      setCatalog(catalogRes.data || []);
    } catch (err: any) {
      console.error('Failed to load customer data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  useEffect(() => {
    if (navigationVersion === 0) return;
    const targetId = ({
      'My Solar Journey': 'customer-journey',
      'Quotations & Payments': 'customer-quotes',
      'Service Desk': 'customer-service',
      'Materials & Prices': 'customer-materials',
      Warranty: 'customer-warranty',
      'My Profile': 'customer-profile'
    } as Record<string, string>)[activeSection];
    const target = targetId && document.getElementById(targetId);
    (target || document.getElementById('customer-home'))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [navigationVersion]);

  useEffect(() => {
    setProfileName(user?.fullName || '');
    setProfilePhone(user?.phone || '');
    setProfileAddress(user?.address || '');
  }, [user]);

  const handleSaveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      setSavingProfile(true);
      await updateProfile({ fullName: profileName, phone: profilePhone, address: profileAddress });
      notice('Your profile was updated.');
    } catch (error: any) {
      notice(`Could not update your profile: ${error.message}`);
    } finally {
      setSavingProfile(false);
    }
  };

  const activeProject = projects[0] || null;

  // Handle new project submission
  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      if (requestType === 'INSTALLATION') {
        const roofEstimate = roofSizeUnknown || !roofLength || !roofWidth
          ? 'Approximate roof size: customer is unsure; confirm during site visit.'
          : `Approximate roof size: ${roofLength} × ${roofWidth} ${roofUnit}.`;
        await api.projects.create({
          projectName: `Solar installation for ${user?.fullName || 'customer'}`,
          // Internal placeholder required by the current schema; survey determines the recommendation.
          systemCapacityKw: 5.0,
          systemType: 'Rooftop On-Grid',
          installationAddress: address,
          notes: ['Customer requested solar installation. System size and setup to be confirmed after site visit.', roofEstimate, requestNotes].filter(Boolean).join('\n')
        });
        notice('Installation request sent. Our team will review the details and arrange a site visit.');
      } else {
        const category = requestType === 'MAINTENANCE' ? 'Maintenance request' : 'Customer complaint';
        await api.services.create({
          projectId: activeProject?.id,
          category: requestType,
          issueDescription: `${category}\nSite address: ${address}\n${issueDescription}`,
          priority: ticketPriority,
          photoData: servicePhoto || undefined
        });
        notice(requestType === 'MAINTENANCE' ? 'Maintenance request sent to our team.' : 'Your complaint was sent to our team.');
      }
      setIsRequestModalOpen(false);
      setRequestNotes('');
      setIssueDescription('');
      setServicePhoto('');
      setServicePhotoName('');
      setServicePhotoError('');
      setRoofLength('');
      setRoofWidth('');
      setRoofSizeUnknown(false);
      fetchData();
    } catch (err: any) {
      notice(`Error submitting request: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle quotation approval
  const handleApproveEstimate = async (estimateId: number) => {
    try {
      await api.estimates.takeAction(estimateId, 'APPROVE');
      notice('Quotation approved! Next step: installation scheduling and advance payment.');
      fetchData();
    } catch (err: any) {
      notice(`Error: ${err.message}`);
    }
  };

  const handleRejectEstimate = async (estimateId: number) => {
    try { await api.estimates.takeAction(estimateId, 'REJECT'); notice('Quotation declined. Our team has been notified.'); fetchData(); }
    catch (err: any) { notice(`Could not decline the quote: ${err.message}`); }
  };

  const downloadReceipt = (payment: any) => {
    const amount = Number(payment.amount).toLocaleString('en-IN');
    const transaction = String(payment.transactionRef || `PAY-${payment.id}`).replace(/[<>]/g, '');
    const safeName = String(user?.fullName || 'Customer').replace(/[<>]/g, '');
    const safeProject = String(activeProject?.requestNumber || 'SolarOps service').replace(/[<>]/g, '');
    const receipt = `<!doctype html><html><head><meta charset="utf-8"><title>SolarOps payment receipt ${transaction}</title><style>body{font:16px Arial,sans-serif;color:#23352a;margin:48px;max-width:760px}.brand{color:#31714b;font-size:24px;font-weight:bold}.box{border:1px solid #dce5dd;border-radius:10px;padding:24px;margin-top:24px}h1{font-size:22px}td{padding:12px 24px 12px 0}small{color:#68786d}</style></head><body><div class="brand">SolarOps</div><h1>Payment receipt</h1><small>Payment recorded ${new Date(payment.paidAt).toLocaleString()}</small><div class="box"><table><tr><td>Customer</td><td>${safeName}</td></tr><tr><td>Request</td><td>${safeProject}</td></tr><tr><td>Payment stage</td><td>${payment.paymentStage}</td></tr><tr><td>Method</td><td>${String(payment.paymentMethod || 'Recorded payment').replace(/[<>]/g, '')}</td></tr><tr><td>Transaction reference</td><td>${transaction}</td></tr><tr><td><b>Amount paid</b></td><td><b>₹${amount}</b></td></tr></table></div><p><small>This is a receipt for the payment recorded in the SolarOps demo portal.</small></p></body></html>`;
    const url = URL.createObjectURL(new Blob([receipt], { type: 'text/html' }));
    const link = document.createElement('a'); link.href = url; link.download = `SolarOps-receipt-${transaction}.html`; link.click(); URL.revokeObjectURL(url);
  };

  // Handle simulated advance payment
  const handleMakePayment = async (projectId: number, amount: number, paymentStage: 'ADVANCE' | 'FINAL' = 'ADVANCE') => {
    try {
      await api.payments.record({
        projectId,
        amount,
        paymentStage,
        paymentMethod: 'Demo portal record'
      });
      notice(`₹${amount.toLocaleString('en-IN')} ${paymentStage === 'ADVANCE' ? 'advance' : 'remaining balance'} recorded in this demo portal. You can download its receipt.`);
      fetchData();
    } catch (err: any) {
      notice(`Payment error: ${err.message}`);
    }
  };

  const openRequestForm = (type: 'INSTALLATION' | 'MAINTENANCE' | 'COMPLAINT') => {
    setRequestType(type);
    setIsRequestModalOpen(true);
  };

  const handleServicePhoto = (file?: File) => {
    setServicePhotoError('');
    if (!file) return;
    setServicePhoto('');
    setServicePhotoName('');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setServicePhotoError('Please choose a JPG, PNG, or WebP image.');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setServicePhotoError('Please choose an image smaller than 3 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setServicePhoto(String(reader.result || ''));
      setServicePhotoName(file.name);
    };
    reader.onerror = () => setServicePhotoError('The image could not be read. Please try another photo.');
    reader.readAsDataURL(file);
  };

  // Derive active step index
  const getStepIndex = (status: string) => {
    if (status === 'ENQUIRY') return 0;
    if (status === 'SURVEY_SCHEDULED' || status === 'SURVEY_COMPLETED') return 1;
    if (status === 'ESTIMATE_SENT' || status === 'ESTIMATE_APPROVED') return 2;
    if (status === 'INSTALLATION_SCHEDULED' || status === 'INSTALLATION_IN_PROGRESS') return 3;
    if (status === 'COMPLETED') return 4;
    return 0;
  };

  const getCustomerStatus = (status: string) => ({
    ENQUIRY: 'Request received',
    SURVEY_SCHEDULED: 'Site visit scheduled',
    SURVEY_COMPLETED: 'Site visit complete',
    ESTIMATE_SENT: 'Quote ready to review',
    ESTIMATE_APPROVED: 'Quote approved',
    INSTALLATION_SCHEDULED: 'Installation scheduled',
    INSTALLATION_IN_PROGRESS: 'Installation in progress',
    COMPLETED: 'Solar system installed',
    CANCELLED: 'Request cancelled'
  }[status] || 'Request in progress');

  const activeStepIdx = activeProject ? getStepIndex(activeProject.status) : 0;
  const currentEstimate = activeProject?.estimates?.[0] || null;
  const advancePayment = activeProject?.payments?.find((p: any) => p.paymentStage === 'ADVANCE') || null;
  const amountPaid = (activeProject?.payments || []).filter((payment: any) => payment.status === 'COMPLETED').reduce((sum: number, payment: any) => sum + Number(payment.amount), 0);
  const remainingBalance = Math.max(0, Number(currentEstimate?.netAmount || 0) - amountPaid);

  return (
    <div className={'customer-dashboard' + (activeSection === 'My Profile' ? ' profile-view' : '')}>
      {/* Hero Banner */}
      <div className="customer-hero panel" id="customer-home">
        <div>
          <span className={'status ' + (activeProject?.status === 'COMPLETED' ? 'green' : 'amber')}>
            ● &nbsp;{activeProject ? getCustomerStatus(activeProject.status) : 'NO ACTIVE PROJECT'}
          </span>
          <h2>
            {activeProject
              ? activeProject.status === 'ENQUIRY'
                ? 'We’ve received your solar installation request.'
                : activeProject.status === 'COMPLETED'
                  ? 'Your solar system is installed.'
                  : 'Your solar installation is moving forward.'
              : 'Power your home with clean, independent solar energy.'}
          </h2>
          <p>
            {activeProject
              ? activeProject.status === 'ENQUIRY'
                ? 'We’ll arrange a site visit, recommend a suitable system, and share the price with you before installation.'
                : `Site address: ${activeProject.installationAddress}. Follow each step below.`
              : 'Request solar installation for your home. Our team will help with the details.'}
          </p>
          <div className="hero-btn-row">
            <button className="button primary" onClick={() => openRequestForm('INSTALLATION')}>
              <Plus size={16} /> Request New Solar Installation
            </button>
            {warranties.length > 0 && (
              <button className="button light" onClick={() => setSelectedWarranty(warranties[0])}>
                <ShieldCheck size={16} /> View Warranty Certificate
              </button>
            )}
          </div>
        </div>
        <div className="sun-illustration">
          <Sun size={94} />
          <div className="roof">⌂</div>
        </div>
      </div>

      {activeSection === 'My Profile' && <section className="panel customer-profile-panel" id="customer-profile">
        <div className="panel-head">
          <div><h2>My profile</h2><p>Keep your contact details and service address up to date.</p></div>
        </div>
        <form className="customer-profile-form" onSubmit={handleSaveProfile}>
          <label>Full name<input value={profileName} onChange={(event) => setProfileName(event.target.value)} required minLength={2} /></label>
          <label>Phone number<input type="tel" value={profilePhone} onChange={(event) => setProfilePhone(event.target.value)} required minLength={10} /></label>
          <label>Property address<input value={profileAddress} onChange={(event) => setProfileAddress(event.target.value)} /></label>
          <button className="button primary" type="submit" disabled={savingProfile}>{savingProfile ? 'Saving…' : 'Save profile'}</button>
        </form>
      </section>}

      <section className="panel customer-materials-panel" id="customer-materials">
        <div className="panel-head"><div><h2>Solar components & prices</h2><p>See the individual components that may be included in your project. Your final quotation is confirmed after a site visit.</p></div></div>
        <div className="customer-material-grid">
          {catalog.map((item) => <article className="customer-material-card" key={item.id}>
            <span>{item.category.replace(/_/g, ' ')}</span>
            <b>{item.name}</b>
            <strong>₹{Number(item.unitCost).toLocaleString('en-IN')} <small>per {item.unit.replace(/s$/, '')}</small></strong>
          </article>)}
          {!catalog.length && <p className="empty-state">Component prices will appear here when available.</p>}
        </div>
      </section>

      {/* Live Journey Stepper */}
      {activeProject && (
        <div className="panel journey-panel" id="customer-journey">
          <div className="panel-head">
            <div>
              <h2>Installation Journey Tracker</h2>
              <p>Project {activeProject.requestNumber} · {activeProject.projectName}</p>
            </div>
            <div className="progress-badge">
              <span>{activeProject.progress}% Completed</span>
              <div className="progress-bar-mini">
                <div className="progress-fill" style={{ width: `${activeProject.progress}%` }} />
              </div>
            </div>
          </div>
          <div className="journey">
            {steps.map((s, i) => (
              <div key={s} className={'journey-step ' + (i < activeStepIdx ? 'done' : i === activeStepIdx ? 'current' : '')}>
                <div className="journey-dot">{i < activeStepIdx ? <Check size={14} /> : i + 1}</div>
                <b>{s}</b>
                {i === activeStepIdx && <small>Current</small>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grid: Project Details & Estimates/Payments */}
      <div className="bottom-grid">
        {/* Project Details */}
        <section className="panel" id="customer-quotes">
          <div className="panel-head">
            <div>
              <h2>Your Installation</h2>
              <p>We’ll confirm the right system for your home after the site visit.</p>
            </div>
            <Zap size={18} />
          </div>
          {activeProject ? (
            <div className="detail-list">
              <div className="detail-row"><span>Recommended system size</span><b>{activeProject.surveys?.[0]?.proposedCapacityKw ? `${activeProject.surveys[0].proposedCapacityKw} kW` : 'To be confirmed after site visit'}</b></div>
              <div className="detail-row"><span>Site visit</span><b>{activeProject.assignments?.[0]?.technician?.fullName ? `Scheduled with ${activeProject.assignments[0].technician.fullName}` : 'Our team will arrange this'}</b></div>
              <div className="detail-row"><span>Installation Site</span><b>{activeProject.installationAddress}</b></div>
              <div className="detail-row"><span>Current Status</span><b className="status-text">{getCustomerStatus(activeProject.status)}</b></div>
            </div>
          ) : (
            <div className="empty-state">
              <Sun size={32} />
              <p>No active solar projects found.</p>
              <button className="button primary small" onClick={() => openRequestForm('INSTALLATION')}>Create Request</button>
            </div>
          )}
        </section>

        {/* Quotation & Payments */}
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Your Quote & Payments</h2>
              <p>Review the price before deciding to proceed.</p>
            </div>
            <CreditCard size={18} />
          </div>

          {currentEstimate ? (
            <div className="estimate-box">
              <div className="estimate-header">
                <b>Quotation {currentEstimate.estimateNumber}</b>
                <span className={'status ' + (currentEstimate.status === 'APPROVED' ? 'green' : 'amber')}>
                  {currentEstimate.status}
                </span>
              </div>
              <div className="estimate-financials">
                {currentEstimate.items?.map((item: any) => <div className="fin-row" key={item.id}><span>{item.name} · {item.quantity} {item.unit}</span><span>₹{Number(item.lineTotal).toLocaleString('en-IN')}</span></div>)}
                <div className="fin-row"><span>Total price:</span><span>₹{currentEstimate.totalAmount.toLocaleString('en-IN')}</span></div>
                <div className="fin-row green-text"><span>Estimated government support:</span><span>- ₹{currentEstimate.subsidyAmount.toLocaleString('en-IN')}</span></div>
                <div className="fin-row total-row"><span>Your price after support:</span><b>₹{currentEstimate.netAmount.toLocaleString('en-IN')}</b></div>
              </div>

              {currentEstimate.status === 'SENT' && (
                <div className="quote-decision-actions"><button className="button primary" onClick={() => handleApproveEstimate(currentEstimate.id)}><Check size={16} /> Accept this quote</button><button className="button light" onClick={() => handleRejectEstimate(currentEstimate.id)}>Decline</button></div>
              )}
            </div>
          ) : (
            <div className="payment-card">
              <div>
                <small>QUOTATION</small>
                <b>Site survey evaluation required first</b>
              </div>
              <span className="status neutral">PENDING SURVEY</span>
            </div>
          )}

          {/* Payment Card */}
          <div className="payment-card" id="customer-warranty">
            <div>
              <small>ADVANCE PAYMENT</small>
              {advancePayment ? (
                <b>₹ {advancePayment.amount.toLocaleString('en-IN')} <span>· Paid on {new Date(advancePayment.paidAt).toLocaleDateString()}</span></b>
              ) : currentEstimate?.status === 'APPROVED' ? (
                <b>No advance payment recorded yet <span>· Record it here to begin installation</span></b>
              ) : (
                <b>No payment due yet <span>· Payment details appear after you accept a quote</span></b>
              )}
            </div>
            {advancePayment ? (
              <div className="payment-actions"><span className="status green">PAID</span><button className="button light small" onClick={() => downloadReceipt(advancePayment)}><FileText size={14} /> Download receipt</button></div>
            ) : currentEstimate?.status === 'APPROVED' ? (
              <button className="button primary small" onClick={() => handleMakePayment(activeProject.id, Math.max(1, Math.round(currentEstimate.netAmount * 0.2)))}>
                Record 20% advance · ₹{Math.round(currentEstimate.netAmount * 0.2).toLocaleString('en-IN')}
              </button>
            ) : (
              <span className="status neutral">UPCOMING</span>
            )}
          </div>

          {currentEstimate?.status === 'APPROVED' && <div className="payment-card remaining-balance-card">
            <div><small>REMAINING BALANCE</small><b>₹{remainingBalance.toLocaleString('en-IN')} <span>· Quote total less payments already recorded</span></b></div>
            {remainingBalance <= 0 ? <span className="status green">SETTLED</span> : activeProject?.status === 'COMPLETED' ? <button className="button primary small" onClick={() => handleMakePayment(activeProject.id, remainingBalance, 'FINAL')}>Pay remaining balance · ₹{remainingBalance.toLocaleString('en-IN')}</button> : <span className="status neutral">DUE AFTER INSTALLATION</span>}
          </div>}

          {(activeProject?.payments || []).filter((payment: any) => payment.status === 'COMPLETED').length > 0 && <div className="customer-payment-history"><h3>Payment receipts</h3>{activeProject.payments.filter((payment: any) => payment.status === 'COMPLETED').map((payment: any) => <div key={payment.id}><span>{payment.paymentStage.replace(/_/g, ' ')} · ₹{Number(payment.amount).toLocaleString('en-IN')} · {new Date(payment.paidAt).toLocaleDateString()}</span><button className="button light small" onClick={() => downloadReceipt(payment)}><FileText size={14} /> Download receipt</button></div>)}</div>}

          {/* Warranty Preview */}
          <div className="payment-card">
            <div>
              <small>PROTECTION & WARRANTY</small>
              <b>{warranties.length > 0 ? `${warranties[0].certificateNumber} (Active)` : 'Active after system commissioning'}</b>
            </div>
            {warranties.length > 0 ? (
              <button className="button light small" onClick={() => setSelectedWarranty(warranties[0])}>
                View Certificate
              </button>
            ) : (
              <span className="status neutral">PENDING HANDOVER</span>
            )}
          </div>
        </section>
      </div>

      {/* Service Tickets Section */}
      <div className="panel service-panel" id="customer-service">
        <div className="panel-head">
          <div>
            <h2>Maintenance & Support</h2>
            <p>Request maintenance, ask a question, or report a problem.</p>
          </div>
          <button className="button light" onClick={() => openRequestForm('MAINTENANCE')}>
            <Wrench size={16} /> Request Maintenance
          </button>
        </div>
        <p className="support-contact">Need to speak with us? <a href="tel:+919160436054">Call {supportPhone}</a></p>

        {services.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>TICKET NO</th>
                  <th>ISSUE DESCRIPTION</th>
                  <th>PRIORITY</th>
                  <th>STATUS</th>
                  <th>DATE</th>
                </tr>
              </thead>
              <tbody>
                {services.map((s) => (
                  <tr key={s.id}>
                    <td><b>{s.ticketNumber}</b></td>
                    <td>{s.issueDescription}</td>
                    <td>
                      <span className={'badge-priority ' + s.priority.toLowerCase()}>
                        {s.priority}
                      </span>
                    </td>
                    <td>
                      <span className={'status ' + (s.status === 'RESOLVED' ? 'green' : s.status === 'OPEN' ? 'amber' : 'neutral')}>
                        {s.status}
                      </span>
                    </td>
                    <td>{new Date(s.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state small">
            <CheckCircle2 size={24} />
            <p>No maintenance requests or complaints yet.</p>
          </div>
        )}
      </div>

      {/* Modal: Customer service request */}
      {isRequestModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h2>{requestType === 'INSTALLATION' ? 'Request Solar Installation' : requestType === 'MAINTENANCE' ? 'Request Maintenance' : 'Report a Problem'}</h2>
              <button className="modal-close" onClick={() => setIsRequestModalOpen(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleCreateRequest} className="modal-form">
              <div className="form-group">
                <label>What do you need?</label>
                <select value={requestType} onChange={(e) => setRequestType(e.target.value as typeof requestType)}>
                  <option value="INSTALLATION">Install new solar panels</option>
                  <option value="MAINTENANCE">Request maintenance (any type)</option>
                  <option value="COMPLAINT">Report a problem or make a complaint</option>
                </select>
              </div>

              {requestType === 'INSTALLATION' && <>
                <p className="form-help">Approximate roof measurements help our team prepare. If you’re unsure, choose “I’m not sure” and we’ll measure during the visit.</p>
                <label className="checkbox-label"><input type="checkbox" checked={roofSizeUnknown} onChange={(e) => setRoofSizeUnknown(e.target.checked)} /> I’m not sure about the roof size</label>
                {!roofSizeUnknown && <>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Approximate roof length</label>
                      <input type="number" min="1" step="any" required={!roofSizeUnknown} placeholder="For example, 30" value={roofLength} onChange={(e) => setRoofLength(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label>Approximate roof width</label>
                      <input type="number" min="1" step="any" required={!roofSizeUnknown} placeholder="For example, 20" value={roofWidth} onChange={(e) => setRoofWidth(e.target.value)} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Measurement unit</label>
                    <select value={roofUnit} onChange={(e) => setRoofUnit(e.target.value as typeof roofUnit)}>
                      <option value="feet">Feet</option>
                      <option value="inches">Inches</option>
                    </select>
                  </div>
                </>}
              </>}

              <div className="form-group">
                <label>{requestType === 'INSTALLATION' ? 'Installation address' : 'Where is the property?'}</label>
                <input
                  type="text"
                  required
                  placeholder="Plot/Flat, Street, Area, Pin Code"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>

              {requestType === 'INSTALLATION' ? (
                <div className="form-group">
                  <label>Anything else we should know? (optional)</label>
                  <textarea rows={3} placeholder="Any questions or details about your home? You can leave this blank." value={requestNotes} onChange={(e) => setRequestNotes(e.target.value)} />
                </div>
              ) : <>
                <div className="form-group">
                  <label>{requestType === 'MAINTENANCE' ? 'What maintenance do you need?' : 'What happened?'}</label>
                  <textarea required minLength={10} rows={3} placeholder={requestType === 'MAINTENANCE' ? 'Tell us what you would like checked or serviced.' : 'Describe the problem or complaint so we can help.'} value={issueDescription} onChange={(e) => setIssueDescription(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>How soon do you need help?</label>
                  <select value={ticketPriority} onChange={(e) => setTicketPriority(e.target.value)}>
                    <option value="LOW">When convenient</option>
                    <option value="MEDIUM">Soon</option>
                    <option value="HIGH">As soon as possible</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Add a photo (optional)</label>
                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => handleServicePhoto(e.target.files?.[0])} />
                  <small className="form-help">A clear photo can help our technician review the concern. JPG, PNG, or WebP up to 3 MB.</small>
                  {servicePhotoError && <small className="auth-error">{servicePhotoError}</small>}
                  {servicePhoto && <div className="service-photo-preview"><img src={servicePhoto} alt="Photo attached to service request" /><div><b>{servicePhotoName}</b><button type="button" className="link-btn" onClick={() => { setServicePhoto(''); setServicePhotoName(''); }}>Remove photo</button></div></div>}
                </div>
              </>}

              <div className="modal-actions">
                <button type="button" className="button light" onClick={() => setIsRequestModalOpen(false)}>Cancel</button>
                <button type="submit" className="button primary" disabled={submitting}>
                  {submitting ? 'Submitting...' : requestType === 'INSTALLATION' ? 'Submit Installation Request' : requestType === 'MAINTENANCE' ? 'Send Maintenance Request' : 'Send Complaint'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Warranty Modal */}
      {selectedWarranty && (
        <WarrantyModal warranty={selectedWarranty} onClose={() => setSelectedWarranty(null)} />
      )}
    </div>
  );
}
