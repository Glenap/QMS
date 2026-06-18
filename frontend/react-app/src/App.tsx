import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { Dashboard } from './pages/Dashboard';
import { Analytics } from './pages/Analytics';
import { Traceability } from './pages/Traceability';
import { PourCardForm } from './pages/PourCardForm';
import { CubeResult } from './pages/CubeResult';

// New Phase 2 Pages
import { ProjectMasterForm } from './pages/ProjectMasterForm';
import { RMCSupplierForm } from './pages/RMCSupplierForm';
import { ContractorRegistrationForm } from './pages/ContractorRegistrationForm';
import { UserRegistrationForm } from './pages/UserRegistrationForm';
import { LabRegistrationForm } from './pages/LabRegistrationForm';
import { GateScan } from './pages/GateScan';
import { NCRDashboard } from './pages/NCRDashboard';
import { NCRForm } from './pages/NCRForm';
import { Chatbot } from './pages/Chatbot';
import { LandingPage } from './pages/LandingPage';
import { DocumentManagement } from './pages/DocumentManagement';
import { AuditManagement } from './pages/AuditManagement';
import { SupplierDashboard } from './pages/SupplierDashboard';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* External Routes (No Sidebar) */}
        <Route path="/external/lab-registration" element={<LabRegistrationForm />} />
        
        <Route path="/" element={<LandingPage />} />
        
        {/* Internal Authenticated Routes */}
        <Route path="/app" element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="documents" element={<DocumentManagement />} />
          <Route path="audits" element={<AuditManagement />} />
          <Route path="trace" element={<Traceability />} />
          
          <Route path="projects/new" element={<ProjectMasterForm />} />
          <Route path="contractors/new" element={<ContractorRegistrationForm />} />
          <Route path="team" element={<UserRegistrationForm />} />
          <Route path="suppliers" element={<SupplierDashboard />} />
          <Route path="suppliers/new" element={<RMCSupplierForm />} />
          
          <Route path="pours/new" element={<PourCardForm />} />
          <Route path="results/:id" element={<CubeResult />} />
          
          <Route path="gate" element={<GateScan />} />
          <Route path="ncr" element={<NCRDashboard />} />
          <Route path="ncr/new" element={<NCRForm />} />
          <Route path="chatbot" element={<Chatbot />} />

          
          {/* Fallback routes for demo purposes */}
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
