import utils from '../../test-utils';

import puppeteer from 'puppeteer';
import Email from 'Common/Types/Email';
import init from '../../test-init';

let page: $TSFixMe, browser: $TSFixMe;

const email: Email = utils.generateRandomBusinessEmail();
const password = '1234567890';
const user: $TSFixMe = {
    email,
    password,
};

const projectName: string = utils.generateRandomString();
const statusPageName: string = utils.generateRandomString();

describe('Probe bar test', () => {
    beforeAll(async (done: $TSFixMe) => {
        jest.setTimeout(init.timeout);

        browser = await puppeteer.launch(utils.puppeteerLaunchConfig);
        page = await browser.newPage();
        await page.setUserAgent(utils.agent);
        done();
    });

    afterAll(async (done: $TSFixMe) => {
        await browser.close();
        done();
    });

    test(
        'Probe bar should not show by default',
        async (done: $TSFixMe) => {
            await init.registerUser(user, page);
            await init.renameProject(projectName, page);
            await init.growthPlanUpgrade(page); // Only Monthly growth plan can enable subscribers in StatusPage

            // Create a StatusPage and Scheduled Maintenance to display in the StatusPage Url
            await page.goto(utils.DASHBOARD_URL, {
                waitUntil: 'networkidle2',
            });

            await init.pageWaitForSelector(page, '#statusPages');

            await init.pageClick(page, '#statusPages');

            await init.pageWaitForSelector(
                page,
                `#btnCreateStatusPage_${projectName}`
            );

            await init.pageClick(page, `#btnCreateStatusPage_${projectName}`);

            await init.pageWaitForSelector(page, '#name');
            await init.pageWaitForSelector(page, 'input[id=name]', {
                visible: true,
                timeout: init.timeout,
            });

            await init.pageClick(page, 'input[id=name]');
            await page.focus('input[id=name]');

            await init.pageType(page, 'input[id=name]', statusPageName);

            await init.pageClick(page, '#btnCreateStatusPage');

            await init.pageWaitForSelector(page, '#statusPagesListContainer');

            await init.pageWaitForSelector(page, '#viewStatusPage');

            await init.pageClick(page, '#viewStatusPage');

            await init.pageWaitForSelector(page, `#header-${statusPageName}`);

            await init.pageWaitForSelector(page, '#publicStatusPageUrl');

            let link: $TSFixMe = await init.page$(
                page,
                '#publicStatusPageUrl > span > a'
            );
            link = await link.getProperty('href');
            link = await link.jsonValue();
            await page.goto(link);

            // To confirm if the probe shows after creating a status.
            const probeBar: $TSFixMe = await page.evaluate(() => {
                const el: $TSFixMe = document.querySelector('.bs-probes');

                return el ? el.innerText : '';
            });
            expect(probeBar).toMatch('');
            done();
        },
        init.timeout
    );
});
