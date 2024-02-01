/**
 * Copyright 2024 Angus.Fenying <fenying@litert.org>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as C from './Common';
import * as I from './_internal';
import * as E from './Errors';
import * as $Logs from '@litert/logger';

const DEP_VER_PLACE_HOLDER = '-';

const NPM_HOOKS = [
    'prepublish',
    'prepare',
    'prepublishOnly',
    'prepack',
    'postpack',
    'publish'
];

class OttoiaManager implements C.IManager {

    private readonly _fs: I.IFileUtils;

    private _packages: Record<string, I.IPackage> = {};

    private _aliases: Record<string, string> = {};

    private readonly _depCounters: I.IDependencyCounter = I.createDependencyCounter();

    private _rootPkg!: I.IRootPackage;

    private _prjRoot!: string;

    private readonly _pkgUtils: I.IPackageUtils;

    private readonly _npm: I.INpmHelper;

    private readonly _logs: I.ILogger;

    public constructor(private _root: string, verbose: number = 0) {

        const logSettings: $Logs.ILevelUpdateOptions<string, I.TLogLevel> = {

            levels: ['error', 'info', 'warning'],
            enabled: true,
        };

        I.loggerFactory.setLevelOptions({
            levels: ['error', 'info', 'warning'],
            enabled: true,
        });

        if (verbose >= 4) {

            logSettings.traceDepth = 5;
        }
        if (verbose >= 3) {

            (logSettings.levels as I.TLogLevel[]).push('debug3');
        }
        if (verbose >= 2) {

            (logSettings.levels as I.TLogLevel[]).push('debug2');
        }
        if (verbose >= 1) {

            (logSettings.levels as I.TLogLevel[]).push('debug1');
        }

        I.loggerFactory.setLevelOptions(logSettings);

        this._logs = I.loggerFactory.createLogger('Manager');

        this._fs = I.createFileUtility(I.loggerFactory.createLogger('FS'));

        this._pkgUtils = I.createPackageUtils(
            I.loggerFactory.createLogger('Pkg Utils'),
            this._fs
        );

        this._npm = I.createNPMHelper(
            I.loggerFactory.createLogger('NPM'),
            this._root,
            this._fs
        );
    }

    public async recall(opts: C.IRecallOptions): Promise<void> {

        const cfg = this._rootPkg.ottoiaOptions.releases[opts.release];

        if (!cfg) {

            throw new E.E_RELEASE_CONFIG_NOT_FOUND({ env: opts.release });
        }

        const pkgs = Object.values(this._packages).filter((v) => !v.noRelease);

        const version: string = opts.version?.replace(/^v/, '');

        const args: string[] = [];

        if (!opts.confirmed) {

            args.push('--dry-run');
        }

        if (cfg.registry) {

            args.push('--registry', `'${cfg.registry}'`);
        }

        for (const p of pkgs) {

            this._logs.info(`Recalling ${p.name}@${version}...`);

            await this._npm.unpublish([...args, `${p.name}@${version}`]);
        }
    }

    public async deprecate(opts: C.IDeprecateOptions): Promise<void> {

        const pkgs = Object.values(this._packages).filter((v) => !v.noRelease);

        const args: string[] = [];

        for (const p of pkgs) {

            this._logs.info(`Deprecating ${p.name}@${opts.scope}...`);

            await this._npm.deprecate([...args, `${p.name}@${opts.scope}`, opts.message || '""']);
        }
    }

    public async release(opts: C.IReleaseOptions): Promise<void> {

        const cfg = this._rootPkg.ottoiaOptions.releases[opts.env];

        if (!cfg) {

            throw new E.E_RELEASE_CONFIG_NOT_FOUND({ env: opts.env });
        }

        const tags = Array.isArray(cfg.tag) ? cfg.tag : [cfg.tag];

        this._logs.debug1(`Release to tags "${tags.join(', ')}".`);

        if (!opts.confirmed) {

            this._logs.warning(`Simulating releasing ${opts.env} version with "--dry-run"...`);
        }

        let version: string = opts.version?.replace(/^v/, '');

        if (!version) {

            const pkgVersions = await this._npm.getCurrentVersionSet(
                Object.keys(this._packages),
                I.builtInCmpSemVersion,
                tags[0]
            );

            if (Object.keys(pkgVersions).length) {

                /**
                 * Use the newest one if any package exists.
                 */
                version = Object.values(pkgVersions).sort(I.builtInCmpSemVersion).pop()!;
            }
            else {

                /**
                 * Use a new version if none of package exists
                 */
                version = this._rootPkg.version;
            }

            const versionNamer = cfg.versionNamer ?
                // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
                require(this._fs.concatPath(this._root, cfg.versionNamer)).default as C.IVersionNamer :
                I.createBuiltInVersionNamer();

            version = versionNamer.next(
                version,
                opts.env,
                opts.withBreakingChanges,
                opts.withNewFeatures,
                opts.withPatches
            );
        }

        if (!opts.noClean) {

            await this.clean();
        }

        this._npm.chdir(this._root);

        this._rootPkg.version = version;

        this._logs.info(`Releasing the ${opts.env} version "v${version}"...`);

        try {

            this._logs.debug1('Backing up the package.json...');

            await this._createPackageJsonBackup();

            this._logs.debug1('Setting up dependency versions...');

            await this._setupDependencies(version, cfg);

            this._logs.debug1('Preparing packages...');

            await this._preparePackage();

            for (const pkgName in this._packages) {

                const pkg = this._packages[pkgName];

                if (pkg.noRelease) {

                    continue;
                }

                this._logs.info(`Publishing package "${pkgName}@${version}".`);

                this._npm.chdir(pkg.root);

                const publishArgs: string[] = [`--tag=${tags[0]}`];
                const distAddArgs: string[] = [];

                if (!opts.confirmed) {

                    this._logs.debug1('Simulating with "--dry-run".');

                    publishArgs.push('--dry-run');
                }

                /**
                 * For the public package.
                 */
                if (!pkg.privateAccess) {

                    publishArgs.push('--access=public');
                }

                if (cfg.registry) {

                    publishArgs.push(`--registry`, `'${cfg.registry}'`);
                    distAddArgs.push(`--registry`, `'${cfg.registry}'`);
                }

                this._logs.debug1(await this._npm.publish(publishArgs));

                for (const tag of tags.slice(1)) {

                    this._logs.debug1(await this._npm.distAdd([...distAddArgs, `${pkgName}@${version}`, tag], !opts.confirmed));
                }
            }

            this._logs.debug1('Cleaning up packages.');

            for (const pkgName in this._packages) {

                const pkg = this._packages[pkgName];

                if (pkg.noRelease) {

                    this._logs.debug1(`Skipped no-releasing package "${pkg.name}".`);

                    continue;
                }

                this._npm.chdir(pkg.root);

                if (pkg.scripts['ottoia:postpublish']) {

                    this._logs.debug2('Executing ottoia hook "ottoia:postpublish".');
                    await this._npm.run('ottoia:postpublish', []);
                }
            }
        }
        finally {

            this._npm.close();

            await this._recoverPackageJsonFromBackup();

            await this._cleanPackageJsonBackup();
        }
    }

    private async _preparePackage(): Promise<void> {

        this._npm.chdir(this._root);

        if (this._rootPkg.scripts['ottoia:prepublish']) {

            await this._npm.run('ottoia:prepublish', []);
        }

        for (const pkgName in this._packages) {

            const pkg = this._packages[pkgName];

            if (pkg.noRelease) {

                this._logs.debug1(`Skipped no-releasing package "${pkg.name}".`);

                continue;
            }

            this._npm.chdir(pkg.root);

            // await this._clean(pkg, false);

            this._logs.debug2(`Preparing package "${pkgName}".`);

            if (pkg.scripts['ottoia:prepublish']) {

                this._logs.debug2('Executing ottoia hook "ottoia:prepublish".');
                await this._npm.run('ottoia:prepublish', []);
            }
        }

        this._npm.chdir(this._root);

        if (this._rootPkg.scripts['ottoia:prepare']) {

            await this._npm.run('ottoia:prepare', []);
        }
    }

    private _getDependencyVersion(depName: string, pkgName: string): string {

        const localPkg = this._packages[depName];

        if (localPkg) {

            if (localPkg.noRelease) {

                throw new E.E_PRIVATE_DEPENDENCY({
                    package: pkgName, dependency: depName
                });
            }

            switch (this._rootPkg.ottoiaOptions.versionLock ?? 'full') {
                default:
                case 'full':
                    return localPkg.version!;
                case 'major':
                    return `^${localPkg.version!}`;
                case 'minor':
                    return `~${localPkg.version!}`;
            }
        }

        let v = '';

        if (this._rootPkg.packageLock.packages[`node_modules/${depName}`]) {

            const depVer = this._rootPkg.packageLock.packages?.[''].dependencies?.[depName] ??
                this._rootPkg.packageLock.packages?.[''].peerDependencies?.[depName] ??
                this._rootPkg.raw.dependencies?.[depName] ??
                this._rootPkg.raw.peerDependencies?.[depName] ??
                '';

            const semverFlag = depVer ? /^(\^|~|>=|>|=|<|<=)/.exec(depVer)?.[1] ?? '' : '^';

            v = `${semverFlag}${this._rootPkg.packageLock.packages[`node_modules/${depName}`].version}`;
        }
        else if (this._rootPkg.raw.dependencies?.[depName]) {

            v = this._rootPkg.raw.dependencies[depName];
        }
        else {

            throw new E.E_DEP_NOT_LOCKED({
                package: pkgName, dependency: depName
            });
        }

        return v;
    }

    /**
     * Setup the dependencies of each package.
     */
    private async _setupDependencies(version: string, cfg: I.IReleaseOptions): Promise<void> {

        for (const pkgName in this._packages) {

            const pkg = this._packages[pkgName];

            if (pkg.noRelease) {

                this._logs.debug1(`Skipped no-releasing package "${pkg.name}".`);
                continue;
            }

            pkg.raw.version = pkg.version = version;
        }

        for (const pkgName in this._packages) {

            const p = this._packages[pkgName];

            if (p.noRelease) {

                continue;
            }

            for (const deps of [p.raw.peerDependencies, p.raw.dependencies]) {

                for (const depName in deps) {

                    if (deps[depName] === '*') {
                        this._logs.debug3(`Use "${depName}@*" for package "${p.name}".`);
                    }
                    else if (deps[depName] === DEP_VER_PLACE_HOLDER) {

                        deps[depName] = this._getDependencyVersion(depName, pkgName);
                        this._logs.debug3(`Use "${depName}@${p.raw.dependencies[depName]}" for package "${p.name}".`);
                    }
                    else {

                        this._logs.warning(`Use "${depName}@${deps[depName]}" for package "${p.name}".`);
                    }
                }
            }

            for (const hookName of NPM_HOOKS) {

                if (p.raw.scripts?.[hookName]) {

                    this._logs.debug2(`Ignored NPM built-in hook script "${hookName}".`);
                    delete p.raw.scripts?.[hookName];
                }
            }

            this._setupPublishConfig(p.raw, cfg);

            await this._fs.writeFile(
                this._fs.concatPath(p.root, 'package.json'),
                JSON.stringify(p.raw, null, 2)
            );
        }
    }

    private _setupPublishConfig(pkg: I.INpmPackage, cfg: I.IReleaseOptions): void {

        if (!cfg.registry) {

            return;
        }

        pkg.publishConfig = {};

        if (pkg.name.includes('/')) {

            pkg.publishConfig[`${pkg.name.split('/')[0]}:registry`] = cfg.registry;
        }

        pkg.publishConfig.registry = cfg.registry;
    }

    private async _createPackageJsonBackup(): Promise<void> {

        this._logs.debug2('Create a backup of all package.json files...');

        const tmpPath = this._fs.concatPath(this._root, '.ottoia/tmp/packages.d');

        await this._fs.mkdirP(tmpPath);

        for (const pkgName in this._packages) {

            const pkg = this._packages[pkgName];

            if (pkg.noRelease) {

                continue;
            }

            await this._fs.copyFile(
                this._fs.concatPath(pkg.root, 'package.json'),
                this._fs.concatPath(tmpPath, pkg.name.replace(/\//g, '-') + '.json')
            );
        }
    }

    private async _cleanPackageJsonBackup(): Promise<void> {

        this._logs.debug2('Cleaning up the backup of all package.json files...');

        const tmpPath = this._fs.concatPath(this._root, '.ottoia/tmp/packages.d');

        if (!await this._fs.existsDir(tmpPath)) {

            return;
        }

        for (const pkgName in this._packages) {

            const pkg = this._packages[pkgName];

            if (pkg.noRelease) {

                continue;
            }

            const bakFile = this._fs.concatPath(tmpPath, pkg.name.replace(/\//g, '-') + '.json');

            if (!await this._fs.existsFile(bakFile)) {

                continue;
            }

            await this._fs.removeFile(bakFile);
        }
    }

    private async _recoverPackageJsonFromBackup(): Promise<void> {

        this._logs.debug2('Recovering all package.json files from the backup...');

        const tmpPath = this._fs.concatPath(this._root, '.ottoia/tmp/packages.d');

        if (!await this._fs.existsDir(tmpPath)) {

            return;
        }

        for (const pkgName in this._packages) {

            const pkg = this._packages[pkgName];

            if (pkg.noRelease) {

                continue;
            }

            const bakFile = this._fs.concatPath(tmpPath, pkg.name.replace(/\//g, '-') + '.json');

            if (!await this._fs.existsFile(bakFile)) {

                continue;
            }

            await this._fs.copyFile(
                bakFile,
                this._fs.concatPath(pkg.root, 'package.json')
            );
        }
    }

    public async runCommand(
        pkgs: string[],
        cmd: string,
        args: string[],
        allowRoot: boolean = false,
        rootOnly: boolean = false
    ): Promise<void> {

        pkgs = pkgs.map((v) => v.toLowerCase());

        if (pkgs.length) {

            this._checkPackages(pkgs);
        }
        else {

            pkgs = Object.keys(this._packages);
        }

        if (!rootOnly) {

            for (const pkgName of pkgs) {

                const pkg = this._getPackage(pkgName, false);

                if (!pkg.scripts[cmd]) {

                    this._logs.warning(`Command "${cmd}" not found in package "${pkg.name}".`);
                    continue;
                }

                this._logs.debug1(`Executing NPM command "${cmd}" for sub package "${pkg.name}"...`);

                this._npm.chdir(pkg.root);

                console.log(await this._npm.run(cmd, args));
            }
        }

        if (allowRoot) {

            this._npm.chdir(this._root);

            this._logs.debug1(`Executing NPM command "${cmd}" for root package...`);

            console.log(await this._npm.run(cmd, args));
        }
    }

    public async initialize(ensured?: boolean): Promise<void> {

        const PATH_TO_ROOT_JSON = this._fs.concatPath(this._root, 'package.json');

        let newJson = false;

        if (!await this._fs.existsFile(PATH_TO_ROOT_JSON)) {

            this._logs.debug1(`The root package.json not found in "${this._root}".`);

            newJson = true;

            await this._npm.init();
        }
        else {

            this._logs.debug1(`Found package.json file "${PATH_TO_ROOT_JSON}".`);

            if (!ensured) {

                throw new E.E_EXISTING_PACKAGE_JSON({ path: PATH_TO_ROOT_JSON });
            }
        }

        const rootJson = JSON.parse(await this._fs.readFile(PATH_TO_ROOT_JSON));

        const ottoiaProjectJSON = await this._fs.readJsonFile<I.INpmPackage>(`${__dirname}/../package.json`);

        rootJson.ottoia = true;

        rootJson.private = true;

        if (!rootJson.devDependencies || typeof rootJson.devDependencies !== 'object') {

            rootJson.devDependencies = {};
        }

        rootJson.devDependencies[ottoiaProjectJSON.name] = `^${ottoiaProjectJSON.version}`;

        if (!rootJson.version || newJson) {

            rootJson.version = '0.1.0';
        }

        if (typeof rootJson.ottoia !== 'object') {

            rootJson.ottoia = {
                'releases': {

                    'production': { tag: 'latest' }
                }
            };
        }

        if (typeof rootJson.ottoia.releases !== 'object') {

            rootJson.ottoia.releases = {

                'production': { tag: 'latest' }
            };
        }

        this._logs.debug1('Writing package.json file...');

        await this._fs.writeFile(PATH_TO_ROOT_JSON, JSON.stringify(rootJson, null, 2));

        this._logs.debug1('Initializing packages root...');

        await this._fs.mkdirP(this._fs.concatPath(this._root, 'packages'));

        this._logs.debug1('Initializing git ignore settings...');

        const GIT_IGNORE_PATH = this._fs.concatPath(this._root, '.gitignore');

        if (await this._fs.existsFile(GIT_IGNORE_PATH)) {

            const GIT_IGNORE_CONTENT = await this._fs.readFile(GIT_IGNORE_PATH);
            if (!GIT_IGNORE_CONTENT.includes('.ottoia')) {

                this._logs.debug1('Setting up ottoia for current package...');

                await this._fs.writeFile(
                    GIT_IGNORE_PATH,
                    ['.ottoia', ...GIT_IGNORE_CONTENT.split('\n').map((v) => v.trim())].join('\n')
                );
            }
        }
    }

    public async ensureRootPackagePath(): Promise<void> {

        let curPath = this._root;

        while (1) {

            try {

                this._logs.debug1(`Try detecting package.json in "${curPath}"...`);

                this._rootPkg = await this._pkgUtils.readRoot(curPath);

                this._logs.debug1(`Detected package.json in "${curPath}"...`);
                this._root = curPath;
                break;
            }
            catch {

                const newPath = this._fs.concatPath(curPath, '..');

                if (newPath === curPath) {

                    throw new E.E_NO_ROOT_PACKAGE({ cwd: this._root });
                }

                curPath = newPath;
            }
        }

        this._prjRoot = this._fs.concatPath(this._root, './packages');
        this._npm.chdir(this._root);
    }

    public async reload(): Promise<void> {

        const packages: Record<string, I.IPackage> = {};

        let pkgPathList: string[];

        const aliases: Record<string, string> = {};

        try {

            this._logs.debug1(`Scanning possible packages in path "${this._prjRoot}"...`);

            pkgPathList = await this._pkgUtils.scan(this._prjRoot);

        }
        catch {

            this._logs.debug1(`Failed to scan packages in "${this._prjRoot}".`);

            pkgPathList = [];
        }

        for (const p of pkgPathList) {

            try {

                this._logs.debug1(`Loading package in "${p}"...`);

                const pkg = await this._pkgUtils.read(p);

                this._logs.debug1(`Successfully loaded package "${pkg.name}" in "${p}"...`);

                this._depCounters.add(pkg.name, this._extractDeps(pkg, false));

                packages[pkg.name] = pkg;

                if (pkg.alias) {

                    pkg.alias = pkg.alias.toLowerCase();

                    if (aliases[pkg.alias]) {

                        throw new E.E_DUP_PACKAGE_ALIAS({
                            alias: pkg.alias,
                            packages: [ pkg.name, aliases[pkg.alias] ]
                        });
                    }

                    aliases[pkg.alias] = pkg.name;
                }
            }
            catch (e) {

                if (!(e instanceof E.OttoiaError)) {

                    throw new E.E_INVALID_PACKAGE({ path: p });
                }

                throw e;
            }
        }

        this._packages = packages;
        this._aliases = aliases;
    }

    public getPackageNames(): string[] {

        return Object.keys(this._packages);
    }

    public getPackage(name: string): C.IPackage {

        const pkg = this._getPackage(name, true);

        if (!pkg) {
            throw new E.E_PACKAGE_NOT_FOUND({ name });
        }

        return {
            'name': pkg.name,
            'noRelease': pkg.noRelease,
            'privateAccess': pkg.privateAccess,
            'alias': pkg.alias,
            'scripts': { ...pkg.scripts },
            'dependencies': { ...pkg.dependencies },
            'devDependencies': { ...pkg.devDependencies },
            'peerDependencies': { ...pkg.peerDependencies }
        };
    }

    private _getPackage(nameOrAlias: string, assert: boolean): I.IPackage {

        nameOrAlias = nameOrAlias.toLowerCase();

        if (nameOrAlias.startsWith('@@')) {

            nameOrAlias = nameOrAlias.slice(2);

            this._logs.debug2(`Try using package alias "${nameOrAlias}"...`);

            if (!this._aliases[nameOrAlias]) {

                this._logs.debug2(`No package was found by alias "${nameOrAlias}".`);
                if (!assert) {

                    return this._packages['?'];
                }

                throw new E.E_PACKAGE_NOT_FOUND({ alias: nameOrAlias });
            }

            nameOrAlias = this._aliases[nameOrAlias];
        }

        this._logs.debug2(`Try using package name "${nameOrAlias}"...`);

        if (assert && !this._packages[nameOrAlias]) {

            this._logs.debug2(`Package "${nameOrAlias}" does not exist.`);

            throw new E.E_PACKAGE_NOT_FOUND({ name: nameOrAlias });
        }

        this._logs.debug2(`Fetched package "${nameOrAlias}".`);

        return this._packages[nameOrAlias];
    }

    public async createPackage(
        name: string,
        tplFile?: string,
        noRelease: boolean = false,
        privateAccess: boolean = false,
        dirName?: string,
        aliasName?: string
    ): Promise<void> {

        name = name.toLowerCase();

        this._pkgUtils.validatePackageName(name);

        this._logs.debug1(`Try creating sub package "${name}"...`);

        aliasName = aliasName?.toLowerCase();

        if (this._packages[name]) {

            this._logs.debug1(`Sub package "${name}" already exists.`);

            throw new E.E_DUP_PACKAGE({ name });
        }

        if (aliasName && this._aliases[aliasName]) {

            this._logs.debug1(`Alias "${aliasName}" of sub package "${name}" already exists.`);

            throw new E.E_DUP_PACKAGE_ALIAS({
                alias: aliasName,
                packages: [ this._aliases[aliasName] ]
            });
        }

        const pkg = await this._pkgUtils.create({

            root: this._prjRoot,
            name,
            templateFile: tplFile,
            noRelease,
            dirName,
            privateAccess,
            alias: aliasName
        });

        this._logs.debug1(`Successfully created sub package "${name}".`);

        this._packages[name] = pkg;
    }

    private _checkPackages(pkgs: string[]): void {

        const unkPkgs = pkgs.filter((v) => !this._getPackage(v, false));

        if (unkPkgs.length) {

            throw new E.E_UNKNOWN_SUB_PACKAGE({ packages: unkPkgs });
        }
    }

    public async install(
        depExprs: string[],
        dstPkgNames: string[],
        isPeer: boolean = false,
        isDev: boolean = false,
        depPath: string[] = [],
        noSave: boolean = false,
        noBootStrap: boolean = false
    ): Promise<void> {

        const deps = depExprs.map((v) => this._pkgUtils.parseDependency(v.toLowerCase()));

        if (!deps.length) {

            return;
        }

        dstPkgNames = dstPkgNames.map((v) => v.toLowerCase());

        if (!noSave) {

            await this._createPackageJsonBackup();
        }

        if (dstPkgNames.length) {

            this._logs.debug1('Installing to determined sub packages...');
            this._checkPackages(dstPkgNames);
        }
        else {

            this._logs.debug1('Installing to all sub packages...');
            dstPkgNames = Object.keys(this._packages);
        }

        const pkgs: Record<string, I.IPackage> = {};

        for (const p of dstPkgNames) {

            pkgs[p] = this._getPackage(p, true);
        }

        const REMOTE_DEPS = deps.filter(
            (p) => this._pkgUtils.isValidDependencyName(p.name) && !this._getPackage(p.name, false)
        );
        const LOCAL_DEPS = deps.filter((v) => !!this._getPackage(v.name, false));

        if (REMOTE_DEPS.length + LOCAL_DEPS.length !== deps.length) {

            throw new E.E_INVALID_PACKAGE_NAME({
                deps: deps.filter((v) => !REMOTE_DEPS.includes(v) && !LOCAL_DEPS.includes(v))
            });
        }

        this._npm.chdir(this._root);

        try {

            if (REMOTE_DEPS.length) {

                this._logs.debug1(`Installing ${REMOTE_DEPS.length} remote dependencies...`);

                await this._npm.install(REMOTE_DEPS, false, isDev);

                for (const depPkg of REMOTE_DEPS) {

                    for (const pkgName of dstPkgNames) {

                        const pkg = pkgs[pkgName];

                        this._logs.debug1(`Installed "${depPkg.expr}" to sub package "${pkg.name}".`);

                        delete pkg.peerDependencies[depPkg.name];
                        delete pkg.devDependencies[depPkg.name];
                        delete pkg.dependencies[depPkg.name];

                        /**
                         * If --development is specified, only root package.json will be written in.
                         */
                        if (!isDev) {

                            if (isPeer) {

                                pkg.peerDependencies[depPkg.name] = DEP_VER_PLACE_HOLDER;
                            }
                            else  {

                                pkg.dependencies[depPkg.name] = DEP_VER_PLACE_HOLDER;
                            }
                        }
                    }
                }
            }

            if (LOCAL_DEPS.length) {

                this._logs.debug1(`Installing ${LOCAL_DEPS.length} local dependencies...`);

                for (const dep of LOCAL_DEPS) {

                    const ldp = this._getPackage(dep.name, true);

                    for (const pkgName of dstPkgNames) {

                        const p = pkgs[pkgName];

                        if (ldp.name === p.name) {

                            this._logs.debug1(`Not installed "${dep.expr}" to itself.`);
                            continue;
                        }

                        this._logs.debug1(`Installed "${dep.expr}" to sub package "${p.name}".`);

                        if (
                            ldp.dependencies[p.name]
                            || ldp.devDependencies[p.name]
                            || ldp.peerDependencies[p.name]
                            || depPath.includes(ldp.name)
                        ) {

                            throw new E.E_RECURSIVE_DEP({ package: p.name, dependency: ldp.name });
                        }

                        if (!noSave) {

                            delete p.devDependencies[ldp.name];
                            delete p.dependencies[ldp.name];
                            delete p.peerDependencies[ldp.name];

                            if (isPeer) {

                                p.peerDependencies[ldp.name] = DEP_VER_PLACE_HOLDER;
                            }
                            else if (isDev) {

                                p.devDependencies[ldp.name] = DEP_VER_PLACE_HOLDER;
                            }
                            else {

                                p.dependencies[ldp.name] = DEP_VER_PLACE_HOLDER;
                            }
                        }

                        this._npm.chdir(p.root);

                        /**
                         * Install the indirect dependencies of the new installed dependencies.
                         */
                        const indirectLocalDeps = this._extractLocalDeps(ldp, true);

                        if (indirectLocalDeps.length) {

                            this._logs.debug1(
                                `Installing indirect local dependencies of "${ldp.name}" to sub package "${p.name}".`
                            );

                            await this.install(
                                indirectLocalDeps,
                                [p.name],
                                false,
                                false,
                                [...depPath, p.name],
                                true,
                                true
                            );
                        }

                        await this._npm.link(ldp.name, ldp.root);
                    }
                }
            }

            for (const pkgName of dstPkgNames) {

                await this._pkgUtils.save(this._getPackage(pkgName, true));
            }

            /**
             * Install the new local dependencies for dependents.
             */
            if (LOCAL_DEPS.length && !noBootStrap) {

                await this._bootstrapLocal();
            }
        }
        catch (e) {

            this._logs.debug1('Failed to install dependencies.');

            if (!noSave) {

                await this._recoverPackageJsonFromBackup();
            }

            throw e;
        }
        finally {

            if (!noSave) {

                await this._cleanPackageJsonBackup();
            }
        }
    }

    private async _uninstallRemoteDeps(deps: string[], pkgs: string[]): Promise<void> {

        for (const depName of deps) {

            for (const pkgName of pkgs) {

                const pkg = this._getPackage(pkgName, true);

                this._logs.debug1(`Uninstalled remote dependency "${depName}" from "${pkg.name}".`);

                delete pkg.devDependencies[depName];
                delete pkg.dependencies[depName];
                delete pkg.peerDependencies[depName];

                /**
                 * Remove the dependency from the sub packages.
                 */
                this._depCounters.remove(pkgName, deps);
            }
        }

        /**
         * Get the reference map of all dependencies of all sub projects.
         */
        const remoteDepsMap = this._depCounters.generateMap();

        this._npm.chdir(this._root);

        /**
         * Remove only the non-referred dependencies.
         */
        await this._npm.uninstall(deps.filter((v) => !remoteDepsMap[v]));

    }

    private async _uninstallLocalDeps(deps: string[], pkgs: string[]): Promise<void> {

        for (const pkgName of pkgs) {

            const pkg = this._getPackage(pkgName, true);

            const prevDepMap = this._depCounters.generateMap(pkg.name);

            for (const depName of deps) {

                const dep = this._getPackage(depName, true);

                if (dep.name === pkg.name) {

                    continue;
                }

                this._logs.debug1(`Uninstalled local dependency "${dep.name}" from "${pkg.name}".`);

                delete pkg.devDependencies[dep.name];
                delete pkg.dependencies[dep.name];
                delete pkg.peerDependencies[dep.name];

                this._depCounters.remove(pkg.name, [dep.name]);
            }

            const finalDepMap = this._depCounters.generateMap(pkg.name);

            this._npm.chdir(pkg.root);

            for (const d of Object.keys(prevDepMap).filter((v) => this._getPackage(pkgName, true) && !finalDepMap[v])) {

                await this._npm.unlink(d);
            }
        }

        if (deps.length) {

            await this._cleanLocalPackageNodeModules();
            await this._bootstrapLocal();
        }
    }

    public async uninstall(deps: string[], pkgs: string[]): Promise<void> {

        if (!deps.length) {

            return;
        }

        deps = deps.map((d) => this._pkgUtils.parseDependency(d).name);

        const explicitDepRefs = this._depCounters.generateMap();

        /**
         * Only the explicit dependencies should be uninstalled.
         */
        const REMOTE_DEPS = deps
            .filter((v) => this._pkgUtils.isValidDependencyName(v) && !this._getPackage(v, false))
            .filter((v) => !!explicitDepRefs[v]);
        const LOCAL_DEPS = deps
            .map((v) => this._getPackage(v, false)?.name)
            .filter((v) => v && !!explicitDepRefs[v]);

        if (REMOTE_DEPS.length + LOCAL_DEPS.length !== deps.length) {

            throw new E.E_DEP_NOT_FOUND({
                deps: deps.filter((v) => !REMOTE_DEPS.includes(v) && !LOCAL_DEPS.includes(v))
            });
        }

        pkgs = pkgs.map((v) => this._getPackage(v, true).name);

        if (pkgs.length) {

            this._checkPackages(pkgs);
        }
        else {

            pkgs = Object.keys(this._packages);
        }

        await this._createPackageJsonBackup();

        try {

            await this._uninstallRemoteDeps(REMOTE_DEPS, pkgs);

            await this._uninstallLocalDeps(LOCAL_DEPS, pkgs);

            for (const p of pkgs) {

                await this._pkgUtils.save(this._getPackage(p, false));
            }
        }
        catch (e) {

            this._logs.debug1('Failed to uninstall dependencies.');

            await this._recoverPackageJsonFromBackup();

            throw e;
        }
        finally {

            await this._cleanPackageJsonBackup();
        }
    }

    private async _cleanLocalPackageNodeModules(): Promise<void> {

        for (const pkgName of Object.keys(this._packages)) {

            const pkg = this._packages[pkgName];

            await this._fs.execAt(pkg.root, 'rm', '-rf', 'node_modules');
        }

    }

    /**
     * Clean up determined package.
     *
     * @notice chdir before calling this method.
     */
    private async _clean(pkg: I.IPackage, full: boolean): Promise<void> {

        if (pkg.scripts['ottoia:clean']) {

            this._logs.debug1(`Executing NPM script "clean" for sub package "${pkg.name}"...`);

            await this._npm.run('ottoia:clean', []);
        }
        else if (pkg.scripts['clean']) {

            this._logs.debug1(`Ignored NPM script "clean" for sub package "${pkg.name}"...`);
        }

        if (full) {

            this._logs.debug1(`Removing "node_modules" for sub package "${pkg.name}"...`);

            await this._fs.execAt(pkg.root, 'rm', '-rf', 'node_modules');
        }
    }

    public async clean(packages: string[] = [], full: boolean = false): Promise<void> {

        this._logs.debug1('Cleaning up the project...');

        if (packages.length) {

            this._checkPackages(packages);
        }
        else {

            packages = Object.keys(this._packages);
        }

        for (const pkgName of packages) {

            const pkg = this._getPackage(pkgName, true);

            this._npm.chdir(pkg.root);

            await this._clean(pkg, full);
        }

        if (this._rootPkg.scripts['ottoia:clean']) {

            this._npm.chdir(this._root);

            this._logs.debug1('Executing NPM script "ottoia:clean" for root package...');

            await this._npm.run('ottoia:clean', []);
        }
        else if (this._rootPkg.scripts['clean']) {

            this._logs.debug1('Ignored NPM script "clean" for root package...');
        }

        if (full) {

            this._logs.debug1('Removing "node_modules" for root package...');

            await this._fs.execAt(this._root, 'rm', '-rf', 'node_modules');
        }
    }

    public async bootstrap(noInstall: boolean, useCI: boolean): Promise<void> {

        this._npm.chdir(this._root);

        if (!noInstall) {

            if (useCI) {

                await this._npm.bootstrapCI();
            }
            else {

                await this._npm.bootstrap();
            }
        }

        await this._bootstrapLocal();
    }

    private async _bootstrapLocal(): Promise<void> {

        for (const pkgName in this._packages) {

            const pkg = this._packages[pkgName];

            this._logs.debug2(`Bootstrap sub package "${pkg.name}"...`);

            await this.install(this._extractLocalDeps(pkg, false), [pkg.name], false, false, [], true, true);
        }
    }

    private _extractLocalDeps(pkg: I.IPackage, productionOnly: boolean): string[] {

        return this._extractDeps(pkg, productionOnly).filter((v) => !!this._packages[v]);
    }

    private _extractDeps(pkg: I.IPackage, productionOnly: boolean): string[] {

        const deps = [...Object.keys(pkg.dependencies), ...Object.keys(pkg.peerDependencies)];
        if (!productionOnly) {

            deps.push(...Object.keys(pkg.devDependencies));
        }

        return Array.from(new Set(deps));
    }
}

export function createManager(root: string, verbose?: number): C.IManager {

    return new OttoiaManager(root, verbose);
}
