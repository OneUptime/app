import puppeteer from 'puppeteer';
import Email from 'Common/Types/Email';
import utils from '../../test-utils';
import init from '../../test-init';
let browser: $TSFixMe, page: $TSFixMe;

// Parent user credentials
const email: Email = utils.generateRandomBusinessEmail();
const password = '1234567890';

const monitorName: string = utils.generateRandomString();
const componentName: string = utils.generateRandomString();

describe('Incident Reports API', () => {
    const operationTimeOut: $TSFixMe = init.timeout;

    beforeAll(async () => {
        jest.setTimeout(360000);

        browser = await puppeteer.launch(utils.puppeteerLaunchConfig);
        page = await browser.newPage();
        await page.setUserAgent(utils.agent);

        const user: $TSFixMe = {
            email,
            password,
        };
        // User
        await init.registerUser(user, page);

        // Create component
        await init.addComponent(componentName, page);

        // Add new monitor to project
        await init.addNewMonitorToComponent(page, componentName, monitorName);
    });

    afterAll(async (done: $TSFixMe) => {
        await browser.close();
        done();
    });

    test(
        'should create 5 incidents and resolved them',
        async (done: $TSFixMe) => {
            for (let i: $TSFixMe = 0; i < 4; i++) {
                await init.navigateToMonitorDetails(
                    componentName,
                    monitorName,
                    page
                );

                await init.pageClick(
                    page,
                    `#monitorCreateIncident_${monitorName}`
                );

                await init.pageWaitForSelector(page, '#incidentType');

                await init.pageClick(page, '#createIncident');
                await init.pageWaitForSelector(page, '#createIncident', {
                    hidden: true,
                });

                await init.pageClick(page, '#viewIncident-0');

                await init.pageWaitForSelector(page, '#btnAcknowledge_0');

                await init.pageClick(page, '#btnAcknowledge_0');

                await init.pageClick(page, '#btnResolve_0');

                const resolvedConfirmation: $TSFixMe =
                    await init.pageWaitForSelector(page, '.bs-resolved-green');
                expect(resolvedConfirmation).toBeDefined();
            }
            done();
        },
        operationTimeOut
    );

    test(
        'should notice that all resolved incidents are closed on navigation to dashboard',
        async (done: $TSFixMe) => {
            // Resolved Incidents are closed on page reload or navigation to dashboard.
            await page.goto(utils.DASHBOARD_URL, {
                waitUntil: 'networkidle2',
            });

            const closedResolvedIncidents: $TSFixMe =
                await init.pageWaitForSelector(
                    page,
                    '#incidents-close-all-btn',
                    { hidden: true }
                );
            expect(closedResolvedIncidents).toBeNull();
            done();
        },
        operationTimeOut
    );
});
