import 'should';

import zapier from 'zapier-platform-core';

import App from '../../index';

const appTester: $TSFixMe = zapier.createAppTester(App);

describe('Acknowledge Last Incident', () => {
    it('passes authentication and acknowledges last incident', (done: $TSFixMe) => {
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
                        acknowledged: true,
                    },
                    {
                        id: '1',
                        acknowledged: false,
                    },
                ],
            },
        };
        appTester(
            App.creates.acknowledge_last_incident.operation.perform,
            bundle
        )
            .then((response: $TSFixMe) => {
                response.should.be.an.instanceOf(Object);
                response.should.have.property('projectName');
                response.should.have.property('incidents');
                response.incidents.should.be.an.instanceOf(Array);
                response.incidents[0].acknowledged.should.be.equal(true);
                response.incidents[1].acknowledged.should.be.equal(false);
                done();
            })
            .catch(done);
    });
});
