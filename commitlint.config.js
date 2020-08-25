module.exports = {
    'extends': ['@commitlint/config-conventional'],
    'defaultIgnores': false,
    'rules': {
        'type-enum': [2, 'always', [
            'feat',
            'fix',
            'add',
            'test',
            'refactor',
            'config',
            'merge'
        ]],
        'scope-enum': [2, 'always', [
            'cmd:install',
            'cmd:uninstall',
            'cmd:create',
            'cmd:init',
            'cmd:clean',
            'cmd:bootstrap',
            'cmd:release',
            'cmd:show',
            'skeleton',
            'log',
            'internal',
            'doc',
            'lint',
            'branch',
            'global'
        ]],
        'scope-empty': [2, 'never'],
        'subject-min-length': [2, 'always', 5],
        'subject-max-length': [2, 'always', 50],
    }
};
