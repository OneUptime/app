process.env.PORT = 3020;
import userData from './data/user';
import chai, { expect } from 'chai';
import ObjectID from 'Common/Types/ObjectID';
import chaihttp from 'chai-http';
chai.use(chaihttp);
import app from '../server';
import EmailStatusService from '../backend/services/emailStatusService';

const request: $TSFixMe = chai.request.agent(app);

import { createUser } from './utils/userSignUp';
import UserService from '../backend/services/userService';
import FeedbackService from '../backend/services/feedbackService';
import ProjectService from '../backend/services/projectService';
import VerificationTokenModel from '../backend/models/verificationToken';
import AirtableService from '../backend/services/airtableService';
import GlobalConfig from './utils/globalConfig';
const selectEmailStatus: $TSFixMe =
    'from to subject body createdAt template status content error deleted deletedAt deletedById replyTo smtpServer';

let token: $TSFixMe, projectId: ObjectID, userId: ObjectID;

describe('Feedback API', function (): void {
    this.timeout(50000);

    before(function (done: $TSFixMe): void {
        this.timeout(40000);
        GlobalConfig.initTestConfig().then((): void => {
            GlobalConfig.enableEmailLog().then((): void => {
                createUser(
                    request,
                    userData.user,
                    (err: $TSFixMe, res: $TSFixMe): void => {
                        const project: $TSFixMe = res.body.project;
                        projectId = project._id;
                        userId = res.body.id;

                        VerificationTokenModel.findOne(
                            { userId },
                            (err: $TSFixMe, verificationToken: $TSFixMe) => {
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
                                                password:
                                                    userData.user.password,
                                            })
                                            .end(
                                                (
                                                    err: $TSFixMe,
                                                    res: $TSFixMe
                                                ) => {
                                                    token =
                                                        res.body.tokens
                                                            .jwtAccessToken;
                                                    done();
                                                }
                                            );
                                    });
                            }
                        );
                    }
                );
            });
        });
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

        await ProjectService.hardDeleteBy({ _id: projectId }, userId);
        await AirtableService.deleteAll({ tableName: 'User' });
    });

    it('should create feedback and check the sent emails to oneuptime team and user', async (): void => {
        const authorization: string = `Basic ${token}`;
        const testFeedback: $TSFixMe = {
            feedback: 'test feedback',
            page: 'test page',
        };
        const res: $TSFixMe = await request
            .post(`/feedback/${projectId}`)
            .set('Authorization', authorization)
            .send(testFeedback);
        expect(res).to.have.status(200);
        await FeedbackService.hardDeleteBy({ _id: res.body._id });
        await AirtableService.deleteFeedback(res.body.airtableId);
        const emailStatuses: $TSFixMe = await EmailStatusService.findBy({
            query: {},
            select: selectEmailStatus,
        });
        if (emailStatuses[0].subject.includes('Thank you')) {
            expect(emailStatuses[0].subject).to.equal(
                'Thank you for your feedback!'
            );
        } else {
            const subject: string = 'Welcome to OneUptime.';
            const status: $TSFixMe = emailStatuses.find((status: $TSFixMe) => {
                return status.subject === subject;
            });
            expect(status.subject).to.equal(subject);
        }
    });
});
