"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-env node */
const fsNs = __importStar(require("fs"));
const path_1 = __importDefault(require("path"));
const github = __importStar(require("@actions/github"));
const core = __importStar(require("@actions/core"));
const exec_1 = require("@actions/exec");
const pngjs_1 = require("pngjs");
const pixelmatch_1 = __importDefault(require("pixelmatch"));
const fs = fsNs.promises;
const { owner, repo } = github.context.repo;
const token = core.getInput('githubToken');
const octokit = github.getOctokit(token);
const GITHUB_SHA = process.env.GITHUB_SHA || '';
const GITHUB_WORKSPACE = process.env.GITHUB_WORKSPACE || '';
function isSnapshot(dirent) {
    // Only png atm
    return dirent.isFile() && dirent.name.endsWith('.png');
}
function createDiff(snapshotName, output, file1, file2) {
    return __awaiter(this, void 0, void 0, function* () {
        const img1 = pngjs_1.PNG.sync.read(yield fs.readFile(file1));
        const img2 = pngjs_1.PNG.sync.read(yield fs.readFile(file2));
        const { width, height } = img1;
        const diff = new pngjs_1.PNG({ width, height });
        const result = pixelmatch_1.default(img1.data, img2.data, diff.data, width, height, {
            threshold: 0.1,
        });
        if (result > 0) {
            yield fs.writeFile(path_1.default.resolve(output, snapshotName), pngjs_1.PNG.sync.write(diff));
        }
        return result;
    });
}
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const base = core.getInput('base');
            const current = core.getInput('current');
            const diff = core.getInput('diff');
            core.debug(`${base} vs ${current} vs ${diff}`);
            core.debug(GITHUB_WORKSPACE);
            core.setOutput('diff-path', diff);
            const newSnapshots = new Set([]);
            const changedSnapshots = new Set([]);
            const missingSnapshots = new Map([]);
            const currentSnapshots = new Map([]);
            const baseSnapshots = new Map([]);
            // fetch artifact from main branch
            // this is hacky since github actions do not support downloading
            // artifacts from different workflows
            const { data: { workflow_runs: [workflowRun], }, } = yield octokit.actions.listWorkflowRuns({
                owner,
                repo,
                // @ts-ignore
                workflow_id: 'acceptance.yml',
                branch: 'master',
            });
            if (!workflowRun) {
                core.debug('No workflow run found');
            }
            const { data: { artifacts }, } = yield octokit.actions.listWorkflowRunArtifacts({
                owner,
                repo,
                run_id: workflowRun.id,
            });
            core.debug(JSON.stringify(artifacts));
            // filter artifacts for `visual-snapshots-main`
            const mainSnapshotArtifact = artifacts.find(artifact => artifact.name === 'visual-snapshots-main');
            if (!mainSnapshotArtifact) {
                core.debug('Artifact not found');
                return;
            }
            // Download the artifact
            const download = yield octokit.actions.downloadArtifact({
                owner,
                repo,
                artifact_id: mainSnapshotArtifact.id,
                archive_format: 'zip',
            });
            core.debug(JSON.stringify(download));
            const outputPath = path_1.default.resolve('/tmp/visual-snapshots-base');
            try {
                yield fs.mkdir(outputPath, { recursive: true });
            }
            catch (_a) {
                core.debug(`Unable to create dir: ${outputPath}`);
            }
            yield exec_1.exec(`curl -L -o ${path_1.default.resolve(outputPath, 'visual-snapshots-base.zip')} ${download.url}`);
            yield exec_1.exec(`unzip -d ${outputPath} ${path_1.default.resolve(outputPath, 'visual-snapshots-base.zip')}`);
            // read dirs
            const [currentDir, baseDir] = yield Promise.all([
                fs.readdir(current, { withFileTypes: true }),
                fs.readdir(path_1.default.resolve(outputPath), {
                    withFileTypes: true,
                }),
            ]);
            console.log(currentDir, baseDir);
            // make output dir if not exists
            const diffPath = path_1.default.resolve(GITHUB_WORKSPACE, diff);
            try {
                yield fs.mkdir(diffPath, { recursive: true });
            }
            catch (_b) {
                core.debug(`Unable to create dir: ${diffPath}`);
            }
            baseDir.filter(isSnapshot).forEach(entry => {
                baseSnapshots.set(entry.name, entry);
                missingSnapshots.set(entry.name, entry);
            });
            currentDir.filter(isSnapshot).forEach((entry) => __awaiter(this, void 0, void 0, function* () {
                currentSnapshots.set(entry.name, entry);
                if (baseSnapshots.has(entry.name)) {
                    try {
                        const isDiff = yield createDiff(entry.name, path_1.default.resolve(GITHUB_WORKSPACE, diff), path_1.default.resolve(GITHUB_WORKSPACE, current, entry.name), path_1.default.resolve(outputPath, entry.name));
                        if (isDiff) {
                            changedSnapshots.add(entry.name);
                        }
                        missingSnapshots.delete(entry.name);
                    }
                    catch (err) {
                        core.debug(`Unable to diff: ${err.message}`);
                    }
                }
                else {
                    newSnapshots.add(entry.name);
                }
            }));
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
                const { data: release } = yield octokit.repos.createRelease({
                    owner,
                    repo,
                    tag_name: `visual-snapshot-${GITHUB_SHA}`,
                    target_commitish: GITHUB_SHA,
                    name: 'Visual Snapshot Artifacts',
                    body: 'Testing',
                    draft: true,
                    prerelease: true,
                });
                const diffFiles = yield fs.readdir(diffPath, {
                    withFileTypes: true,
                });
                diffFiles.filter(isSnapshot).forEach((entry) => __awaiter(this, void 0, void 0, function* () {
                    core.debug(`Diff file: ${entry.name}`);
                    yield octokit.repos.uploadReleaseAsset({
                        owner,
                        repo,
                        release_id: release.id,
                        origin: release.upload_url,
                        data: (yield fs.readFile(path_1.default.resolve(diffPath, entry.name))).toString('base64'),
                    });
                }));
                hasRelease = true;
            }
            const conclusion = !!changedSnapshots.size || !!missingSnapshots.size
                ? 'failure'
                : !!newSnapshots.size
                    ? 'neutral'
                    : 'success';
            // Create a GitHub check with our results
            yield octokit.checks.create({
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
${[...missingSnapshots].map(name => `* ${name}`).join('\n')}

## New snapshots
${[...newSnapshots].map(name => `* ${name}`).join('\n')}
`,
                },
            });
        }
        catch (error) {
            core.setFailed(error.message);
        }
    });
}
run();
