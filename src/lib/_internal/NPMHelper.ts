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

import * as I from './Internal';
import * as C from '../Common';
import * as E from '../Errors';
import * as $AsyncUtils from './AsyncUtils';
import * as $Http from '@litert/http-client';

class NPMHelper implements I.INPMHelper {

    private readonly _hCli = $Http.createHttpClient();

    public constructor(
        private readonly _logs: I.ILogger,
        private _cwd: string,
        private readonly _fs: I.IFileUtils
    ) { }

    public chdir(cwd: string): void {

        this._cwd = cwd;
    }

    public async init(): Promise<void> {

        await this._fs.execAt(this._cwd, 'npm', 'init', '--yes');
    }

    public async exists(name: string): Promise<boolean> {

        try {

            await this._fs.execAt(this._cwd, 'npm', 'info', name);
        }
        catch {

            return false;
        }

        return true;
    }

    public async bootstrap(): Promise<void> {

        await this._fs.execAt(this._cwd, 'npm', 'install');
    }

    public async bootstrapCI(): Promise<void> {

        await this._fs.execAt(this._cwd, 'npm', 'ci');
    }

    public async install(dependencies: I.IDependency[], peer?: boolean, dev?: boolean): Promise<void> {

        if (!dependencies.length) {

            return;
        }

        const args: string[] = dependencies.slice().map((v) => v.expr);

        if (peer) {

            this._logs.debug2('Installing peer dependencies...');
            args.push('--peer');
        }

        if (dev) {

            this._logs.debug2('Installing development dependencies...');
            args.push('--save-dev');
        }

        await this._fs.execAt(this._cwd, 'npm', 'install', ...args);
    }

    public async getCurrentVersionSet(
        names: string[],
        comparer?: C.IVersionComparer,
        tag?: string
    ): Promise<Record<string, string>> {

        const results = await $AsyncUtils.multiTasks(names.map((v) => this.getCurrentVersion(v, comparer, tag)));

        const ret: Record<string, string> = {};

        for (let i = 0; i < names.length; i++) {

            const item = results[i];

            if (item.success) {

                ret[names[i]] = item.result;
                continue;
            }

            if (item.result instanceof E.E_PACKAGE_NOT_RELEASED) {

                continue;
            }

            throw item.result;
        }

        return ret;
    }

    public async run(cmdName: string): Promise<string> {

        const cmd = (await this._fs.readJsonFile(`${this._cwd}/package.json`) as any).scripts[cmdName];

        const ret = await this._fs.execAt(this._cwd, 'bash', '-c', cmd);

        return `${ret.stderr}\n${ret.stdout}`;
    }

    public async publish(args: any[]): Promise<string> {

        const ret = await this._fs.execAt(this._cwd, 'npm', 'publish', ...args);

        return `${ret.stderr}\n${ret.stdout}`;
    }

    public async unpublish(args: any[]): Promise<string> {

        const ret = await this._fs.execAt(this._cwd, 'npm', 'unpublish', ...args);

        return `${ret.stderr}\n${ret.stdout}`;
    }

    public close(): void {

        this._hCli.close();
    }

    public async getCurrentVersion(
        pkgName: string,
        comparer: C.IVersionComparer = I.builtInCmpSemVersion,
        tag: string = 'latest'
    ): Promise<string> {

        const hReq = await this._hCli.request({
            'url': `https://registry.npmjs.com/${pkgName}`,
            'method': 'GET',
            'version': 1.1,
            'keepAlive': false,
            'gzip': false
        });

        if (hReq.statusCode !== 200) {

            if (hReq.statusCode === 404) {

                this._logs.debug3(`Package "${pkgName}" is not published yet.`);
                throw new E.E_PACKAGE_NOT_RELEASED({ package: pkgName });
            }

            throw new E.E_NPM_ERROR();
        }

        const data = JSON.parse((await hReq.getBuffer()).toString())['dist-tags'] as Record<string, string>;

        if (data[tag]) {

            this._logs.debug3(`Found package "${pkgName}@${data[tag]}".`);
            return data[tag];
        }

        const ret = Object.entries(data).sort((a, b) => comparer(a[1], b[1])).reverse()[0];

        this._logs.debug3(`Found and select package "${pkgName}@${ret[0]}:v${ret[1]}".`);

        return ret[1];
    }

    public async uninstall(dependencies: string[], peer?: boolean, dev?: boolean): Promise<void> {

        if (!dependencies.length) {

            return;
        }

        dependencies = dependencies.slice();

        if (peer) {

            dependencies.push('--peer');
        }

        if (dev) {

            dependencies.push('-D');
        }

        await this._fs.execAt(this._cwd, 'npm', 'un', ...dependencies);
    }

    public async link(pkgName: string, path: string): Promise<void> {

        await this._fs.mkdirP(this._fs.concatPath(this._cwd, 'node_modules'));

        const pkgParentPath = pkgName.split('/').slice(0, -1).join('/');

        if (pkgParentPath) {

            await this._fs.mkdirP(this._fs.concatPath(this._cwd, 'node_modules', pkgParentPath));
        }

        const PATH_TO_LINK = this._fs.concatPath(this._cwd, 'node_modules', pkgName);

        if (!await this._fs.exists(PATH_TO_LINK)) {

            await this._fs.execAt(this._cwd, 'ln', '-s', path, PATH_TO_LINK);
        }
    }

    public async unlink(pkgName: string): Promise<void> {

        const PATH_TO_LINK = this._fs.concatPath(this._cwd, 'node_modules', pkgName);

        if (await this._fs.exists(PATH_TO_LINK)) {

            await this._fs.removeFile(PATH_TO_LINK);
        }
    }
}

export function createNPMHelper(logs: I.ILogger, cwd: string, fs: I.IFileUtils): I.INPMHelper {

    return new NPMHelper(logs, cwd, fs);
}
