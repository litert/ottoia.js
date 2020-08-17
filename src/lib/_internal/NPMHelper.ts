import * as L from '@litert/core';
import * as I from './Internal';
import * as C from '../Common';
import * as E from '../Errors';
import * as $Http from '@litert/http-client';

class NPMHelper implements I.INPMHelper {

    private _hCli = $Http.createHttpClient();

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

    public async install(dependencies: string[], peer?: boolean, dev?: boolean): Promise<void> {

        if (!dependencies.length) {

            return;
        }

        dependencies = dependencies.slice();

        if (peer) {

            this._logs.debug2('Installing peer dependencies...');
            dependencies.push('--peer');
        }

        if (dev) {

            this._logs.debug2('Installing development dependencies...');
            dependencies.push('--save-dev');
        }

        await this._fs.execAt(this._cwd, 'npm', 'install', ...dependencies);
    }

    public async getCurrentVersionSet(
        names: string[],
        comparer?: C.IVersionComparer,
        tag?: string
    ): Promise<Record<string, string>> {

        const results = await L.Async.multiTasks(names.map((v) => this.getCurrentVersion(v, comparer, tag)));

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

    public async run(cmdName: string, args: any[]): Promise<string> {

        return await this._fs.execAt(this._cwd, 'npm', 'run', cmdName, ...args);
    }

    public async publish(args: any[]): Promise<string> {

        return await this._fs.execAt(this._cwd, 'npm', 'publish', ...args);
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
            url: `https://registry.npmjs.com/${pkgName}`,
            method: 'GET',
            'gzip': false,
            version: 1.1
        });

        if (hReq.statusCode !== 200) {

            if (hReq.statusCode === 404) {

                this._logs.debug3(`Package "${pkgName}" is not published yet.`);
                throw new E.E_PACKAGE_NOT_RELEASED({ metadata: { package: pkgName }  });
            }

            throw new E.E_NPM_ERROR();
        }

        const data = JSON.parse((await hReq.getBuffer()).toString())['dist-tags'] as Record<string, string>;

        if (data[tag]) {

            this._logs.debug3(`Found package "${pkgName}@${data[tag]}".`);
            return data[tag];
        }

        const ret = Object.values(data).sort(comparer).reverse()[0];

        this._logs.debug3(`Found package "${pkgName}@${ret}".`);

        return ret;
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
