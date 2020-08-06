import * as C from '../Common';

export interface INPMPackage {

    'name': string;

    'ottoia:alias'?: string;

    'description': string;

    'version': string;

    'ottoia'?: boolean;

    'private'?: boolean;

    'scripts'?: Record<string, string>;

    'dependencies': Record<string, string>;

    'devDependencies': Record<string, string>;

    'peerDependencies': Record<string, string>;
}

export interface IPackage extends C.IPackage {

    root: string;

    version?: string;

    raw: INPMPackage;
}

export interface INPMHelper {

    chdir(cwd: string): void;

    bootstrap(): Promise<void>;

    install(dependencies: string[], peer?: boolean, dev?: boolean): Promise<void>;

    run(cmdName: string, ...args: any[]): Promise<void>;

    uninstall(dependencies: string[]): Promise<void>;

    link(pkgName: string, path: string): Promise<void>;

    unlink(pkgName: string): Promise<void>;

    init(): Promise<void>;

    /**
     * Check if a package exists in the online repository.
     */
    exists(name: string): Promise<boolean>;
}

export interface IMasterPackage extends IPackage {

    version: string;
}

export interface IPackageScanner {

    scan(root: string): Promise<string[]>;
}

export interface IFileUtils {

    execAt(cwd: string, cmd: string, ...args: string[]): Promise<void>;

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

    isPrivate: boolean;

    templateFile?: string;

    dirName?: string;

    alias?: string;
}

export interface IPackageUtils {

    save(pkg: IPackage): Promise<IPackage>;

    create(opts?: IPackageOptions): Promise<IPackage>;

    readMaster(path: string): Promise<IMasterPackage>;

    read(path: string): Promise<IPackage>;

    scan(root: string): Promise<string[]>;
}

export interface IDependencyCounter {

    add(pkgName: string, deps: string[]): void;

    remove(pkgName: string, deps: string[]): void;

    isDependingOn(dep: string, pkgName?: string): boolean;

    generateMap(pkgName?: string): Record<string, number>;
}
