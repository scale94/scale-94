// Provenance for a capture (scripts/_git.mjs).
//
// This exists because `baseline/art-sphere-phase2-bloom-dial-certified`'s first
// capture landed on disk stamped `"gitCommit": null`. `artBaseline` read the
// commit from `BASELINE_COMMIT` and nothing else, so forgetting to export it
// produced a reference nobody could attribute — and exporting a STALE one while
// the tree was dirty produced something worse: a capture labelled with a commit
// that does not contain what was captured.
//
// `artFrameTime.mjs` had already solved this for its own artefact and left the
// reasoning in a comment. What was missing was one answer both scripts share.
//
// The git calls are injected rather than mocked at the module boundary: the
// fallback and dirty-tree paths are the ones that were wrong, and they only
// happen when git misbehaves, which is not a state worth arranging for real.

import { describe, it, expect } from 'vitest';
import { gitProvenance } from '../scripts/_git.mjs';

// A stand-in for `git`, keyed on the subcommand shape the helper uses.
const fakeGit = ({ head, branch, status = '' }) => (args) => {
  const key = args.join(' ');
  if (key === 'rev-parse HEAD') return head;
  if (key === 'rev-parse --abbrev-ref HEAD') return branch;
  if (key === 'status --porcelain -uno') return status;
  throw new Error(`unexpected git call: ${key}`);
};

const HEAD = 'd69ce7588db67553228754499bbe6ae6666e5545';

describe('gitProvenance', () => {
  it('derives the commit from git, not from the environment', () => {
    const p = gitProvenance({
      run: fakeGit({ head: HEAD, branch: 'fix/art-sphere-index-space' }),
      env: {},
    });

    expect(p.gitCommit).toBe(HEAD);
    expect(p.gitBranch).toBe('fix/art-sphere-index-space');
    expect(p.provenanceSource).toBe('git');
  });

  it('records the short commit alongside the full one', () => {
    const p = gitProvenance({
      run: fakeGit({ head: HEAD, branch: 'main' }),
      env: {},
    });

    // Manifests on disk carry the full sha; artFrameTime records the short
    // one. Both come from the same call so they can never disagree.
    expect(p.gitCommitShort).toBe('d69ce75');
    expect(HEAD.startsWith(p.gitCommitShort)).toBe(true);
  });

  it('reports a clean tree as not dirty', () => {
    const p = gitProvenance({
      run: fakeGit({ head: HEAD, branch: 'main', status: '' }),
      env: {},
    });

    expect(p.gitDirty).toBe(false);
    expect(p.warnings).toEqual([]);
  });

  it('reports a tracked modification as dirty, and warns', () => {
    const p = gitProvenance({
      run: fakeGit({
        head: HEAD,
        branch: 'main',
        status: ' M src/terminal/art/artComposite.js\n',
      }),
      env: {},
    });

    expect(p.gitDirty).toBe(true);
    // The whole point: a capture taken here is labelled with a commit that
    // does not contain the change. Silence is how that reached disk before.
    expect(p.warnings.join(' ')).toMatch(/dirty/i);
  });

  it('ignores untracked files when deciding dirty', () => {
    // This repo carries untracked `baseline/_*` scratch permanently. If they
    // counted, every capture would warn and the warning would mean nothing.
    const calls = [];
    const run = (args) => {
      calls.push(args.join(' '));
      return args.join(' ') === 'rev-parse HEAD' ? HEAD
        : args.join(' ') === 'rev-parse --abbrev-ref HEAD' ? 'main' : '';
    };

    gitProvenance({ run, env: {} });

    expect(calls).toContain('status --porcelain -uno');
  });

  it('falls back to BASELINE_COMMIT when git is unavailable', () => {
    const p = gitProvenance({
      run: () => { throw new Error('not a git repository'); },
      env: { BASELINE_COMMIT: HEAD },
    });

    expect(p.gitCommit).toBe(HEAD);
    expect(p.gitBranch).toBe(null);
    expect(p.gitDirty).toBe(null);
    expect(p.provenanceSource).toBe('env');
  });

  it('reports nothing rather than guessing when git fails and nothing is declared', () => {
    const p = gitProvenance({
      run: () => { throw new Error('not a git repository'); },
      env: {},
    });

    expect(p.gitCommit).toBe(null);
    expect(p.gitCommitShort).toBe(null);
    expect(p.provenanceSource).toBe('none');
    // A null commit is what started all this. It must at least be loud.
    expect(p.warnings.join(' ')).toMatch(/no commit/i);
  });

  it('prefers git over a stale BASELINE_COMMIT, and says the two disagree', () => {
    const p = gitProvenance({
      run: fakeGit({ head: HEAD, branch: 'main' }),
      env: { BASELINE_COMMIT: 'b8ad97f367c87711222426853d4d1364b8836e98' },
    });

    expect(p.gitCommit).toBe(HEAD);
    expect(p.provenanceSource).toBe('git');
    expect(p.warnings.join(' ')).toMatch(/BASELINE_COMMIT/);
  });

  it('does not warn when BASELINE_COMMIT agrees with git', () => {
    const p = gitProvenance({
      run: fakeGit({ head: HEAD, branch: 'main' }),
      env: { BASELINE_COMMIT: HEAD },
    });

    expect(p.warnings).toEqual([]);
  });

  it('accepts a short BASELINE_COMMIT as agreeing with the full head', () => {
    // The phase-1 reference was captured with the full sha exported, but the
    // handover quotes short ones throughout and either is a reasonable thing
    // to export. A prefix match is agreement, not a conflict.
    const p = gitProvenance({
      run: fakeGit({ head: HEAD, branch: 'main' }),
      env: { BASELINE_COMMIT: 'd69ce75' },
    });

    expect(p.warnings).toEqual([]);
  });

  it('trims what git prints', () => {
    const p = gitProvenance({
      run: (args) => (args.join(' ') === 'rev-parse HEAD' ? `${HEAD}\n`
        : args.join(' ') === 'rev-parse --abbrev-ref HEAD' ? 'main\n' : '\n'),
      env: {},
    });

    expect(p.gitCommit).toBe(HEAD);
    expect(p.gitBranch).toBe('main');
    expect(p.gitDirty).toBe(false);
  });
});
