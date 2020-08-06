import * as E from '../Errors';
import * as I from './Internal';
import * as $TyG from '@litert/typeguard';

type TemplateFileList = Array<string | [string, string]>;

const tgc = $TyG.createInlineCompiler();

const isNodePackage = tgc.compile<I.INPMPackage>({
    rule: {
        'name': 'string',
        'description?': 'string',
        'version?': 'string',
        'private?': 'boolean',
        'scripts->{}?': 'string',
        'dependencies->{}?': 'string',
        'devDependencies->{}?': 'string',
        'peerDependencies->{}?': 'string'
    }
});

const isTemplateFileList = tgc.compile<TemplateFileList>({
    rule: ['$.list', 'string', 'string[2]']
});

class PackageUtils implements I.IPackageUtils {

    public constructor(private readonly _fs: I.IFileUtils) {}

    public async readMaster(path: string): Promise<I.IMasterPackage> {

        const ret = await this.read(path) as I.IMasterPackage;

        if (!ret.version || !ret.raw.ottoia) {

            throw new E.E_INVALID_MASTER_PACKAGE({ metadata: { path } });
        }

        return ret;
    }

    public async read(path: string): Promise<I.IPackage> {

        const packageJson = await this._fs.readJsonFile(this._fs.concatPath(path, './package.json'));

        if (!isNodePackage(packageJson)) {

            throw Error('invalid package');
        }

        return {
            'root': path,
            'name': packageJson.name.toLowerCase(),
            'alias': packageJson['ottoia:alias'],
            'version': packageJson.version,
            'isPrivate': !!packageJson.private,
            'scripts': packageJson.scripts ?? {},
            'dependencies': packageJson.dependencies,
            'devDependencies': packageJson.devDependencies,
            'peerDependencies': packageJson.peerDependencies,
            'raw': packageJson
        };
    }

    public async create(opts: I.IPackageOptions): Promise<I.IPackage> {

        opts.name = opts.name.toLowerCase();

        if (!/(@[a-z0-9][-\w]*\/)?[a-z0-9][-.\w]*/.test(opts.name)) {

            throw new E.E_INVALID_PACKAGE_NAME({ metadata: { name: opts.name } });
        }

        const pkgRoot = this._fs.concatPath(opts.root, opts.dirName ?? opts.name);

        if (await this._fs.exists(pkgRoot)) {

            throw new E.E_DUP_PACKAGE({ metadata: { name: opts.name } });
        }

        if (opts.templateFile === undefined) {

            opts.templateFile = this._fs.concatPath(__dirname, '../../built-in-template');
        }

        if (await this._fs.existsDir(opts.templateFile)) {

            opts.templateFile = this._fs.concatPath(opts.templateFile, './template.json');
        }

        const [tplRoot] = this._fs.extractPath(opts.templateFile);

        if (!await this._fs.existsFile(opts.templateFile)) {

            throw new E.E_INVALID_TEMPLATE({ metadata: { template: opts.templateFile } });
        }

        const tplFileList = await this._fs.readJsonFile<TemplateFileList>(opts.templateFile);

        if (!isTemplateFileList(tplFileList)) {

            throw new E.E_INVALID_TEMPLATE({ metadata: { template: opts.templateFile } });
        }

        await this._fs.mkdirP(pkgRoot);

        for (const x of tplFileList) {

            let inputFile: string, outputFile: string;

            if (Array.isArray(x)) {

                inputFile = x[0];
                outputFile = x[1];
            }
            else {

                outputFile = inputFile = x;
            }

            await this._createFile(pkgRoot, tplRoot, opts, inputFile, outputFile);
        }

        return this.read(pkgRoot);
    }

    private async _createFile(
        pkgRoot: string,
        tplRoot: string,
        opts: I.IPackageOptions,
        inputFile: string,
        outputFile: string
    ): Promise<void> {

        const fullOutFile = this._fs.concatPath(pkgRoot, outputFile);

        const fullInFile = this._fs.concatPath(tplRoot, inputFile);

        if (outputFile !== 'package.json') {

            await this._fs.mkdirP(this._fs.extractPath(fullOutFile)[0]);

            await this._fs.copyFile(
                fullInFile,
                fullOutFile
            );

            return;
        }

        await this._fs.writeFile(
            fullOutFile,
            JSON.stringify({
                ...await this._fs.readJsonFile<any>(fullInFile),
                'name': opts.name,
                'private': !!opts.isPrivate,
                'ottoia:alias': opts.alias
            }, null, 2)
        );
    }

    public async scan(root: string): Promise<string[]> {

        const ret: string[] = [];

        await this._scan(root, ret);

        return ret;
    }

    private async _scan(root: string, stack: string[]): Promise<void> {

        const items = await this._fs.readDir(root);

        for (const subItem of items) {

            if (subItem.endsWith('.')) {

                continue;
            }

            if (!await this._fs.existsDir(subItem)) {

                continue;
            }

            if (await this._fs.existsFile(`${subItem}/package.json`)) {

                stack.push(subItem);
            }
            else {

                await this._scan(subItem, stack);
            }
        }
    }

    public async save(pkg: I.IPackage): Promise<I.IPackage> {

        const curPkg = await this.read(pkg.root);

        curPkg.raw.devDependencies = { ...pkg.devDependencies };
        curPkg.raw.dependencies = { ...pkg.dependencies };
        curPkg.raw.peerDependencies = { ...pkg.peerDependencies };

        await this._fs.writeFile(
            this._fs.concatPath(pkg.root, 'package.json'),
            JSON.stringify(curPkg.raw, null, 2)
        );

        return curPkg;
    }
}

export function createPackageUtils(fs: I.IFileUtils): I.IPackageUtils {

    return new PackageUtils(fs);
}
