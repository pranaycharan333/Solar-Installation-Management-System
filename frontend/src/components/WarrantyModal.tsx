import React from 'react';
import { ShieldCheck, Award, X, Check, Calendar, Sun } from 'lucide-react';

interface WarrantyModalProps {
  warranty: any;
  onClose: () => void;
}

export default function WarrantyModal({ warranty, onClose }: WarrantyModalProps) {
  if (!warranty) return null;

  const project = warranty.project;

  return (
    <div className="modal-backdrop">
      <div className="certificate-card">
        <button className="modal-close" onClick={onClose}><X size={18} /></button>

        <div className="certificate-border">
          <div className="cert-header">
            <div className="cert-seal">
              <Sun size={28} />
            </div>
            <h2>CERTIFICATE OF SOLAR WARRANTY</h2>
            <p className="cert-sub">SOLAROPS INTELLIGENCE ASSURED PERFORMANCE</p>
            <div className="cert-number">CERTIFICATE NO: <b>{warranty.certificateNumber}</b></div>
          </div>

          <div className="cert-body">
            <p className="cert-statement">
              This document certifies that the solar photovoltaic installation described below has been engineered,
              tested, and commissioned according to national standards and is covered under the SolarOps Comprehensive Protection Plan.
            </p>

            <div className="cert-details-grid">
              <div className="cert-detail">
                <span>INSTALLATION</span>
                <b>{project?.projectName || 'Rooftop Solar System'}</b>
              </div>
              <div className="cert-detail">
                <span>SYSTEM CAPACITY</span>
                <b>{project?.systemCapacityKw ? `${project.systemCapacityKw} kW` : '6.5 kW'}</b>
              </div>
              <div className="cert-detail">
                <span>SYSTEM TYPE</span>
                <b>{project?.systemType || 'Rooftop On-Grid'}</b>
              </div>
              <div className="cert-detail">
                <span>SITE LOCATION</span>
                <b>{project?.installationAddress || 'Bengaluru, Karnataka'}</b>
              </div>
            </div>

            <div className="cert-tiers">
              <div className="cert-tier">
                <div className="tier-icon"><ShieldCheck size={20} /></div>
                <b>{warranty.systemWarrantyYears || 5} Years</b>
                <small>Comprehensive System & Workmanship Guarantee</small>
              </div>
              <div className="cert-tier">
                <div className="tier-icon"><Award size={20} /></div>
                <b>{warranty.inverterWarrantyYears || 10} Years</b>
                <small>Power Inverter & Conversion Electronics</small>
              </div>
              <div className="cert-tier">
                <div className="tier-icon"><Sun size={20} /></div>
                <b>{warranty.panelWarrantyYears || 25} Years</b>
                <small>PV Module Linear Power Output Guarantee (80%+)</small>
              </div>
            </div>

            <div className="cert-terms">
              <b>Warranty Terms & Coverage:</b>
              <p>{warranty.terms || 'Full on-site technician dispatch, component replacement, and remote generation monitoring included.'}</p>
            </div>

            <div className="cert-dates">
              <div><Calendar size={14} /> Effective: {new Date(warranty.startDate).toLocaleDateString()}</div>
              <div>Valid Thru: {new Date(warranty.endDate).toLocaleDateString()}</div>
            </div>
          </div>

          <div className="cert-footer">
            <div className="cert-sign">
              <div className="signature-line" />
              <b>Aarav Kapoor</b>
              <small>Authorized Signatory, SolarOps HQ</small>
            </div>
            <div className="cert-stamp">
              <Check size={16} /> VERIFIED & ACTIVE
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
