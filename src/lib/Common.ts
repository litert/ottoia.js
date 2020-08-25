export interface IPackage {

    name: string;

    alias?: string;

    privateAccess: boolean;

    /**
     * No releasing versions online.
     */
    noRelease: boolean;

    scripts: Record<string, string>;

    dependencies: Record<string, string>;

    devDependencies: Record<string, string>;

    peerDependencies: Record<string, string>;
}

export interface IReleaseOptions {

    env: string;

    withBreakingChanges: boolean;

    withNewFeatures: boolean;

    withPatches: boolean;

    confirmed: boolean;
}

export type IVersionComparer = (a: string, b: string) => number;

export interface IManager {

    runCommand(
        pkgs: string[],
        cmd: string,
        args: string[],
        allowRoot?: boolean,
        rootOnly?: boolean
    ): Promise<void>;

    initialize(ensured?: boolean): Promise<void>;

    ensureRootPackagePath(): Promise<void>;

    reload(): Promise<void>;

    release(opts: IReleaseOptions): Promise<void>;

    getPackage(name: string): IPackage;

    getPackageNames(): string[];

    createPackage(
        name: string,
        tplFile?: string,
        noRelease?: boolean,
        privateAccess?: boolean,
        dirName?: string,
        aliasName?: string
    ): Promise<void>;

    install(deps: string[], to: string[], peer?: boolean, dev?: boolean): Promise<void>;

    uninstall(deps: string[], from: string[]): Promise<void>;

    clean(project?: string[], completely?: boolean): Promise<void>;

    bootstrap(): Promise<void>;

    // publish(
    //     packages: string[],
    //     tag: string
    // ): Promise<void>;

    // increaseVersion(
    //     packages: string[],
    //     mode: 'major' | 'minor' | 'patch' | 'pre-release'
    // ): Promise<void>;

    // executeCommand(
    //     command: string,
    //     packages: string[]
    // ): Promise<void>;
}

export interface IVersionNamer {

    next(
        current: string,
        env: string,
        withBreakingChanges: boolean,
        withNewFeatures: boolean,
        withPatches: boolean,
    ): string;
}
