// _git.mjs — provenance for a capture, DERIVED rather than DECLARED.
//
// WHY THIS EXISTS.
//
// `artBaseline` read the build id out of `BASELINE_COMMIT` and nothing else:
//
//     gitCommit: process.env.BASELINE_COMMIT ?? null,
//
// Two ways that goes wrong, and both have happened on this branch.
//
//   1. Forget to export it and the capture lands on disk stamped
//      `"gitCommit": null`. The first capture of
//      `baseline/art-sphere-phase2-bloom-dial-certified` did exactly this and
//      was thrown away. A reference is quoted for weeks; one that cannot name
//      its own build is not a reference.
//   2. Export a stale one — or export the right one and capture with a dirty
//      tree — and the artefact is labelled with a commit that DOES NOT CONTAIN
//      what was captured. That is worse than null, because nothing downstream
//      can tell. `artBaseline`'s own header warns about this trap and then had
//      no check for it.
//
// `artFrameTime.mjs` already derived its provenance from git for reason (1),
// after `frametime-headed-gpu.json` shipped with a null commit. This is that
// answer, shared, with the dirty-tree check (2) added.
//
// `git rev-parse` in the cwd answers for the WORKTREE THE SERVER IS SERVING,
// which is the thing that needs recording — and this project measures against
// same-session control worktrees as a matter of routine, so a declared commit
// is indistinguishable from a control-worktree run of the same script.
//
// `BASELINE_COMMIT` survives as a FALLBACK only, for a capture taken outside a
// git checkout. When both are present git wins and the disagreement is
// reported, because the env var is a claim and git is an observation.

import { execFileSync } from 'node:child_process';

const defaultRun = (args) =>
  execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });

/**
 * @param {object}   [opts]
 * @param {function} [opts.run] - (string[]) => string, stands in for `git`.
 * @param {object}   [opts.env] - defaults to process.env.
 */
export function gitProvenance({ run = defaultRun, env = process.env } = {}) {
  const declared = env.BASELINE_COMMIT ?? null;
  const warnings = [];

  let head, branch, status;
  try {
    head = run(['rev-parse', 'HEAD']).trim();
    branch = run(['rev-parse', '--abbrev-ref', 'HEAD']).trim();
    // -uno: this repo carries untracked `baseline/_*` scratch permanently, so
    // only TRACKED modifications say anything about what was measured. Count
    // the scratch and every capture warns, which is the same as none warning.
    status = run(['status', '--porcelain', '-uno']).trim();
  } catch {
    if (declared) {
      return {
        gitCommit: declared,
        gitCommitShort: declared.slice(0, 7),
        gitBranch: null,
        gitDirty: null,
        provenanceSource: 'env',
        warnings,
      };
    }
    warnings.push(
      'no commit recorded: git is unavailable here and BASELINE_COMMIT is unset. '
      + 'This artefact cannot be attributed to a build.',
    );
    return {
      gitCommit: null,
      gitCommitShort: null,
      gitBranch: null,
      gitDirty: null,
      provenanceSource: 'none',
      warnings,
    };
  }

  const gitDirty = status.length > 0;
  if (gitDirty) {
    warnings.push(
      `the tracked tree is dirty, so this artefact will be stamped ${head.slice(0, 7)} `
      + 'but does NOT contain that commit alone. Commit before capturing a reference.',
    );
  }

  // A prefix match is agreement: short and full shas are both reasonable
  // things to have exported, and the handover quotes short ones throughout.
  if (declared && !head.startsWith(declared) && !declared.startsWith(head)) {
    warnings.push(
      `BASELINE_COMMIT is ${declared.slice(0, 7)} but git HEAD is ${head.slice(0, 7)}; `
      + 'recording git. The environment variable is stale and should be unset.',
    );
  }

  return {
    gitCommit: head,
    gitCommitShort: head.slice(0, 7),
    gitBranch: branch,
    gitDirty,
    provenanceSource: 'git',
    warnings,
  };
}
