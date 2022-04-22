process.env.PORT = 3020;
import userData from './data/user';
import chai, { expect } from 'chai';
import ObjectID from 'Common/Types/ObjectID';
import chaihttp from 'chai-http';
chai.use(chaihttp);
import chaiSubset from 'chai-subset';
chai.use(chaiSubset);
import app from '../server';
import GlobalConfig from './utils/globalConfig';

const request: $TSFixMe = chai.request.agent(app);

import { createUser } from './utils/userSignUp';
import VerificationTokenModel from '../backend/models/verificationToken';
import ApplicationLogService from '../backend/services/applicationLogService';
import UserService from '../backend/services/userService';
import ProjectService from '../backend/services/projectService';
import NotificationService from '../backend/services/notificationService';
import AirtableService from '../backend/services/airtableService';

let token: $TSFixMe,
    userId: $TSFixMe,
    projectId: ObjectID,
    componentId: $TSFixMe,
    applicationLog: $TSFixMe;
const log: $TSFixMe = {
    applicationLogKey: 'Wrong-key',
    content: 'this is a log',
    type: 'info',
};
const logCount: $TSFixMe = {
    error: 0,
    info: 0,
    warning: 0,
};

describe('Application Log API', function (): void {
    this.timeout(80000);

    before(function (done: $TSFixMe): void {
        this.timeout(90000);
        GlobalConfig.initTestConfig().then((): void => {
            createUser(
                request,
                userData.user,
                (err: $TSFixMe, res: $TSFixMe): void => {
                    const project: $TSFixMe = res.body.project;
                    projectId = project._id;
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
                                            request
                                                .post(`/component/${projectId}`)
                                                .set(
                                                    'Authorization',
                                                    authorization
                                                )
                                                .send({
                                                    name: 'New Component',
                                                })
                                                .end(
                                                    (
                                                        err: $TSFixMe,
                                                        res: $TSFixMe
                                                    ) => {
                                                        componentId =
                                                            res.body._id;
                                                        expect(
                                                            res
                                                        ).to.have.status(200);
                                                        expect(
                                                            res.body.name
                                                        ).to.be.equal(
                                                            'New Component'
                                                        );
                                                        done();
                                                    }
                                                );
                                        });
                                });
                        }
                    );
                }
            );
        });
    });

    it('should reject the request of an unauthenticated user', (done: $TSFixMe): void => {
        request
            .post(`/application-log/${projectId}/${componentId}/create`)
            .send({
                name: 'New Application Log',
            })
            .end((err: $TSFixMe, res: $TSFixMe): void => {
                expect(res).to.have.status(401);
                done();
            });
    });

    it('should reject the request of an empty application log name', (done: $TSFixMe): void => {
        const authorization: string = `Basic ${token}`;
        request
            .post(`/application-log/${projectId}/${componentId}/create`)
            .set('Authorization', authorization)
            .send({
                name: null,
            })
            .end((err: $TSFixMe, res: $TSFixMe): void => {
                expect(res).to.have.status(400);
                done();
            });
    });

    it('should create the application log', (done: $TSFixMe): void => {
        const authorization: string = `Basic ${token}`;
        request
            .post(`/application-log/${projectId}/${componentId}/create`)
            .set('Authorization', authorization)
            .send({
                name: 'Travis Watcher',
            })
            .end((err: $TSFixMe, res: $TSFixMe): void => {
                applicationLog = res.body;
                expect(res).to.have.status(200);
                expect(res.body).to.include({ name: 'Travis Watcher' });
                done();
            });
    });

    it('should return a list of application logs under component', (done: $TSFixMe): void => {
        const authorization: string = `Basic ${token}`;
        request
            .get(`/application-log/${projectId}/${componentId}`)
            .set('Authorization', authorization)
            .end((err: $TSFixMe, res: $TSFixMe): void => {
                expect(res).to.have.status(200);
                expect(res.body.applicationLogs).to.be.an('array');
                done();
            });
    });

    it('should not return a list of application logs under wrong component', (done: $TSFixMe): void => {
        const authorization: string = `Basic ${token}`;
        request
            .get(`/application-log/${projectId}/5ee8d7cc8701d678901ab908`) // Wrong component ID
            .set('Authorization', authorization)
            .end((err: $TSFixMe, res: $TSFixMe): void => {
                expect(res).to.have.status(400);
                expect(res.body.message).to.be.equal(
                    'Component does not exist.'
                );
                done();
            });
    });

    it('should not create a log with wrong application key', (done: $TSFixMe): void => {
        const authorization: string = `Basic ${token}`;
        request
            .post(`/application-log/${applicationLog._id}/log`)
            .set('Authorization', authorization)
            .send(log)
            .end((err: $TSFixMe, res: $TSFixMe): void => {
                expect(res).to.have.status(400);
                expect(res.body.message).to.be.equal(
                    'Application Log does not exist.'
                );
                done();
            });
    });

    it('should create a log with correct application log key', (done: $TSFixMe): void => {
        const authorization: string = `Basic ${token}`;
        log.applicationLogKey = applicationLog.key;
        request
            .post(`/application-log/${applicationLog._id}/log`)
            .set('Authorization', authorization)
            .send(log)
            .end((err: $TSFixMe, res: $TSFixMe): void => {
                expect(res).to.have.status(200);
                expect(res.body).to.include({ content: log.content });
                expect(res.body).to.include({ type: log.type });
                expect(res.body.applicationLogId).to.include({
                    name: applicationLog.name,
                });
                logCount.info++;
                done();
            });
    });

    it('should create a log with correct application log key with type error', (done: $TSFixMe): void => {
        const authorization: string = `Basic ${token}`;
        log.applicationLogKey = applicationLog.key;
        log.type = 'error';
        request
            .post(`/application-log/${applicationLog._id}/log`)
            .set('Authorization', authorization)
            .send(log)
            .end((err: $TSFixMe, res: $TSFixMe): void => {
                expect(res).to.have.status(200);
                expect(res.body).to.include({ content: log.content });
                expect(res.body).to.include({ type: log.type });
                expect(res.body.applicationLogId).to.include({
                    name: applicationLog.name,
                });
                logCount.error++;
                done();
            });
    });

    it('should create a log with correct application log key with type error and one tag', (done: $TSFixMe): void => {
        const authorization: string = `Basic ${token}`;
        log.applicationLogKey = applicationLog.key;
        log.type = 'error';

        log.tags = 'server-side';
        request
            .post(`/application-log/${applicationLog._id}/log`)
            .set('Authorization', authorization)
            .send(log)
            .end((err: $TSFixMe, res: $TSFixMe): void => {
                expect(res).to.have.status(200);
                expect(res.body).to.include({ content: log.content });
                expect(res.body).to.include({ type: log.type });
                expect(res.body.tags).to.be.an('array');
                expect(res.body.tags).to.have.lengthOf(1);

                expect(res.body.tags).to.include(log.tags);
                logCount.error++;
                done();
            });
    });

    it('should not create a log with correct application log key with type error but invalid tag', (done: $TSFixMe): void => {
        const authorization: string = `Basic ${token}`;
        log.applicationLogKey = applicationLog.key;
        log.type = 'error';

        log.tags = { key: 'server-side' };
        request
            .post(`/application-log/${applicationLog._id}/log`)
            .set('Authorization', authorization)
            .send(log)
            .end((err: $TSFixMe, res: $TSFixMe): void => {
                expect(res).to.have.status(400);
                expect(res.body.message).to.be.equal(
                    'Application Log Tags must be of type String or Array of Strings'
                );
                // Remove the invalid tag

                delete log.tags;
                done();
            });
    });

    it('should create a log with correct application log key with type error and 5 tags', (done: $TSFixMe): void => {
        const authorization: string = `Basic ${token}`;
        log.applicationLogKey = applicationLog.key;
        log.type = 'error';

        log.tags = ['server', 'side', 'monitor', 'watcher', 'testing'];
        request
            .post(`/application-log/${applicationLog._id}/log`)
            .set('Authorization', authorization)
            .send(log)
            .end((err: $TSFixMe, res: $TSFixMe): void => {
                expect(res).to.have.status(200);
                expect(res.body).to.include({ content: log.content });
                expect(res.body).to.include({ type: log.type });
                expect(res.body.tags).to.be.an('array');

                expect(res.body.tags).to.have.lengthOf(log.tags.length);
                logCount.error++;

                delete log.tags;
                done();
            });
    });

    it('should fetch logs related to application log with tag search params', (done: $TSFixMe): void => {
        const authorization: string = `Basic ${token}`;
        // Create a log
        log.applicationLogKey = applicationLog.key;
        log.content = 'another content';
        log.type = 'warning';

        log.tags = ['server', 'side', 'monitor', 'watcher', 'testing'];
        request
            .post(`/application-log/${applicationLog._id}/log`)
            .set('Authorization', authorization)
            .send(log)
            .end();
        logCount.warning++;
        request
            .post(
                `/application-log/${projectId}/${componentId}/${applicationLog._id}/logs`
            )
            .set('Authorization', authorization)
            .send({ filter: 'server' })
            .end((err: $TSFixMe, res: $TSFixMe): void => {
                expect(res).to.have.status(200);
                expect(res.body.data).to.be.an('object');
                expect(res.body.data.logs).to.be.an('array');
                expect(res.body.data.dateRange).to.be.an('object');
                expect(res.body.count).to.be.equal(3);
                done();
            });
    });

    it('should not create a log with correct application log key and invalid type', (done: $TSFixMe): void => {
        const authorization: string = `Basic ${token}`;
        log.applicationLogKey = applicationLog.key;
        log.type = 'any type';
        request
            .post(`/application-log/${applicationLog._id}/log`)
            .set('Authorization', authorization)
            .send(log)
            .end((err: $TSFixMe, res: $TSFixMe): void => {
                expect(res).to.have.status(400);
                expect(res.body.message).to.be.equal(
                    'Log Type must be of the allowed types.'
                );
                done();
            });
    });

    it('should not reset the application log key for wrong application log id', (done: $TSFixMe): void => {
        const authorization: string = `Basic ${token}`;
        request
            .post(
                `/application-log/${projectId}/${componentId}/5ee8d7cc8701d678901ab908/reset-key`
            )
            .set('Authorization', authorization)
            .end((err: $TSFixMe, res: $TSFixMe): void => {
                expect(res).to.have.status(404);
                expect(res.body.message).to.be.equal(
                    'Application Log not found'
                );
                expect(res).to.not.have.property('id');
                expect(res).to.not.have.property('key');
                done();
            });
    });

    it('should reset the application log key', (done: $TSFixMe): void => {
        const authorization: string = `Basic ${token}`;
        request
            .post(
                `/application-log/${projectId}/${componentId}/${applicationLog._id}/reset-key`
            )
            .set('Authorization', authorization)
            .end((err: $TSFixMe, res: $TSFixMe): void => {
                expect(res).to.have.status(200);
                // Confirm that the new key is not the same with the old key
                expect(res.body.key).to.not.be.equal(applicationLog.key);
                // Confirm the id are the same
                expect(res.body.id).to.be.equal(applicationLog.id);
                // Now set the new key to our global applicationLog so other test can make use of it
                applicationLog.key = res.body.key; //
                done();
            });
    });

    it('should fetch logs related to application log', (done: $TSFixMe): void => {
        const authorization: string = `Basic ${token}`;
        request
            .post(
                `/application-log/${projectId}/${componentId}/${applicationLog._id}/logs`
            )
            .set('Authorization', authorization)
            .end((err: $TSFixMe, res: $TSFixMe): void => {
                expect(res).to.have.status(200);
                expect(res.body.data).to.be.an('object');
                expect(res.body.data.logs).to.be.an('array');
                expect(res.body.data.dateRange).to.be.an('object');
                expect(res.body.count).to.be.equal(
                    logCount.error + logCount.info + logCount.warning
                );
                done();
            });
    });

    it('should fetch logs related to application log with search params', (done: $TSFixMe): void => {
        const authorization: string = `Basic ${token}`;
        // Create a log
        log.applicationLogKey = applicationLog.key;
        log.content = 'another content';
        log.type = 'warning';
        request
            .post(`/application-log/${applicationLog._id}/log`)
            .set('Authorization', authorization)
            .send(log)
            .end();
        logCount.warning++;
        request
            .post(
                `/application-log/${projectId}/${componentId}/${applicationLog._id}/logs`
            )
            .set('Authorization', authorization)
            .send({ type: 'warning' })
            .end((err: $TSFixMe, res: $TSFixMe): void => {
                expect(res).to.have.status(200);
                expect(res.body.data).to.be.an('object');
                expect(res.body.data.logs).to.be.an('array');
                expect(res.body.data.dateRange).to.be.an('object');
                expect(res.body.count).to.be.equal(2);
                done();
            });
    });

    it('should fetch logs related to application log with search params related to content', (done: $TSFixMe): void => {
        const authorization: string = `Basic ${token}`;
        // Create a log
        log.applicationLogKey = applicationLog.key;

        log.content = { code: '007', name: 'james', location: 'berlin' }; // Log an object of type error
        log.type = 'error';
        request
            .post(`/application-log/${applicationLog._id}/log`)
            .set('Authorization', authorization)
            .send(log)
            .end();
        logCount.error++;
        request
            .post(
                `/application-log/${projectId}/${componentId}/${applicationLog._id}/logs`
            )
            .set('Authorization', authorization)
            .send({ type: 'error' }) // Filter by error
            .end((err: $TSFixMe, res: $TSFixMe): void => {
                expect(res).to.have.status(200);
                expect(res.body.data).to.be.an('object');
                expect(res.body.data.logs).to.be.an('array');
                expect(res.body.data.dateRange).to.be.an('object');
                expect(res.body.count).to.be.equal(logCount.error);
            });
        request
            .post(
                `/application-log/${projectId}/${componentId}/${applicationLog._id}/logs`
            )
            .set('Authorization', authorization)
            .send({ type: 'error', filter: 'james' }) // Filter by error and keyword from content
            .end((err: $TSFixMe, res: $TSFixMe): void => {
                expect(res).to.have.status(200);
                expect(res.body.data).to.be.an('object');
                expect(res.body.data.logs).to.be.an('array');
                expect(res.body.data.dateRange).to.be.an('object');
                expect(res.body.count).to.be.equal(1);
                done();
            });
    });

    it('should fetch logs all log stat related to application log', (done: $TSFixMe): void => {
        const authorization: string = `Basic ${token}`;
        // Create a log
        log.applicationLogKey = applicationLog.key;

        log.content = { code: '007', name: 'james', location: 'berlin' }; // Log an object of type error
        log.type = 'error';
        request
            .post(`/application-log/${applicationLog._id}/log`)
            .set('Authorization', authorization)
            .send(log)
            .end();
        logCount.error++;
        request
            .post(
                `/application-log/${projectId}/${componentId}/${applicationLog._id}/stats`
            )
            .set('Authorization', authorization)
            .send({})
            .end((err: $TSFixMe, res: $TSFixMe): void => {
                expect(res).to.have.status(200);
                expect(res.body.data).to.be.an('object');
                expect(res.body.data.all).to.be.equal(
                    logCount.error + logCount.warning + logCount.info
                ); // Total logs
                expect(res.body.data.error).to.be.equal(logCount.error); // Total error
                expect(res.body.data.info).to.be.equal(logCount.info); // Total info
                expect(res.body.data.warning).to.be.equal(logCount.warning); // Total warning
                done();
            });
    });

    it('should not edit an application log with empty name', (done: $TSFixMe): void => {
        const newName: string = '';
        const authorization: string = `Basic ${token}`;
        request
            .put(
                `/application-log/${projectId}/${componentId}/${applicationLog._id}`
            )
            .set('Authorization', authorization)
            .send({ name: newName })
            .end((err: $TSFixMe, res: $TSFixMe): void => {
                expect(res).to.have.status(400);
                expect(res.body.message).to.be.equal(
                    'New Application Log Name is required.'
                );
                done();
            });
    });

    it('should not edit an application log with same name as existing application log', (done: $TSFixMe): void => {
        const newName: string = 'Astro';
        const authorization: string = `Basic ${token}`;
        request
            .post(`/application-log/${projectId}/${componentId}/create`)
            .set('Authorization', authorization)
            .send({
                name: newName,
            })
            .end((err: $TSFixMe, res: $TSFixMe): void => {
                applicationLog = res.body;
                expect(res).to.have.status(200);
                expect(res.body).to.include({ name: newName });
                request
                    .put(
                        `/application-log/${projectId}/${componentId}/${applicationLog._id}`
                    )
                    .set('Authorization', authorization)
                    .send({ name: newName })
                    .end((err: $TSFixMe, res: $TSFixMe): void => {
                        expect(res).to.have.status(400);
                        expect(res.body.message).to.be.equal(
                            'Application Log with that name already exists.'
                        );
                        done();
                    });
            });
    });

    it('should edit an application log', (done: $TSFixMe): void => {
        const newName: string = 'Rodeo';
        const authorization: string = `Basic ${token}`;
        request
            .put(
                `/application-log/${projectId}/${componentId}/${applicationLog._id}`
            )
            .set('Authorization', authorization)
            .send({ name: newName })
            .end((err: $TSFixMe, res: $TSFixMe): void => {
                expect(res).to.have.status(200);
                expect(res.body.id).to.be.equal(applicationLog.id);
                expect(res.body.name).to.be.equal(newName);
                done();
            });
    });

    it('should edit an application log but not change application log key', (done: $TSFixMe): void => {
        const newName: string = 'Rodeo II';
        const authorization: string = `Basic ${token}`;
        request
            .put(
                `/application-log/${projectId}/${componentId}/${applicationLog._id}`
            )
            .set('Authorization', authorization)
            .send({ name: newName })
            .end((err: $TSFixMe, res: $TSFixMe): void => {
                expect(res).to.have.status(200);
                expect(res.body.id).to.be.equal(applicationLog.id);
                expect(res.body.name).to.be.equal(newName);
                expect(res.body.key).to.be.equal(applicationLog.key);
                done();
            });
    });

    it('should delete an application log', (done: $TSFixMe): void => {
        const authorization: string = `Basic ${token}`;
        request
            .delete(
                `/application-log/${projectId}/${componentId}/${applicationLog._id}`
            )
            .set('Authorization', authorization)
            .end((err: $TSFixMe, res: $TSFixMe): void => {
                expect(res).to.have.status(200);
                expect(res.body.id).to.be.equal(applicationLog.id);
                expect(res.body.deleted).to.be.equal(true);
                done();
            });
    });

    // Yet to figure out how thi works

    after(async (): void => {
        await GlobalConfig.removeTestConfig();
        await ProjectService.hardDeleteBy({ _id: projectId });
        await ApplicationLogService.hardDeleteBy({
            _id: { $in: [applicationLog._id] },
        });
        await UserService.hardDeleteBy({
            email: {
                $in: [userData.user.email.toLowerCase()],
            },
        });
        await NotificationService.hardDeleteBy({ projectId: projectId });
        await AirtableService.deleteAll({ tableName: 'User' });
    });
});
