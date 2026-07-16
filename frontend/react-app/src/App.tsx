import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { AcceptInvitationPage } from './pages/AcceptInvitationPage';
import { VerifyOtpPage } from './pages/VerifyOtpPage';
import { ConfirmRegistration } from './pages/ConfirmRegistration';
import { DispatchFill } from './pages/DispatchFill';
import { LabReport } from './pages/LabReport';
import { MixDesignSubmit } from './pages/MixDesignSubmit';

// Workspace entry + project listing
import { AppHome } from './pages/AppHome';
import { ProjectsList } from './pages/ProjectsList';
import { ProjectMasterForm } from './pages/ProjectMasterForm';
import { AssignedProjects } from './pages/AssignedProjects';
import { Profile } from './pages/Profile';
import { Team } from './pages/Team';
import { OrgSuppliers } from './pages/OrgSuppliers';
import { OrgLabs } from './pages/OrgLabs';

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
import { Analytics } from './pages/project/Analytics';
import { ProjectDocuments } from './pages/project/ProjectDocuments';
import { Traceability } from './pages/project/Traceability';
import { PourCardForm } from './pages/project/PourCardForm';
import { ProjectPours } from './pages/project/ProjectPours';
import { ProjectDispatches } from './pages/project/ProjectDispatches';
import { ProjectCubeTests } from './pages/project/ProjectCubeTests';
import { GateScan } from './pages/project/GateScan';
import { QEInbox } from './pages/project/QEInbox';
import { Alerts } from './pages/project/Alerts';
import { NCRDashboard } from './pages/project/NCRDashboard';
import { Retests } from './pages/project/Retests';
import { ConformanceAnalyser } from './pages/project/ConformanceAnalyser';
import { Chatbot } from './pages/project/Chatbot';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* External / public routes */}
        <Route path="/external/confirm/:kind" element={<ConfirmRegistration />} />
        <Route path="/dispatch/fill" element={<DispatchFill />} />
        <Route path="/external/lab-report" element={<LabReport />} />
        <Route path="/external/mix-design" element={<MixDesignSubmit />} />
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
            <Route path="team" element={<Team />} />
            <Route path="suppliers" element={<OrgSuppliers />} />
            <Route path="labs" element={<OrgLabs />} />
            <Route path="profile" element={<Profile />} />

            {/* Project workspace — all pages scoped to :projectId */}
            <Route path="projects/:projectId" element={<ProjectLayout />}>
              <Route index element={<ProjectOverview />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="documents" element={<ProjectDocuments />} />
              <Route path="trace" element={<Traceability />} />
              <Route path="pours" element={<ProjectPours />} />
              <Route path="pours/new" element={<PourCardForm />} />
              <Route path="dispatches" element={<ProjectDispatches />} />
              <Route path="cube" element={<ProjectCubeTests />} />
              <Route path="gate" element={<GateScan />} />
              <Route path="qe-inbox" element={<QEInbox />} />
              <Route path="alerts" element={<Alerts />} />
              <Route path="ncr" element={<NCRDashboard />} />
              <Route path="retests" element={<Retests />} />
              <Route path="conformance" element={<ConformanceAnalyser />} />
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
