import { PublicFormShell } from '../components/PublicFormShell';
import { NewsletterForm } from '../components/NewsletterForm';

/** The newsletter signup on its own, for embedding in the WordPress site. */
export default function PublicNewsletterPage() {
  return (
    <PublicFormShell>
      <NewsletterForm />
    </PublicFormShell>
  );
}
