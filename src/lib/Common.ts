export interface IPackage {

    name: string;

    alias?: string;

    isPrivate: boolean;

    scripts: Record<string, string>;

    dependencies: Record<string, string>;

    devDependencies: Record<string, string>;

    peerDependencies: Record<string, string>;
}

export interface IManager {

    initialize(ensured?: boolean): Promise<void>;

    ensureMasterPackageRoot(): Promise<void>;

    reload(): Promise<void>;

    getPackage(name: string): IPackage;

    getPackageNames(): string[];

    createPackage(
        name: string,
        tplFile?: string,
        isPrivate?: boolean,
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
