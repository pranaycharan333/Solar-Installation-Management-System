import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

const demoPhotoRecommendations = [
  'Possible dust or soiling on the panel surface. Check whether cleaning is needed.',
  'Possible dirt or mud buildup on the panel surface. Verify during the site visit.',
  'Possible panel damage or cracked glass. Keep clear of the area and verify on site.',
  'Possible snow or surface covering. Check whether it is blocking the panel.'
];

function photoRecommendation(ticket: any) {
  if (ticket.visualFinding) return { text: ticket.visualFinding, simulated: false };
  return { text: demoPhotoRecommendations[Math.abs(Number(ticket.id) || 0) % demoPhotoRecommendations.length], simulated: true };
}
import {
  Wrench,
  CheckCircle2,
  Clock,
  Calendar,
  MapPin,
  Phone,
  ClipboardList,
  Check,
  X,
  Plus,
  Camera,
  AlertTriangle,
  Zap,
  ArrowRight
} from 'lucide-react';

export default function TechnicianDashboard({ notice, activeSection, navigationVersion }: { notice: (msg: string) => void; activeSection: string; navigationVersion: number }) {
  const [projects, setProjects] = useState<any[]>([]);
  const [serviceTickets, setServiceTickets] = useState<any[]>([]);
  const [serviceImages, setServiceImages] = useState<Record<number, string>>({});
  const [activeProject, setActiveProject] = useState<any | null>(null);
  const [checklists, setChecklists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isSurveyModalOpen, setIsSurveyModalOpen] = useState(false);
  const [isFieldReportModalOpen, setIsFieldReportModalOpen] = useState(false);

  // Survey Form State
  const [roofType, setRoofType] = useState('Concrete Flat Roof');
  const [roofArea, setRoofArea] = useState('650');
  const [shading, setShading] = useState('Nil shading between 9 AM and 4:30 PM');
  const [structural, setStructural] = useState('Approved (RCC Slab 150mm)');
  const [electrical, setElectrical] = useState('Good, upgraded 3-phase MCB');
  const [proposedKw, setProposedKw] = useState('6.5');
  const [surveyNotes, setSurveyNotes] = useState('');
  const [submittingSurvey, setSubmittingSurvey] = useState(false);
  const [fieldReport, setFieldReport] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);

  const fetchTechData = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const [res, serviceRes] = await Promise.all([api.projects.getAll(), api.services.getAll()]);
      const allProjects = res.data || [];
      setServiceTickets(serviceRes.data || []);
      setProjects(allProjects);

      if (allProjects.length > 0) {
        const current = activeProject
          ? allProjects.find((p) => p.id === activeProject.id) || allProjects[0]
          : allProjects[0];
        setActiveProject(current);
        loadChecklist(current.id);
      }
    } catch (err: any) {
      console.error('Failed to load technician projects:', err);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const loadChecklist = async (projectId: number) => {
    try {
      const res = await api.checklists.getByProject(projectId);
      setChecklists(res.data || []);
    } catch (err) {
      console.error('Checklist load error:', err);
    }
  };

  useEffect(() => {
    fetchTechData();
    const refreshTimer = window.setInterval(() => fetchTechData(false), 20000);
    return () => window.clearInterval(refreshTimer);
  }, []);

  const photoTicketIds = serviceTickets.filter((ticket) => ticket.hasPhoto).map((ticket) => ticket.id).join(',');
  useEffect(() => {
    let current = true;
    const objectUrls: string[] = [];
    const loadPhotos = async () => {
      const ticketsWithPhotos = serviceTickets.filter((ticket) => ticket.hasPhoto);
      const entries = await Promise.all(ticketsWithPhotos.map(async (ticket) => {
        try {
          const url = await api.services.getPhoto(ticket.id);
          objectUrls.push(url);
          return [ticket.id, url] as const;
        } catch {
          return null;
        }
      }));
      if (current) setServiceImages(Object.fromEntries(entries.filter(Boolean) as Array<readonly [number, string]>));
    };
    if (photoTicketIds) loadPhotos();
    else setServiceImages({});
    return () => {
      current = false;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [photoTicketIds]);

  useEffect(() => {
    if (navigationVersion === 0) return;
    setIsSurveyModalOpen(false);
    setIsFieldReportModalOpen(false);
    if (activeSection === 'My Work Queue') {
      document.getElementById('tech-work-queue')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (activeSection === 'Installation Checklists') {
      document.getElementById('tech-installation-checklist')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (activeSection === 'Site Surveys') {
      if (activeProject) setIsSurveyModalOpen(true);
      else notice('No assigned job is available for a site survey yet.');
    } else if (activeSection === 'Field Reports') {
      if (activeProject) setIsFieldReportModalOpen(true);
      else notice('No assigned job is available for a field report yet.');
    }
  }, [navigationVersion]);

  const handleSelectProject = (project: any) => {
    setActiveProject(project);
    loadChecklist(project.id);
  };

  const handleInspectProject = async (project: any) => {
    setActiveProject(project);
    await loadChecklist(project.id);
    notice(`Opened ${project.requestNumber} inspection checklist.`);
    window.setTimeout(() => document.getElementById('tech-installation-checklist')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  };

  // Toggle checklist step
  const handleToggleChecklist = async (stepId: number, currentStatus: boolean) => {
    try {
      const res = await api.checklists.toggle(stepId, { isCompleted: !currentStatus });
      notice(res.message);
      // Reload checklist & project progress
      if (activeProject) {
        loadChecklist(activeProject.id);
        const updatedProject = {
          ...activeProject,
          progress: res.projectProgress,
          status: res.projectStatus
        };
        setActiveProject(updatedProject);
      }
      fetchTechData();
    } catch (err: any) {
      notice(`Failed to update step: ${err.message}`);
    }
  };

  // Submit Site Survey
  const handleSubmitSurvey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject) return;

    try {
      setSubmittingSurvey(true);
      await api.surveys.submit({
        projectId: activeProject.id,
        roofType,
        roofAreaSqft: parseFloat(roofArea) || 600,
        shadingCondition: shading,
        structuralFeasibility: structural,
        electricalPanelCondition: electrical,
        proposedCapacityKw: parseFloat(proposedKw) || activeProject.systemCapacityKw,
        surveyNotes
      });
      notice(`Site survey submitted for ${activeProject.requestNumber}! Ready for Admin quotation.`);
      setIsSurveyModalOpen(false);
      fetchTechData();
    } catch (err: any) {
      notice(`Survey submission failed: ${err.message}`);
    } finally {
      setSubmittingSurvey(false);
    }
  };

  const handleSubmitFieldReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject) return;
    try {
      setSubmittingReport(true);
      await api.projects.updateStatus(activeProject.id, { notes: fieldReport });
      notice(`Field report saved for ${activeProject.requestNumber}.`);
      setIsFieldReportModalOpen(false);
      setFieldReport('');
      fetchTechData(false);
    } catch (err: any) {
      notice(`Could not save field report: ${err.message}`);
    } finally {
      setSubmittingReport(false);
    }
  };

  return (
    <div className="technician-dashboard">
      {/* Tech KPI Metrics */}
      <div className="metrics">
        <div className="metric">
          <div className="metric-top">
            <span>Jobs Assigned</span>
            <i><ClipboardList /></i>
          </div>
          <div className="metric-number">{projects.length}</div>
          <div className="metric-bottom">
            <span className="change flat">Active queue</span>
            <small>Bengaluru cluster</small>
          </div>
        </div>

        <div className="metric">
          <div className="metric-top">
            <span>Checklist Progress</span>
            <i><CheckCircle2 /></i>
          </div>
          <div className="metric-number">
            {checklists.filter((c) => c.isCompleted).length} / {checklists.length || 6}
          </div>
          <div className="metric-bottom">
            <span className="change healthy">Verified steps</span>
            <small>Active job</small>
          </div>
        </div>

        <div className="metric">
          <div className="metric-top">
            <span>Current Project</span>
            <i><Zap /></i>
          </div>
          <div className="metric-number">{activeProject ? `${activeProject.progress}%` : 'N/A'}</div>
          <div className="metric-bottom">
            <span className="change up">{activeProject?.status.replace(/_/g, ' ') || 'Idle'}</span>
            <small>{activeProject?.requestNumber}</small>
          </div>
        </div>

        <div className="metric">
          <div className="metric-top">
            <span>Safety Inspection</span>
            <i><Wrench /></i>
          </div>
          <div className="metric-number">100%</div>
          <div className="metric-bottom">
            <span className="change healthy">MNRE Standards</span>
            <small>Zero incidents</small>
          </div>
        </div>
      </div>

      <div className="overview-grid">
        {/* Work Queue */}
        <section className="panel projects-panel" id="tech-work-queue">
          <div className="panel-head">
            <div>
              <h2>Field Work Queue</h2>
              <p>Assigned installation sites and customer visits.</p>
            </div>
            <button className="select-pill"><Calendar size={14} /> Today, Nov 21</button>
          </div>

          <div className="job-list">
            {projects.map((p) => (
              <div
                key={p.id}
                className={'job-card clickable ' + (activeProject?.id === p.id ? 'active-job' : '')}
                onClick={() => handleSelectProject(p)}
              >
                <div className="job-time">
                  <b>{p.requestNumber}</b>
                  <small>{p.systemCapacityKw} kW</small>
                </div>
                <div className="job-body">
                  <div className="job-title">
                    <div>
                      <span className={'status ' + (p.status === 'COMPLETED' ? 'green' : 'amber')}>
                        {p.status.replace(/_/g, ' ')}
                      </span>
                      <h3>{p.customer?.fullName || 'Customer'}</h3>
                      <p><MapPin size={12} /> {p.installationAddress}</p>
                    </div>
                    <button
                      className="button light small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleInspectProject(p);
                      }}
                    >
                      Inspect <ArrowRight size={14} />
                    </button>
                  </div>
                  <div className="job-foot">
                    <span><Phone size={13} /> {p.customer?.phone || '+91 98451 22334'}</span>
                    <span>Progress: {p.progress}%</span>
                    {p.status === 'SURVEY_SCHEDULED' && (
                      <button
                        className="survey-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveProject(p);
                          setIsSurveyModalOpen(true);
                        }}
                      >
                        + Submit Survey
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Selected Project Live Checklist & Survey Controls */}
        <section className="panel" id="tech-installation-checklist">
          <div className="panel-head">
            <div>
              <h2>Interactive Installation Checklist</h2>
              <p>Project {activeProject?.requestNumber || 'SO-2408'} · Real-time verification.</p>
            </div>
            {activeProject && (
              <button
                className="button primary small"
                onClick={() => setIsSurveyModalOpen(true)}
              >
                + Site Survey Form
              </button>
            )}
          </div>

          {activeProject ? (
            <div className="checklist-container">
              <div className="checklist-meta">
                <div>
                  <b>{activeProject.projectName}</b>
                  <small className="block-sub">{activeProject.installationAddress}</small>
                </div>
                <div className="status green">{activeProject.progress}% Done</div>
              </div>

              <div className="checklist-items">
                {checklists.map((step) => (
                  <div
                    key={step.id}
                    className={'checklist-item ' + (step.isCompleted ? 'completed' : '')}
                    onClick={() => handleToggleChecklist(step.id, step.isCompleted)}
                  >
                    <div className="checkbox-box">
                      {step.isCompleted && <Check size={14} />}
                    </div>
                    <div className="checklist-info">
                      <b>{step.title}</b>
                      {step.isCompleted && step.completedBy && (
                        <small>Verified by {step.completedBy} on {new Date(step.completedAt).toLocaleTimeString()}</small>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {activeProject.progress === 100 && (
                <div className="completion-banner">
                  <CheckCircle2 size={20} />
                  <div>
                    <b>Installation Complete & Commissioned!</b>
                    <p>DISCOM net metering synchronized. 5-year warranty certificate auto-provisioned for customer.</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="empty-state">
              <ClipboardList size={32} />
              <p>Select a job from the work queue to inspect its installation checklist.</p>
            </div>
          )}
        </section>
      </div>

      <section className="panel technician-service-requests" id="technician-service-requests">
        <div className="panel-head">
          <div>
            <h2>Maintenance & Customer Support Requests</h2>
            <p>Customer concerns assigned to you, including any attached photos.</p>
          </div>
        </div>
        {serviceTickets.length ? serviceTickets.map((ticket) => (
          <article className="technician-service-ticket" key={ticket.id}>
            <div className="technician-service-summary">
              <div>
                <span className="status amber">{ticket.status.replace(/_/g, ' ')}</span>
                <h3>{ticket.ticketNumber} · {ticket.customer?.fullName || 'Customer'}</h3>
                <p className="service-ticket-description">{ticket.issueDescription}</p>
                <small>Priority: {ticket.priority} · {new Date(ticket.createdAt).toLocaleString()}</small>
              </div>
              {serviceImages[ticket.id] && <img className="service-ticket-photo" src={serviceImages[ticket.id]} alt={`Customer photo for ${ticket.ticketNumber}`} loading="lazy" decoding="async" />}
            </div>
            {ticket.hasPhoto && <div className="technician-photo-review">
              <b>Customer photo · {photoRecommendation(ticket).simulated ? 'Demo recommendation' : 'Photo recommendation'}</b>
              <p>{photoRecommendation(ticket).text}</p>
              <small>{photoRecommendation(ticket).simulated ? 'Simulated rotation for demonstration; this is not image detection. Confirm the condition during the site visit.' : 'Confirm the condition during the site visit and record your finding in the report.'}</small>
            </div>}
          </article>
        )) : <div className="empty-state small"><ClipboardList size={24} /><p>No maintenance or support requests are assigned to you yet.</p></div>}
      </section>

      {/* Field Note & Advisory Photo Review */}
      <div className="bottom-grid" id="tech-field-reports">
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Field Site Details</h2>
              <p>Customer contact & rooftop specifications.</p>
            </div>
            <Zap size={18} />
          </div>
          {activeProject ? (
            <div className="detail-list">
              <div className="detail-row"><span>Customer Contact</span><b>{activeProject.customer?.phone || 'N/A'}</b></div>
              <div className="detail-row"><span>Email</span><b>{activeProject.customer?.email || 'N/A'}</b></div>
              <div className="detail-row"><span>System Type</span><b>{activeProject.systemType}</b></div>
              <div className="detail-row"><span>Capacity</span><b>{activeProject.systemCapacityKw} kW Peak</b></div>
              <div className="detail-row"><span>Special Notes</span><b>{activeProject.notes || 'None'}</b></div>
            </div>
          ) : null}
        </section>

        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Photographic Inspection & Safety Notice</h2>
              <p>Field documentation guidelines.</p>
            </div>
            <Camera size={18} />
          </div>
          <div className="recommendation">
            <b>MNRE Safety Compliance Standard</b>
            <p>
              Ensure all DC cables are UV-rated and routed inside rigid conduit. Measure earth pit resistance
              before net meter power injection. AI site photo analysis is purely advisory for shadow detection
              and does not replace physical multimeter verification.
            </p>
            <span className="status amber">PHYSICAL TESTING MANDATORY</span>
          </div>
        </section>
      </div>

      {/* MODAL: SUBMIT SITE SURVEY */}
      {isSurveyModalOpen && activeProject && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h2>Site Survey Form: {activeProject.requestNumber}</h2>
              <button className="modal-close" onClick={() => setIsSurveyModalOpen(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmitSurvey} className="modal-form">
              <div className="form-group">
                <label>Customer & Site</label>
                <input type="text" disabled value={`${activeProject.customer?.fullName} — ${activeProject.installationAddress}`} />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Roof Structure Type</label>
                  <select value={roofType} onChange={(e) => setRoofType(e.target.value)}>
                    <option value="Concrete Flat Roof">Concrete Flat Roof (RCC)</option>
                    <option value="Sloped Metal Sheet">Sloped Metal Sheet (GI/Colour Coated)</option>
                    <option value="Mangalore Tile Sloped">Mangalore Tile / Clay Tile</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Effective Roof Area (sq. ft)</label>
                  <input
                    type="number"
                    required
                    value={roofArea}
                    onChange={(e) => setRoofArea(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Structural Feasibility</label>
                  <select value={structural} onChange={(e) => setStructural(e.target.value)}>
                    <option value="Approved (RCC Slab 150mm)">Approved (Sound RCC Slab)</option>
                    <option value="Approved with Elevated Legs">Approved with Elevated Superstructure</option>
                    <option value="Needs Reinforcement">Needs Reinforcement</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Proposed System Capacity (kW)</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={proposedKw}
                    onChange={(e) => setProposedKw(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Shading Assessment</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Zero shading 9 AM - 4:30 PM, minor shadow from parapet after 5 PM"
                  value={shading}
                  onChange={(e) => setShading(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Electrical Panel & Cable Route Notes</label>
                <textarea
                  rows={3}
                  placeholder="e.g. Distance from roof to main distribution box is 22m. 3-phase meter present. Easy staircase roof access."
                  value={surveyNotes}
                  onChange={(e) => setSurveyNotes(e.target.value)}
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="button light" onClick={() => setIsSurveyModalOpen(false)}>Cancel</button>
                <button type="submit" className="button primary" disabled={submittingSurvey}>
                  {submittingSurvey ? 'Saving Survey...' : 'Submit Survey & Advance Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isFieldReportModalOpen && activeProject && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h2>Field Report: {activeProject.requestNumber}</h2>
              <button className="modal-close" onClick={() => setIsFieldReportModalOpen(false)} aria-label="Close"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmitFieldReport} className="modal-form">
              <p className="form-help">Record a visit update, customer concern, or work completed at this site.</p>
              <div className="form-group">
                <label>Report details</label>
                <textarea required minLength={5} rows={5} value={fieldReport} onChange={(e) => setFieldReport(e.target.value)} placeholder="Write a short update for the admin and customer record." />
              </div>
              <div className="modal-actions">
                <button type="button" className="button light" onClick={() => setIsFieldReportModalOpen(false)}>Cancel</button>
                <button type="submit" className="button primary" disabled={submittingReport}>{submittingReport ? 'Saving...' : 'Submit field report'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
