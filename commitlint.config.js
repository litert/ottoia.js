module.exports = {
    'extends': ['@commitlint/config-conventional'],
    'defaultIgnores': false,
    'rules': {
        'type-enum': [2, 'always', [
            'feat',
            'fix',
            'build'
        ]],
        'scope-enum': [2, 'always', [
            'cmd:install',
            'cmd:uninstall',
            'cmd:create',
            'cmd:init',
            'cmd:clean',
            'cmd:bootstrap',
            'cmd:release',
            'cmd:recall',
            'cmd:show',
            'skeleton',
            'log',
            'internal',
            'doc',
            'lint',
            'deps',
            'branch',
            'project'
        ]],
        'scope-empty': [2, 'never'],
        'subject-min-length': [2, 'always', 5],
        'subject-max-length': [2, 'always', 50],
    }
};
