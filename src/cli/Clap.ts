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

import * as $Clap from '@litert/clap';

function createCLAParser(): $Clap.IParser {

    const parser = $Clap.createGNUParser();

    // ottoia create <package> [--template=pathOrPackage]
    // ottoia install <...deps> [--scope=<package>[ ...--scope=<package>]] [--development|-D|--peer|-P]
    // ottoia uninstall <...deps> [--scope=<package>[ ...--scope=<package>]]
    // ottoia release <env> [--breaking-change|--new-features|--patch]
    // ottoia show <package>

    parser.addCommand({
        name: 'create',
        description: 'Create a new sub package.'
    }).addCommand({
        name: 'install',
        description: 'Install dependencies of specific sub packages.',
        aliases: 'i',
        minArguments: 1
    }).addCommand({
        name: 'uninstall',
        description: 'Uninstall dependencies of specific sub packages.',
        aliases: 'un'
    }).addCommand({
        name: 'release',
        description: 'Release a new version online.',
        minArguments: 1,
        maxArguments: 1
    }).addCommand({
        name: 'show',
        description: 'Display the information of specific packages.'
    }).addCommand({
        name: 'run',
        description: 'Run a command defined in root package.json.',
        minArguments: 1
    }).addCommand({
        name: 'initialize',
        aliases: ['init'],
        description: 'Create or initialized the package.json in the project root.'
    }).addCommand({
        name: 'clean',
        description: 'Clean up determined or all projects.'
    }).addCommand({
        name: 'bootstrap',
        description: 'Install all dependencies for all projects.'
    });

    parser.addOption({
        'path': 'create',
        'name': 'template',
        'description': 'The template for new package.',
        'shortcut': 't',
        'arguments': 1
    }).addOption({
        'path': 'initialize',
        'name': 'yes',
        'description': 'Ensure to update the existing package.json.',
        'shortcut': 'y',
        'arguments': 0
    }).addOption({
        'path': 'clean',
        'name': 'full',
        'description': 'Clean up the node_modules.',
        'shortcut': 'f',
        'arguments': 0
    }).addOption({
        'path': 'create',
        'name': 'private-access',
        'shortcut': 'p',
        'description': 'Mark the accessibility of new package as private.',
        'arguments': 0
    }).addOption({
        'path': 'create',
        'name': 'no-release',
        'description': 'Forbid releasing the new package online.',
        'arguments': 0
    }).addOption({
        'path': 'create',
        'name': 'alias',
        'shortcut': 'a',
        'description': 'Specify an alias name for the new package.',
        'arguments': 1
    }).addOption({
        'path': 'create',
        'name': 'dir',
        'shortcut': 'd',
        'description': 'Specify the name of package directory.',
        'arguments': 1
    }).addOption({
        'path': 'run',
        'name': 'package',
        'shortcut': 'p',
        'description': 'Specify which package should be run command at.'
    }).addOption({
        'path': 'run',
        'name': 'root',
        'shortcut': 'r',
        'description': 'Also run the command in the root package.',
        'arguments': 0
    }).addOption({
        'path': 'run',
        'name': 'root-only',
        'shortcut': 'R',
        'description': 'Run the command in the root package only.',
        'arguments': 0
    }).addOption({
        'path': 'install',
        'name': 'package',
        'shortcut': 'p',
        'description': 'Specify which package should be installed to.'
    }).addOption({
        'path': 'install',
        'name': 'root-only',
        'description': 'Install in the root package, for development usage only.'
    }).addOption({
        'path': 'install',
        'name': 'development',
        'description': 'Install the development dependencies.',
        'shortcut': 'D',
        'arguments': 0
    }).addOption({
        'path': 'install',
        'name': 'peer',
        'description': 'Install the peer dependencies.',
        'shortcut': 'P',
        'arguments': 0
    }).addOption({
        'path': 'uninstall',
        'name': 'package',
        'shortcut': 'p',
        'description': 'Specify which package should be uninstalled from.'
    }).addOption({
        'path': 'release',
        'name': 'confirm',
        'description': 'Confirmation of release. Otherwise, --dry-run will be used.',
        'arguments': 0
    }).addOption({
        'path': 'release',
        'name': 'breaking-changes',
        'description': 'Create a new version with breaking changes.',
        'arguments': 0
    }).addOption({
        'path': 'release',
        'name': 'new-feature',
        'shortcut': 'V',
        'description': 'Create a new version with new features.',
        'arguments': 0
    }).addOption({
        'path': 'release',
        'name': 'version',
        'description': 'Specify the new version.',
        'arguments': 1
    }).addOption({
        'path': 'release',
        'name': 'patch',
        'description': 'Create a new version with patches.',
        'arguments': 0
    }).addOption({
        'name': 'verbose',
        'shortcut': 'v',
        'description': 'Display debug logs.',
        'arguments': 0
    });

    return parser;
}

function printHelp(parser: $Clap.IParser, helpPath: string): void {

    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    console.log(`Version ${require('../package.json').version}`);
    console.log(parser.generateHelp('ottoia', helpPath).join('\n'));
}

export default function parseCLA(): $Clap.IResult | null {

    const clap = createCLAParser();

    try {

        const result = clap.parse(process.argv.slice(2));

        if (!result.commands.length || result.help) {

            printHelp(clap, result.help);
            return null;
        }

        return result;
    }
    catch {

        printHelp(clap, '');
        return null;
    }
}
