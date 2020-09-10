# Changes Logs

## v0.1.1

- fix(cmd:install): did not save development dependencies to devDependencies.
- fix(internal): error while reading omitted deps fields.
- feat(cmd:release): execute "ottoia:clean" before publish.
- feat(cmd:release): added "--version" option to specify the target version.
- feat(cmd:release): added hook "ottoia:prepare" between "ottoia:prepublish" and "npm publish".
- feat(cmd:release): Use the version from root package for the new package.
- feat(cmd:clean): Now hook "clean" will be executed only when hook "ottoia:prepare" does not exist.
