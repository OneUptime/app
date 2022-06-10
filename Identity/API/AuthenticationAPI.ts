import {
    AccountsHostname,
    DashboardHostname,
    DisableSignup,
    HomeHostname,
    HttpProtocol,
    IsSaaSService,
} from 'CommonServer/Config';
import Express, {
    ExpressRequest,
    ExpressResponse,
    ExpressRouter,
    NextFunction,
} from 'CommonServer/Utils/Express';
import BadRequestException from 'Common/Types/Exception/BadRequestException';
import { JSONObject } from 'Common/Types/JSON';
import User from 'Common/Models/User';
import EmailVerificationTokenService from 'CommonServer/Services/EmailVerificationTokenService';
import UserService from 'CommonServer/Services/UserService';
import ObjectID from 'Common/Types/ObjectID';
import EmailVerificationToken from 'Common/Models/EmailVerificationToken';
import BadDataException from 'Common/Types/Exception/BadDataException';
import MailService from 'CommonServer/Services/MailService';
import EmailTemplateType from 'Common/Types/Email/EmailTemplateType';
import EmailSubjects from 'Common/Types/Email/EmailSubjects';
import URL from 'Common/Types/API/URL';
import Response from 'CommonServer/Utils/Response';
import JSONWebToken from 'CommonServer/Utils/JsonWebToken';
import OneUptimeDate from 'Common/Types/Date';
import PositiveNumber from 'Common/Types/PositiveNumber';

const router: ExpressRouter = Express.getRouter();

router.post(
    '/signup',
    async (
        req: ExpressRequest,
        res: ExpressResponse,
        next: NextFunction
    ): Promise<void> => {
        try {
            if (DisableSignup) {
                throw new BadRequestException('Sign up is disabled.');
            }

            const data: JSONObject = req.body;

            const user: User = User.asPublicCreateable<User>(
                data['user'] as JSONObject,
                User
            );

            if (IsSaaSService) {
                //ALERT: Delete data.role so user don't accidently sign up as master-admin from the API.
                user.isMasterAdmin = false;
                user.isEmailVerified = false;
            }

            let verificationToken: ObjectID | null = null;
            let emailVerificationToken: EmailVerificationToken | null = null;
            if (req.query['token']) {
                verificationToken = new ObjectID(req.query['token'] as string);
                emailVerificationToken =
                    await EmailVerificationTokenService.findOneBy({
                        query: {
                            token: verificationToken,
                        },
                    });
            }

            const alreadySavedUser: User | null = await UserService.findOneBy({
                query: { email: user.email! },
                select: {
                    _id: true,
                    password: true,
                },
            });

            if (
                emailVerificationToken &&
                user &&
                alreadySavedUser?.id?.toString() ===
                    emailVerificationToken?.userId?.toString()
            ) {
                user.isEmailVerified = true;
            }

            if (alreadySavedUser && alreadySavedUser.password) {
                throw new BadDataException(
                    `User with email ${user.email} already exists.`
                );
            }

            let savedUser: User | null = null;
            if (alreadySavedUser) {
                savedUser = await UserService.updateOneByIdAndFetch({
                    id: alreadySavedUser.id!,
                    data: user,
                });
            } else {
                savedUser = await UserService.create({ data: user });
            }

            if (alreadySavedUser) {
                // Send Welcome Mail
                await MailService.sendMail(
                    user.email!,
                    EmailSubjects.getSubjectByType(
                        EmailTemplateType.SIGNUP_WELCOME_EMAIL
                    ),
                    EmailTemplateType.SIGNUP_WELCOME_EMAIL,
                    {
                        name: user.name!.toString(),
                        dashboardUrl: new URL(
                            HttpProtocol,
                            DashboardHostname
                        ).toString(),
                        homeUrl: new URL(HttpProtocol, HomeHostname).toString(),
                    }
                );
            } else {
                // Send EmailVerification Link because this is a new user.
                await MailService.sendMail(
                    user.email!,
                    EmailSubjects.getSubjectByType(
                        EmailTemplateType.SIGNUP_WELCOME_EMAIL
                    ),
                    EmailTemplateType.SIGNUP_WELCOME_EMAIL,
                    {
                        name: user.name!.toString(),
                        emailVerificationUrl: new URL(
                            HttpProtocol,
                            AccountsHostname
                        ).toString(),
                        homeUrl: new URL(HttpProtocol, HomeHostname).toString(),
                    }
                );
            }

            if (savedUser) {
                const token: string = JSONWebToken.sign(
                    {
                        userId: savedUser.id!,
                        email: savedUser.email!,
                        isMasterAdmin: savedUser.isMasterAdmin!,
                        roles: [],
                    },
                    OneUptimeDate.getSomeDaysAfter(new PositiveNumber(30))
                );

                return Response.sendItemResponse(req, res, { token: token });
            }

            throw new BadRequestException('Failed to create a user');
        } catch (err) {
            return next(err);
        }
    }
);

export default router;
