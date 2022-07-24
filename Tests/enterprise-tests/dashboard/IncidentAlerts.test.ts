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

const componentName: string = utils.generateRandomString();
const monitorName: string = utils.generateRandomString();
const callScheduleName: string = utils.generateRandomString();

describe('Schedule', () => {
    const operationTimeOut: $TSFixMe = init.timeout;

    beforeAll(async (done: $TSFixMe) => {
        jest.setTimeout(init.timeout);

        browser = await puppeteer.launch(utils.puppeteerLaunchConfig);
        page = await browser.newPage();
        await page.setUserAgent(utils.agent);

        await init.registerEnterpriseUser(user, page);
        const enableSms: $TSFixMe = true;
        const enableCalls: $TSFixMe = true;
        const { accountSid, authToken, phoneNumber }: $TSFixMe =
            utils.twilioCredentials;
        const alertLimit = '100';
        await init.addGlobalTwilioSettings(
            enableSms,
            enableCalls,
            accountSid,
            authToken,
            phoneNumber,
            alertLimit,
            page
        );
        await init.logout(page);
        await init.loginUser(user, page);
        await init.setAlertPhoneNumber('+19173976123', '123456', page);
        await init.addMonitorToComponent(componentName, monitorName, page);
        await init.addAnExternalSubscriber(
            componentName,
            monitorName,
            'SMS',
            page,
            {
                countryCode: '+1',
                phoneNumber: '9173976128',
            }
        );

        await init.addSchedule(callScheduleName, page);

        await init.pageWaitForSelector(page, 'table tbody tr:first-child');

        await init.pageClick(page, 'table tbody tr:first-child');

        await init.pageWaitForSelector(page, '#btnSaveMonitors');

        await init.pageClick(page, '#scheduleMonitor_0');

        await init.pageClick(page, '#btnSaveMonitors');
        await init.page$Eval(
            page,
            'input[name="OnCallAlertBox[0].email"]',
            (element: $TSFixMe) => {
                return element.click();
            }
        );
        await init.page$Eval(
            page,
            'input[name="OnCallAlertBox[0].sms"]',
            (element: $TSFixMe) => {
                return element.click();
            }
        );
        await init.page$Eval(
            page,
            'input[name="OnCallAlertBox[0].call"]',
            (element: $TSFixMe) => {
                return element.click();
            }
        );
        await init.selectDropdownValue(
            'div[id="OnCallAlertBox[0].teams[0].teamMembers[0].userId"]',
            'Test Name',
            page
        );

        await init.pageClick(page, '#saveSchedulePolicy');

        done();
    });

    afterAll(async (done: $TSFixMe) => {
        await browser.close();
        done();
    });

    test(
        'should send on-call and external subscribers alerts when an incident is created.',
        async (done: $TSFixMe) => {
            await init.addIncident(monitorName, 'offline', page);

            await init.pageWaitForSelector(page, '#viewIncident-0');

            await init.pageClick(page, '#viewIncident-0');

            await init.pageWaitForSelector(page, '#react-tabs-4');

            await init.pageClick(page, '#react-tabs-4');

            await init.pageWaitForSelector(page, '#TeamAlertLogBox');

            const firstOncallAlertStatusSelector: $TSFixMe =
                '#TeamAlertLogBox tbody tr:nth-last-of-type(1) td:last-of-type';

            await init.pageWaitForSelector(
                page,
                firstOncallAlertStatusSelector
            );

            const firstOncallAlertStatus: $TSFixMe = await init.page$Eval(
                page,
                firstOncallAlertStatusSelector,
                (element: $TSFixMe) => {
                    return element.textContent;
                }
            );

            expect(firstOncallAlertStatus).toEqual('Success');

            await init.pageWaitForSelector(page, '#subscriberAlertTable');
            const subscriberAlertStatusSelector: $TSFixMe =
                '#subscriberAlertTable tbody tr:first-of-type td:nth-last-of-type(1)';
            const subscriberAlertTypeSelector: $TSFixMe =
                '#subscriberAlertTable tbody tr:first-of-type td:nth-last-of-type(2)';

            const subscriberAlertStatus: $TSFixMe = await init.page$Eval(
                page,
                subscriberAlertStatusSelector,
                (element: $TSFixMe) => {
                    return element.textContent;
                }
            );
            expect(subscriberAlertStatus).toEqual('Sent');

            const subscriberAlertType: $TSFixMe = await init.page$Eval(
                page,
                subscriberAlertTypeSelector,
                (element: $TSFixMe) => {
                    return element.textContent;
                }
            );
            expect(subscriberAlertType).toEqual('identified');
            done();
        },
        operationTimeOut
    );
});
