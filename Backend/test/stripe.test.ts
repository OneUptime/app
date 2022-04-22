process.env.PORT = 3020;

process.env.IS_SAAS_SERVICE = true;
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
import AirtableService from '../backend/services/airtableService';

let token: $TSFixMe, projectId: ObjectID, userId: ObjectID;
import VerificationTokenModel from '../backend/models/verificationToken';

let cardId: $TSFixMe, authorization: $TSFixMe;

describe('Stripe payment API', function (): void {
    this.timeout(50000);

    before(function (done: $TSFixMe): void {
        this.timeout(40000);
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
                                            authorization = `Basic ${token}`;
                                            done();
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
        await UserService.hardDeleteBy({
            email: {
                $in: [
                    userData.user.email,
                    userData.newUser.email,
                    userData.anotherUser.email,
                ],
            },
        });
        await ProjectService.hardDeleteBy({ _id: projectId });
        await AirtableService.deleteAll({ tableName: 'User' });
    });

    it('should sign up and a transaction of 1 $ should be made', (done: $TSFixMe): void => {
        request
            .get(`/stripe/${userId}/charges`)
            .set('Authorization', authorization)
            .end((err: $TSFixMe, res: $TSFixMe): void => {
                expect(res).to.have.status(200);
                expect(res.body).to.have.property('data');
                expect(res.body.data).to.be.an('array');
                expect(res.body.data).to.have.length.greaterThan(0);
                expect(res.body.data[0]).to.be.an('object');
                expect(res.body.data[0]).to.have.property('failure_code');
                expect(res.body.data[0].failure_code).to.be.equal(null);
                expect(res.body.data[0]).to.have.property('amount');
                expect(res.body.data[0].amount).to.be.equal(100);
                done();
            });
    });

    it('should return payment intent when valid details are passed ', (done: $TSFixMe): void => {
        request
            .post(`/stripe/${userId}/creditCard/${'tok_amex'}/pi`)
            .set('Authorization', authorization)
            .end((err: $TSFixMe, res: $TSFixMe): void => {
                cardId = res.body.source;
                expect(res).to.have.status(200);
                expect(res.body).to.have.property('id');
                expect(res.body).to.have.property('client_secret');
                expect(res.body.client_secret).not.to.be.null;
                expect(res.body).to.have.property('source');
                expect(res.body.source).not.to.be.null;
                done();
            });
    });

    it('should return 2 cards attached to customer', (done: $TSFixMe): void => {
        request
            .get(`/stripe/${userId}/creditCard`)
            .set('Authorization', authorization)
            .end((err: $TSFixMe, res: $TSFixMe): void => {
                expect(res).to.have.status(200);
                expect(res.body).to.have.property('data');
                expect(res.body.data).to.be.an('array');
                expect(res.body.data).to.have.length(2);
                done();
            });
    });

    it('should update default card for customer', (done: $TSFixMe): void => {
        request
            .put(`/stripe/${userId}/creditCard/${cardId}`)
            .set('Authorization', authorization)
            .end((err: $TSFixMe, res: $TSFixMe): void => {
                expect(res).to.have.status(200);
                expect(res.body).to.be.an('object');
                expect(res.body).to.have.property('default_source');
                expect(res.body.default_source).to.be.equal(cardId);
                done();
            });
    });

    it('should return 2 cards attached to customer', (done: $TSFixMe): void => {
        request
            .get(`/stripe/${userId}/creditCard`)
            .set('Authorization', authorization)
            .end((err: $TSFixMe, res: $TSFixMe): void => {
                expect(res).to.have.status(200);
                expect(res.body).to.have.property('data');
                expect(res.body.data).to.be.an('array');
                expect(res.body.data).to.have.length(2);
                done();
            });
    });

    it('should fetch a single card', (done: $TSFixMe): void => {
        request
            .get(`/stripe/${userId}/creditCard/${cardId}`)
            .set('Authorization', authorization)
            .end((err: $TSFixMe, res: $TSFixMe): void => {
                expect(res).to.have.status(200);
                expect(res.body).to.be.an('object');
                expect(res.body).to.have.property('id');
                expect(res.body.id).not.to.be.null;
                expect(res.body).to.have.property('customer');
                expect(res.body.customer).not.to.be.null;
                done();
            });
    });

    it('should delete a card', (done: $TSFixMe): void => {
        request
            .delete(`/stripe/${userId}/creditCard/${cardId}`)
            .set('Authorization', authorization)
            .end((err: $TSFixMe, res: $TSFixMe): void => {
                expect(res).to.have.status(200);
                expect(res.body).to.be.an('object');
                expect(res.body).to.have.property('id');
                expect(res.body.id).not.to.be.null;
                done();
            });
    });

    it('should not delete a single left card', (done: $TSFixMe): void => {
        request
            .get(`/stripe/${userId}/creditCard`)
            .set('Authorization', authorization)
            .end((err: $TSFixMe, res: $TSFixMe): void => {
                cardId = res.body.data[0].id;
                request
                    .delete(`/stripe/${userId}/creditCard/${cardId}`)
                    .set('Authorization', authorization)
                    .end((err: $TSFixMe, res: $TSFixMe): void => {
                        expect(res).to.have.status(403);
                        expect(res.body.message).to.be.equal(
                            'Cannot delete the only card'
                        );
                        done();
                    });
            });
    });

    it('should not create a payment intent when token(generated from client) is invalid', (done: $TSFixMe): void => {
        request
            .post(`/stripe/${userId}/creditCard/${'tok_invalid'}/pi`)
            .set('Authorization', authorization)
            .end((err: $TSFixMe, res: $TSFixMe): void => {
                expect(res).to.have.status(400);
                expect(res.body.message).to.be.equal(
                    "No such token: 'tok_invalid'"
                );
                done();
            });
    });

    it('should not add balance to customer accounts if rechargeBalanceAmount is not a valid integer', (done: $TSFixMe): void => {
        request
            .post(`/stripe/${projectId}/addBalance`)
            .set('Authorization', authorization)
            .send({
                rechargeBalanceAmount: '43_',
            })
            .end((err: $TSFixMe, res: $TSFixMe): void => {
                expect(res).to.have.status(400);
                expect(res.body.message).to.be.equal(
                    'Amount should be present and it should be a valid number.'
                );
                done();
            });
    });

    it('should return payment intent if rechargeBalanceAmount is a valid integer', (done: $TSFixMe): void => {
        request
            .post(`/stripe/${projectId}/addBalance`)
            .set('Authorization', authorization)
            .send({
                rechargeBalanceAmount: '100',
            })
            .end((err: $TSFixMe, res: $TSFixMe): void => {
                expect(res).to.have.status(200);
                expect(res.body).to.have.property('id');
                expect(res.body).to.have.property('client_secret');
                expect(res.body.client_secret).not.to.be.null;
                expect(res.body).to.have.property('source');
                expect(res.body.source).not.to.be.null;
                done();
            });
    });
});
