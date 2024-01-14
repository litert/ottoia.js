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

/**
 * The error class for websocket.
 */
export abstract class OttoiaError extends Error {

    public constructor(
        name: string,
        message: string,
        public readonly context: Record<string, unknown>,
        public readonly origin: unknown = null
    ) {

        super(message);
        this.name = name;
    }
}

export const E_PACKAGE_NOT_FOUND = class extends OttoiaError {

    public constructor(ctx: Record<string, unknown> = {}, origin: unknown = null) {

        super(
            'package_not_found',
            'No such a package.',
            ctx,
            origin
        );
    }
};

export const E_NPM_ERROR = class extends OttoiaError {

    public constructor(ctx: Record<string, unknown> = {}, origin: unknown = null) {

        super(
            'npm_error',
            'Failed with NPM operation.',
            ctx,
            origin
        );
    }
};

export const E_PACKAGE_NOT_RELEASED = class extends OttoiaError {

    public constructor(ctx: Record<string, unknown> = {}, origin: unknown = null) {

        super(
            'package_not_released',
            'The package has not been published yet.',
            ctx,
            origin
        );
    }
};

export const E_INVALID_PACKAGE = class extends OttoiaError {

    public constructor(ctx: Record<string, unknown> = {}, origin: unknown = null) {

        super(
            'invalid_package',
            'The package.json is invalid.',
            ctx,
            origin
        );
    }
};

export const E_INVALID_PATH = class extends OttoiaError {

    public constructor(ctx: Record<string, unknown> = {}, origin: unknown = null) {

        super(
            'invalid_path',
            'The path could not be accessed.',
            ctx,
            origin
        );
    }
};

export const E_DUP_PACKAGE = class extends OttoiaError {

    public constructor(ctx: Record<string, unknown> = {}, origin: unknown = null) {

        super(
            'dup_package',
            'The determined package already exists.',
            ctx,
            origin
        );
    }
};

export const E_RELEASE_CONFIG_NOT_FOUND = class extends OttoiaError {

    public constructor(ctx: Record<string, unknown> = {}, origin: unknown = null) {

        super(
            'release_config_not_found',
            'No such a release configuration.',
            ctx,
            origin
        );
    }
};

export const E_COMMAND_NOT_FOUND = class extends OttoiaError {

    public constructor(ctx: Record<string, unknown> = {}, origin: unknown = null) {

        super(
            'command_not_found',
            'No such a command.',
            ctx,
            origin
        );
    }
};

export const E_DUP_PACKAGE_ALIAS = class extends OttoiaError {

    public constructor(ctx: Record<string, unknown> = {}, origin: unknown = null) {

        super(
            'dup_package_alias',
            'The determined package alias already exists.',
            ctx,
            origin
        );
    }
};

export const E_RECURSIVE_DEP = class extends OttoiaError {

    public constructor(ctx: Record<string, unknown> = {}, origin: unknown = null) {

        super(
            'recursive_dep',
            'Recursive dependency is forbidden.',
            ctx,
            origin
        );
    }
};

export const E_INVALID_TEMPLATE = class extends OttoiaError {

    public constructor(ctx: Record<string, unknown> = {}, origin: unknown = null) {

        super(
            'invalid_template',
            'The template of package is invalid.',
            ctx,
            origin
        );
    }
};

export const E_INVALID_PACKAGE_NAME = class extends OttoiaError {

    public constructor(ctx: Record<string, unknown> = {}, origin: unknown = null) {

        super(
            'invalid_package_name',
            'The name of package is invalid.',
            ctx,
            origin
        );
    }
};

export const E_INVALID_JSON_FILE = class extends OttoiaError {

    public constructor(ctx: Record<string, unknown> = {}, origin: unknown = null) {

        super(
            'invalid_json_file',
            'The JSON is malformed.',
            ctx,
            origin
        );
    }
};

export const E_INVALID_ROOT_PACKAGE = class extends OttoiaError {

    public constructor(ctx: Record<string, unknown> = {}, origin: unknown = null) {

        super(
            'invalid_root_package',
            'The package.json of root package is malformed.',
            ctx,
            origin
        );
    }
};

export const E_NO_ROOT_PACKAGE = class extends OttoiaError {

    public constructor(ctx: Record<string, unknown> = {}, origin: unknown = null) {

        super(
            'no_root_package',
            'The root package not found.',
            ctx,
            origin
        );
    }
};

export const E_SHELL_FAILED = class extends OttoiaError {

    public constructor(ctx: Record<string, unknown> = {}, origin: unknown = null) {

        super(
            'shell_failed',
            'Failed to execute shell command.',
            ctx,
            origin
        );
    }
};

export const E_EXISTING_PACKAGE_JSON = class extends OttoiaError {

    public constructor(ctx: Record<string, unknown> = {}, origin: unknown = null) {

        super(
            'existing_package_json',
            'Can not initialize an existing package.json without "--yes" option.',
            ctx,
            origin
        );
    }
};

export const E_UNKNOWN_SUB_PACKAGE = class extends OttoiaError {

    public constructor(ctx: Record<string, unknown> = {}, origin: unknown = null) {

        super(
            'unknown_sub_package',
            'The determined sub packages does not exist.',
            ctx,
            origin
        );
    }
};

export const E_DEP_NOT_FOUND = class extends OttoiaError {

    public constructor(ctx: Record<string, unknown> = {}, origin: unknown = null) {

        super(
            'dep_not_found',
            'No such a dependency.',
            ctx,
            origin
        );
    }
};

export const E_DEP_INVALID = class extends OttoiaError {

    public constructor(ctx: Record<string, unknown> = {}, origin: unknown = null) {

        super(
            'dep_invalid',
            'Can not resolve the dependency expression.',
            ctx,
            origin
        );
    }
};

export const E_DEP_NOT_LOCKED = class extends OttoiaError {

    public constructor(ctx: Record<string, unknown> = {}, origin: unknown = null) {

        super(
            'dep_not_locked',
            'No such a dependency in the root package.json.',
            ctx,
            origin
        );
    }
};

export const E_PRIVATE_DEPENDENCY = class extends OttoiaError {

    public constructor(ctx: Record<string, unknown> = {}, origin: unknown = null) {

        super(
            'private_dependency',
            'Can not depend on a private sub package.',
            ctx,
            origin
        );
    }
};
