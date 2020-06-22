/* eslint-env node */
import fs from 'fs';
import path from 'path';

import * as core from '@actions/core';
import {PNG} from 'pngjs';
import pixelmatch from 'pixelmatch';

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

    // read dirs
    const currentDir = fs.readdirSync(current, {withFileTypes: true});
    const baseDir = fs.readdirSync(base, {withFileTypes: true});

    // make output dir if not exists
    const diffPath = path.resolve(GITHUB_WORKSPACE, diff);
    if (!fs.existsSync(diffPath)) {
      fs.mkdirSync(diffPath);
    }

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
          path.resolve(GITHUB_WORKSPACE, base, entry.name)
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
