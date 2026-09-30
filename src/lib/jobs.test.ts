import { describe, expect, it } from 'vitest';
import { fileProblem, fileSize } from './jobs';

describe('job application files', () => {
  it('accepts PDF and Word files under the limit', () => {
    expect(fileProblem({ name: 'Resume.PDF', size: 200_000 })).toBeNull();
    expect(fileProblem({ name: 'cover letter.docx', size: 50_000 })).toBeNull();
    expect(fileProblem({ name: 'old.doc', size: 50_000 })).toBeNull();
  });

  it('rejects other file types, big files and empty files', () => {
    expect(fileProblem({ name: 'photo.jpg', size: 1000 })).toMatch(/PDF or Word/);
    expect(fileProblem({ name: 'resume.pdf.exe', size: 1000 })).toMatch(/PDF or Word/);
    expect(fileProblem({ name: 'huge.pdf', size: 6 * 1024 * 1024 })).toMatch(/over 5 MB/);
    expect(fileProblem({ name: 'empty.pdf', size: 0 })).toMatch(/empty/);
  });

  it('shows sizes plainly', () => {
    expect(fileSize(120_000)).toBe('117 KB');
    expect(fileSize(2.5 * 1024 * 1024)).toBe('2.5 MB');
  });
});
