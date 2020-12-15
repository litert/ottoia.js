/**
 * Copyright 2020 Angus.Fenying <fenying@litert.org>
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

export type IWaitResult<T, TE> = {

    success: true;

    result: T;

} | {

    success: false;

    result: new () => TE;
};

/**
 * Wait for multi-tasks, and get all results, whatever succeed or failed.
 *
 * @param tasks The all tasks' promises.
 */
export function multiTasks<T, TE>(
    tasks: Array<Promise<T>>
): Promise<Array<IWaitResult<T, TE>>> {

    return new Promise<Array<IWaitResult<T, TE>>>(function(resolve): void {

        let ret: Array<IWaitResult<T, TE>> = Array(tasks.length);

        let done: number = 0;

        for (let i = 0; i < tasks.length; i++) {

            tasks[i].then(function(r): void {

                ret[i] = {
                    success: true,
                    result: r
                };

                if (++done === tasks.length) {

                    resolve(ret);
                }

            }).catch(function(e): void {

                ret[i] = {
                    success: false,
                    result: e
                };

                if (++done === tasks.length) {

                    resolve(ret);
                }
            });
        }
    });
}
