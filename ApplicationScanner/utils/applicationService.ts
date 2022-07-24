import crypto from 'crypto';
import logger from 'CommonServer/utils/Logger';
import EncryptionKeys from './encryptionKeys';
const algorithm: $TSFixMe = EncryptionKeys.algorithm;
const key: $TSFixMe = EncryptionKeys.key;
import git from 'simple-git/promise';

import { v1 as uuidv1 } from 'uuid';
import Path from 'path';
import ErrorService from './errorService';
import fs from 'fs';
import { promisify } from 'util';
const readdir: $TSFixMe = promisify(fs.readdir);
const rmdir: $TSFixMe = promisify(fs.rmdir);
const unlink: $TSFixMe = promisify(fs.unlink);
import { spawn } from 'child_process';
import {
    updateApplicationSecurityToScanning,
    updateApplicationSecurityLogService,
    updateApplicationSecurityScanTime,
    updateApplicationSecurityToFailed,
} from './applicationSecurityUpdate';

import { Client } from 'ssh2';
export default {
    scan: async function (security: $TSFixMe): void {
        if (
            security.gitCredential.gitUsername &&
            security.gitCredential.gitPassword
        ) {
            const decryptedSecurity: $TSFixMe = this.decryptPassword(security);
            await this.scanApplicationSecurity(decryptedSecurity);
        }
        if (
            security.gitCredential.sshTitle &&
            security.gitCredential.sshPrivateKey
        ) {
            await this.sshScanApplicationSecurity(security);
        }
    },

    decryptPassword: async function (security: $TSFixMe): void {
        const values: $TSFixMe = [];
        for (let i: $TSFixMe = 0; i <= 15; i++) {
            values.push(security.gitCredential.iv[i]);
        }
        const iv: $TSFixMe = Buffer.from(values);
        security.gitCredential.gitPassword = await this.decrypt(
            security.gitCredential.gitPassword,
            iv
        );
        return security;
    },

    decrypt: (encText: $TSFixMe, iv: $TSFixMe) => {
        const promise: Promise = new Promise(
            (resolve: Function, reject: Function) => {
                try {
                    const decipher: $TSFixMe = crypto.createDecipheriv(
                        algorithm,
                        key,
                        iv
                    );
                    let decoded: $TSFixMe = decipher.update(
                        encText,
                        'hex',
                        'utf8'
                    );
                    decoded += decipher.final('utf8');
                    resolve(decoded);
                } catch (error) {
                    reject(error);
                }
            }
        );
        return promise;
    },

    sshScanApplicationSecurity: async (security: $TSFixMe) => {
        let securityDir: $TSFixMe = 'application_security_dir';

        securityDir = createDir(securityDir);
        const cloneDirectory = `${uuidv1()}security`; // Always create unique paths
        const repoPath: $TSFixMe = Path.resolve(securityDir, cloneDirectory);
        const conn: $TSFixMe = new Client();

        const url: $TSFixMe = security.gitRepositoryUrl.split(
            'https://github.com/'
        )[1];

        conn.on('ready', () => {
            logger.info('SSH Client :: ready');
            return new Promise((resolve: Function, reject: Function) => {
                git(securityDir)
                    .silent(true)
                    .clone(`git@github.com:${url}.git`, cloneDirectory)
                    .then(() => {
                        const output: $TSFixMe = spawn('npm', ['install'], {
                            cwd: repoPath,
                        });
                        output.on('error', (error: Error) => {
                            error.code = 500;
                            throw error;
                        });

                        output.on('close', () => {
                            let auditOutput: $TSFixMe = '';
                            const audit: $TSFixMe = spawn(
                                'npm',
                                ['audit', '--json'],
                                {
                                    cwd: repoPath,
                                }
                            );

                            audit.on('error', (error: Error) => {
                                error.code = 500;
                                throw error;
                            });

                            audit.stdout.on('data', (data: $TSFixMe) => {
                                const strData: $TSFixMe = data.toString();
                                auditOutput += strData;
                            });

                            audit.on('close', async () => {
                                let advisories: $TSFixMe = [];
                                auditOutput = JSON.parse(auditOutput); // Parse the stringified json

                                for (const key in auditOutput.vulnerabilities) {
                                    advisories.push(
                                        auditOutput.vulnerabilities[key]
                                    );
                                }

                                const criticalArr: $TSFixMe = [],
                                    highArr: $TSFixMe = [],
                                    moderateArr: $TSFixMe = [],
                                    lowArr: $TSFixMe = [];
                                advisories.map((advisory: $TSFixMe) => {
                                    if (advisory.severity === 'critical') {
                                        criticalArr.push(advisory);
                                    }
                                    if (advisory.severity === 'high') {
                                        highArr.push(advisory);
                                    }
                                    if (advisory.severity === 'moderate') {
                                        moderateArr.push(advisory);
                                    }
                                    if (advisory.severity === 'low') {
                                        lowArr.push(advisory);
                                    }
                                    return advisory;
                                });

                                // Restructure advisories from the most critical case to the least critical(low)
                                advisories = [
                                    ...criticalArr,

                                    ...highArr,

                                    ...moderateArr,

                                    ...lowArr,
                                ];

                                const auditData: $TSFixMe = {
                                    dependencies:
                                        auditOutput.metadata.dependencies,
                                    devDependencies:
                                        auditOutput.metadata.devDependencies,
                                    optionalDependencies:
                                        auditOutput.metadata
                                            .optionalDependencies,
                                    totalDependencies:
                                        auditOutput.metadata.totalDependencies,
                                    vulnerabilities:
                                        auditOutput.metadata.vulnerabilities,
                                    advisories,
                                };

                                const resolvedLog: $TSFixMe =
                                    await updateApplicationSecurityLogService({
                                        securityId: security._id,
                                        componentId: security.componentId._id,
                                        data: auditData,
                                    });
                                await updateApplicationSecurityScanTime({
                                    _id: security._id,
                                });
                                deleteFolderRecursive(repoPath);
                                return resolve(resolvedLog);
                            });
                        });
                    })
                    .catch(async (error: Error) => {
                        await updateApplicationSecurityToFailed(security);
                        error.message =
                            'Authentication failed please check your git credentials or git repository url';
                        ErrorService.log(
                            'applicationSecurityUpdate.updateApplicationSecurityToFailed',
                            error
                        );

                        deleteFolderRecursive(repoPath);
                        return reject(error);
                    });
            });
        }).connect({
            // This is where we use the ssh private Key to connect to github
            host: 'github.com',
            username: 'git',
            privateKey: security.gitCredential.sshPrivateKey,
        });
    },

    scanApplicationSecurity: async (security: $TSFixMe) => {
        let securityDir: $TSFixMe = 'application_security_dir';

        securityDir = createDir(securityDir);

        const USER: $TSFixMe = security.gitCredential.gitUsername;
        const PASS: $TSFixMe = security.gitCredential.gitPassword;
        // Format the url
        const REPO: $TSFixMe = formatUrl(security.gitRepositoryUrl);
        const remote = `https://${USER}:${PASS}@${REPO}`;
        const cloneDirectory = `${uuidv1()}security`; // Always create unique paths
        const repoPath: $TSFixMe = Path.resolve(securityDir, cloneDirectory);

        /*
         * Update application security to scanning true
         * To prevent pulling an applicaiton security multiple times by running cron job
         * Due to network delay
         */
        await updateApplicationSecurityToScanning(security);

        return new Promise((resolve: Function, reject: Function) => {
            git(securityDir)
                .silent(true)
                .clone(remote, cloneDirectory)
                .then(() => {
                    const output: $TSFixMe = spawn('npm', ['install'], {
                        cwd: repoPath,
                    });
                    output.on('error', (error: Error) => {
                        error.code = 500;
                        throw error;
                    });

                    output.on('close', () => {
                        let auditOutput: $TSFixMe = '';
                        const audit: $TSFixMe = spawn(
                            'npm',
                            ['audit', '--json'],
                            {
                                cwd: repoPath,
                            }
                        );

                        audit.on('error', (error: Error) => {
                            error.code = 500;
                            throw error;
                        });

                        audit.stdout.on('data', (data: $TSFixMe) => {
                            const strData: $TSFixMe = data.toString();
                            auditOutput += strData;
                        });

                        audit.on('close', async () => {
                            let advisories: $TSFixMe = [];
                            auditOutput = JSON.parse(auditOutput); // Parse the stringified json

                            for (const key in auditOutput.vulnerabilities) {
                                advisories.push(
                                    auditOutput.vulnerabilities[key]
                                );
                            }

                            const criticalArr: $TSFixMe = [],
                                highArr: $TSFixMe = [],
                                moderateArr: $TSFixMe = [],
                                lowArr: $TSFixMe = [];
                            advisories.map((advisory: $TSFixMe) => {
                                if (advisory.severity === 'critical') {
                                    criticalArr.push(advisory);
                                }
                                if (advisory.severity === 'high') {
                                    highArr.push(advisory);
                                }
                                if (advisory.severity === 'moderate') {
                                    moderateArr.push(advisory);
                                }
                                if (advisory.severity === 'low') {
                                    lowArr.push(advisory);
                                }
                                return advisory;
                            });

                            // Restructure advisories from the most critical case to the least critical(low)
                            advisories = [
                                ...criticalArr,

                                ...highArr,

                                ...moderateArr,

                                ...lowArr,
                            ];

                            const auditData: $TSFixMe = {
                                dependencies: auditOutput.metadata.dependencies,
                                devDependencies:
                                    auditOutput.metadata.devDependencies,
                                optionalDependencies:
                                    auditOutput.metadata.optionalDependencies,
                                totalDependencies:
                                    auditOutput.metadata.totalDependencies,
                                vulnerabilities:
                                    auditOutput.metadata.vulnerabilities,
                                advisories,
                            };

                            const resolvedLog: $TSFixMe =
                                await updateApplicationSecurityLogService({
                                    securityId: security._id,
                                    componentId: security.componentId._id,
                                    data: auditData,
                                });
                            await updateApplicationSecurityScanTime({
                                _id: security._id,
                            });
                            deleteFolderRecursive(repoPath);
                            return resolve(resolvedLog);
                        });
                    });
                })
                .catch(async (error: Error) => {
                    await updateApplicationSecurityToFailed(security);
                    error.message =
                        'Authentication failed please check your git credentials or git repository url';
                    ErrorService.log(
                        'applicationSecurityUpdate.updateApplicationSecurityToFailed',
                        error
                    );

                    deleteFolderRecursive(repoPath);
                    return reject(error);
                });
        });
    },
};

