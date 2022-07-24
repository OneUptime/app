import puppeteer from 'puppeteer';
import Email from 'Common/Types/Email';
import utils from '../../test-utils';
import init from '../../test-init';
let browser: $TSFixMe, page: $TSFixMe;

import 'should';

// User credentials
const userEmail: Email = utils.generateRandomBusinessEmail();
const password = '1234567890';

describe('Enterprise License API', () => {
    const operationTimeOut: $TSFixMe = init.timeout;

    beforeAll(async (done: $TSFixMe) => {
        jest.setTimeout(init.timeout);

        browser = await puppeteer.launch(utils.puppeteerLaunchConfig);
        page = await browser.newPage();
        await page.setUserAgent(utils.agent);

        const user: $TSFixMe = {
            email: userEmail,
            password: password,
        };
        // User

        await init.registerEnterpriseUser(user, page, false);
        //Await browser.close();
        done();
    });

    afterAll(async (done: $TSFixMe) => {
        await browser.close();
        done();
    });

    test(
        'Should not confirm expired license',
        async (done: $TSFixMe) => {
            await page.goto(utils.ADMIN_DASHBOARD_URL);

            await init.pageWaitForSelector(page, '#settings');

            await init.pageClick(page, '#settings');

            await init.pageWaitForSelector(page, '#license');

            await init.pageClick(page, 'input[name=license]');

            await init.pageType(page, 'input[name=license]', 'expired-license');

            await init.pageClick(page, 'input[name=email]');

            await init.pageType(
                page,
                'input[name=email]',
                utils.generateRandomBusinessEmail()
            );

            await init.pageClick(page, 'button[type=submit]');

            const expiredError: $TSFixMe = await init.page$Eval(
                page,
                '#licenseError',
                (e: $TSFixMe) => {
                    return e.innerHTML;
                }
            );

            expect(expiredError).toEqual('License Expired');

            done();
        },
        operationTimeOut
    );
});
