// "Work with us" job applications: the roles people can apply for and the file rules.
import type { ApplicationStatus } from '../data/types';

/** The same roles as the current form on confessionportadelaide.com/jointheteam. */
export const JOB_ROLES = [
  'Bar staff',
  'Door staff',
  'Glassy',
  'Kitchen & event staff',
  'Promoters',
  'Sound & lighting engineer',
];

export const APPLICATION_STATUS_LABEL: Record<ApplicationStatus, string> = {
  new: 'New',
  reviewing: 'Reviewing',
  interview: 'Interview',
  hired: 'Hired',
  not_suitable: 'Not suitable',
};

export const APPLICATION_STATUSES = Object.keys(APPLICATION_STATUS_LABEL) as ApplicationStatus[];

/** Resumes and cover letters are deleted this many months after the application, unless hired. */
export const APPLICATION_KEEP_MONTHS = 12;

export const MAX_FILE_MB = 5;
export const FILE_ACCEPT = '.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const OK_EXT = /\.(pdf|docx?)$/i;

/** Returns a plain-language problem with a chosen file, or null if it's fine. */
export function fileProblem(file: { name: string; size: number }): string | null {
  if (!OK_EXT.test(file.name)) return 'Please attach a PDF or Word document (.pdf, .doc or .docx).';
  if (file.size > MAX_FILE_MB * 1024 * 1024) return `That file is over ${MAX_FILE_MB} MB. Please attach a smaller one.`;
  if (file.size === 0) return 'That file looks empty. Please try another.';
  return null;
}

export function fileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
