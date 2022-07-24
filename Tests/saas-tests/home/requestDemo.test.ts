import puppeteer from 'puppeteer';
import Email from 'Common/Types/Email';
import utils from '../../test-utils';
import init from '../../test-init';

import axios from 'axios';

let page: $TSFixMe, browser: $TSFixMe;

// User credentials
const email: Email = utils.generateRandomBusinessEmail();
const queryString = '?utm_source=runningtest&good=thankyou&kill=love&ion=pure';
let queryObj: $TSFixMe = {};

describe('Demo form', () => {
    beforeAll(async (done: $TSFixMe) => {
        jest.setTimeout(init.timeout);

        browser = await puppeteer.launch(utils.puppeteerLaunchConfig);
        page = await browser.newPage();
        await page.setUserAgent(utils.agent);
        await page.goto(`${utils.HOME_URL}${queryString}`, {
            waitUntil: 'networkidle2',
        });

        await init.pageClick(page, '#accept-cookies');
        await page.goto(`${utils.HOME_URL}/enterprise/demo`, {
            waitUntil: 'networkidle2',
        });

        await init.pageWaitForSelector(page, '#form-section');

        await init.pageType(page, '#fullname', utils.user.name);

        await init.pageType(page, '#email', email);

        await init.pageType(page, '#Phone', utils.user.phone);

        await init.pageType(page, '#website', utils.user.website);

        await init.pageClick(page, '#country');
        await page.keyboard.press('ArrowDown');
        await page.keyboard.down('Enter');

        await init.pageClick(page, '#volume');
        await page.keyboard.press('ArrowDown');
        await page.keyboard.down('Enter');

        await init.pageType(page, '#message', utils.user.message);

        await init.pageClick(page, '#request-demo-btn');

        await init.pageWaitForSelector(page, '#success');
        // Check if user's email is submitted successfully
        await init.pageWaitForSelector(page, '.submitted-email', {
            visible: true,
            timeout: init.timeout,
        });

        const params: $TSFixMe = new URLSearchParams(queryString);
        // Formating query string to an object
        for (const param of params) {
            queryObj = { ...queryObj, [`${param[0]}`]: param[1] };
        }
        done();
    });

    afterAll(async (done: $TSFixMe) => {
        await browser.close();
        done();
    });

    test(
        'redirected query string should be save as source in the leads schema',
        async () => {
            const data: $TSFixMe = {
                collection: 'leads',
                query: { email: email },
            };
            const config: $TSFixMe = {
                method: 'post',
                url: utils.INIT_SCRIPT_URL + '/find',
                headers: {
                    'Content-Type': 'application/json',
                },
                data: data,
            };
            const res: $TSFixMe = await axios(config);
            const sourceObj: $TSFixMe = res.data[0].source;
            for (const key in sourceObj) {
                expect(sourceObj[key]).toEqual(queryObj[key]);
            }
        },
        init.timeout
    );
});
