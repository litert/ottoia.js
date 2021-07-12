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

const GBL_ID = Symbol('@litert/ottoia:global') as any as string;

class DependencyCounter implements I.IDependencyCounter {

    private _packages: Record<string, Record<string, number>> = { [GBL_ID]: {} };

    public add(pkgName: string, deps: string[]): void {

        let pkg = this._packages[pkgName] ?? {};

        this._packages[pkgName] = pkg;

        for (const depName of deps) {

            pkg[depName] = 1 + (pkg[depName] ?? 0);
        }

        if (pkgName !== GBL_ID) {

            this.add(GBL_ID, deps);
        }
    }

    public remove(pkgName: string, deps: string[]): void {

        let pkg = this._packages[pkgName] ?? {};

        if (!pkg) {

            return;
        }

        for (const depName of deps) {

            if (!pkg[depName]) {

                continue;
            }

            pkg[depName]--;

            if (!pkg[depName]) {

                delete pkg[depName];
            }
        }

        if (pkgName !== GBL_ID) {

            this.remove(GBL_ID, deps);
        }
    }

    public isDependingOn(dep: string, pkgName: string = GBL_ID): boolean {

        return !!this.generateMap(pkgName)[dep];
    }

    public generateMap(pkgName: string = GBL_ID): Record<string, number> {

        const ret: Record<string, number> = {};

        this._generateMap(pkgName, ret);

        return ret;
    }

    private _generateMap(pkgName: string, stack: Record<string, number>, path: string[] = []): void {

        const pkg = this._packages[pkgName];

        if (!pkg) {

            return;
        }

        for (const depName in pkg) {

            stack[depName] = pkg[depName] + (stack[depName] ?? 0);

            if (this._packages[depName] && !path.includes(depName)) {

                this._generateMap(depName, stack, [...path, depName]);
            }
        }
    }
}

export function createDependencyCounter(): I.IDependencyCounter {

    return new DependencyCounter();
}
