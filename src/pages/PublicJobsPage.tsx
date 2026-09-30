import { PublicFormShell } from '../components/PublicFormShell';
import { JobApplicationForm } from '../components/JobApplicationForm';

/** The Work with us job application on its own, for embedding in the WordPress site. */
export default function PublicJobsPage() {
  return (
    <PublicFormShell>
      <JobApplicationForm />
    </PublicFormShell>
  );
}
