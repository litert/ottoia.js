#!/bin/env node

import OttoiaCLI from './CLI';

new OttoiaCLI().main().catch((e) => console.error(e?.toJSON?.() ?? e));
