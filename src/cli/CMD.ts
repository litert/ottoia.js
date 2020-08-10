#!/bin/env node

import OttoiaCLI from './CLI';

new OttoiaCLI().main().catch((e) => {

    console.error('EEEE');
    if (e?.toJSON) {

        console.error(e.toJSON());
        process.exit(e.code);
    }

    console.error(e);
    process.exit(-1);
});
