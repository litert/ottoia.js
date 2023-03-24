/**
 * Copyright 2023 Angus.Fenying <fenying@litert.org>
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

import * as $Exceptions from '@litert/exception';

export const errorRegistry = $Exceptions.createExceptionRegistry({
    'module': 'ottoia.litert.org',
    'types': {
        'public': {
            'index': $Exceptions.createIncreaseCodeIndex(1)
        }
    }
});

export const E_PACKAGE_NOT_FOUND = errorRegistry.register({
    name: 'package_not_found',
    message: 'No such a package.',
    metadata: {},
    type: 'public'
});

export const E_NPM_ERROR = errorRegistry.register({
    name: 'npm_error',
    message: 'Failed with NPM operation.',
    metadata: {},
    type: 'public'
});

export const E_PACKAGE_NOT_RELEASED = errorRegistry.register({
    name: 'package_not_released',
    message: 'The package has not been published yet.',
    metadata: {},
    type: 'public'
});

export const E_INVALID_PACKAGE = errorRegistry.register({
    name: 'invalid_package',
    message: 'The package.json is invalid.',
    metadata: {},
    type: 'public'
});

export const E_INVALID_PATH = errorRegistry.register({
    name: 'invalid_path',
    message: 'The path could not be accessed.',
    metadata: {},
    type: 'public'
});

export const E_DUP_PACKAGE = errorRegistry.register({
    name: 'dup_package',
    message: 'The determined package already exists.',
    metadata: {},
    type: 'public'
});

export const E_RELEASE_CONFIG_NOT_FOUND = errorRegistry.register({
    name: 'release_config_not_found',
    message: 'No such a release configuration.',
    metadata: {},
    type: 'public'
});

export const E_COMMAND_NOT_FOUND = errorRegistry.register({
    name: 'command_not_found',
    message: 'No such a command.',
    metadata: {},
    type: 'public'
});

export const E_DUP_PACKAGE_ALIAS = errorRegistry.register({
    name: 'dup_package_alias',
    message: 'The determined package alias already exists.',
    metadata: {},
    type: 'public'
});

export const E_RECURSIVE_DEP = errorRegistry.register({
    name: 'recursive_dep',
    message: 'Recursive dependency is forbidden.',
    metadata: {},
    type: 'public'
});

export const E_INVALID_TEMPLATE = errorRegistry.register({
    name: 'invalid_template',
    message: 'The template of package is invalid.',
    metadata: {},
    type: 'public'
});

export const E_INVALID_PACKAGE_NAME = errorRegistry.register({
    name: 'invalid_package_name',
    message: 'The name of package is invalid.',
    metadata: {},
    type: 'public'
});

export const E_INVALID_JSON_FILE = errorRegistry.register({
    name: 'invalid_json_file',
    message: 'The JSON is malformed.',
    metadata: {},
    type: 'public'
});

export const E_INVALID_ROOT_PACKAGE = errorRegistry.register({
    name: 'invalid_root_package',
    message: 'The package.json of root package is malformed.',
    metadata: {},
    type: 'public'
});

export const E_NO_ROOT_PACKAGE = errorRegistry.register({
    name: 'no_root_package',
    message: 'The root package not found.',
    metadata: {},
    type: 'public'
});

export const E_SHELL_FAILED = errorRegistry.register({
    name: 'shell_failed',
    message: 'Failed to execute shell command.',
    metadata: {},
    type: 'public'
});

export const E_EXISTING_PACKAGE_JSON = errorRegistry.register({
    name: 'existing_package_json',
    message: 'Can not initialize an existing package.json without "--yes" option.',
    metadata: {},
    type: 'public'
});

export const E_UNKNOWN_SUB_PACKAGE = errorRegistry.register({
    name: 'unknown_sub_package',
    message: 'The determined sub packages does not exist.',
    metadata: {},
    type: 'public'
});

export const E_DEP_NOT_FOUND = errorRegistry.register({
    name: 'dep_not_found',
    message: 'No such a dependency.',
    metadata: {},
    type: 'public'
});

export const E_DEP_INVALID = errorRegistry.register({
    name: 'dep_invalid',
    message: 'Can not resolve the dependency expression.',
    metadata: {},
    type: 'public'
});

export const E_DEP_NOT_LOCKED = errorRegistry.register({
    name: 'dep_not_locked',
    message: 'No such a dependency in the root package.json.',
    metadata: {},
    type: 'public'
});

export const E_PRIVATE_DEPENDENCY = errorRegistry.register({
    name: 'private_dependency',
    message: 'Can not depend on a private sub package.',
    metadata: {},
    type: 'public'
});
