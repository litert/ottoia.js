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
import * as E from '../Errors';
import { promises as $FS } from 'fs';
import * as $Path from 'path';
import * as $ChildProcess from 'child_process';

class FileUtils implements I.IFileUtils {

    private _cmdId = Date.now();

    public constructor(private readonly _logs: I.ILogger) {}

    private async _exec(cmd: string): Promise<Record<'stdout' | 'stderr', string>> {

        return new Promise((resolve, reject) => {

            $ChildProcess.exec(cmd, (error, stdout, stderr) => {

                if (error) {

                    reject(error); return;
                }

                resolve({ stdout, stderr });
            });
        });
    }

    public async execAt(cwd: string, cmd: string, ...args: string[]): Promise<Record<'stdout' | 'stderr', string>> {

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

            this._logs.debug3(`Command[${CMD_ID}]: Using CWD "${cwd}".`);

            this._logs.debug3(`Command[${CMD_ID}]: Executing...`);

            const result = await this._exec(cmdline);

            if (!result.stdout && result.stderr) {

                this._logs.debug3(`Command[${CMD_ID}]: ${result.stderr}.`);

                throw result;
            }

            this._logs.debug3(`Command[${CMD_ID}]: OK.`);

            return result;
        }
        catch (e) {

            this._logs.debug3(`Command[${CMD_ID}]: Failed.`);

            throw e;
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

        return $FS.readFile(file, { encoding: 'utf8' });
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
