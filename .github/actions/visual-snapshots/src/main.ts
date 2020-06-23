/* eslint-env node */
import fs from 'fs';
import path from 'path';

import * as github from '@actions/github';
import * as core from '@actions/core';
import {exec} from '@actions/exec';

import {PNG} from 'pngjs';
import pixelmatch from 'pixelmatch';

const {owner, repo} = github.context.repo;
const token = core.getInput('githubToken');
const octokit = github.getOctokit(token);
const GITHUB_WORKSPACE = process.env.GITHUB_WORKSPACE || '';

function isSnapshot(dirent: fs.Dirent) {
  // Only png atm
  return dirent.isFile() && dirent.name.endsWith('.png');
}

function createDiff(snapshotName: string, output: string, file1: string, file2: string) {
  const img1 = PNG.sync.read(fs.readFileSync(file1));
  const img2 = PNG.sync.read(fs.readFileSync(file2));
  const {width, height} = img1;
  const diff = new PNG({width, height});

  const result = pixelmatch(img1.data, img2.data, diff.data, width, height, {
    threshold: 0.1,
  });

  if (result > 0) {
    fs.writeFileSync(path.resolve(output, snapshotName), PNG.sync.write(diff));
  }
}

async function run(): Promise<void> {
  try {
    const base: string = core.getInput('base');
    const current: string = core.getInput('current');
    const diff: string = core.getInput('diff');
    core.debug(`${base} vs ${current} vs ${diff}`);

    core.debug(__dirname);
    core.debug(GITHUB_WORKSPACE);
    core.setOutput('diff-path', diff);

    const newSnapshots = new Set<string>([]);
    const missingSnapshots = new Map<string, fs.Dirent>([]);
    const currentSnapshots = new Map<string, fs.Dirent>([]);
    const baseSnapshots = new Map<string, fs.Dirent>([]);

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
    fs.mkdirSync(outputPath, {recursive: true});
    await exec(
      `curl -L -o ${path.resolve(outputPath, 'visual-snapshots-base.zip')} ${
        download.url
      }`
    );
    await exec(
      `unzip -d ${outputPath} ${path.resolve(outputPath, 'visual-snapshots-base.zip')}`
    );

    // read dirs
    const currentDir = fs.readdirSync(current, {withFileTypes: true});
    const baseDir = fs.readdirSync(path.resolve(outputPath), {
      withFileTypes: true,
    });

    // make output dir if not exists
    const diffPath = path.resolve(GITHUB_WORKSPACE, diff);

    if (!fs.existsSync(diffPath)) {
      fs.mkdirSync(diffPath, {recursive: true});
    }

    core.debug('basedir');
    core.debug(JSON.stringify(baseDir));
    await exec('ls /tmp/visual-snapshots-base');

    baseDir.filter(isSnapshot).forEach(entry => {
      baseSnapshots.set(entry.name, entry);
      missingSnapshots.set(entry.name, entry);
    });

    currentDir.filter(isSnapshot).forEach(entry => {
      currentSnapshots.set(entry.name, entry);

      if (baseSnapshots.has(entry.name)) {
        createDiff(
          entry.name,
          path.resolve(GITHUB_WORKSPACE, diff),
          path.resolve(GITHUB_WORKSPACE, current, entry.name),
          path.resolve(outputPath, entry.name)
        );
        missingSnapshots.delete(entry.name);
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
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
