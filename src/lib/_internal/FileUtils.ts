import * as L from '@litert/core';
import * as I from './Internal';
import * as E from '../Errors';
import { promises as $FS } from 'fs';
import * as $Path from 'path';
import * as $ChildProcess from 'child_process';

class FileUtils implements I.IFileUtils {

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

    public async execAt(cwd: string, cmd: string, ...args: string[]): Promise<void> {

        const oldCWD = process.cwd();

        if (!await this.existsDir(cwd)) {

            throw new E.E_INVALID_PATH({ metadata: { path: cwd } });
        }

        try {

            process.chdir(cwd);

            const result = await this._exec([cmd, ...args].map((v) => v.includes(' ') ? `"${v}"` : v).join(' '));

            if (typeof result !== 'string') {

                throw result;
            }
        }
        finally {

            process.chdir(oldCWD);
        }

    }

    public async removeFile(path: string): Promise<void> {

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

        await $FS.copyFile(src, dst);
    }

    public async writeFile(file: string, content: string): Promise<void> {

        await $FS.writeFile(file, content);
    }

    public async readFile(file: string): Promise<string> {

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

        return (await $FS.readdir(path)).map((v) => $Path.resolve(path, v));
    }
}

export function createFileUtility(): I.IFileUtils {

    return new FileUtils();
}
