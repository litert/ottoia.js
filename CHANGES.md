# Changes Logs

## v0.1.2

- config(deps): updated development deps.
- feat(internal): replaced exception mechanism.

## v0.1.1

- fix(cmd:install): did not save development dependencies to devDependencies.
- fix(internal): error while reading omitted deps fields.
- fix(internal): error while installing deps with tag.
- feat(cmd:release): execute "ottoia:clean" before publish.
- feat(cmd:release): added "--version" option to specify the target version.
- feat(cmd:release): added hook "ottoia:prepare" between "ottoia:prepublish" and "npm publish".
- feat(cmd:release): Use the version from root package for the new package.
- feat(cmd:clean): Now hook "clean" will be executed only when hook "ottoia:prepare" does not exist.
