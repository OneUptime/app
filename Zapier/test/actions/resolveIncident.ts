import 'should';

import zapier from 'zapier-platform-core';

import App from '../../index';

const appTester: $TSFixMe = zapier.createAppTester(App);

describe('Resolve Incident By ID Action', () => {
    it('passes authentication and resolves an incident by ID', (done: $TSFixMe) => {
        zapier.tools.env.inject();
        const bundle: $TSFixMe = {
            authData: {
                apiKey: process.env.DEV_API_KEY,
                projectId: process.env.DEV_PROJECT_ID,
            },
            cleanedRequest: {
                projectName: 'New Project',
                projectId: '1',
                incidents: [
                    {
                        id: '1',
                        resolved: true,
                    },
                ],
            },
        };
        appTester(App.creates.acknowledge_incident.operation.perform, bundle)
            .then((response: $TSFixMe) => {
                response.should.be.an.instanceOf(Object);
                response.should.have.property('projectName');
                response.should.have.property('incidents');
                response.incidents.should.be.an.instanceOf(Array);
                response.incidents[0].resolved.should.be.equal(true);
                done();
            })
            .catch(done);
    });
});
