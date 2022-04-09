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

function createCLAParser(): $Clap.IHelper {

    const helper = $Clap.createHelper({
        // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
        title: `Ottoia/${require('../package.json').version}`,
        description: 'A simple multi-repository package manager of Node.js.',
        command: 'ottoia'
    });

    // ottoia create <package> [--template=pathOrPackage]
    // ottoia install <...deps> [--scope=<package>[ ...--scope=<package>]] [--development|-D|--peer|-P]
    // ottoia uninstall <...deps> [--scope=<package>[ ...--scope=<package>]]
    // ottoia release <env> [--breaking-change|--new-features|--patch]
    // ottoia show <package>

    return helper
        .addFlag({
            'name': 'verbose',
            'shortcut': 'v',
            'description': 'Display debug logs.'
        })
        .addCommand({
            name: 'create',
            description: 'Create a new sub package.',
            minArguments: 1,
            maxArguments: 1
        }, (helper) => helper
            .addOption({
                'name': 'template',
                'description': 'The template for new package.',
                'shortcut': 't'
            })
            .addFlag({
                'name': 'private-access',
                'shortcut': 'p',
                'description': 'Mark the accessibility of new package as private.'
            })
            .addFlag({
                'name': 'no-release',
                'description': 'Forbid releasing the new package online.'
            })
            .addOption({
                'name': 'alias',
                'shortcut': 'a',
                'description': 'Specify an alias name for the new package.'
            })
            .addOption({
                'name': 'dir',
                'shortcut': 'd',
                'description': 'Specify the name of package directory.'
            })
        )
        .addCommand({
            name: 'install',
            description: 'Install dependencies of specific sub packages.',
            shortcut: 'i',
            minArguments: 1
        }, (helper) => helper
            .addOption({
                'name': 'package',
                'shortcut': 'p',
                'description': 'Specify which package should be installed to.',
                'multiple': true
            })
            .addFlag({
                'name': 'root-only',
                'description': 'Install in the root package, for development usage only.'
            })
            .addFlag({
                'name': 'development',
                'description': 'Install the development dependencies.',
                'shortcut': 'D'
            })
            .addFlag({
                'name': 'peer',
                'description': 'Install the peer dependencies.',
                'shortcut': 'P'
            })
        )
        .addCommand({
            name: 'uninstall',
            description: 'Uninstall dependencies of specific sub packages.',
            shortcut: 'un'
        }, (helper) => helper
            .addOption({
                'name': 'package',
                'shortcut': 'p',
                'description': 'Specify which package should be uninstalled from.',
                'multiple': true
            })
        )
        .addCommand({
            name: 'release',
            description: 'Release a new version online.',
            minArguments: 1,
            maxArguments: 1
        }, (helper) => helper
            .addFlag({
                'name': 'confirm',
                'description': 'Confirmation of release. Otherwise, --dry-run will be used.'
            })
            .addFlag({
                'name': 'no-clean',
                'description': 'Don\'t clean before building.'
            })
            .addFlag({
                'name': 'breaking-changes',
                'description': 'Create a new version with breaking changes.'
            })
            .addFlag({
                'name': 'new-feature',
                'shortcut': 'V',
                'description': 'Create a new version with new features.'
            })
            .addFlag({
                'name': 'patch',
                'description': 'Create a new version with patches.'
            })
            .addOption({
                'name': 'version',
                'description': 'Specify the new version.'
            })
        )
        .addCommand({
            name: 'recall',
            description: 'Recall a released version.',
            minArguments: 2,
            maxArguments: 2
        }, (helper) => helper
            .addFlag({
                'name': 'confirm',
                'description': 'Confirmation of recall. Otherwise, --dry-run will be used.'
            })
        )
        .addCommand({
            name: 'show',
            description: 'Display the information of specific packages.'
        })
        .addCommand({
            name: 'run',
            description: 'Run a command defined in root package.json.',
            minArguments: 1
        }, (helper) => helper
            .addOption({
                'name': 'package',
                'shortcut': 'p',
                'description': 'Specify which package should be run command at.',
                'multiple': true
            }).addFlag({
                'name': 'root',
                'shortcut': 'r',
                'description': 'Also run the command in the root package.',
            }).addFlag({
                'name': 'root-only',
                'shortcut': 'R',
                'description': 'Run the command in the root package only.',
            })
        )
        .addCommand({
            name: 'initialize',
            shortcut: 'init',
            description: 'Create or initialized the package.json in the project root.'
        }, (helper) => helper
            .addFlag({
                'name': 'yes',
                'description': 'Ensure to update the existing package.json.',
                'shortcut': 'y'
            })
        )
        .addCommand({
            name: 'clean',
            description: 'Clean up determined or all projects.'
        }, (helper) => helper
            .addFlag({
                'name': 'full',
                'description': 'Clean up the node_modules.',
                'shortcut': 'f'
            })
        )
        .addCommand({
            name: 'bootstrap',
            description: 'Install all dependencies for all projects.'
        }, (helper) => helper
            .addFlag({
                name: 'no-install',
                description: 'Don\'t execute `npm install`.',
                shortcut: 'N'
            })
            .addFlag({
                name: 'ci',
                description: 'Use `npm ci` command.',
            })
        );
}

export default function parseCLA(): $Clap.IParseResult | null {

    const clap = createCLAParser();

    const result = clap.parseAndProcess(process.argv.slice(2));

    if (Array.isArray(result)) {

        console.log(result.join('\n'));
        return null;
    }

    return result;
}
