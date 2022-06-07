import puppeteer, { Browser, Page } from 'puppeteer';
import PuppeteerHelper from 'Common/Tests/TestingUtils/PuppeteerHelper';
import {
    OPERATION_TIMEOUT,
    PUPPETEER_OPTIONS,
    VIEW_PORT_OPTIONS,
    HOME_URL,
    VALUE_TYPE,
} from '../Config';

let browser: Browser, page: Page;

describe('Demo page test', () => {
    beforeAll(async () => {
        jest.setTimeout(OPERATION_TIMEOUT);
        browser = await puppeteer.launch(PUPPETEER_OPTIONS);
        page = await browser.newPage();
        await page.setViewport(VIEW_PORT_OPTIONS);
    });

    afterAll(async () => {
        await browser.close();
    });

    test(
        'Title of the page',
        async () => {
            await page.goto(`${HOME_URL.toString()}/enterprise/demo`, {
                waitUntil: 'networkidle0',
                timeout: OPERATION_TIMEOUT,
            });
            const title: VALUE_TYPE = await page.title();
            expect(title).toBe(`OneUptime | Request Demo`);
        },
        OPERATION_TIMEOUT
    );

    test(
        'Confirm text on page',
        async () => {
            await page.goto(`${HOME_URL.toString()}/enterprise/demo`, {
                waitUntil: 'networkidle0',
                timeout: OPERATION_TIMEOUT,
            });

            const pageTittle: VALUE_TYPE = await PuppeteerHelper.getTextContent(
                page,
                '.Header-title'
            );
            const firstIntrotext: VALUE_TYPE =
                await PuppeteerHelper.getTextContent(page, '.common-IntroText');
            const secondIntrotext: VALUE_TYPE =
                await PuppeteerHelper.getTextContent(page, '.intro-text');
            const headline: VALUE_TYPE = await PuppeteerHelper.getTextContent(
                page,
                '.cta-headline'
            );

            expect(pageTittle).toBe('Request Demo');
            expect(firstIntrotext).toBeDefined();
            expect(secondIntrotext).toBeDefined();
            expect(headline).toBeDefined();
        },
        OPERATION_TIMEOUT
    );

    test(
        'Check for form on page',
        async () => {
            await page.goto(`${HOME_URL.toString()}/enterprise/demo`, {
                waitUntil: 'networkidle0',
                timeout: OPERATION_TIMEOUT,
            });
            const fullName: VALUE_TYPE = await PuppeteerHelper.getTextContent(
                page,
                'input[name=fullname]'
            );
            const email: VALUE_TYPE = await PuppeteerHelper.getTextContent(
                page,
                'input[name=email]'
            );
            const phone: VALUE_TYPE = await PuppeteerHelper.getTextContent(
                page,
                'input[name=phone]'
            );

            const website: VALUE_TYPE = await PuppeteerHelper.getTextContent(
                page,
                'input[name=website]'
            );

            const country: VALUE_TYPE = await PuppeteerHelper.getTextContent(
                page,
                'select[id=country]'
            );

            const companySize: VALUE_TYPE =
                await PuppeteerHelper.getTextContent(page, 'select[id=volume]');

            const message: VALUE_TYPE = await PuppeteerHelper.getTextContent(
                page,
                'textarea[id=message]'
            );

            const button: VALUE_TYPE = await PuppeteerHelper.getTextContent(
                page,
                'input[id=request-demo-btn]'
            );
            expect(fullName).toBeDefined();
            expect(email).toBeDefined();
            expect(phone).toBeDefined();
            expect(website).toBeDefined();
            expect(country).toBeDefined();
            expect(companySize).toBeDefined();
            expect(message).toBeDefined();
            expect(button).toBeDefined();
        },
        OPERATION_TIMEOUT
    );

    test(
        'Check for calendly widget on page',
        async () => {
            await page.goto(`${HOME_URL.toString()}/enterprise/demo`, {
                waitUntil: 'networkidle0',
                timeout: OPERATION_TIMEOUT,
            });

            const calendly: VALUE_TYPE = await PuppeteerHelper.getTextContent(
                page,
                '.calendly-inline-widget'
            );
            expect(calendly).toBeDefined();
        },
        OPERATION_TIMEOUT
    );
});
