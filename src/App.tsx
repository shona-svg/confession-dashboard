import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import PipelinePage from './pages/PipelinePage';
import ContactsPage from './pages/ContactsPage';
import ContactPage from './pages/ContactPage';
import BookingsPage from './pages/BookingsPage';
import FormsPage from './pages/FormsPage';
import PublicEnquiryPage from './pages/PublicEnquiryPage';
import PublicNewsletterPage from './pages/PublicNewsletterPage';
import FollowUpsPage from './pages/FollowUpsPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';

export default function App() {
  return (
    <Routes>
      {/* Public: the embeddable enquiry form. Everything else sits behind login from phase 3. */}
      <Route path="forms/enquiry" element={<PublicEnquiryPage />} />
      <Route path="forms/newsletter" element={<PublicNewsletterPage />} />
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="pipeline" element={<PipelinePage />} />
        <Route path="contacts" element={<ContactsPage />} />
        <Route path="contacts/:id" element={<ContactPage />} />
        <Route path="bookings" element={<BookingsPage />} />
        <Route path="tours" element={<Navigate to="/bookings" replace />} />
        <Route path="forms" element={<FormsPage />} />
        <Route path="follow-ups" element={<FollowUpsPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<HomePage />} />
      </Route>
    </Routes>
  );
}