async function deleteFolderRecursive(dir: $TSFixMe): void {
    if (fs.existsSync(dir)) {
        const entries: $TSFixMe = await readdir(dir, { withFileTypes: true });
        await Promise.all(
            entries.map((entry: $TSFixMe) => {
                const fullPath: $TSFixMe = Path.join(dir, entry.name);
                return entry.isDirectory()
                    ? deleteFolderRecursive(fullPath)
                    : unlink(fullPath);
            })
        );
        await rmdir(dir); // Finally remove now empty directory
    }
}

function formatUrl(url: $TSFixMe): void {
    // Remove https://www. from url
    if (url.indexOf('https://www.') === 0) {
        return url.slice(12);
    }
    // Remove http://www. from url
    if (url.indexOf('http://www.') === 0) {
        return url.slice(11);
    }
    // Remove https:// from url
    if (url.indexOf('https://') === 0) {
        return url.slice(8);
    }
    // Remove http:// from url
    if (url.indexOf('http://') === 0) {
        return url.slice(7);
    }
    // Remove www. from url
    if (url.indexOf('www.') === 0) {
        return url.slice(4);
    }

    return url;
}

function createDir(dirPath: $TSFixMe): void {
    return new Promise((resolve: Function, reject: Function) => {
        const workPath: $TSFixMe = Path.resolve(process.cwd(), dirPath);
        if (fs.existsSync(workPath)) {
            resolve(workPath);
        }

        fs.mkdir(workPath, (error: Error) => {
            if (error) {
                reject(error);
            }
            resolve(workPath);
        });
    });
}
