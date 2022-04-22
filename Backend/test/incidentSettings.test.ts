process.env.PORT = 3020;
import chai, { expect } from 'chai';
import userData from './data/user';
import ObjectID from 'Common/Types/ObjectID';
import chaihttp from 'chai-http';
chai.use(chaihttp);
import app from '../server';

const request: $TSFixMe = chai.request.agent(app);

import { createUser } from './utils/userSignUp';
import incidentData from './data/incident';
import UserService from '../backend/services/userService';
import MonitorService from '../backend/services/monitorService';
import IncidentService from '../backend/services/incidentService';
import IncidentSettings from '../backend/services/incidentSettingsService';
import IncidentPrioritiesService from '../backend/services/incidentPrioritiesService';
import ComponentService from '../backend/services/componentService';
import ProjectService from '../backend/services/projectService';
import NotificationService from '../backend/services/notificationService';
const {
    incidentDefaultSettings,
} = require('../backend/config/incidentDefaultSettings');
import VerificationTokenModel from '../backend/models/verificationToken';
import GlobalConfig from './utils/globalConfig';
import ComponentModel from '../backend/models/component';
import AirtableService from '../backend/services/airtableService';

let token: $TSFixMe,
    userId: ObjectID,
    projectId: ObjectID,
    monitorId: $TSFixMe,
    componentId: $TSFixMe,
    incidentId: $TSFixMe,
    templateId: $TSFixMe;

const monitor: $TSFixMe = {
    name: 'New Monitor',
    type: 'url',
    data: { url: 'http://www.tests.org' },
};

const incidentSettings: $TSFixMe = {
    title: `TEST: {{monitorName}}`,
    description: `TEST: {{incidentType}}`,
    name: 'Another update',
};

describe('Incident Settings API', function (): void {
    this.timeout(500000);

    before(function (done: $TSFixMe): void {
        this.timeout(90000);
        GlobalConfig.initTestConfig().then((): void => {
            createUser(
                request,
                userData.user,
                (err: $TSFixMe, res: $TSFixMe): void => {
                    projectId = res.body.project._id;
                    userId = res.body.id;

                    VerificationTokenModel.findOne(
                        { userId },
                        (err: $TSFixMe, verificationToken: $TSFixMe): void => {
                            request
                                .get(
                                    `/user/confirmation/${verificationToken.token}`
                                )
                                .redirects(0)
                                .end((): void => {
                                    request
                                        .post('/user/login')
                                        .send({
                                            email: userData.user.email,
                                            password: userData.user.password,
                                        })
                                        .end((err: $TSFixMe, res: $TSFixMe) => {
                                            token =
                                                res.body.tokens.jwtAccessToken;
                                            const authorization: string = `Basic ${token}`;
                                            ComponentModel.create({
                                                name: 'New Component',
                                                projectId,
                                            }).then((component: $TSFixMe) => {
                                                componentId = component._id;
                                                request
                                                    .post(
                                                        `/monitor/${projectId}`
                                                    )
                                                    .set(
                                                        'Authorization',
                                                        authorization
                                                    )
                                                    .send({
                                                        ...monitor,
                                                        componentId,
                                                    })
                                                    .end(
                                                        async (
                                                            err: $TSFixMe,
                                                            res: $TSFixMe
                                                        ): void => {
                                                            monitorId =
                                                                res.body._id;
                                                            expect(
                                                                res
                                                            ).to.have.status(
                                                                200
                                                            );
                                                            expect(
                                                                res.body.name
                                                            ).to.be.equal(
                                                                monitor.name
                                                            );
                                                            done();
                                                        }
                                                    );
                                            });
                                        });
                                });
                        }
                    );
                }
            );
        });
    });

    after(async (): void => {
        await GlobalConfig.removeTestConfig();
        await IncidentService.hardDeleteBy({ _id: incidentId });
        await IncidentSettings.hardDeleteBy({ projectId });
        await IncidentPrioritiesService.hardDeleteBy({ projectId });
        await UserService.hardDeleteBy({ _id: userId });
        await MonitorService.hardDeleteBy({ _id: monitorId });
        await ComponentService.hardDeleteBy({ _id: componentId });
        await NotificationService.hardDeleteBy({ projectId });
        await ProjectService.hardDeleteBy({ _id: projectId });
        await AirtableService.deleteAll({ tableName: 'User' });
    });

    it('should return the list of the available variables', async () => {
        const authorization: string = `Basic ${token}`;
        const res: $TSFixMe = await request
            .get(`/incidentSettings/variables`)
            .set('Authorization', authorization);
        expect(res).to.have.status(200);
        expect(res.body).to.be.an('array');
        expect(res.body.length).to.be.greaterThan(0);
        expect(res.body[0]).to.be.an('object');
        expect(res.body[0]).to.have.property('name');
        expect(res.body[0]).to.have.property('definition');
    });

    it('should return the default settings if no custom settings are defined', async () => {
        const authorization: string = `Basic ${token}`;
        const res: $TSFixMe = await request
            .get(`/incidentSettings/${projectId}?skip=0&limit=10`)
            .set('Authorization', authorization);
        templateId = res.body.data[0]._id;
        expect(res).to.have.status(200);
        expect(res.body).to.be.an('object');
        expect(res.body).to.have.property('data');
        expect(res.body).to.have.property('count');
        expect(res.body).to.have.property('limit');
        expect(res.body).to.have.property('skip');
        expect(res.body.data[0].title).to.eql(incidentDefaultSettings.title);
        expect(res.body.data[0].description).to.eql(
            incidentDefaultSettings.description
        );
    });

    it('should update the default incident settings.', async () => {
        const authorization: string = `Basic ${token}`;
        const incidentPriorityObject: $TSFixMe =
            await IncidentPrioritiesService.findOne({
                query: {
                    projectId,
                    name: 'High',
                },
                select: 'projectId name color createdAt deletedAt deleted deletedById',
            });
        expect(incidentPriorityObject).to.not.equal(null);
        const { _id: incidentPriority } = incidentPriorityObject;
        const res: $TSFixMe = await request
            .put(`/incidentSettings/${projectId}/${templateId}`)
            .set('Authorization', authorization)
            .send({ ...incidentSettings, incidentPriority });
        expect(res).to.have.status(200);

        expect(res.body).to.be.an('object');
        expect(res.body).to.have.property('title');
        expect(res.body).to.have.property('incidentPriority');
        expect(res.body).to.have.property('description');
        expect(res.body).to.have.property('name');
        expect(res.body.title).to.eql(incidentSettings.title);
        expect(res.body.description).to.eql(incidentSettings.description);
        expect(res.body.name).to.eql(incidentSettings.name);
    });

    it('should substitute variables with their values when an incident is created manually.', async () => {
        const authorization: string = `Basic ${token}`;
        const payload: $TSFixMe = {
            ...incidentData,
            ...incidentSettings,
            monitors: [monitorId],
        };
        const res: $TSFixMe = await request
            .post(`/incident/${projectId}/create-incident`)
            .set('Authorization', authorization)
            .send(payload);

        expect(res).to.have.status(200);
        expect(res.body).to.be.an('object');
        incidentId = res.body._id;
        const incident: $TSFixMe = await IncidentService.findOneBy({
            query: { _id: incidentId },
            select: 'description',
        });
        expect(incident.description).to.eql('TEST: online');
    });
});
