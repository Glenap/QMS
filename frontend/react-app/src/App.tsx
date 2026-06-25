import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { AcceptInvitationPage } from './pages/AcceptInvitationPage';
import { VerifyOtpPage } from './pages/VerifyOtpPage';
import { LabRegistrationForm } from './pages/LabRegistrationForm';
import { ConfirmRegistration } from './pages/ConfirmRegistration';
import { DispatchFill } from './pages/DispatchFill';

// Workspace entry + project listing
import { AppHome } from './pages/AppHome';
import { ProjectsList } from './pages/ProjectsList';
import { ProjectMasterForm } from './pages/ProjectMasterForm';
import { AssignedProjects } from './pages/AssignedProjects';
import { Profile } from './pages/Profile';

// Project workspace (everything below is scoped to one project)
import { ProjectLayout } from './components/layout/ProjectLayout';
import { ProjectOverview } from './pages/project/ProjectOverview';
import { ProjectTeam } from './pages/project/ProjectTeam';
import { ProjectContractors } from './pages/project/ProjectContractors';
import { ContractorDetail } from './pages/project/ContractorDetail';
import { ProjectSuppliers } from './pages/project/ProjectSuppliers';
import { SupplierDetail } from './pages/project/SupplierDetail';
import { ProjectLabs } from './pages/project/ProjectLabs';
import { ProjectMixDesigns } from './pages/project/ProjectMixDesigns';
import { ProjectFloors } from './pages/project/ProjectFloors';
import { Analytics } from './pages/Analytics';
import { DocumentManagement } from './pages/DocumentManagement';
import { AuditManagement } from './pages/AuditManagement';
import { Traceability } from './pages/Traceability';
import { PourCardForm } from './pages/PourCardForm';
import { ProjectPours } from './pages/project/ProjectPours';
import { ProjectDispatches } from './pages/project/ProjectDispatches';
import { ProjectCubeTests } from './pages/project/ProjectCubeTests';
import { GateScan } from './pages/GateScan';
import { NCRDashboard } from './pages/NCRDashboard';
import { NCRForm } from './pages/NCRForm';
import { Chatbot } from './pages/Chatbot';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* External / public routes */}
        <Route path="/external/lab-registration" element={<LabRegistrationForm />} />
        <Route path="/external/confirm/:kind" element={<ConfirmRegistration />} />
        <Route path="/dispatch/fill" element={<DispatchFill />} />
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/accept-invitation" element={<AcceptInvitationPage />} />
        <Route path="/auth/verify-otp" element={<VerifyOtpPage />} />

        {/* Authenticated app */}
        <Route element={<ProtectedRoute />}>
          <Route path="/app" element={<AppLayout />}>
            {/* Landing → picker (admins) or single project (users) */}
            <Route index element={<AppHome />} />
            <Route path="projects" element={<ProjectsList />} />
            <Route path="projects/new" element={<ProjectMasterForm />} />
            <Route path="assigned" element={<AssignedProjects />} />
            <Route path="profile" element={<Profile />} />

            {/* Project workspace — all pages scoped to :projectId */}
            <Route path="projects/:projectId" element={<ProjectLayout />}>
              <Route index element={<ProjectOverview />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="documents" element={<DocumentManagement />} />
              <Route path="audits" element={<AuditManagement />} />
              <Route path="trace" element={<Traceability />} />
              <Route path="pours" element={<ProjectPours />} />
              <Route path="pours/new" element={<PourCardForm />} />
              <Route path="dispatches" element={<ProjectDispatches />} />
              <Route path="cube" element={<ProjectCubeTests />} />
              <Route path="gate" element={<GateScan />} />
              <Route path="ncr" element={<NCRDashboard />} />
              <Route path="ncr/new" element={<NCRForm />} />
              <Route path="chatbot" element={<Chatbot />} />
              <Route path="team" element={<ProjectTeam />} />
              <Route path="contractors" element={<ProjectContractors />} />
              <Route path="contractors/:contractorOrgId" element={<ContractorDetail />} />
              <Route path="suppliers" element={<ProjectSuppliers />} />
              <Route path="suppliers/:supplierId" element={<SupplierDetail />} />
              <Route path="labs" element={<ProjectLabs />} />
              <Route path="floors" element={<ProjectFloors />} />
              <Route path="mix-designs" element={<ProjectMixDesigns />} />
            </Route>

            <Route path="*" element={<Navigate to="/app" replace />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
