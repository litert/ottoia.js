#!/bin/env node
import * as $Ottoia from '../lib';
import * as $Clap from '@litert/clap';
import parseCLA from './Clap';

class OttoiaCLI {

    private _cla: $Clap.IResult;

    private _ottoia: $Ottoia.IManager;

    public constructor() {

        this._cla = parseCLA()!;

        if (!this._cla) {

            process.exit(0);
        }

        this._ottoia = $Ottoia.createManager(this._cla.options.root?.[0] ?? process.cwd());
    }

    public async main(): Promise<void> {

        if (this._cla.commands[0].name !== 'init') {

            await this._ottoia.ensureMasterPackageRoot();

            await this._ottoia.reload();
        }

        switch (this._cla.commands[0].name) {
            case 'init': {
                await this._ottoia.initialize(!!this._cla.commands[0].flags['yes']);
                break;
            }
            case 'clean': {
                await this._ottoia.clean(this._cla.arguments, !!this._cla.commands[0].flags['full']);
                break;
            }
            case 'bootstrap': {
                await this._ottoia.bootstrap();
                break;
            }
            case 'create': {

                const tplFile = this._cla.commands[0].options.template?.[0];

                await this._ottoia.createPackage(
                    this._cla.arguments[0],
                    tplFile,
                    !!this._cla.commands[0].flags.private,
                    this._cla.commands[0].options.dir?.[0],
                    this._cla.commands[0].options.alias?.[0],
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
                    this._cla.commands[0].options.package ?? [],
                    !!this._cla.commands[0].flags.peer,
                    !!this._cla.commands[0].flags.development
                );
                break;
            }
            case 'uninstall': {

                await this._ottoia.uninstall(
                    this._cla.arguments,
                    this._cla.commands[0].options.package ?? []
                );
                break;
            }
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
        console.log(`  Type: ${pkg.isPrivate ? 'Private' : 'Public'}`);

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

new OttoiaCLI().main().catch((e) => console.error(e?.toJSON ? e.toJSON() : e));
