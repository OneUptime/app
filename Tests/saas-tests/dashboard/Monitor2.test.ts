import puppeteer from 'puppeteer';
import Email from 'Common/Types/Email';
import utils from '../../test-utils';
import init from '../../test-init';

let browser: $TSFixMe, page: $TSFixMe;
import 'should';

// User credentials
const email: Email = utils.generateRandomBusinessEmail();
const password = '1234567890';
const componentName: string = utils.generateRandomString();
const monitorName: string = utils.generateRandomString();

describe('Monitor API', () => {
    const operationTimeOut: $TSFixMe = init.timeout;

    beforeAll(async () => {
        jest.setTimeout(600000);

        browser = await puppeteer.launch(utils.puppeteerLaunchConfig);
        page = await browser.newPage();
        await page.setUserAgent(utils.agent);

        const user: $TSFixMe = {
            email,
            password,
        };
        await init.registerUser(user, page);
        await init.addMonitorToComponent(componentName, monitorName, page); // This creates a default component and a monitor. The monitor created here will be used by other tests as required
    });

    afterAll(async (done: $TSFixMe) => {
        await browser.close();
        done();
    });

    test('should display lighthouse scores', async (done: $TSFixMe) => {
        /*
         * Navigate to Component details
         * This navigates to the monitor created alongside the created component
         */
        await init.navigateToMonitorDetails(componentName, monitorName, page);

        await init.pageWaitForSelector(page, '#website_scanning', {
            timeout: 600000,
        });
        await init.pageWaitForSelector(page, '#website_postscan', {
            timeout: 600000,
        });

        await init.pageWaitForSelector(
            page,
            `#lighthouseLogs_${monitorName}_0`,
            {
                visible: true,
                timeout: 600000,
            }
        );

        let lighthousePerformanceElement: $TSFixMe =
            await init.pageWaitForSelector(
                page,
                `#lighthouse-performance-${monitorName}`,
                { visible: true, timeout: 600000 }
            );
        lighthousePerformanceElement =
            await lighthousePerformanceElement.getProperty('innerText');
        lighthousePerformanceElement =
            await lighthousePerformanceElement.jsonValue();
        lighthousePerformanceElement.should.endWith('%');

        let lighthouseAccessibilityElement: $TSFixMe =
            await init.pageWaitForSelector(
                page,
                `#lighthouse-accessibility-${monitorName}`,
                { visible: true, timeout: operationTimeOut }
            );
        lighthouseAccessibilityElement =
            await lighthouseAccessibilityElement.getProperty('innerText');
        lighthouseAccessibilityElement =
            await lighthouseAccessibilityElement.jsonValue();
        lighthouseAccessibilityElement.should.endWith('%');

        let lighthouseBestPracticesElement: $TSFixMe =
            await init.pageWaitForSelector(
                page,
                `#lighthouse-bestPractices-${monitorName}`,
                { visible: true, timeout: operationTimeOut }
            );
        lighthouseBestPracticesElement =
            await lighthouseBestPracticesElement.getProperty('innerText');
        lighthouseBestPracticesElement =
            await lighthouseBestPracticesElement.jsonValue();
        lighthouseBestPracticesElement.should.endWith('%');

        let lighthouseSeoElement: $TSFixMe = await init.pageWaitForSelector(
            page,
            `#lighthouse-seo-${monitorName}`,
            { visible: true, timeout: operationTimeOut }
        );
        lighthouseSeoElement = await lighthouseSeoElement.getProperty(
            'innerText'
        );
        lighthouseSeoElement = await lighthouseSeoElement.jsonValue();
        lighthouseSeoElement.should.endWith('%');

        let lighthousePwaElement: $TSFixMe = await init.pageWaitForSelector(
            page,
            `#lighthouse-pwa-${monitorName}`,
            { visible: true, timeout: operationTimeOut }
        );
        lighthousePwaElement = await lighthousePwaElement.getProperty(
            'innerText'
        );
        lighthousePwaElement = await lighthousePwaElement.jsonValue();
        lighthousePwaElement.should.endWith('%');
        done();
    }, 600000);

    test(
        'should display multiple probes and monitor chart on refresh',
        async (done: $TSFixMe) => {
            /*
             * Navigate to Component details
             * This navigates to the monitor created alongside the created component
             */
            await init.navigateToMonitorDetails(
                componentName,
                monitorName,
                page
            );

            const probe0: $TSFixMe = await init.pageWaitForSelector(
                page,
                '#probes-btn0'
            );

            const probe1: $TSFixMe = await init.pageWaitForSelector(
                page,
                '#probes-btn1'
            );

            expect(probe0).toBeDefined();
            expect(probe1).toBeDefined();

            const monitorStatus: $TSFixMe = await init.pageWaitForSelector(
                page,
                `#monitor-status-${monitorName}`
            );

            const sslStatus: $TSFixMe = await init.pageWaitForSelector(
                page,
                `#ssl-status-${monitorName}`
            );

            expect(monitorStatus).toBeDefined();
            expect(sslStatus).toBeDefined();
            done();
        },
        operationTimeOut
    );
});
