import { lazy, Suspense, type ComponentType } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ProjectLayout } from './components/layout/ProjectLayout';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';

// Everything past the landing/login shell is code-split: each page ships in its
// own chunk and only loads when its route is visited. This keeps the initial
// bundle small (big win on slow hosting / first paint) — the heavy pages
// (analytics + recharts, the conformance analyser, the chatbot) never load until
// someone opens them.
const named = (factory: () => Promise<Record<string, unknown>>, name: string) =>
  lazy(() => factory().then((m) => ({ default: m[name] as ComponentType })));

// Public / auth
const AcceptInvitationPage = named(() => import('./pages/AcceptInvitationPage'), 'AcceptInvitationPage');
const VerifyOtpPage = named(() => import('./pages/VerifyOtpPage'), 'VerifyOtpPage');
const ConfirmRegistration = named(() => import('./pages/ConfirmRegistration'), 'ConfirmRegistration');
const DispatchFill = named(() => import('./pages/DispatchFill'), 'DispatchFill');
const LabReport = named(() => import('./pages/LabReport'), 'LabReport');
const MixDesignSubmit = named(() => import('./pages/MixDesignSubmit'), 'MixDesignSubmit');

// Workspace entry + project listing
const AppHome = named(() => import('./pages/AppHome'), 'AppHome');
const ProjectsList = named(() => import('./pages/ProjectsList'), 'ProjectsList');
const ProjectMasterForm = named(() => import('./pages/ProjectMasterForm'), 'ProjectMasterForm');
const AssignedProjects = named(() => import('./pages/AssignedProjects'), 'AssignedProjects');
const Profile = named(() => import('./pages/Profile'), 'Profile');
const Team = named(() => import('./pages/Team'), 'Team');
const OrgSuppliers = named(() => import('./pages/OrgSuppliers'), 'OrgSuppliers');
const OrgLabs = named(() => import('./pages/OrgLabs'), 'OrgLabs');

// Project workspace
const ProjectOverview = named(() => import('./pages/project/ProjectOverview'), 'ProjectOverview');
const ProjectTeam = named(() => import('./pages/project/ProjectTeam'), 'ProjectTeam');
const ProjectContractors = named(() => import('./pages/project/ProjectContractors'), 'ProjectContractors');
const ContractorDetail = named(() => import('./pages/project/ContractorDetail'), 'ContractorDetail');
const ProjectSuppliers = named(() => import('./pages/project/ProjectSuppliers'), 'ProjectSuppliers');
const SupplierDetail = named(() => import('./pages/project/SupplierDetail'), 'SupplierDetail');
const ProjectLabs = named(() => import('./pages/project/ProjectLabs'), 'ProjectLabs');
const ProjectMixDesigns = named(() => import('./pages/project/ProjectMixDesigns'), 'ProjectMixDesigns');
const ProjectFloors = named(() => import('./pages/project/ProjectFloors'), 'ProjectFloors');
const Analytics = named(() => import('./pages/project/Analytics'), 'Analytics');
const ProjectDocuments = named(() => import('./pages/project/ProjectDocuments'), 'ProjectDocuments');
const Traceability = named(() => import('./pages/project/Traceability'), 'Traceability');
const PourCardForm = named(() => import('./pages/project/PourCardForm'), 'PourCardForm');
const ProjectPours = named(() => import('./pages/project/ProjectPours'), 'ProjectPours');
const ProjectDispatches = named(() => import('./pages/project/ProjectDispatches'), 'ProjectDispatches');
const ProjectCubeTests = named(() => import('./pages/project/ProjectCubeTests'), 'ProjectCubeTests');
const GateScan = named(() => import('./pages/project/GateScan'), 'GateScan');
const QEInbox = named(() => import('./pages/project/QEInbox'), 'QEInbox');
const Alerts = named(() => import('./pages/project/Alerts'), 'Alerts');
const NCRDashboard = named(() => import('./pages/project/NCRDashboard'), 'NCRDashboard');
const Retests = named(() => import('./pages/project/Retests'), 'Retests');
const ConformanceAnalyser = named(() => import('./pages/project/ConformanceAnalyser'), 'ConformanceAnalyser');
const Chatbot = named(() => import('./pages/project/Chatbot'), 'Chatbot');

const PageFallback = () => (
  <div style={{ padding: 40, color: 'var(--gray-500)', fontSize: 14 }}>Loading…</div>
);

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageFallback />}>
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
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
