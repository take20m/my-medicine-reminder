import Router, { Route } from 'preact-router';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { Header } from './components/Header';
import { InstallBanner } from './components/InstallBanner';
import { Navigation } from './components/Navigation';
import { LoginPage } from './pages/LoginPage';
import { HomePage } from './pages/HomePage';
import { MedicationsPage } from './pages/MedicationsPage';
import { MedicationFormPage } from './pages/MedicationFormPage';
import { HistoryPage } from './pages/HistoryPage';
import { SettingsPage } from './pages/SettingsPage';

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div class="flex items-center justify-center" style={{ minHeight: '100vh' }}>
        <div class="spinner" />
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <InstallBanner />
        <LoginPage />
      </>
    );
  }

  return (
    <div class="flex flex-col" style={{ minHeight: '100vh' }}>
      <Header />
      <InstallBanner />
      <main style={{ flex: 1, paddingBottom: '70px' }}>
        <Router>
          <Route path="/" component={HomePage} />
          <Route path="/medications" component={MedicationsPage} />
          <Route path="/medications/new" component={MedicationFormPage} />
          <Route path="/medications/:id" component={MedicationFormPage} />
          <Route path="/history" component={HistoryPage} />
          <Route path="/settings" component={SettingsPage} />
        </Router>
      </main>
      <Navigation />
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
