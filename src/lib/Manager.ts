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

    public constructor(private _root: string) {

        this._fs = I.createFileUtility();
        this._pkgUtils = I.createPackageUtils(this._fs);
        this._npm = I.createNPMHelper(this._root, this._fs);
    }

    public async release(opts: C.IReleaseOptions): Promise<void> {

        const cfg = this._rootPackage.ottoiaOptions.releases[opts.env];

        if (!cfg) {

            throw new E.E_RELEASE_CONFIG_NOT_FOUND({ metadata: { env: opts.env } });
        }

        if (!opts.confirmed) {

            console.log(`Simulating releasing ${opts.env} version with "--dry-run"...`);
        }

        let version: string;

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
            version = '0.0.0';
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

        console.log(`Releasing the ${opts.env} version "v${version}"...`);

        try {

            await this._backupPackageJson();

            await this._setupDependencies(version);

            for (const pkgName in this._packages) {

                const pkg = this._packages[pkgName];

                if (pkg.noRelease) {

                    continue;
                }

                this._npm.chdir(pkg.root);

                console.log(`Preparing package "${pkgName}".`);

                if (pkg.scripts['ottoia:prepublish']) {

                    console.log('Executing ottoia hook "ottoia:prepublish".');
                    await this._npm.run('ottoia:prepublish', []);
                }
            }

            for (const pkgName in this._packages) {

                const pkg = this._packages[pkgName];

                if (pkg.noRelease) {

                    continue;
                }

                console.log(`Publishing package "${pkgName}@${version}".`);

                this._npm.chdir(pkg.root);

                const extArgs: string[] = [];

                if (!opts.confirmed) {

                    extArgs.push('--dry-run');
                }

                /**
                 * For the first release of this public package.
                 */
                if (!pkgVersions[pkgName] && !pkg.privateAccess) {

                    extArgs.push('--access=public');
                }

                await this._npm.publish(extArgs);
            }

            for (const pkgName in this._packages) {

                const pkg = this._packages[pkgName];

                if (pkg.noRelease) {

                    continue;
                }

                this._npm.chdir(pkg.root);

                if (pkg.scripts['ottoia:postpublish']) {

                    console.log('Executing ottoia hook "ottoia:postpublish".');
                    await this._npm.run('ottoia:postpublish', []);
                }
            }
        }
        finally {

            this._npm.close();

            await this._cleanPackageJsonBackup();
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

            return `^${localPkg.version}`;
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
            }

            for (const depName in pkg.raw.peerDependencies) {

                pkg.raw.peerDependencies[depName] = this._getDependencyVersion(depName, pkgName);
            }

            for (const hookName of NPM_HOOKS) {

                if (pkg.raw.scripts?.[hookName]) {

                    console.warn(`Ignored NPM built-in hook script "${hookName}".`);
                    delete pkg.raw.scripts?.[hookName];
                }
            }

            await this._fs.writeFile(
                this._fs.concatPath(pkg.root, 'package.json'),
                JSON.stringify(pkg.raw)
            );
        }
    }

    private async _backupPackageJson(): Promise<void> {

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

            await this._fs.removeFile(bakFile);
        }
    }

    public async run(pkgs: string[], cmd: string, args: string[]): Promise<void> {

        pkgs = pkgs.map((v) => v.toLowerCase());

        if (pkgs.length) {

            this._checkPackages(pkgs);
        }
        else {

            pkgs = Object.keys(this._packages);
        }

        for (const pkgName of pkgs) {

            const pkg = this._getPackage(pkgName, false);

            if (!pkg.scripts[cmd]) {

                console.warn(`Command not found in package "${pkg.name}".`);
                continue;
            }

            this._npm.chdir(pkg.root);

            console.log(await this._npm.run(cmd, args));
        }
    }

    public async initialize(ensured?: boolean): Promise<void> {

        const PATH_TO_ROOT_JSON = this._fs.concatPath(this._root, 'package.json');

        let newJson = false;

        if (!await this._fs.existsFile(PATH_TO_ROOT_JSON)) {

            newJson = true;

            await this._npm.init();
        }
        else if (!ensured) {

            throw new E.E_EXISTING_PACKAGE_JSON({ metadata: { path: PATH_TO_ROOT_JSON } });
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

        await this._fs.writeFile(PATH_TO_ROOT_JSON, JSON.stringify(rootJson, null, 2));

        await this._fs.mkdirP(this._fs.concatPath(this._root, 'packages'));

        const GIT_IGNORE_PATH = this._fs.concatPath(this._root, '.gitignore');

        if (await this._fs.existsFile(GIT_IGNORE_PATH)) {

            const GIT_IGNORE_CONTENT = await this._fs.readFile(GIT_IGNORE_PATH);
            if (!GIT_IGNORE_CONTENT.includes('.ottoia')) {

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

                this._rootPackage = await this._pkgUtils.readRoot(curPath);

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

            pkgPathList = await this._pkgUtils.scan(this._pkgRoot);
        }
        catch {

            pkgPathList = [];
        }

        for (const p of pkgPathList) {

            try {

                const pkg = await this._pkgUtils.read(p);

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

                if (!E.errors.is(e)) {

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

            if (!this._aliases[nameOrAlias]) {

                if (!assert) {

                    return this._packages['?'];
                }

                throw new E.E_PACKAGE_NOT_FOUND({ metadata: { alias: nameOrAlias } });
            }

            nameOrAlias = this._aliases[nameOrAlias];
        }

        if (assert && !this._packages[nameOrAlias]) {

            throw new E.E_PACKAGE_NOT_FOUND({ metadata: { name: nameOrAlias } });
        }

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

        aliasName = aliasName?.toLowerCase();

        if (this._packages[name]) {

            throw new E.E_INVALID_PACKAGE({ metadata: { name } });
        }

        if (aliasName && this._aliases[aliasName]) {

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
        pkgs: string[],
        isPeer: boolean = false,
        isDev: boolean = false,
        depPath: string[] = [],
        noSave: boolean = false,
        noBootStrap: boolean = false
    ): Promise<void> {

        deps = deps.map((v) => v.toLowerCase());
        pkgs = pkgs.map((v) => v.toLowerCase());

        if (pkgs.length) {

            this._checkPackages(pkgs);
        }
        else {

            pkgs = Object.keys(this._packages);
        }

        const REMOTE_DEPS = deps.filter((v) => !this._getPackage(v, false));
        const LOCAL_DEPS = deps.filter((v) => !!this._getPackage(v, false));

        this._npm.chdir(this._root);

        await this._npm.install(REMOTE_DEPS);

        for (const depName of REMOTE_DEPS) {

            for (const pkgName of pkgs) {

                const pkg = this._getPackage(pkgName, true);

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

        for (const depName of LOCAL_DEPS) {

            const dep = this._getPackage(depName, true);

            for (const pkgName of pkgs) {

                const pkg = this._getPackage(pkgName, true);

                if (dep.name === pkg.name) {

                    continue;
                }

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

                    await this.install(indirectLocalDeps, [pkg.name], false, false, [...depPath, pkg.name], true, noBootStrap);
                }

                await this._npm.link(dep.name, dep.root);
            }
        }

        for (const pkgName of pkgs) {

            await this._pkgUtils.save(this._getPackage(pkgName, true));
        }

        /**
         * Install the new local dependencies for dependents.
         */
        if (LOCAL_DEPS.length && !noBootStrap) {

            await this._bootstrapLocal();
        }
    }

    private async _uninstallRemoteDeps(deps: string[], pkgs: string[]): Promise<void> {

        for (const depName of deps) {

            for (const pkgName of pkgs) {

                const pkg = this._getPackage(pkgName, true);

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
        const remoteDeps = deps.filter((v) => !this._getPackage(v, false)).filter((v) => !!explicitDepRefs[v]);
        const localDeps = deps.map((v) => this._getPackage(v, false)?.name).filter((v) => v && !!explicitDepRefs[v]);

        pkgs = pkgs.map((v) => this._getPackage(v, true).name);

        if (pkgs.length) {

            this._checkPackages(pkgs);
        }
        else {

            pkgs = Object.keys(this._packages);
        }

        await this._uninstallRemoteDeps(remoteDeps, pkgs);

        await this._uninstallLocalDeps(localDeps, pkgs);

        for (const p of pkgs) {

            await this._pkgUtils.save(this._getPackage(p, false));
        }
    }

    private async _cleanLocalPackageNodeModules(): Promise<void> {

        for (const pkgName of Object.keys(this._packages)) {

            const pkg = this._packages[pkgName];

            await this._fs.execAt(pkg.root, 'rm', '-rf', 'node_modules');
        }

    }

    public async clean(packages: string[] = [], full: boolean = false): Promise<void> {

        if (packages.length) {

            this._checkPackages(packages);
        }
        else {

            packages = Object.keys(this._packages);
        }

        for (const pkgName of packages) {

            const pkg = this._getPackage(pkgName, true);

            if (pkg.scripts['clean']) {

                this._npm.chdir(pkg.root);

                await this._npm.run('clean', []);
            }

            if (full) {

                await this._fs.execAt(pkg.root, 'rm', '-rf', 'node_modules');
            }
        }

        if (this._rootPackage.scripts['ottoia:clean']) {

            this._npm.chdir(this._root);

            await this._npm.run('ottoia:clean', []);
        }

        if (full) {

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

export function createManager(root: string): C.IManager {

    return new OttoiaManager(root);
}
