import puppeteer from 'puppeteer';
import Email from 'Common/Types/Email';
import utils from '../../test-utils';
import init from '../../test-init';

import 'should';

let browser: $TSFixMe, page: $TSFixMe;
// User credentials
const email: Email = utils.generateRandomBusinessEmail();
const password = '1234567890';

const user: $TSFixMe = {
    email,
    password,
};

describe('BreadCrumb Component test', () => {
    const operationTimeOut: $TSFixMe = init.timeout;

    beforeAll(async (done: $TSFixMe) => {
        jest.setTimeout(init.timeout);

        browser = await puppeteer.launch(utils.puppeteerLaunchConfig);
        page = await browser.newPage();
        await page.setUserAgent(utils.agent);
        // User
        await init.registerUser(user, page);
        done();
    });

    afterAll(async (done: $TSFixMe) => {
        await browser.close();
        done();
    });

    test(
        'Should navigate between pages from the breadcrumbs',
        async (done: $TSFixMe) => {
            const componentName: string = utils.generateRandomString();
            const monitorName: string = utils.generateRandomString();

            await page.goto(utils.DASHBOARD_URL, {
                waitUntil: ['networkidle2'],
            });
            await init.addMonitorToComponent(componentName, monitorName, page);

            const monitorBreadcrumb: $TSFixMe = await init.pageWaitForSelector(
                page,
                `#cb${monitorName}`,
                {
                    visible: true,
                }
            );

            const componentBreadcrumb: $TSFixMe =
                await init.pageWaitForSelector(page, '#cbMonitors');
            expect(monitorBreadcrumb).toBeDefined();
            expect(componentBreadcrumb).toBeDefined();

            await init.pageClick(page, '#cbMonitors');

            const monitorTitle: $TSFixMe = await init.pageWaitForSelector(
                page,
                `#monitor-title-${monitorName}`,
                { visible: true, timeout: init.timeout }
            );
            expect(monitorTitle).toBeDefined();
            done();
        },
        operationTimeOut
    );

    test(
        'Should not go to the landing page when the project breadcrumb item is clicked',
        async (done: $TSFixMe) => {
            await page.goto(utils.DASHBOARD_URL, {
                waitUntil: ['networkidle2'],
            });
            await init.pageWaitForSelector(page, '#cbUnnamedProject', {
                visible: true,
                timeout: init.timeout,
            });

            await init.pageClick(page, '#cbUnnamedProject');
            let currentPage: $TSFixMe = await init.pageWaitForSelector(
                page,
                '#cbUnnamedProject',
                {
                    visible: true,
                    timeout: init.timeout,
                }
            );
            currentPage = await currentPage.getProperty('innerText');
            currentPage = await currentPage.jsonValue();
            expect(currentPage).toBe('Unnamed Project');

            done();
        },
        operationTimeOut
    );
});
