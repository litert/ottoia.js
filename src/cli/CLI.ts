/**
 * Copyright 2024 Angus.Fenying <fenying@litert.org>
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

import * as $Ottoia from '../lib';
import * as $Clap from '@litert/clap';
import parseCLA from './Clap';

export default class OttoiaCLI {

    private readonly _cla: $Clap.IParseResult;

    private readonly _ottoia: $Ottoia.IManager;

    public constructor() {

        this._cla = parseCLA()!;

        if (!this._cla) {

            process.exit(0);
        }

        this._ottoia = $Ottoia.createManager(
            this._cla.options.root?.[0] ?? process.cwd(),
            this._cla.flags.verbose ?? undefined
        );
    }

    public async main(): Promise<void> {

        if (this._cla.commands[0] !== 'initialize') {

            await this._ottoia.ensureRootPackagePath();

            await this._ottoia.reload();
        }

        switch (this._cla.commands[0]) {
            case 'initialize': {
                await this._ottoia.initialize(!!this._cla.flags['yes']);
                break;
            }
            case 'clean': {
                await this._ottoia.clean(this._cla.arguments, !!this._cla.flags['full']);
                break;
            }
            case 'bootstrap': {
                await this._ottoia.bootstrap(
                    !!this._cla.flags['no-install'],
                    !!this._cla.flags['ci'],
                );
                break;
            }
            case 'run': {
                await this._ottoia.runCommand(
                    this._cla.options.package ?? [],
                    this._cla.arguments[0],
                    this._cla.arguments.slice(1),
                    !!(this._cla.flags['root-only'] || this._cla.flags['root']),
                    !!this._cla.flags['root-only']
                );
                break;
            }
            case 'release': {
                await this._ottoia.release({
                    version: this._cla.options['version']?.[0],
                    env: this._cla.arguments[0],
                    withBreakingChanges: !!this._cla.flags['breaking-changes'],
                    withNewFeatures: !!this._cla.flags['new-feature'],
                    withPatches: !!this._cla.flags['patch'],
                    confirmed: !!this._cla.flags['confirm'],
                    noClean: !!this._cla.flags['no-clean']
                });
                break;
            }
            case 'recall': {
                await this._ottoia.recall({
                    release: this._cla.arguments[0],
                    version: this._cla.arguments[1],
                    confirmed: !!this._cla.flags['confirm'],
                });
                break;
            }
            case 'deprecate': {
                await this._ottoia.deprecate({
                    scope: this._cla.arguments[0],
                    message: this._cla.arguments[1],
                });
                break;
            }
            case 'create': {

                const tplFile = this._cla.options.template?.[0];

                await this._ottoia.createPackage(
                    this._cla.arguments[0],
                    tplFile,
                    !!this._cla.flags['no-release'],
                    !!this._cla.flags['private-access'],
                    this._cla.options.dir?.[0],
                    this._cla.options.alias?.[0],
                );

                this._printPackageInfo(this._ottoia.getPackage(this._cla.arguments[0]));

                break;
            }
            case 'show': {

                if (!this._cla.arguments[0]) {

                    console.log('Please select a package to display:');
                    console.log(
                        this._ottoia.getPackageNames().map((v) => {

                            const p = this._ottoia.getPackage(v);

                            return p.alias ? `  ${v} [${p.alias}]` : `  ${v}`;

                        }).join('\n')
                    );
                }
                else {

                    this._printPackageInfo(this._ottoia.getPackage(this._cla.arguments[0]));
                }
                break;
            }
            case 'install': {

                await this._ottoia.install(
                    this._cla.arguments,
                    this._cla.options.package ?? [],
                    !!this._cla.flags.peer,
                    !!this._cla.flags.development
                );
                break;
            }
            case 'uninstall': {

                await this._ottoia.uninstall(
                    this._cla.arguments,
                    this._cla.options.package ?? []
                );
                break;
            }
        }

        if (this._cla.flags['debug-force-quit']) {

            process.exit(0);
        }
    }

    private _printPackageInfo(pkg: $Ottoia.IPackage): void {

        const deps = Object.keys(pkg.dependencies);
        const devDeps = Object.keys(pkg.devDependencies);
        const peerDeps = Object.keys(pkg.peerDependencies);

        console.log(pkg.name);
        if (pkg.alias) {

            console.log(`  Alias: ${pkg.alias}`);
        }
        console.log(`  Release: ${pkg.noRelease ? 'No' : 'Yes'}`);
        console.log(`  Access: ${pkg.privateAccess ? 'Private' : 'Public'}`);

        if (deps.length || devDeps.length || peerDeps.length) {
            console.log('  Dependencies:');
            console.log([
                ...deps.map((v) => `  ${v}`),
                ...devDeps.map((v) => `  ${v} [Development]`),
                ...peerDeps.map((v) => `  ${v} [Peer]`),
            ].map((v) => `  ${v}`).join('\n'));
        }
    }
}
