import * as I from './Internal';

class NPMHelper implements I.INPMHelper {

    public constructor(private _cwd: string, private _fs: I.IFileUtils) { }

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

            dependencies.push('--peer');
        }

        if (dev) {

            dependencies.push('--save-dev');
        }

        await this._fs.execAt(this._cwd, 'npm', 'install', ...dependencies);
    }

    public async run(cmdName: string, ...args: any[]): Promise<void> {

        await this._fs.execAt(this._cwd, 'npm', 'run', cmdName, ...args);
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

export function createNPMHelper(cwd: string, fs: I.IFileUtils): I.INPMHelper {

    return new NPMHelper(cwd, fs);
}
