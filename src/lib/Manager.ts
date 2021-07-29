/**
 * Copyright 2021 Angus.Fenying <fenying@litert.org>
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

/* eslint-disable @typescript-eslint/no-require-imports */
import * as C from './Common';
import * as I from './_internal';
import * as E from './Errors';

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

    private _fs: I.IFileUtils;

    private _packages: Record<string, I.IPackage> = {};

    private _aliases: Record<string, string> = {};

    private _depCounters: I.IDependencyCounter = I.createDependencyCounter();

    private _rootPackage!: I.IRootPackage;

    private _pkgRoot!: string;

    private _pkgUtils: I.IPackageUtils;

    private _npm: I.INPMHelper;

    private _logs: I.ILogger;

    public constructor(private _root: string, verbose: number = 0) {

        I.loggerFactory.unmute(['error', 'info', 'warning']);

        switch (verbose) {
            case 0: break;
            default:
            case 4: I.loggerFactory.enableTrace(10);
            // eslint-disable-next-line no-fallthrough
            case 3: I.loggerFactory.unmute('debug3');
            // eslint-disable-next-line no-fallthrough
            case 2: I.loggerFactory.unmute('debug2');
            // eslint-disable-next-line no-fallthrough
            case 1: I.loggerFactory.unmute('debug1'); break;
        }

        this._logs = I.loggerFactory.createTextLogger('manager');

        this._fs = I.createFileUtility(I.loggerFactory.createTextLogger('fs'));

        this._pkgUtils = I.createPackageUtils(
            I.loggerFactory.createTextLogger('pkgutils'),
            this._fs
        );

        this._npm = I.createNPMHelper(
            I.loggerFactory.createTextLogger('npm'),
            this._root,
            this._fs
        );
    }

    public async release(opts: C.IReleaseOptions): Promise<void> {

        const cfg = this._rootPackage.ottoiaOptions.releases[opts.env];

        if (!cfg) {

            throw new E.E_RELEASE_CONFIG_NOT_FOUND({ metadata: { env: opts.env } });
        }

        this._logs.debug1(`Release to tag "${cfg.tag}".`);

        if (!opts.confirmed) {

            this._logs.warning(`Simulating releasing ${opts.env} version with "--dry-run"...`);
        }

        let version: string = opts.version;

        if (!version) {

            const pkgVersions = await this._npm.getCurrentVersionSet(
                Object.keys(this._packages),
                I.builtInCmpSemVersion,
                cfg.tag
            );

            if (Object.keys(pkgVersions).length) {

                /**
                 * Use the newest one if any package exists.
                 */
                version = Object.values(pkgVersions).sort(I.builtInCmpSemVersion).pop() as string;
            }
            else {

                /**
                 * Use a new version if none of package exists
                 */
                version = this._rootPackage.version;
            }

            const versioner = cfg.versioner ?
                require(this._fs.concatPath(this._root, cfg.versioner)).default as C.IVersionNamer :
                I.createBuiltInVersionNamer();

            version = versioner.next(
                version,
                opts.env,
                opts.withBreakingChanges,
                opts.withNewFeatures,
                opts.withPatches
            );
        }

        await this.clean();

        this._npm.chdir(this._root);

        this._rootPackage.version = version;

        this._logs.info(`Releasing the ${opts.env} version "v${version}"...`);

        try {

            this._logs.debug1('Backing up the package.json...');

            await this._createPackageJsonBackup();

            this._logs.debug1('Setting up dependency versions...');

            await this._setupDependencies(version);

            this._logs.debug1('Preparing packages...');

            await this._preparePackage();

            for (const pkgName in this._packages) {

                const pkg = this._packages[pkgName];

                if (pkg.noRelease) {

                    continue;
                }

                this._logs.info(`Publishing package "${pkgName}@${version}".`);

                this._npm.chdir(pkg.root);

                const extArgs: string[] = [`--tag=${cfg.tag}`];

                if (!opts.confirmed) {

                    this._logs.debug1('Simulating with "--dry-run".');

                    extArgs.push('--dry-run');
                }

                /**
                 * For the public package.
                 */
                if (!pkg.privateAccess) {

                    extArgs.push('--access=public');
                }

                this._logs.debug1(await this._npm.publish(extArgs));
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

        if (this._rootPackage.scripts['ottoia:prepublish']) {

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

        if (this._rootPackage.scripts['ottoia:prepare']) {

            await this._npm.run('ottoia:prepare', []);
        }
    }

    private _getDependencyVersion(depName: string, pkgName: string): string {

        const localPkg = this._packages[depName];

        if (localPkg) {

            if (localPkg.noRelease) {

                throw new E.E_PRIVATE_DEPENDENCY({
                    metadata: { package: pkgName, dependency: depName }
                });
            }

            return localPkg.version!;
        }

        if (!this._rootPackage.raw.dependencies[depName]) {

            throw new E.E_DEP_NOT_LOCKED({
                metadata: { package: pkgName, dependency: depName }
            });
        }

        return this._rootPackage.raw.dependencies[depName];
    }

    /**
     * Setup the dependencies of each package.
     */
    private async _setupDependencies(version: string): Promise<void> {

        for (const pkgName in this._packages) {

            const pkg = this._packages[pkgName];

            if (pkg.noRelease) {

                this._logs.debug1(`Skipped no-releasing package "${pkg.name}".`);
                continue;
            }

            pkg.raw.version = pkg.version = version;
        }

        for (const pkgName in this._packages) {

            const pkg = this._packages[pkgName];

            if (pkg.noRelease) {

                continue;
            }

            pkg.raw.version = pkg.version = version;

            for (const depName in pkg.raw.dependencies) {

                pkg.raw.dependencies[depName] = this._getDependencyVersion(depName, pkgName);
                this._logs.debug3(`Use "${depName}@${pkg.raw.dependencies[depName]}" for package "${pkg.name}".`);
            }

            for (const depName in pkg.raw.peerDependencies) {

                pkg.raw.peerDependencies[depName] = this._getDependencyVersion(depName, pkgName);
                this._logs.debug3(`Use "${depName}@${pkg.raw.dependencies[depName]}" for package "${pkg.name}".`);
            }

            for (const hookName of NPM_HOOKS) {

                if (pkg.raw.scripts?.[hookName]) {

                    this._logs.debug2(`Ignored NPM built-in hook script "${hookName}".`);
                    delete pkg.raw.scripts?.[hookName];
                }
            }

            await this._fs.writeFile(
                this._fs.concatPath(pkg.root, 'package.json'),
                JSON.stringify(pkg.raw, null, 2)
            );
        }
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

                throw new E.E_EXISTING_PACKAGE_JSON({ metadata: { path: PATH_TO_ROOT_JSON } });
            }
        }

        const rootJson = JSON.parse(await this._fs.readFile(PATH_TO_ROOT_JSON));

        const ottoiaProjectJSON = await this._fs.readJsonFile<I.INPMPackage>(`${__dirname}/../package.json`);

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

                this._rootPackage = await this._pkgUtils.readRoot(curPath);

                this._logs.debug1(`Detected package.json in "${curPath}"...`);
                this._root = curPath;
                break;
            }
            catch {

                const newPath = this._fs.concatPath(curPath, '..');

                if (newPath === curPath) {

                    throw new E.E_NO_ROOT_PACKAGE({ metadata: { cwd: this._root } });
                }

                curPath = newPath;
            }
        }

        this._pkgRoot = this._fs.concatPath(this._root, './packages');
        this._npm.chdir(this._root);
    }

    public async reload(): Promise<void> {

        const packages: Record<string, I.IPackage> = {};

        let pkgPathList: string[];

        const aliases: Record<string, string> = {};

        try {

            this._logs.debug1(`Scanning possible packages in path "${this._pkgRoot}"...`);

            pkgPathList = await this._pkgUtils.scan(this._pkgRoot);

        }
        catch {

            this._logs.debug1(`Failed to scan packages in "${this._pkgRoot}".`);

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

                        throw new E.E_DUP_PACKAGE_ALIAS({ metadata: {
                            alias: pkg.alias,
                            packages: [ pkg.name, aliases[pkg.alias] ]
                        } });
                    }

                    aliases[pkg.alias] = pkg.name;
                }
            }
            catch (e) {

                if (!E.errorRegistry.identify(e)) {

                    throw new E.E_INVALID_PACKAGE({ metadata: { path: p } });
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
            throw new E.E_PACKAGE_NOT_FOUND({ metadata: { name } });
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

                throw new E.E_PACKAGE_NOT_FOUND({ metadata: { alias: nameOrAlias } });
            }

            nameOrAlias = this._aliases[nameOrAlias];
        }

        this._logs.debug2(`Try using package name "${nameOrAlias}"...`);

        if (assert && !this._packages[nameOrAlias]) {

            this._logs.debug2(`Package "${nameOrAlias}" does not exist.`);

            throw new E.E_PACKAGE_NOT_FOUND({ metadata: { name: nameOrAlias } });
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

            throw new E.E_DUP_PACKAGE({ metadata: { name } });
        }

        if (aliasName && this._aliases[aliasName]) {

            this._logs.debug1(`Alias "${aliasName}" of sub package "${name}" already exists.`);

            throw new E.E_DUP_PACKAGE_ALIAS({
                metadata: {
                    alias: aliasName,
                    packages: [ this._aliases[aliasName] ]
                }
            });
        }

        const pkg = await this._pkgUtils.create({

            root: this._pkgRoot,
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

            throw new E.E_UNKNOWN_SUB_PACKAGE({ metadata: { packages: unkPkgs } });
        }
    }

    public async install(
        deps: string[],
        pkgNames: string[],
        isPeer: boolean = false,
        isDev: boolean = false,
        depPath: string[] = [],
        noSave: boolean = false,
        noBootStrap: boolean = false
    ): Promise<void> {

        deps = deps.map((v) => v.toLowerCase());

        if (!deps.length) {

            return;
        }

        pkgNames = pkgNames.map((v) => v.toLowerCase());

        if (!noSave) {

            await this._createPackageJsonBackup();
        }

        if (pkgNames.length) {

            this._logs.debug1('Installing to determined sub packages...');
            this._checkPackages(pkgNames);
        }
        else {

            this._logs.debug1('Installing to all sub packages...');
            pkgNames = Object.keys(this._packages);
        }

        const pkgs: Record<string, I.IPackage> = {};

        for (const p of pkgNames) {

            pkgs[p] = this._getPackage(p, true);
        }

        const REMOTE_DEPS = deps.filter((v) => this._pkgUtils.isValidDependencyName(v) && !this._getPackage(v, false));
        const LOCAL_DEPS = deps.filter((v) => !!this._getPackage(v, false));

        if (REMOTE_DEPS.length + LOCAL_DEPS.length !== deps.length) {

            throw new E.E_INVALID_PACKAGE_NAME({
                metadata: { deps: deps.filter((v) => !REMOTE_DEPS.includes(v) && !LOCAL_DEPS.includes(v)) }
            });
        }

        this._npm.chdir(this._root);

        try {

            if (REMOTE_DEPS.length) {

                this._logs.debug1(`Installing ${REMOTE_DEPS.length} remote dependencies...`);

                await this._npm.install(REMOTE_DEPS, false, isDev);

                for (const depName of REMOTE_DEPS) {

                    for (const pkgName of pkgNames) {

                        const pkg = pkgs[pkgName];

                        this._logs.debug1(`Installed "${depName}" to sub package "${pkg.name}".`);

                        delete pkg.peerDependencies[depName];
                        delete pkg.devDependencies[depName];
                        delete pkg.dependencies[depName];

                        /**
                         * If --development is specified, only root package.json will be written in.
                         */
                        if (!isDev) {

                            if (isPeer) {

                                pkg.peerDependencies[depName] = DEP_VER_PLACE_HOLDER;
                            }
                            else  {

                                pkg.dependencies[depName] = DEP_VER_PLACE_HOLDER;
                            }
                        }
                    }
                }
            }

            if (LOCAL_DEPS.length) {

                this._logs.debug1(`Installing ${LOCAL_DEPS.length} local dependencies...`);

                for (const depName of LOCAL_DEPS) {

                    const dep = this._getPackage(depName, true);

                    for (const pkgName of pkgNames) {

                        const pkg = pkgs[pkgName];

                        if (dep.name === pkg.name) {

                            this._logs.debug1(`Not installed "${depName}" to itself.`);
                            continue;
                        }

                        this._logs.debug1(`Installed "${depName}" to sub package "${pkg.name}".`);

                        if (
                            dep.dependencies[pkg.name]
                            || dep.devDependencies[pkg.name]
                            || dep.peerDependencies[pkg.name]
                            || depPath.includes(dep.name)
                        ) {

                            throw new E.E_RECURSIVE_DEP({ metadata: { package: pkg.name, dependency: dep.name } });
                        }

                        if (!noSave) {

                            delete pkg.devDependencies[dep.name];
                            delete pkg.dependencies[dep.name];
                            delete pkg.peerDependencies[dep.name];

                            if (isPeer) {

                                pkg.peerDependencies[dep.name] = DEP_VER_PLACE_HOLDER;
                            }
                            else if (isDev) {

                                pkg.devDependencies[dep.name] = DEP_VER_PLACE_HOLDER;
                            }
                            else {

                                pkg.dependencies[dep.name] = DEP_VER_PLACE_HOLDER;
                            }
                        }

                        this._npm.chdir(pkg.root);

                        /**
                         * Install the indirected dependencies of the new installed dependencies.
                         */
                        const indirectLocalDeps = this._extractLocalDeps(dep, true);

                        if (indirectLocalDeps.length) {

                            this._logs.debug1(`Installing indirect local dependencies of "${dep.name}" to sub package "${pkg.name}".`);

                            await this.install(indirectLocalDeps, [pkg.name], false, false, [...depPath, pkg.name], true, true);
                        }

                        await this._npm.link(dep.name, dep.root);
                    }
                }
            }

            for (const pkgName of pkgNames) {

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
                 * Unrefer the dependency to the sub packages.
                 */
                this._depCounters.remove(pkgName, deps);
            }
        }

        /**
         * Get the reference map of all dependencies of all sub projects.
         */
        let remoteDepsMap = this._depCounters.generateMap();

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

        const explicitDepRefs = this._depCounters.generateMap();

        /**
         * Only the explicit dependencies should be uninstalled.
         */
        const REMOTE_DEPS = deps.filter((v) => this._pkgUtils.isValidDependencyName(v) && !this._getPackage(v, false)).filter((v) => !!explicitDepRefs[v]);
        const LOCAL_DEPS = deps.map((v) => this._getPackage(v, false)?.name).filter((v) => v && !!explicitDepRefs[v]);

        if (REMOTE_DEPS.length + LOCAL_DEPS.length !== deps.length) {

            throw new E.E_INVALID_PACKAGE_NAME({
                metadata: { deps: deps.filter((v) => !REMOTE_DEPS.includes(v) && !LOCAL_DEPS.includes(v)) }
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

            this._logs.debug1(`Executing NPM script "clean" for sub package "${pkg.name}"...`);

            await this._npm.run('clean', []);
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

        if (this._rootPackage.scripts['ottoia:clean']) {

            this._npm.chdir(this._root);

            this._logs.debug1('Executing NPM script "ottoia:clean" for root package...');

            await this._npm.run('ottoia:clean', []);
        }
        else if (this._rootPackage.scripts['clean']) {

            this._npm.chdir(this._root);

            this._logs.debug1('Executing NPM script "clean" for root package...');

            await this._npm.run('clean', []);
        }

        if (full) {

            this._logs.debug1('Removing "node_modules" for root package...');

            await this._fs.execAt(this._root, 'rm', '-rf', 'node_modules');
        }
    }

    public async bootstrap(): Promise<void> {

        this._npm.chdir(this._root);

        await this._npm.bootstrap();

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

        const deps = [...Object.keys(pkg.dependencies)];
        if (!productionOnly) {

            deps.push(...Object.keys(pkg.dependencies), ...Object.keys(pkg.peerDependencies));
        }

        return Array.from(new Set(deps));
    }
}

export function createManager(root: string, verbose?: number): C.IManager {

    return new OttoiaManager(root, verbose);
}
