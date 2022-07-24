import puppeteer from 'puppeteer';
import Email from 'Common/Types/Email';

import utils from '../../test-utils';
import init from '../../test-init';
let browser: $TSFixMe, page: $TSFixMe;
import 'should';

const email: Email = utils.generateRandomBusinessEmail();
const password = '1234567890';

describe('Settings Component (IS_SAAS_SERVICE=false)', () => {
    const operationTimeOut: $TSFixMe = init.timeout;

    beforeAll(async (done: $TSFixMe) => {
        jest.setTimeout(init.timeout);

        browser = await puppeteer.launch(utils.puppeteerLaunchConfig);
        page = await browser.newPage();
        await page.setUserAgent(utils.agent);

        const user: $TSFixMe = {
            email: email,
            password: password,
        };

        await init.registerEnterpriseUser(user, page, false);

        done();
    });

    afterAll(async (done: $TSFixMe) => {
        await browser.close();
        done();
    });

    test(
        'should show settings option in the admin dashboard',
        async () => {
            await page.goto(utils.ADMIN_DASHBOARD_URL, {
                waitUntil: 'networkidle0',
            });

            // If element does not exist it will timeout and throw
            const elem: $TSFixMe = await init.pageWaitForSelector(
                page,
                '#settings',
                {
                    visible: true,
                    timeout: init.timeout,
                }
            );
            expect(elem).toBeDefined();
        },
        operationTimeOut
    );

    test(
        'should show license option in the admin dashboard',
        async () => {
            await page.goto(utils.ADMIN_DASHBOARD_URL, {
                waitUntil: 'networkidle0',
            });

            await init.pageWaitForSelector(page, '#settings', {
                visible: true,
                timeout: init.timeout,
            });
            await init.page$Eval(page, '#settings a', (elem: $TSFixMe) => {
                return elem.click();
            });

            // If element does not exist it will timeout and throw
            const licenseOption: $TSFixMe = await init.pageWaitForSelector(
                page,
                '#license',
                {
                    visible: true,
                    timeout: init.timeout,
                }
            );
            expect(licenseOption).toBeDefined();
        },
        operationTimeOut
    );
});
