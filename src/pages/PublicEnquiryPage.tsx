import { EnquiryForm } from '../components/EnquiryForm';

/** The enquiry form on its own, for embedding in the WordPress site. */
export default function PublicEnquiryPage() {
  return (
    <main className="public-form">
      <EnquiryForm />
    </main>
  );
}
