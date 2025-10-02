/**
 * Copyright 2025 Angus.Fenying <fenying@litert.org>
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

import * as LibOTP from '@litert/otp';
import * as NodeFS from 'node:fs';
import * as I from './Internal';
import * as NodePath from 'node:path';

export class OtpHelper {

    private readonly _logs: I.ILogger;

    public constructor() {

        this._logs = I.loggerFactory.createLogger('OtpHelper');
    }

    private _secret: string | null = null;

    public setSecret(secret: string): void {

        this._secret = secret;
    }

    public loadSecret(workspacePath: string): void {

        try {

            this._secret = NodeFS.readFileSync(
                NodePath.join(workspacePath, '.ottoia/otp_secret'),
                'utf-8'
            );

            this._logs.debug1('OTP secret loaded.');
        }
        catch {
            this._logs.debug1('No OTP secret found.');
        }
    }

    public isLoaded(): boolean {

        return this._secret !== null;
    }

    public getCode(): string | null {

        if (this._secret === null) {
            return null;
        }

        const otp = LibOTP.TOTP.generate(this._secret);

        return otp;
    }
}
