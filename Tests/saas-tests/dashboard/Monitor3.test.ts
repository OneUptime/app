import puppeteer from 'puppeteer';
import Email from 'Common/Types/Email';
import utils from '../../test-utils';
import init from '../../test-init';

let browser: $TSFixMe, page: $TSFixMe;
import 'should';

// User credentials
const email: Email = utils.generateRandomBusinessEmail();
const password = '1234567890';
const projectName: string = utils.generateRandomString();
const callSchedule: string = utils.generateRandomString();
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
        await init.renameProject(projectName, page);
        await init.addSchedule(callSchedule, projectName, page);
        await init.addMonitorToComponent(componentName, monitorName, page); // This creates a default component and a monitor. The monitor created here will be used by other tests as required
    });

    afterAll(async (done: $TSFixMe) => {
        await browser.close();
        done();
    });

    test(
        'Should create new monitor with call schedules',
        async (done: $TSFixMe) => {
            /*
             * Create Component first
             * Redirects automatically component to details page
             */
            await init.navigateToComponentDetails(componentName, page);
            const monitorName: string = utils.generateRandomString();

            await init.pageWaitForSelector(page, '#cbMonitors');

            await init.pageClick(page, '#newFormId');

            await init.pageWaitForSelector(page, '#form-new-monitor');
            await init.pageWaitForSelector(page, 'input[id=name]', {
                visible: true,
                timeout: init.timeout,
            });
            await init.pageWaitForSelector(page, 'input[id=name]', {
                visible: true,
                timeout: init.timeout,
            });

            await init.pageClick(page, 'input[id=name]');
            await page.focus('input[id=name]');

            await init.pageType(page, 'input[id=name]', monitorName);

            await init.pageClick(page, '[data-testId=type_url]');
            await init.pageWaitForSelector(page, '#url', {
                visible: true,
                timeout: init.timeout,
            });

            await init.pageClick(page, '#url');

            await init.pageType(page, '#url', 'https://google.com');
            // Select multiple schedules
            await init.page$$Eval(
                page,
                '[data-testId^=callSchedules_]',
                (schedules: $TSFixMe) => {
                    return schedules.forEach((schedule: $TSFixMe) => {
                        return schedule.click();
                    });
                }
            );

            await init.pageClick(page, 'button[type=submit]');

            let spanElement: $TSFixMe = await init.pageWaitForSelector(
                page,
                `#monitor-title-${monitorName}`
            );
            spanElement = await spanElement.getProperty('innerText');
            spanElement = await spanElement.jsonValue();
            spanElement.should.be.exactly(monitorName);

            await init.pageClick(page, `#edit_${monitorName}`);

            const checkboxValues: $TSFixMe = await init.page$$Eval(
                page,
                '[data-testId^=callSchedules_]',
                (schedules: $TSFixMe) => {
                    return schedules.map((schedule: $TSFixMe) => {
                        return schedule.checked;
                    });
                }
            );

            const areAllChecked: $TSFixMe = checkboxValues.every(
                (checked: $TSFixMe) => {
                    return checked === true;
                }
            );
            expect(areAllChecked).toEqual(true);
            done();
        },
        operationTimeOut
    );

    test(
        'Should not create new monitor when details are incorrect',
        async (done: $TSFixMe) => {
            // Navigate to Component details
            await init.navigateToComponentDetails(componentName, page);

            await init.pageWaitForSelector(page, '#cbMonitors');

            await init.pageClick(page, '#newFormId');

            await init.pageWaitForSelector(page, '#form-new-monitor');

            await init.pageClick(page, '[data-testId=type_url]');
            await init.pageWaitForSelector(page, '#url', {
                visible: true,
                timeout: init.timeout,
            });

            await init.pageClick(page, '#url');

            await init.pageType(page, '#url', 'https://google.com');

            await init.pageClick(page, 'button[type=submit]');

            let spanElement: $TSFixMe = await init.pageWaitForSelector(
                page,
                '#form-new-monitor span#field-error'
            );
            spanElement = await spanElement.getProperty('innerText');
            spanElement = await spanElement.jsonValue();
            spanElement.should.be.exactly('This field cannot be left blank');
            done();
        },
        operationTimeOut
    );

    test('should display SSL enabled status', async (done: $TSFixMe) => {
        // Navigate to Component details
        await init.navigateToMonitorDetails(componentName, monitorName, page);
        //Await init.pageWaitForSelector(page, '#website_postscan');
        let sslStatusElement: $TSFixMe = await init.pageWaitForSelector(
            page,
            `#ssl-status-${monitorName}`,
            { visible: true, timeout: 600000 }
        );
        sslStatusElement = await sslStatusElement.getProperty('innerText');
        sslStatusElement = await sslStatusElement.jsonValue();
        sslStatusElement.should.be.exactly('Enabled');
        done();
    }, 600000);
});
