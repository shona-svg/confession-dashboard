import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import PipelinePage from './pages/PipelinePage';
import ContactsPage from './pages/ContactsPage';
import ContactPage from './pages/ContactPage';
import ToursPage from './pages/ToursPage';
import FollowUpsPage from './pages/FollowUpsPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="pipeline" element={<PipelinePage />} />
        <Route path="contacts" element={<ContactsPage />} />
        <Route path="contacts/:id" element={<ContactPage />} />
        <Route path="tours" element={<ToursPage />} />
        <Route path="follow-ups" element={<FollowUpsPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<HomePage />} />
      </Route>
    </Routes>
  );
}
