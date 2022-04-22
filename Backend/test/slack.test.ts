process.env.PORT = 3020;
import chai, { expect } from 'chai';
import userData from './data/user';
import ObjectID from 'Common/Types/ObjectID';
import chaihttp from 'chai-http';
chai.use(chaihttp);
import app from '../server';

const request: $TSFixMe = chai.request.agent(app);
import UserService from '../backend/services/userService';
import ProjectService from '../backend/services/projectService';
import GlobalConfig from './utils/globalConfig';

// eslint-disable-next-line
let token: $TSFixMe, projectId: ObjectID;

describe('Slack API', function (): void {
    this.timeout(20000);

    this.beforeAll(function (done: $TSFixMe): void {
        this.timeout(30000);
        GlobalConfig.initTestConfig().then((): void => {
            request
                .post('/user/signup')
                .send(userData.user)
                .end((err: $TSFixMe, res: $TSFixMe): void => {
                    projectId = res.body.projectId;
                    request
                        .post('/user/login')
                        .send({
                            email: userData.user.email,
                            password: userData.user.password,
                        })
                        .end((err: $TSFixMe, res: $TSFixMe): void => {
                            token = res.body.tokens.jwtAccessToken;
                            done();
                        });
                });
        });
    });

    this.afterAll(async (): void => {
        await GlobalConfig.removeTestConfig();
        await ProjectService.hardDeleteBy({ _id: projectId });
        await UserService.hardDeleteBy({
            email: {
                $in: [
                    userData.user.email.toLowerCase(),
                    'noreply@oneuptime.com',
                ],
            },
        });
    });

    // 'post /slack/:projectId/monitor'

    it('The purchase', (done: $TSFixMe): void => {
        request
            .get(`/team/${projectId}/team`)
            .send({
                name: 'New Schedule',
            })
            .end((err: $TSFixMe, res: $TSFixMe): void => {
                expect(res).to.have.status(400);
                done();
            });
    });

    it.skip('The purchase', (done: $TSFixMe): void => {
        const authorization: string = `Basic ${token}`;
        request
            .get(`/slack/${projectId}/:teamId`)
            .set('Authorization', authorization)
            .end((err: $TSFixMe, res: $TSFixMe): void => {
                expect(res).to.have.status(200);
                expect(res.body).to.be.an('array');
                done();
            });
    });
});
