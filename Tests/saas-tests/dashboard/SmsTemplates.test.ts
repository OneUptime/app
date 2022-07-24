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

describe('SMS Templates API', () => {
    const operationTimeOut: $TSFixMe = init.timeout;

    let initialTemplate: $TSFixMe;

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
        'should not show reset button if sms template is not saved yet',
        async (done: $TSFixMe) => {
            await page.goto(utils.DASHBOARD_URL, {
                waitUntil: ['networkidle2'],
            });

            await init.pageWaitForSelector(page, '#projectSettings');

            await init.pageClick(page, '#projectSettings');

            await init.pageWaitForSelector(page, '#more');

            await init.pageClick(page, '#more');

            await init.pageWaitForSelector(page, '#smsCalls');

            await init.pageClick(page, '#smsCalls');

            await init.pageWaitForSelector(page, '#type');
            await init.selectDropdownValue(
                '#type',
                'Subscriber Incident Created',
                page
            );

            await init.pageWaitForSelector(page, '#templateField');
            initialTemplate = await init.page$Eval(
                page,
                '#templateField',
                (elem: $TSFixMe) => {
                    return elem.value;
                }
            );
            const resetBtn: $TSFixMe = await init.pageWaitForSelector(
                page,
                '#templateReset',
                {
                    hidden: true,
                }
            );
            expect(resetBtn).toBeNull();

            done();
        },
        operationTimeOut
    );

    test(
        'Should update default sms template',
        async (done: $TSFixMe) => {
            await page.goto(utils.DASHBOARD_URL, {
                waitUntil: ['networkidle2'],
            });

            await init.pageWaitForSelector(page, '#projectSettings');

            await init.pageClick(page, '#projectSettings');

            await init.pageWaitForSelector(page, '#more');

            await init.pageClick(page, '#more');

            await init.pageWaitForSelector(page, '#smsCalls');

            await init.pageClick(page, '#smsCalls');

            await init.pageWaitForSelector(page, '#type');
            await init.selectDropdownValue(
                '#type',
                ' Subscriber Incident Created',
                page
            );

            await init.pageWaitForSelector(page, '#frmSmsTemplate');
            const newTemplate = 'New Body';
            await init.pageClick(page, 'textarea[name=body]', {
                clickCount: 3,
            });

            await init.pageType(page, 'textarea[name=body]', newTemplate);

            await init.pageClick(page, '#saveTemplate');
            await init.pageWaitForSelector(page, '.ball-beat', {
                hidden: true,
            });

            await page.reload({
                waitUntil: ['networkidle2', 'domcontentloaded'],
            });
            await init.selectDropdownValue(
                '#type',
                'Subscriber Incident Created',
                page
            );

            await init.pageWaitForSelector(page, '#frmSmsTemplate');

            const smsTemplateBody: $TSFixMe = await init.page$Eval(
                page,
                'textarea[name=body]',
                (el: $TSFixMe) => {
                    return el.value;
                }
            );
            expect(smsTemplateBody).toEqual(newTemplate);

            done();
        },
        operationTimeOut
    );

    test(
        'should show reset button when a template is already saved',
        async (done: $TSFixMe) => {
            await page.goto(utils.DASHBOARD_URL, {
                waitUntil: ['networkidle2'],
            });

            await init.pageWaitForSelector(page, '#projectSettings');

            await init.pageClick(page, '#projectSettings');

            await init.pageWaitForSelector(page, '#more');

            await init.pageClick(page, '#more');

            await init.pageWaitForSelector(page, '#smsCalls');

            await init.pageClick(page, '#smsCalls');

            await init.pageWaitForSelector(page, '#type');
            await init.selectDropdownValue(
                '#type',
                'Subscriber Incident Created',
                page
            );
            const resetBtn: $TSFixMe = await init.pageWaitForSelector(
                page,
                '#templateReset',
                {
                    visible: true,
                    timeout: init.timeout,
                }
            );
            expect(resetBtn).toBeDefined();

            done();
        },
        operationTimeOut
    );

    test(
        'should reset template to default state',
        async (done: $TSFixMe) => {
            await page.goto(utils.DASHBOARD_URL, {
                waitUntil: ['networkidle2'],
            });

            await init.pageWaitForSelector(page, '#projectSettings');

            await init.pageClick(page, '#projectSettings');

            await init.pageWaitForSelector(page, '#more');

            await init.pageClick(page, '#more');

            await init.pageWaitForSelector(page, '#smsCalls');

            await init.pageClick(page, '#smsCalls');

            await init.pageWaitForSelector(page, '#type');
            await init.selectDropdownValue(
                '#type',
                'Subscriber Incident Created',
                page
            );

            await init.pageWaitForSelector(page, '#templateReset');

            await init.pageClick(page, '#templateReset');

            await init.pageWaitForSelector(page, '#ResetSmsTemplate');

            await init.pageClick(page, '#ResetSmsTemplate');

            await init.pageWaitForSelector(page, '#ResetSmsTemplate', {
                hidden: true,
            });
            await page.reload();

            await init.pageWaitForSelector(page, '#type');
            await init.selectDropdownValue(
                '#type',
                'Subscriber Incident Created',
                page
            );

            await init.pageWaitForSelector(page, '#templateField');
            const template: $TSFixMe = await init.page$Eval(
                page,
                '#templateField',
                (elem: $TSFixMe) => {
                    return elem.value;
                }
            );
            expect(template).toEqual(initialTemplate);

            done();
        },
        operationTimeOut
    );
});
