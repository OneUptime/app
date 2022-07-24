import puppeteer from 'puppeteer';
import utils from '../../test-utils';
import init from '../../test-init';

let browser: $TSFixMe, page: $TSFixMe;
const user: $TSFixMe = {
    email: utils.generateRandomBusinessEmail(),
    password: '1234567890',
};
const componentName: string = utils.generateRandomString();
const monitorName: string = utils.generateRandomString();
const onCallName: string = utils.generateRandomString();
const projectName: string = utils.generateRandomString();

/**
 * This is a test to check:
 * No errors on page reload
 * It stays on the same page on reload
 */

describe('OneUptime Page Reload', () => {
    const operationTimeOut: $TSFixMe = init.timeout;

    beforeAll(async (done: $TSFixMe) => {
        jest.setTimeout(init.timeout);

        browser = await puppeteer.launch(utils.puppeteerLaunchConfig);
        page = await browser.newPage();
        await page.setUserAgent(utils.agent);

        await init.registerUser(user, page); // This automatically routes to dashboard page
        await init.renameProject(projectName, page);
        await init.addComponent(componentName, page);
        await init.addNewMonitorToComponent(page, componentName, monitorName);
        done();
    });

    afterAll(async (done: $TSFixMe) => {
        await browser.close();
        done();
    });

    test(
        'Should reload the on call-duty page and confirm there are no errors',
        async (done: $TSFixMe) => {
            await page.goto(utils.DASHBOARD_URL, {
                waitUntil: ['networkidle2'],
            });
            await init.pageWaitForSelector(page, '#onCallDuty', {
                visible: true,
                timeout: init.timeout,
            });
            await init.page$Eval(page, '#onCallDuty', (elem: $TSFixMe) => {
                return elem.click();
            });
            const createScheduleBtn = `#btnCreateSchedule_${projectName}`;
            await init.pageWaitForSelector(page, createScheduleBtn, {
                visible: true,
                timeout: init.timeout,
            });
            await init.page$Eval(page, createScheduleBtn, (elem: $TSFixMe) => {
                return elem.click();
            });

            await init.pageWaitForSelector(page, '#name', {
                visible: true,
                timeout: init.timeout,
            });

            await init.pageType(page, '#name', onCallName);

            await init.pageClick(page, '#btnCreateSchedule');
            await init.pageWaitForSelector(page, '#name', { hidden: true });

            await init.pageWaitForSelector(page, '#viewOnCallSchedule', {
                visible: true,
                timeout: init.timeout,
            });

            await init.pageClick(page, '#viewOnCallSchedule');
            await init.pageWaitForSelector(page, '#scheduleMonitor_0', {
                visible: true,
                timeout: init.timeout,
            });

            await init.pageClick(page, '#scheduleMonitor_0');
            await init.pageWaitForSelector(page, '#btnSaveMonitors', {
                visible: true,
                timeout: init.timeout,
            });

            await init.pageClick(page, '#btnSaveMonitors');

            await init.selectDropdownValue(
                '.css-1uccc91-singleValue',
                'Test Name',
                page
            );
            await init.pageWaitForSelector(page, '#saveSchedulePolicy', {
                visible: true,
                timeout: init.timeout,
            });

            await init.pageClick(page, '#saveSchedulePolicy');

            // To confirm no errors and stays on the same page on reload
            await page.reload({ waitUntil: 'networkidle2' });
            await init.pageWaitForSelector(page, '#cbOn-CallDuty', {
                visible: true,
                timeout: init.timeout,
            });
            await init.pageWaitForSelector(page, `#cb${onCallName}`, {
                visible: true,
                timeout: init.timeout,
            });

            const spanElement: $TSFixMe = await init.pageWaitForSelector(
                page,
                '#onCallDutyNote',
                {
                    visible: true,
                    timeout: init.timeout,
                }
            );
            expect(spanElement).toBeDefined();

            done();
        },
        operationTimeOut
    );
});
