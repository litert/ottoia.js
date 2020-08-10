import * as L from '@litert/core';

export const errors = L.createErrorHub('@litert/ottoia');

export const E_PACKAGE_NOT_FOUND = errors.define(
    null,
    'package_not_found',
    'No such a package.',
    {}
);

export const E_NPM_ERROR = errors.define(
    null,
    'npm_error',
    'Failed with NPM operation.',
    {}
);

export const E_PACKAGE_NOT_RELEASED = errors.define(
    null,
    'package_not_released',
    'The package has not been published yet.',
    {}
);

export const E_INVALID_PACKAGE = errors.define(
    null,
    'invalid_package',
    'The package.json is invalid.',
    {}
);

export const E_INVALID_PATH = errors.define(
    null,
    'invalid_path',
    'The path could not be accessed.',
    {}
);

export const E_DUP_PACKAGE = errors.define(
    null,
    'dup_package',
    'The determined package already exists.',
    {}
);

export const E_RELEASE_CONFIG_NOT_FOUND = errors.define(
    null,
    'release_config_not_found',
    'No such a release configuration.',
    {}
);

export const E_COMMAND_NOT_FOUND = errors.define(
    null,
    'command_not_found',
    'No such a command.',
    {}
);

export const E_DUP_PACKAGE_ALIAS = errors.define(
    null,
    'dup_package_alias',
    'The determined package alias already exists.',
    {}
);

export const E_RECURSIVE_DEP = errors.define(
    null,
    'recursive_dep',
    'Recursive dependency is forbidden.',
    {}
);

export const E_INVALID_TEMPLATE = errors.define(
    null,
    'invalid_template',
    'The template of package is invalid.',
    {}
);

export const E_INVALID_PACKAGE_NAME = errors.define(
    null,
    'invalid_package_name',
    'The name of package is invalid.',
    {}
);

export const E_INVALID_JSON_FILE = errors.define(
    null,
    'invalid_json_file',
    'The JSON is malformed.',
    {}
);

export const E_INVALID_ROOT_PACKAGE = errors.define(
    null,
    'invalid_root_package',
    'The package.json of root package is malformed.',
    {}
);

export const E_NO_ROOT_PACKAGE = errors.define(
    null,
    'no_root_package',
    'The root package not fond.',
    {}
);

export const E_SHELL_FAILED = errors.define(
    null,
    'shell_failed',
    'Failed to execute shell command.',
    {}
);

export const E_EXISTING_PACKAGE_JSON = errors.define(
    null,
    'existing_package_json',
    'Can not initialize an existing package.json without "--yes" option.',
    {}
);

export const E_UNKNOWN_SUB_PACKAGE = errors.define(
    null,
    'unknown_sub_package',
    'The determined sub packages does not exist.',
    {}
);

export const E_DEP_NOT_FOUND = errors.define(
    null,
    'dep_not_found',
    'No such a dependency.',
    {}
);

export const E_DEP_NOT_LOCKED = errors.define(
    null,
    'dep_not_locked',
    'No such a dependency in the root package.json.',
    {}
);

export const E_PRIVATE_DEPENDENCY = errors.define(
    null,
    'private_dependency',
    'Can not depend on a private sub package.',
    {}
);
