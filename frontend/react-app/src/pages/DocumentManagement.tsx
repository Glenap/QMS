import React, { useState } from 'react';
import { Search, Filter, FileText, Download, Upload, MoreVertical, CheckCircle, Clock, XCircle, FileType, BookOpen, ShieldCheck } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import './DocumentManagement.css';

const DOCS = [
  { id: 'DOC-QM-001', title: 'Corporate Quality Manual 2024', category: 'Manual', version: 'v4.2', status: 'Approved', date: '12-Jun-2024', author: 'Rajeev S.' },
  { id: 'DOC-SOP-104', title: 'Concrete Pouring Guidelines', category: 'SOP', version: 'v2.1', status: 'Under Review', date: '15-Jun-2024', author: 'Amit K.' },
  { id: 'DOC-CHK-088', title: 'Pre-pour Inspection Checklist', category: 'Checklist', version: 'v5.0', status: 'Approved', date: '01-May-2024', author: 'System' },
  { id: 'DOC-TRN-012', title: 'Safety Training Module Q3', category: 'Training', version: 'v1.0', status: 'Draft', date: '18-Jun-2024', author: 'Neha M.' },
  { id: 'DOC-POL-005', title: 'Material Rejection Policy', category: 'Policy', version: 'v3.1', status: 'Approved', date: '10-Jan-2024', author: 'Rajeev S.' },
];

export const DocumentManagement: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredDocs = DOCS.filter(d => d.title.toLowerCase().includes(searchTerm.toLowerCase()));

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'Approved': return <Badge variant="pass" icon={<CheckCircle size={12}/>}>Approved</Badge>;
      case 'Under Review': return <Badge variant="warn" icon={<Clock size={12}/>}>Review</Badge>;
      case 'Draft': return <Badge variant="pending">Draft</Badge>;
      default: return <Badge variant="fail" icon={<XCircle size={12}/>}>Obsolete</Badge>;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch(category) {
      case 'Manual': return <BookOpen size={16} className="text-primary" />;
      case 'SOP': return <FileType size={16} className="text-accent" />;
      case 'Checklist': return <ShieldCheck size={16} className="text-success" />;
      default: return <FileText size={16} className="text-gray-500" />;
    }
  };

  return (
    <div className="qms-page">
      <div className="qms-page-header">
        <div>
          <h1 className="qms-page-title">Document Management</h1>
          <p className="qms-page-sub">Centralized repository for quality manuals, SOPs, and checklists.</p>
        </div>
        <Button variant="primary" icon={<Upload size={16}/>}>Upload Document</Button>
      </div>

      <div className="qms-doc-kpis">
        <Card className="qms-doc-kpi-card" padding="sm">
          <div className="qms-doc-kpi-val">1,248</div>
          <div className="qms-doc-kpi-lbl">Total Documents</div>
        </Card>
        <Card className="qms-doc-kpi-card" padding="sm">
          <div className="qms-doc-kpi-val">12</div>
          <div className="qms-doc-kpi-lbl">Pending Review</div>
        </Card>
        <Card className="qms-doc-kpi-card" padding="sm">
          <div className="qms-doc-kpi-val text-success">98%</div>
          <div className="qms-doc-kpi-lbl">Compliance Rate</div>
        </Card>
      </div>

      <Card padding="none" className="qms-doc-list-card">
        <div className="qms-doc-toolbar">
          <div className="qms-search-box">
            <Search size={16} className="qms-search-icon" />
            <input 
              type="text" 
              placeholder="Search documents by title or ID..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button variant="outline" icon={<Filter size={16}/>}>Filters</Button>
        </div>

        <div className="qms-table-container">
          <table className="qms-table">
            <thead>
              <tr>
                <th>Document</th>
                <th>Category</th>
                <th>Version</th>
                <th>Status</th>
                <th>Last Updated</th>
                <th>Author</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDocs.map(doc => (
                <tr key={doc.id}>
                  <td>
                    <div className="qms-doc-title-cell">
                      {getCategoryIcon(doc.category)}
                      <div>
                        <div className="qms-doc-title">{doc.title}</div>
                        <div className="qms-doc-id">{doc.id}</div>
                      </div>
                    </div>
                  </td>
                  <td>{doc.category}</td>
                  <td><span className="qms-version-tag">{doc.version}</span></td>
                  <td>{getStatusBadge(doc.status)}</td>
                  <td>{doc.date}</td>
                  <td>{doc.author}</td>
                  <td>
                    <div className="qms-doc-actions">
                      <button className="qms-icon-btn"><Download size={16} /></button>
                      <button className="qms-icon-btn"><MoreVertical size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
