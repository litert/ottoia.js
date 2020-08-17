import * as L from '@litert/core';
import * as I from './Internal';
import * as E from '../Errors';
import { promises as $FS } from 'fs';
import * as $Path from 'path';
import * as $ChildProcess from 'child_process';

class FileUtils implements I.IFileUtils {

    private _cmdId = Date.now();

    public constructor(private _logs: I.ILogger) {}

    private async _exec(cmd: string): Promise<string | L.IError> {

        return new Promise((resolve, reject) => {

            $ChildProcess.exec(cmd, (error, stdout, stderr) => {

                if (error) {

                    return reject(error);
                }

                resolve(stdout ? stdout : stderr ? new E.E_SHELL_FAILED({ metadata: { stderr } }) : stdout);
            });
        });
    }

    public async execAt(cwd: string, cmd: string, ...args: string[]): Promise<string> {

        const CMD_ID = this._cmdId++;

        const oldCWD = process.cwd();

        const cmdline = [cmd, ...args].map((v) => v.includes(' ') ? `"${v}"` : v).join(' ');

        this._logs.debug3(`Command[${CMD_ID}]: Created - ${cmdline}`);

        if (!await this.existsDir(cwd)) {

            this._logs.debug3(`Command[${CMD_ID}]: CWD ${cwd} does not exist.`);

            throw new E.E_INVALID_PATH({ metadata: { path: cwd } });
        }

        try {

            process.chdir(cwd);

            this._logs.debug3(`Command[${CMD_ID}]: CWD switched from "${oldCWD}" to "${cwd}".`);

            const result = await this._exec(cmdline);

            if (typeof result !== 'string') {

                this._logs.debug3(`Command[${CMD_ID}]: ${result}.`);

                throw result;
            }

            this._logs.debug3(`Command[${CMD_ID}]: OK.`);

            return result;
        }
        finally {

            process.chdir(oldCWD);
        }

    }

    public async removeFile(path: string): Promise<void> {

        this._logs.debug3(`Removing file "${path}".`);

        await $FS.unlink(path);
    }

    public concatPath(...segs: string[]): string {

        return $Path.resolve(...segs);
    }

    public extractPath(path: string): [string, string] {

        path = $Path.resolve(path);

        return [$Path.dirname(path), $Path.basename(path)];
    }

    public async copyFile(src: string, dst: string): Promise<void> {

        this._logs.debug3(`Copying "${src}" to "${dst}".`);

        await $FS.copyFile(src, dst);
    }

    public async writeFile(file: string, content: string): Promise<void> {

        this._logs.debug3(`Writting to file "${file}".`);

        await $FS.writeFile(file, content);
    }

    public async readFile(file: string): Promise<string> {

        this._logs.debug3(`Reading from file "${file}".`);

        return await $FS.readFile(file, {encoding: 'utf8'});
    }

    public async readJsonFile<T>(file: string): Promise<T> {

        const text = await this.readFile(file);

        try {

            return JSON.parse(text);
        }
        catch {

            throw new E.E_INVALID_JSON_FILE({ metadata: { file } });
        }
    }

    public async mkdirP(path: string): Promise<void> {

        this._logs.debug3(`Try creating directory "${path}".`);

        await $FS.mkdir(path, { recursive: true });
    }

    public async exists(path: string): Promise<boolean> {

        try {

            await $FS.stat(path);

            return true;
        }
        catch {

            return false;
        }
    }

    public async existsFile(path: string): Promise<boolean> {

        try {

            return (await $FS.stat(path)).isFile();
        }
        catch {

            return false;
        }
    }

    public async existsLink(path: string): Promise<boolean> {

        try {

            return (await $FS.stat(path)).isSymbolicLink();
        }
        catch {

            return false;
        }
    }

    public async existsDir(path: string): Promise<boolean> {

        try {

            return (await $FS.stat(path)).isDirectory();
        }
        catch {

            return false;
        }
    }

    public async readDir(path: string): Promise<string[]> {

        this._logs.debug3(`Reading directory "${path}".`);

        return (await $FS.readdir(path)).filter(
            (v) => v !== '.' && v !== '..'
        ).map(
            (v) => $Path.resolve(path, v)
        );
    }
}

export function createFileUtility(logs: I.ILogger): I.IFileUtils {

    return new FileUtils(logs);
}
