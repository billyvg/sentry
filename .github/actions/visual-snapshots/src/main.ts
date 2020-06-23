/* eslint-env node */
import * as fsNs from 'fs';
import path from 'path';
import * as github from '@actions/github';
import * as core from '@actions/core';
import {exec} from '@actions/exec';

import {PNG} from 'pngjs';
import pixelmatch from 'pixelmatch';

const fs = fsNs.promises;
const {owner, repo} = github.context.repo;
const token = core.getInput('githubToken');
const octokit = github.getOctokit(token);
const GITHUB_SHA = process.env.GITHUB_SHA || '';
const GITHUB_WORKSPACE = process.env.GITHUB_WORKSPACE || '';

function isSnapshot(dirent: fsNs.Dirent) {
  // Only png atm
  return dirent.isFile() && dirent.name.endsWith('.png');
}

async function createDiff(
  snapshotName: string,
  output: string,
  file1: string,
  file2: string
) {
  const [fileContent1, fileContent2] = await Promise.all([
    fs.readFile(file1),
    fs.readFile(file2),
  ]);

  const img1 = PNG.sync.read(fileContent1);
  const img2 = PNG.sync.read(fileContent2);
  const {width, height} = img1;
  const diff = new PNG({width, height});

  console.log(`diff ${snapshotName}: `, img1.height, img2.height);

  const result = pixelmatch(img1.data, img2.data, diff.data, width, height, {
    threshold: 0.1,
  });

  if (result > 0) {
    await fs.writeFile(path.resolve(output, snapshotName), PNG.sync.write(diff));
  }

  return result;
}

async function run(): Promise<void> {
  try {
    const base: string = core.getInput('base');
    const current: string = core.getInput('current');
    const diff: string = core.getInput('diff');
    core.debug(`${base} vs ${current} vs ${diff}`);

    core.debug(GITHUB_WORKSPACE);
    core.setOutput('diff-path', diff);

    const newSnapshots = new Set<string>([]);
    const changedSnapshots = new Set<string>([]);
    const missingSnapshots = new Map<string, fsNs.Dirent>([]);
    const currentSnapshots = new Map<string, fsNs.Dirent>([]);
    const baseSnapshots = new Map<string, fsNs.Dirent>([]);

    // fetch artifact from main branch
    // this is hacky since github actions do not support downloading
    // artifacts from different workflows
    const {
      data: {
        workflow_runs: [workflowRun],
      },
    } = await octokit.actions.listWorkflowRuns({
      owner,
      repo,
      // @ts-ignore
      workflow_id: 'acceptance.yml',
      branch: 'master',
    });

    if (!workflowRun) {
      core.debug('No workflow run found');
    }

    const {
      data: {artifacts},
    } = await octokit.actions.listWorkflowRunArtifacts({
      owner,
      repo,
      run_id: workflowRun.id,
    });

    core.debug(JSON.stringify(artifacts));
    // filter artifacts for `visual-snapshots-main`
    const mainSnapshotArtifact = artifacts.find(
      artifact => artifact.name === 'visual-snapshots-main'
    );

    if (!mainSnapshotArtifact) {
      core.debug('Artifact not found');
      return;
    }

    // Download the artifact
    const download = await octokit.actions.downloadArtifact({
      owner,
      repo,
      artifact_id: mainSnapshotArtifact.id,
      archive_format: 'zip',
    });

    core.debug(JSON.stringify(download));

    const outputPath = path.resolve('/tmp/visual-snapshots-base');
    try {
      await fs.mkdir(outputPath, {recursive: true});
    } catch {
      core.debug(`Unable to create dir: ${outputPath}`);
    }

    await exec(
      `curl -L -o ${path.resolve(outputPath, 'visual-snapshots-base.zip')} ${
        download.url
      }`
    );
    await exec(
      `unzip -d ${outputPath} ${path.resolve(outputPath, 'visual-snapshots-base.zip')}`
    );

    // read dirs
    const [currentDir, baseDir] = await Promise.all([
      fs.readdir(current, {withFileTypes: true}),
      fs.readdir(path.resolve(outputPath), {
        withFileTypes: true,
      }),
    ]);

    console.log(currentDir, baseDir);

    // make output dir if not exists
    const diffPath = path.resolve(GITHUB_WORKSPACE, diff);

    try {
      await fs.mkdir(diffPath, {recursive: true});
    } catch {
      core.debug(`Unable to create dir: ${diffPath}`);
    }

    baseDir.filter(isSnapshot).forEach(entry => {
      baseSnapshots.set(entry.name, entry);
      missingSnapshots.set(entry.name, entry);
    });

    currentDir.filter(isSnapshot).forEach(async entry => {
      currentSnapshots.set(entry.name, entry);

      if (baseSnapshots.has(entry.name)) {
        try {
          const isDiff = await createDiff(
            entry.name,
            path.resolve(GITHUB_WORKSPACE, diff),
            path.resolve(GITHUB_WORKSPACE, current, entry.name),
            path.resolve(outputPath, entry.name)
          );
          if (isDiff) {
            changedSnapshots.add(entry.name);
          }
          missingSnapshots.delete(entry.name);
        } catch (err) {
          core.debug(`Unable to diff: ${err.message}`);
        }
      } else {
        newSnapshots.add(entry.name);
      }
    });

    missingSnapshots.forEach(entry => {
      core.debug(`missing snapshot: ${entry.name}`);
    });

    newSnapshots.forEach(entryName => {
      core.debug(`new snapshot: ${entryName}`);
    });

    changedSnapshots.forEach(name => {
      core.debug(`changed snapshot: ${name}`);
    });

    let hasRelease = false;
    if (changedSnapshots.size || newSnapshots.size) {
      // Create a release to store our diffed images
      const {data: release} = await octokit.repos.createRelease({
        owner,
        repo,
        tag_name: `visual-snapshot-${GITHUB_SHA}`,
        target_commitish: GITHUB_SHA,
        name: 'Visual Snapshot Artifacts',
        body: 'Testing',
        draft: true,
        prerelease: true,
      });

      const diffFiles = await fs.readdir(diffPath, {
        withFileTypes: true,
      });
      diffFiles.filter(isSnapshot).forEach(async entry => {
        core.debug(`Diff file: ${entry.name}`);

        await octokit.repos.uploadReleaseAsset({
          owner,
          repo,
          release_id: release.id,
          origin: release.upload_url,
          data: (await fs.readFile(path.resolve(diffPath, entry.name))).toString(
            'base64'
          ),
        });
      });

      hasRelease = true;
    }

    const conclusion =
      !!changedSnapshots.size || !!missingSnapshots.size
        ? 'failure'
        : !!newSnapshots.size
        ? 'neutral'
        : 'success';

    // Create a GitHub check with our results
    await octokit.checks.create({
      owner,
      repo,
      name: 'Visual Snapshot',
      head_sha: GITHUB_SHA,
      status: 'completed',
      conclusion,
      output: {
        title: 'Visual Snapshots',
        summary: `Summary:
* **${changedSnapshots.size}** changed snapshots
* **${missingSnapshots.size}** missing snapshots
* **${newSnapshots.size}** new snapshots
`,
        text: `
## Changed snapshots
${[...changedSnapshots].map(name => `* ${name}`).join('\n')}

## Missing snapshots
${[...missingSnapshots].map(([name]) => `* ${name}`).join('\n')}

## New snapshots
${[...newSnapshots].map(name => `* ${name}`).join('\n')}
`,
      },
    });
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
