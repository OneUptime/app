import 'should';

import zapier from 'zapier-platform-core';

import App from '../index';

const appTester: $TSFixMe = zapier.createAppTester(App);

describe('Authenticate API KEY and ProjectID', () => {
    zapier.tools.env.inject();

    it('passes authentication and returns json', (done: $TSFixMe) => {
        const bundle: $TSFixMe = {
            authData: {
                apiKey: process.env.DEV_API_KEY,
                projectId: process.env.DEV_PROJECT_ID,
            },
            cleanedRequest: {
                projectId: '1',
                projectName: 'New Project',
                monitor: [
                    {
                        createdAt: new Date().toTimeString(),
                        pollTime: new Date().toTimeString(),
                        _id: '1',
                        createdBy: 'You',
                        name: 'New Sample',
                        type: 'url',
                        data: {
                            url: 'https://oneuptime.com',
                        },
                        projectId: '1',
                    },
                ],
            },
        };

        appTester(App.authentication.test, bundle)
            .then((json_response: $TSFixMe) => {
                json_response.should.have.property('projectName');
                done();
            })
            .catch(done);
    });
});
