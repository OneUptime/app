process.env.PORT = 3020;
import chai, { expect } from 'chai';
import userData from './data/user';
import ObjectID from 'Common/Types/ObjectID';
import chaihttp from 'chai-http';
chai.use(chaihttp);
import app from '../server';
import GlobalConfig from './utils/globalConfig';

const request: $TSFixMe = chai.request.agent(app);

import { createUser } from './utils/userSignUp';
import UserService from '../backend/services/userService';
import ProjectService from '../backend/services/projectService';
import SmsTemplateService from '../backend/services/smsTemplateService';
import NotificationService from '../backend/services/notificationService';
import AirtableService from '../backend/services/airtableService';

import VerificationTokenModel from '../backend/models/verificationToken';

let token: $TSFixMe,
    projectId: ObjectID,
    userId: $TSFixMe,
    smsTemplateId: $TSFixMe;

describe('SMS Template API', function (): void {
    this.timeout(20000);

    before(async function (): void {
        this.timeout(40000);
        await GlobalConfig.initTestConfig();
        const res: $TSFixMe = await createUser(request, userData.user);
        const project: $TSFixMe = res.body.project;
        projectId = project._id;
        userId = res.body.id;
        const verificationToken: $TSFixMe =
            await VerificationTokenModel.findOne({
                userId,
            });
        await request
            .get(`/user/confirmation/${verificationToken.token}`)
            .redirects(0);
        const res1: $TSFixMe = await request.post('/user/login').send({
            email: userData.user.email,
            password: userData.user.password,
        });
        token = res1.body.tokens.jwtAccessToken;
    });

    after(async (): void => {
        await GlobalConfig.removeTestConfig();
        await UserService.hardDeleteBy({
            email: {
                $in: [
                    userData.user.email.toLowerCase(),
                    userData.newUser.email.toLowerCase(),
                    userData.anotherUser.email.toLowerCase(),
                ],
            },
        });
        await ProjectService.hardDeleteBy({ _id: projectId });
        await NotificationService.hardDeleteBy({ projectId: projectId });
        await SmsTemplateService.hardDeleteBy({ projectId: projectId });
        await AirtableService.deleteAll({ tableName: 'User' });
    });

    // 'post /:projectId'

    it('should create an sms template with valid data', async (): void => {
        const authorization: string = `Basic ${token}`;
        const res: $TSFixMe = await request
            .post(`/smsTemplate/${projectId}`)
            .set('Authorization', authorization)
            .send({
                body: 'SMS Body',
                smsType: 'Subscriber Incident Created',
            });
        smsTemplateId = res.body._id;
        expect(res).to.have.status(200);
        expect(res.body).to.be.an('object');
        expect(res.body.body).to.be.equal('SMS Body');
    });

    it('should sanitize dirty template data sent to endpoint', async (): void => {
        const authorization: string = `Basic ${token}`;
        const res: $TSFixMe = await request
            .post(`/smsTemplate/${projectId}`)
            .set('Authorization', authorization)
            .send({
                body: '<img src=x onerror=alert(1)//>',
                smsType: 'Subscriber Incident Created',
            });
        expect(res).to.have.status(200);
        expect(res.body.body).to.be.equal('<img src="x">');
    });

    it('should get an array of sms templates by valid projectId', async (): void => {
        const authorization: string = `Basic ${token}`;
        const res: $TSFixMe = await request
            .get(`/smsTemplate/${projectId}`)
            .set('Authorization', authorization);
        expect(res).to.have.status(200);
        expect(res.body).to.be.an('array');
    });

    it('should get an sms template by valid smsTemplateId', async (): void => {
        const authorization: string = `Basic ${token}`;
        const res: $TSFixMe = await request
            .get(`/smsTemplate/${projectId}/smsTemplate/${smsTemplateId}`)
            .set('Authorization', authorization);
        expect(res).to.have.status(200);
        expect(res.body).to.be.an('object');
    });

    it('should update an sms template by valid smsTemplateId', async (): void => {
        const authorization: string = `Basic ${token}`;
        const res: $TSFixMe = await request
            .put(`/smsTemplate/${projectId}/smsTemplate/${smsTemplateId}`)
            .send({
                body: 'New SMS Body',
            })
            .set('Authorization', authorization);
        expect(res).to.have.status(200);
        expect(res.body).to.be.an('object');
        expect(res.body.body).to.be.equal('New SMS Body');
    });

    it('should update default sms template', async (): void => {
        const authorization: string = `Basic ${token}`;
        const res: $TSFixMe = await request
            .put(`/smsTemplate/${projectId}`)
            .send([
                {
                    body: 'Updated SMS Body',
                    smsType: 'Subscriber Incident Acknowledged',
                },
            ])
            .set('Authorization', authorization);
        expect(res).to.have.status(200);
        expect(res.body).to.be.an('array');
        expect(res.body[1].body).to.be.equal('Updated SMS Body');
    });

    it('should deleted an sms template', async (): void => {
        const authorization: string = `Basic ${token}`;
        const res: $TSFixMe = await request
            .delete(`/smsTemplate/${projectId}/smsTemplate/${smsTemplateId}`)
            .set('Authorization', authorization);
        expect(res).to.have.status(200);
    });
});
