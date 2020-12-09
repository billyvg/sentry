/* eslint-env node */

/**
 * Creates/updates a status check that tracks the status of other required checks
 */

// Conclusion can be one of:
// success, failure, neutral, cancelled, skipped, timed_out, or action_required
const FAILED_CONCLUSION_TYPES = [
  'failure',
  'cancelled',
  'timed_out',
  'action_required',
  null,
];

function getJobAsMarkdownTableRow(checkRun) {
  return `| ${checkRun.name} | ${
    checkRun.conclusion === 'success'
      ? '✅ '
      : checkRun.conclusion !== null
      ? '❌ '
      : '⏱ '
  } ${checkRun.conclusion || 'pending'} |`;
}

function getSummary(size, type) {
  if (!size) {
    return null;
  }

  return `${size} check${size === 1 ? '' : 's'} ${type}`;
}

function createOrUpdateCheck(
  github,
  checkRun,
  {owner, repo, head_sha, name, status, conclusion, output}
) {
  if (!checkRun) {
    return github.checks.create({
      owner,
      repo,
      head_sha,
      name,
      status,
      conclusion,
      output,
    });
  }

  return github.checks.update({
    owner,
    repo,
    check_run_id: checkRun.id,
    status,
    conclusion,
    output,
  });
}

module.exports = {
  verifyRequiredJobs: async ({github, context, checkName, requiredJobs}) => {
    const {owner, repo} = context.repo;

    const result = await github.checks.listForRef({
      owner,
      repo,
      ref: context.sha,
    });

    const metaCheck = result.data.check_runs.find(({name}) => name === checkName);
    // Ignore this workflow's check run
    // XXX: See https://github.com/actions/runner/issues/852 for why we replace the hyphens like this
    const checkRuns = result.data.check_runs.filter(
      ({name}) => name !== context.job.replace('-', ' ') && name !== checkName
    );
    const missingCheckRunsSet = new Set(requiredJobs);
    const checkRunsSet = new Set(checkRuns.map(({name}) => name));

    // Make sure there is at least one job for each required job name
    requiredJobs.forEach(job => {
      if (!checkRuns.find(({name}) => name.startsWith(job))) {
        return;
      }

      missingCheckRunsSet.delete(job);
    });

    const requiredCheckRuns = checkRuns.filter(({name}) =>
      requiredJobs.find(job => name.startsWith(job))
    );
    const pendingChecks = requiredCheckRuns.filter(
      ({status, conclusion}) => status !== 'completed' || conclusion === null
    );

    const failedChecks = requiredCheckRuns.filter(({conclusion}) =>
      FAILED_CONCLUSION_TYPES.includes(conclusion)
    );
    const passedChecks = requiredCheckRuns.filter(
      ({conclusion}) => !FAILED_CONCLUSION_TYPES.includes(conclusion)
    );
    const didPassAllChecks =
      failedChecks.length === 0 &&
      pendingChecks.length === 0 &&
      missingCheckRunsSet.size === 0;

    const summaries = [
      getSummary(failedChecks.length, 'failed'),
      getSummary(pendingChecks.length, 'pending'),
      getSummary(missingCheckRunsSet.size, 'missing'),
    ].filter(Boolean);

    const summary = didPassAllChecks
      ? 'All required checks passed'
      : summaries.join(', ');
    const conclusion = didPassAllChecks
      ? 'success'
      : pendingChecks.length
      ? undefined
      : 'failure';
    const status = pendingChecks.length ? 'in_progress' : 'completed';

    const text = `
## Status of required checks

| Job | Conclusion |
| --- | ---------- |
${[
  ...failedChecks,
  ...pendingChecks,
  ...Array.from(missingCheckRunsSet).map(name => ({
    name,
    status: 'completed',
    conclusion: 'missing',
  })),
  ...passedChecks,
]
  .map(getJobAsMarkdownTableRow)
  .join('\n')}
`;

    await createOrUpdateCheck(github, metaCheck, {
      owner,
      repo,
      head_sha: context.sha,
      name: checkName,
      status,
      conclusion,
      output: {
        title: summary,
        summary,
        text,
      },
    });
  },
};
