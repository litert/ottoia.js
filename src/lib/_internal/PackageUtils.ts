import * as E from '../Errors';
import * as I from './Internal';
import * as $TyG from '@litert/typeguard';
import * as validateNPMPackageName from 'validate-npm-package-name';

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
        'peerDependencies->{}?': 'string',
        'access?': ['==private', '==public'],
        'ottoia?': {
            'releases->{}': {
                'tag': 'string',
                'versioner?': 'string',
                'registry?': 'string'
            }
        }
    }
});

const isTemplateFileList = tgc.compile<TemplateFileList>({
    rule: ['$.list', 'string', 'string[2]']
});

class PackageUtils implements I.IPackageUtils {

    public constructor(
        private readonly _logs: I.ILogger,
        private readonly _fs: I.IFileUtils
    ) {}

    public isValidPackageName(name: string): boolean {

        return validateNPMPackageName(name).validForNewPackages;
    }

    public isValidDependencyName(expr: string): boolean {

        const [name, tag] = expr.split(/(?!^)@/, 2);

        return validateNPMPackageName(name).validForOldPackages && /^[a-z0-9]+$/.test(tag);
    }

    public validatePackageName(name: string): void {

        if (!this.isValidPackageName(name)) {

            throw new E.E_INVALID_PACKAGE_NAME({ metadata: { name } });
        }
    }

    public validateDependencyName(name: string): void {

        if (!this.isValidDependencyName(name)) {

            throw new E.E_INVALID_PACKAGE_NAME({ metadata: { name } });
        }
    }

    public async readRoot(path: string): Promise<I.IRootPackage> {

        const ret = await this.read(path) as I.IRootPackage;

        this._logs.debug2(`Loaded root package from "${path}".`);

        if (!ret.version || !ret.raw.ottoia) {

            throw new E.E_INVALID_ROOT_PACKAGE({ metadata: { path } });
        }

        ret.ottoiaOptions = ret.raw.ottoia;

        return ret;
    }

    public async read(path: string): Promise<I.IPackage> {

        const packageJson = await this._fs.readJsonFile(this._fs.concatPath(path, './package.json'));

        if (!isNodePackage(packageJson)) {

            throw new E.E_INVALID_PACKAGE({ metadata: { path } });
        }

        return {
            'root': path,
            'name': packageJson.name.toLowerCase(),
            'alias': packageJson['ottoia:alias']?.toLowerCase(),
            'version': packageJson.version,
            'noRelease': !!packageJson.private,
            'privateAccess': packageJson.access !== 'public',
            'scripts': packageJson.scripts ?? {},
            'dependencies': packageJson.dependencies ?? {},
            'devDependencies': packageJson.devDependencies ?? {},
            'peerDependencies': packageJson.peerDependencies ?? {},
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

            this._logs.debug2(`Using package template at "${opts.templateFile}".`);

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

        const [outRoot] = this._fs.extractPath(fullOutFile);

        if (!await this._fs.existsDir(outRoot)) {

            await this._fs.mkdirP(outRoot);
        }

        if (outputFile !== 'package.json') {

            await this._fs.copyFile(
                fullInFile,
                fullOutFile
            );

            return;
        }

        const originFile = await this._fs.readJsonFile<Record<string, any>>(fullInFile);

        await this._fs.writeFile(
            fullOutFile,
            JSON.stringify({
                ...await this._fs.readJsonFile<any>(fullInFile),
                'name': opts.name,
                'private': !!opts.noRelease,
                'ottoia:alias': opts.alias,
                'access': opts.privateAccess ? 'private' : 'public',
                'scripts': {
                    ...originFile.scripts,
                    'prepublishOnly': 'echo "Please use ottoia publishing this package!"; exit 1;'
                }
            }, null, 2)
        );
    }

    public async scan(root: string): Promise<string[]> {

        const ret: string[] = [];

        await this._scan(root, ret);

        return ret;
    }

    private async _scan(root: string, stack: string[]): Promise<void> {

        this._logs.debug3(`Scanning packages in "${root}".`);

        const items = await this._fs.readDir(root);

        for (const subItem of items) {

            if (!await this._fs.existsDir(subItem)) {

                continue;
            }

            if (await this._fs.existsFile(`${subItem}/package.json`)) {

                this._logs.debug3(`Found package in "${subItem}".`);
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

        this._logs.debug3(`Saving package "${pkg.name}".`);

        await this._fs.writeFile(
            this._fs.concatPath(pkg.root, 'package.json'),
            JSON.stringify(curPkg.raw, null, 2)
        );

        return curPkg;
    }
}

export function createPackageUtils(logger: I.ILogger, fs: I.IFileUtils): I.IPackageUtils {

    return new PackageUtils(logger, fs);
}
