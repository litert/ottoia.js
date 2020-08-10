import * as C from '../Common';

class BuiltInVersionNamer implements C.IVersionNamer {

    public next(
        current: string,
        env: string,
        withBreakingChanges: boolean,
        withNewFeatures: boolean,
        // withPatches: boolean,
    ): string {

        const ret: [number, number, number, ] = current.split('.').slice(0, 3).map(
            (v) => {

                const ret = parseInt(v);

                return Number.isSafeInteger(ret) ? ret : 0;
            }
        ) as any;

        if (withBreakingChanges) {

            ret[0]++;
        }
        else if (withNewFeatures) {

            ret[1]++;
        }
        else /*if (withPatches)*/ {

            ret[2]++;
        }

        return ret.join('.');
    }
}

export function createBuiltInVersionNamer(): C.IVersionNamer {

    return new BuiltInVersionNamer();
}
