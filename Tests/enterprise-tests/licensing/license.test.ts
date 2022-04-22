process.env.PORT = 3021;
import chai, { expect } from 'chai';
import { validLicense, invalidLicense, expiredLicense } from './data/license';
import chaihttp from 'chai-http';
chai.use(chaihttp);
import app from '../server';

const request: $TSFixMe = chai.request.agent(app);
import AirtableService from '../../../../licensing/src/services/airtableService';

const tableName: string = 'License';
const email: string = 'license@hackerbay.io';
let validLicenseId: $TSFixMe, expiredLicenseId: $TSFixMe;

describe('License API', function (): void {
    this.timeout(20000);

    before(async () => {
        const licenses: $TSFixMe = await AirtableService.create({
            tableName,
            fields: [{ fields: validLicense }, { fields: expiredLicense }],
        });
        validLicenseId = licenses[0].id;
        expiredLicenseId = licenses[1].id;
    });

    after(async () => {
        await AirtableService.delete({
            tableName,
            id: [validLicenseId, expiredLicenseId],
        });
    });

    it('should confirm valid license', (done: $TSFixMe) => {
        request
            .post('/license/validate')
            .send({
                license: validLicense['License Key'],
                email,
            })
            .end((err: $TSFixMe, res: $TSFixMe): void => {
                expect(res).to.have.status(200);
                expect(res.body).have.property('token');
                done();
            });
    });

    it('should not confirm invalid license', (done: $TSFixMe) => {
        request
            .post('/license/validate')
            .send({
                license: invalidLicense['License Key'],
                email,
            })
            .end((err: $TSFixMe, res: $TSFixMe): void => {
                expect(res).to.have.status(400);
                expect(res.body.message).to.equal('Invalid License');
                done();
            });
    });

    it('should not confirm expired license', (done: $TSFixMe) => {
        request
            .post('/license/validate')
            .send({
                license: expiredLicense['License Key'],
                email,
            })
            .end((err: $TSFixMe, res: $TSFixMe): void => {
                expect(res).to.have.status(400);
                expect(res.body.message).to.equal('License Expired');
                done();
            });
    });

    it('should not confirm valid license for missing details', (done: $TSFixMe) => {
        request
            .post('/license/validate')
            .send({
                license: validLicense['License Key'],
            })
            .end((err: $TSFixMe, res: $TSFixMe): void => {
                expect(res).to.have.status(400);
                expect(res.body.message).to.equal('Email must be present.');
                done();
            });
    });
});
