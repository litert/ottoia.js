/**
 * Copyright 2023 Angus.Fenying <fenying@litert.org>
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

export interface IRecallOptions {

    release: string;

    version: string;

    confirmed: boolean;
}

export interface IDeprecateOptions {

    scope: string;

    message: string;
}

export interface IReleaseOptions {

    env: string;

    version: string;

    withBreakingChanges: boolean;

    withNewFeatures: boolean;

    withPatches: boolean;

    noClean: boolean;

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

    recall(opts: IRecallOptions): Promise<void>;

    deprecate(opts: IDeprecateOptions): Promise<void>;

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

    bootstrap(noInstall: boolean, useCI: boolean): Promise<void>;

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
