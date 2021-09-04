# Changes Logs

## v0.3.1

-   fix(cmd:install): resolve dep tag/version correctly.

## v0.3.0

-   build(lint): upgraded eslint and applied to more stirct rules.
-   build(deps): upgraded `@litert/clap`.
-   build(project): applied to more strict typescript options.
-   feat(cmd:recall): added recall command.
-   feat(cmd:release): lock deps from package-lock.json.

## v0.2.3

-   feat(cmd:release): bind exact version of local packages.
-   feat(cmd:release): output npm publish log on debug1.

## v0.2.2

-   feat(cmd:release): prettify the published package.json.

## v0.2.1

-   fix(cmd:release): execute clean before everything.

## v0.2.0

-   feat(cmd:release): do `ottoia clean` before all `ottoia:prepublish` hook instead of cleaning in
    each project.

## v0.1.3

- fix(cmd:release): should specify tag on releasing.

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
