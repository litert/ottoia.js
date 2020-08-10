import * as C from '../Common';

export interface IReleaseOptions {

    tag: string;

    versioner?: string;

    registry?: string;
}

export interface IPackageOttoiaOptions {

    releases: Record<string, IReleaseOptions>;
}

export interface INPMPackage {

    'name': string;

    'ottoia:alias'?: string;

    'description': string;

    'version': string;

    'ottoia'?: IPackageOttoiaOptions;

    'private'?: boolean;

    'scripts'?: Record<string, string>;

    'dependencies': Record<string, string>;

    'access'?: 'public' | 'private';

    'devDependencies': Record<string, string>;

    'peerDependencies': Record<string, string>;
}

export interface IPackage extends C.IPackage {

    root: string;

    version?: string;

    raw: INPMPackage;
}

export interface INPMHelper {

    close(): void;

    getCurrentVersion(name: string, comparer?: C.IVersionComparer, tag?: string): Promise<string>;

    getCurrentVersionSet(names: string[], comparer?: C.IVersionComparer, tag?: string): Promise<Record<string, string>>;

    chdir(cwd: string): void;

    bootstrap(): Promise<void>;

    install(dependencies: string[], peer?: boolean, dev?: boolean): Promise<void>;

    run(cmdName: string, args: any[]): Promise<string>;

    publish(args: any[]): Promise<string>;

    uninstall(dependencies: string[]): Promise<void>;

    link(pkgName: string, path: string): Promise<void>;

    unlink(pkgName: string): Promise<void>;

    init(): Promise<void>;

    /**
     * Check if a package exists in the online repository.
     */
    exists(name: string): Promise<boolean>;
}

export interface IRootPackage extends IPackage {

    version: string;

    ottoiaOptions: IPackageOttoiaOptions;
}

export interface IPackageScanner {

    scan(root: string): Promise<string[]>;
}

export interface IFileUtils {

    execAt(cwd: string, cmd: string, ...args: string[]): Promise<string>;

    concatPath(...segs: string[]): string;

    removeFile(path: string): Promise<void>;

    extractPath(path: string): [string, string];

    readDir(path: string): Promise<string[]>;

    exists(path: string): Promise<boolean>;

    existsFile(path: string): Promise<boolean>;

    existsLink(path: string): Promise<boolean>;

    existsDir(path: string): Promise<boolean>;

    mkdirP(path: string): Promise<void>;

    readFile(path: string): Promise<string>;

    readJsonFile<T>(path: string): Promise<T>;

    copyFile(src: string, dst: string): Promise<void>;

    writeFile(path: string, content: string): Promise<void>;
}

export interface IPackageOptions {

    root: string;

    name: string;

    noRelease: boolean;

    privateAccess: boolean;

    templateFile?: string;

    dirName?: string;

    alias?: string;
}

export interface IPackageUtils {

    save(pkg: IPackage): Promise<IPackage>;

    create(opts?: IPackageOptions): Promise<IPackage>;

    readRoot(path: string): Promise<IRootPackage>;

    read(path: string): Promise<IPackage>;

    scan(root: string): Promise<string[]>;
}

export interface IDependencyCounter {

    add(pkgName: string, deps: string[]): void;

    remove(pkgName: string, deps: string[]): void;

    isDependingOn(dep: string, pkgName?: string): boolean;

    generateMap(pkgName?: string): Record<string, number>;
}

export function builtInCmpSemVersion(x: string, y: string): number {

    const a = x.split('.').map((v) => parseInt(v));
    const b = y.split('.').map((v) => parseInt(v));

    if (a.length !== b.length) {
        [a, b].sort((x, y) => x.length - y.length)[0].push(...Array(Math.abs(a.length - b.length)).fill(0));
    }

    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) {
            return a[i] - b[i];
        }
    }

    return 0;
}
