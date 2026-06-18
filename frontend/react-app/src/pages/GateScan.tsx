import React, { useState } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { ScanLine, CheckCircle, Truck, MapPin } from 'lucide-react';
import './GateScan.css';

export const GateScan: React.FC = () => {
  const [scanned, setScanned] = useState(false);

  return (
    <div className="qms-gatescan-page">
      <div className="qms-gatescan-header">
        <h1>Gate Security Scan</h1>
        <p>Align the RMC Challan QR code within the frame to verify truck entry</p>
      </div>

      {!scanned ? (
        <Card className="qms-scanner-card" padding="none">
          <div className="qms-camera-view">
            <div className="qms-scanner-frame">
              <ScanLine size={48} className="qms-scan-icon" />
              <div className="qms-scan-corners"></div>
            </div>
            <div className="qms-camera-overlay">Camera active</div>
          </div>
          <div style={{ padding: 20, textAlign: 'center' }}>
            <Button variant="primary" fullWidth onClick={() => setScanned(true)}>
              Simulate Successful Scan
            </Button>
          </div>
        </Card>
      ) : (
        <div className="qms-scan-result">
          <div className="qms-success-mark">
            <CheckCircle size={48} />
          </div>
          <h2>Challan Verified</h2>
          <p className="text-muted" style={{ marginBottom: 24 }}>Details captured from QR Code</p>

          <Card className="qms-truck-details">
            <div className="qms-td-row">
              <span className="text-muted"><Truck size={16} /> Supplier</span>
              <span className="font-medium">UltraTech RMC Whitefield</span>
            </div>
            <div className="qms-td-row">
              <span className="text-muted">Challan No.</span>
              <span className="font-medium">CH-20240601-089</span>
            </div>
            <div className="qms-td-row">
              <span className="text-muted">Vehicle No.</span>
              <span className="font-medium">KA-05-AB-1234</span>
            </div>
            <div className="qms-td-row">
              <span className="text-muted">Driver Name</span>
              <span className="font-medium">Suresh Kumar</span>
            </div>
            <div className="qms-td-row">
              <span className="text-muted">Concrete Grade</span>
              <span className="font-medium">M40</span>
            </div>
            <div className="qms-td-row">
              <span className="text-muted">Dispatch Time</span>
              <span className="font-medium">06:15 AM</span>
            </div>
            <div className="qms-td-row">
              <span className="text-muted">Destination</span>
              <span className="font-medium"><MapPin size={16} style={{ display: 'inline', verticalAlign: 'text-bottom' }} /> Tower 1 (Emerald)</span>
            </div>
          </Card>

          <div className="qms-alert-box qms-alert--success">
            <CheckCircle size={18} />
            <div>
              <strong>Entry Allowed</strong>
              <div>Notifications sent to Quality Manager and Supervisor.</div>
            </div>
          </div>

          <Button variant="outline" fullWidth onClick={() => setScanned(false)}>
            Scan Next Vehicle
          </Button>
        </div>
      )}
    </div>
  );
};
