import puppeteer from 'puppeteer';
import Email from 'Common/Types/Email';
import utils from '../../test-utils';
import init from '../../test-init';

// User credentials
const email: Email = utils.generateRandomBusinessEmail();
const password = '1234567890';
const subProjectName: string = utils.generateRandomString();
const newProjectName: string = utils.generateRandomString();
const statusPageName: string = utils.generateRandomString();
const projectViewer: $TSFixMe = {
    email: utils.generateRandomBusinessEmail(),
    password: '1234567890',
};
const user: $TSFixMe = {
    email,
    password,
};
const role = 'Viewer';

let browser: $TSFixMe, page: $TSFixMe;

describe('Sub-Project API', () => {
    const operationTimeOut: $TSFixMe = init.timeout;

    beforeAll(async (done: $TSFixMe) => {
        jest.setTimeout(init.timeout);

        browser = await puppeteer.launch(utils.puppeteerLaunchConfig);
        page = await browser.newPage();
        await page.setUserAgent(utils.agent);
        // User
        await init.registerEnterpriseUser(user, page);
        await init.createUserFromAdminDashboard(projectViewer, page);
        done();
    });

    afterAll(async (done: $TSFixMe) => {
        await browser.close();
        done();
    });

    test(
        'should create a new sub-project',
        async (done: $TSFixMe) => {
            await page.goto(utils.DASHBOARD_URL, {
                waitUntil: 'networkidle2',
            });

            await init.renameProject(newProjectName, page);
            await page.goto(utils.DASHBOARD_URL, {
                waitUntil: 'networkidle2',
            });
            await init.pageWaitForSelector(page, '#projectSettings', {
                visible: true,
                timeout: init.timeout,
            });

            await init.pageClick(page, '#projectSettings');

            await init.pageWaitForSelector(page, '#btn_Add_SubProjects', {
                visible: true,
                timeout: init.timeout,
            });

            await init.pageClick(page, '#btn_Add_SubProjects');
            await init.pageWaitForSelector(page, '#title', {
                visible: true,
                timeout: init.timeout,
            });

            await init.pageType(page, '#title', subProjectName);

            await init.pageClick(page, '#btnAddSubProjects');
            await init.pageWaitForSelector(page, '#title', { hidden: true });
            const subProjectSelector: $TSFixMe = await init.pageWaitForSelector(
                page,
                `#sub_project_name_${subProjectName}`,
                { visible: true, timeout: init.timeout }
            );

            expect(
                await (
                    await subProjectSelector.getProperty('textContent')
                ).jsonValue()
            ).toEqual(subProjectName);
            done();
        },
        operationTimeOut
    );

    test('should invite viewer to a subproject', async (done: $TSFixMe) => {
        await page.goto(utils.DASHBOARD_URL, {
            waitUntil: 'networkidle2',
        });
        await init.pageWaitForSelector(page, '#teamMembers', {
            visible: true,
            timeout: init.timeout,
        });

        await init.pageClick(page, '#teamMembers');
        let prevMemberCount: $TSFixMe = await init.page$Eval(
            page,
            `#count_${subProjectName}`,
            (elem: $TSFixMe) => {
                return elem.textContent;
            }
        );
        prevMemberCount = Number(prevMemberCount.split(' ')[0]);
        await init.pageWaitForSelector(
            page,
            `button[id=btn_${subProjectName}]`,
            {
                visible: true,
            }
        );

        await init.pageClick(page, `button[id=btn_${subProjectName}]`);
        await init.pageWaitForSelector(page, `#frm_${subProjectName}`, {
            visible: true,
            timeout: init.timeout,
        });

        await init.pageType(page, 'input[name=emails]', email);

        await init.pageClick(page, `#${role}_${subProjectName}`);
        await init.pageWaitForSelector(page, `#btn_modal_${subProjectName}`, {
            visible: true,
        });

        await init.pageClick(page, `#btn_modal_${subProjectName}`);
        await init.pageWaitForSelector(page, `#btn_modal_${subProjectName}`, {
            hidden: true,
        });
        await init.pageWaitForSelector(page, `#count_${subProjectName}`, {
            visible: true,
        });
        let memberCount: $TSFixMe = await init.page$Eval(
            page,
            `#count_${subProjectName}`,
            (elem: $TSFixMe) => {
                return elem.textContent;
            }
        );
        memberCount = Number(memberCount.split(' ')[0]);
        expect(memberCount).toEqual(prevMemberCount + 1);
        done();
    });

    test('should invite viewer to a project', async (done: $TSFixMe) => {
        await page.goto(utils.DASHBOARD_URL, {
            waitUntil: 'networkidle2',
        });
        await init.pageWaitForSelector(page, '#teamMembers', {
            visible: true,
            timeout: init.timeout,
        });

        await init.pageClick(page, '#teamMembers');
        await init.pageWaitForSelector(page, `#count_${newProjectName}`, {
            visible: true,
        });
        let prevMemberCount: $TSFixMe = await init.page$Eval(
            page,
            `#count_${newProjectName}`,
            (elem: $TSFixMe) => {
                return elem.textContent;
            }
        );
        prevMemberCount = Number(prevMemberCount.split(' ')[0]);

        await init.pageWaitForSelector(
            page,
            `button[id=btn_${newProjectName}]`,
            {
                visible: true,
            }
        );

        await init.pageClick(page, `button[id=btn_${newProjectName}]`);
        await init.pageWaitForSelector(page, `#frm_${newProjectName}`, {
            visible: true,
            timeout: init.timeout,
        });

        await init.pageType(page, 'input[name=emails]', projectViewer.email);

        await init.pageClick(page, `#${role}_${newProjectName}`);
        await init.pageWaitForSelector(page, `#btn_modal_${newProjectName}`, {
            visible: true,
        });

        await init.pageClick(page, `#btn_modal_${newProjectName}`);

        const elem: $TSFixMe = await init.page$(
            page,
            'button[id=btnConfirmInvite]'
        );
        elem.click();
        await init.pageWaitForSelector(page, `#btn_modal_${newProjectName}`, {
            hidden: true,
        });
        await init.pageWaitForSelector(page, `#count_${newProjectName}`, {
            visible: true,
        });
        let memberCount: $TSFixMe = await init.page$Eval(
            page,
            `#count_${newProjectName}`,
            (elem: $TSFixMe) => {
                return elem.textContent;
            }
        );
        memberCount = Number(memberCount.split(' ')[0]);
        expect(memberCount).toEqual(prevMemberCount + 1);
        done();
    });

    test('should create a status page', async (done: $TSFixMe) => {
        await page.goto(utils.DASHBOARD_URL, {
            waitUntil: 'networkidle2',
        });
        await init.pageWaitForSelector(page, '#statusPages', {
            visible: true,
            timeout: init.timeout,
        });

        await init.pageClick(page, '#statusPages');
        await init.pageWaitForSelector(
            page,
            `#status_page_count_${newProjectName}`,
            {
                visible: true,
            }
        );
        let oldStatusPageCounter: $TSFixMe = await init.page$Eval(
            page,
            `#status_page_count_${newProjectName}`,
            (elem: $TSFixMe) => {
                return elem.textContent;
            }
        );
        oldStatusPageCounter = Number(oldStatusPageCounter.split(' ')[0]);
        await init.addStatusPageToProject(statusPageName, newProjectName, page);
        await init.addStatusPageToProject(statusPageName, subProjectName, page);
        await init.pageWaitForSelector(
            page,
            `#status_page_count_${newProjectName}`,
            {
                visible: true,
            }
        );
        let statusPageCounter: $TSFixMe = await init.page$Eval(
            page,
            `#status_page_count_${newProjectName}`,
            (elem: $TSFixMe) => {
                return elem.textContent;
            }
        );
        statusPageCounter = Number(statusPageCounter.split(' ')[0]);
        expect(statusPageCounter).toEqual(oldStatusPageCounter + 1);
        done();
    });

    test(
        'should display subproject status pages to a subproject viewer',
        async (done: $TSFixMe) => {
            // Login as viewer
            await init.logout(page);
            await init.loginProjectViewer({ email, password }, page);

            await init.pageWaitForSelector(page, '#statusPages');

            await init.pageClick(page, '#statusPages');

            await init.pageWaitForSelector(page, '#statusPageTable_0', {
                visible: true,
                timeout: init.timeout,
            });
            const projectStatusPages: $TSFixMe = await page.$(
                '#statusPageTable'
            );
            expect(projectStatusPages).toEqual(null);

            const subProjectStatusPages: $TSFixMe = await page.$(
                '#statusPageTable_0'
            );
            expect(subProjectStatusPages).not.toEqual(null);
            done();
        },
        operationTimeOut
    );

    test(
        'should display project and subproject status pages to project viewers',
        async (done: $TSFixMe) => {
            await init.logout(page);
            await init.loginProjectViewer(projectViewer, page);
            await init.pageWaitForSelector(page, '#AccountSwitcherId', {
                visible: true,
                timeout: init.timeout,
            });

            await init.pageClick(page, '#AccountSwitcherId');
            await init.pageWaitForSelector(page, '#accountSwitcher', {
                visible: true,
                timeout: init.timeout,
            });

            const element: $TSFixMe = await init.page$(
                page,
                `#accountSwitcher > div[title=${newProjectName}]`
            );
            element.click();
            await init.pageWaitForSelector(page, '#statusPageTable_0', {
                visible: true,
                timeout: init.timeout,
            });

            const projectStatusPages: $TSFixMe = await init.page$(
                page,
                '#statusPageTable'
            );
            expect(projectStatusPages).not.toEqual(null);

            const subProjectStatusPages: $TSFixMe = await init.page$(
                page,
                '#statusPageTable_0'
            );
            expect(subProjectStatusPages).not.toEqual(null);
            done();
        },
        operationTimeOut
    );

    test('should redirect viewer to external status page', async (done: $TSFixMe) => {
        await init.logout(page);
        await init.loginProjectViewer(projectViewer, page);
        await init.pageWaitForSelector(page, '#AccountSwitcherId', {
            visible: true,
            timeout: init.timeout,
        });

        await init.pageClick(page, '#AccountSwitcherId');
        await init.pageWaitForSelector(page, '#accountSwitcher', {
            visible: true,
            timeout: init.timeout,
        });

        const element: $TSFixMe = await init.page$(
            page,
            `#accountSwitcher > div[title=${newProjectName}]`
        );
        element.click();
        const rowItem: $TSFixMe = await init.pageWaitForSelector(
            page,
            '#statusPagesListContainer > tr',
            { visible: true, timeout: init.timeout }
        );
        rowItem.click();
        const statusPage: $TSFixMe = await page.$(`#cb${statusPageName}`);
        expect(statusPage).toEqual(null);
        done();
    });
});
