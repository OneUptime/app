import 'should';

import zapier from 'zapier-platform-core';

import App from '../../index';

const appTester: $TSFixMe = zapier.createAppTester(App);

describe('Create Incident Action', () => {
    it('passes authentication and create new incident', (done: $TSFixMe) => {
        zapier.tools.env.inject();
        const bundle: $TSFixMe = {
            authData: {
                apiKey: process.env.DEV_API_KEY,
                projectId: process.env.DEV_PROJECT_ID,
            },
            cleanedRequest: {
                projectName: 'New Project',
                projectId: '1',
                incidentId: '1',
                acknowledged: false,
                resolved: false,
                internalNote: 'New Note',
                investigationNote: 'New Investigation',
                createdAt: new Date().toISOString(),
                createdBy: 'user',
                monitorName: 'New Sample',
                monitorType: 'url',
                monitorData: 'https://data.com',
            },
        };
        appTester(App.creates.incident.operation.perform, bundle)
            .then((response: $TSFixMe) => {
                response.should.be.an.instanceOf(Object);
                response.should.have.property('projectName');
                done();
            })
            .catch(done);
    });
});
