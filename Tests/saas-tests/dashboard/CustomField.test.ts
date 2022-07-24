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
const incidentFieldText: $TSFixMe = {
        fieldName: 'textField',
        fieldType: 'text',
    },
    incidentFieldNumber: $TSFixMe = {
        fieldName: 'numField',
        fieldType: 'number',
    };

describe('Incident Custom Field', () => {
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
        'should configure incident custom field in a project',
        async (done: $TSFixMe) => {
            await init.addCustomField(page, incidentFieldText, 'incident');
            await init.navigateToCustomField(page);
            const firstCustomField: $TSFixMe = await init.pageWaitForSelector(
                page,
                `#customfield_${incidentFieldText.fieldName}`,
                { visible: true, timeout: init.timeout }
            );
            expect(firstCustomField).toBeDefined();
            done();
        },
        operationTimeOut
    );

    test(
        'should update a incident custom field in a project',
        async (done: $TSFixMe) => {
            await init.navigateToCustomField(page);
            await init.pageWaitForSelector(page, '#editCustomField_0', {
                visible: true,
                timeout: init.timeout,
            });

            await init.pageClick(page, '#editCustomField_0');
            await init.pageWaitForSelector(page, '#customFieldForm', {
                visible: true,
                timeout: init.timeout,
            });
            await init.pageClick(page, '#fieldName', { clickCount: 3 });

            await init.pageType(
                page,
                '#fieldName',
                incidentFieldNumber.fieldName
            );
            await init.selectDropdownValue(
                '#fieldType',
                incidentFieldNumber.fieldType,
                page
            );
            await init.pageWaitForSelector(page, '#updateCustomField', {
                visible: true,
                timeout: init.timeout,
            });

            await init.pageClick(page, '#updateCustomField');
            await init.pageWaitForSelector(page, '#updateCustomField', {
                hidden: true,
            });

            await init.navigateToCustomField(page);
            const updatedField: $TSFixMe = await init.pageWaitForSelector(
                page,
                `#customfield_${incidentFieldNumber.fieldName}`,
                { visible: true, timeout: init.timeout }
            );
            expect(updatedField).toBeDefined();
            done();
        },
        operationTimeOut
    );

    test(
        'should delete a incident custom field in a project',
        async (done: $TSFixMe) => {
            await init.navigateToCustomField(page);
            await init.pageWaitForSelector(page, '#deleteCustomField_0', {
                visible: true,
                timeout: init.timeout,
            });

            await init.pageClick(page, '#deleteCustomField_0');
            await init.pageWaitForSelector(page, '#deleteCustomFieldModalBtn', {
                visible: true,
                timeout: init.timeout,
            });

            await init.pageClick(page, '#deleteCustomFieldModalBtn');
            await init.pageWaitForSelector(page, '#deleteCustomFieldModalBtn', {
                hidden: true,
            });

            await init.navigateToCustomField(page);
            const noCustomFields: $TSFixMe = await init.pageWaitForSelector(
                page,
                '#noCustomFields',
                { visible: true, timeout: init.timeout }
            );
            expect(noCustomFields).toBeDefined();

            done();
        },
        operationTimeOut
    );
});
