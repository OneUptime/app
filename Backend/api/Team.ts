import Express, {
    ExpressRequest,
    ExpressResponse,
    ExpressRouter,
} from 'CommonServer/utils/Express';
import BadDataException from 'Common/Types/Exception/BadDataException';
const router: ExpressRouter = Express.getRouter();
import TeamService from '../services/teamService';
const isUserAdmin: $TSFixMe = require('../middlewares/project').isUserAdmin;
import RealTimeService from '../services/realTimeService';
import NotificationService from '../services/notificationService';
const getUser: $TSFixMe = require('../middlewares/user').getUser;
const getSubProjects: $TSFixMe =
    require('../middlewares/subProject').getSubProjects;

import { isAuthorized } from '../middlewares/authorization';
import {
    sendErrorResponse,
    sendItemResponse,
} from 'CommonServer/Utils/response';
import Exception from 'Common/Types/Exception/Exception';

/*
 * Route
 * Description: Getting details of team members of the project.
 * Params:
 * Param 1: req.headers-> {token}; req.params-> {projectId}; req.user-> {id}
 * Returns: 200: An array of users belonging to the project.
 */
router.get(
    '/:projectId',
    getUser,
    isAuthorized,
    async (req: ExpressRequest, res: ExpressResponse) => {
        const projectId: $TSFixMe = req.params['projectId'];

        try {
            // Call the TeamService
            const users: $TSFixMe = await TeamService.getTeamMembersBy({
                _id: projectId,
            }); // Frontend expects sendItemResponse
            return sendItemResponse(req, res, users);
        } catch (error) {
            return sendErrorResponse(req, res, error as Exception);
        }
    }
);

router.get(
    '/:projectId/teamMembers',
    getUser,
    isAuthorized,
    getSubProjects,
    async (req: ExpressRequest, res: ExpressResponse) => {
        const subProjectIds: $TSFixMe = req.user.subProjects
            ? req.user.subProjects.map((project: $TSFixMe) => {
                  return project._id;
              })
            : null;
        try {
            const subProjectTeamMembers: $TSFixMe = await Promise.all(
                subProjectIds.map(async (id: $TSFixMe) => {
                    const teamMembers: $TSFixMe =
                        await TeamService.getTeamMembersBy({
                            _id: id,
                        });
                    const count: $TSFixMe = teamMembers.length;
                    return { teamMembers, count, _id: id };
                })
            );
            return sendItemResponse(req, res, subProjectTeamMembers); // Frontend expects sendItemResponse
        } catch (error) {
            return sendErrorResponse(req, res, error as Exception);
        }
    }
);

/*
 * Route
 * Description: Get individual team member details
 * Params
 * Returns: 200: Individual team member object; 400: Error.
 */
router.get(
    '/:projectId/:teamMemberId',
    getUser,
    isAuthorized,
    async (req: $TSFixMe, res: $TSFixMe): void => {
        const projectId: $TSFixMe = req.params['projectId'];
        const teamMemberUserId: $TSFixMe = req.params['teamMemberId'];

        try {
            const teamMember: $TSFixMe = await TeamService.getTeamMemberBy(
                projectId,
                teamMemberUserId
            );
            const teamMemberObj: $TSFixMe = {
                id: teamMember._id,
                name: teamMember.name ? teamMember.name : '',
                email: teamMember.email ? teamMember.email : '',
                companyName: teamMember.companyName,
                companyRole: teamMember.companyRole,
                companySize: teamMember.companySize,
                referral: teamMember.referral,
                isVerified: teamMember.isVerified,
                companyPhoneNumber: teamMember.companyPhoneNumber
                    ? teamMember.companyPhoneNumber
                    : '',
                alertPhoneNumber: teamMember.alertPhoneNumber
                    ? teamMember.alertPhoneNumber
                    : '',
                profilePic: teamMember.profilePic,
                timezone: teamMember.timezone ? teamMember.timezone : '',
                tempEmail: teamMember.tempEmail || null,
                tempAlertPhoneNumber: teamMember.tempAlertPhoneNumber || null,
            };
            return sendItemResponse(req, res, teamMemberObj);
        } catch (error) {
            return sendErrorResponse(req, res, error as Exception);
        }
    }
);

/*
 * Route
 * Description: Adding team members by Project Admin.
 * Params:
 * Param 1: req.body-> {emails, role}; req.headers-> {token}; req.params-> {projectId}
 * Returns: 200: An array of users belonging to the project; 400: Error.
 */
router.post(
    '/:projectId',
    getUser,
    isAuthorized,
    isUserAdmin,
    async (req: $TSFixMe, res: $TSFixMe): void => {
        const data: $TSFixMe = req.body;

        const userId: $TSFixMe = req.user ? req.user : null;
        const { projectId }: $TSFixMe = req.params;

        if (!data.emails) {
            return sendErrorResponse(req, res, {
                code: 400,
                message:
                    'Please enter emails of members you want to add to this project.',
            });
        }

        if (typeof data.emails !== 'string') {
            return sendErrorResponse(
                req,
                res,
                new BadDataException('Emails is not of type text.')
            );
        }

        if (!data.role) {
            return sendErrorResponse(
                req,
                res,
                new BadDataException('Please select member role.')
            );
        }

        if (typeof data.role !== 'string') {
            return sendErrorResponse(
                req,
                res,
                new BadDataException('Role should be in the text format.')
            );
        }

        const emailArray: $TSFixMe = data.emails ? data.emails.split(',') : [];
        if (!TeamService.isValidBusinessEmails(emailArray)) {
            return sendErrorResponse(
                req,
                res,
                new BadDataException(
                    'Please enter business emails of the members.'
                )
            );
        }

        if (data.role !== 'Viewer' && emailArray.length > 100) {
            return sendErrorResponse(
                req,
                res,
                new BadDataException(
                    'Invited members should not exceed 100 on a project.'
                )
            );
        }

        try {
            // If members are not Viewers, we make sure they don't exceed 100
            if (data.role !== 'Viewers') {
                const teamMembers: $TSFixMe = await TeamService.getTeamMembers(
                    projectId
                );
                const withoutViewers: $TSFixMe = teamMembers
                    ? teamMembers.filter((teamMember: $TSFixMe) => {
                          return teamMember.role !== 'Viewer';
                      })
                    : [];
                const totalTeamMembers: $TSFixMe =
                    withoutViewers.length + emailArray.length;
                if (totalTeamMembers > 100 && data.role !== 'Viewer') {
                    return sendErrorResponse(req, res, {
                        code: 400,
                        message: `This project already has ${teamMembers.length} members, you can only add upto 100 members`,
                    });
                }
            }
            // Call the TeamService
            const users: $TSFixMe = await TeamService.inviteTeamMembers(
                req.user.id,
                projectId,
                data.emails,
                data.role
            );
            if (!users) {
                return sendErrorResponse(req, res, {
                    code: 400,
                    message: 'Something went wrong. Please try again.',
                });
            }
            // Run in the background
            RealTimeService.createTeamMember(projectId, {
                users,
                userId: userId.id,
            });

            return sendItemResponse(req, res, users);
        } catch (error) {
            return sendErrorResponse(req, res, error as Exception);
        }
    }
);

/*
 * Route
 * Description: Removing team member by Project Admin.
 * Params:
 * Param 1: req.body-> {team_member_id}; req.headers-> {token}; req.params-> {projectId}
 * Returns: 200: "User successfully removed"; 400: Error.
 */
router.delete(
    '/:projectId/:teamMemberId',
    getUser,
    isAuthorized,
    isUserAdmin,
    async (req: ExpressRequest, res: ExpressResponse) => {
        const userId: $TSFixMe = req.user ? req.user.id : null;
        const teamMemberUserId: $TSFixMe = req.params['teamMemberId'];
        const projectId: $TSFixMe = req.params['projectId'];

        if (!teamMemberUserId) {
            return sendErrorResponse(req, res, {
                code: 400,
                message:
                    'Team member to be deleted from the project must be present.',
            });
        }

        if (typeof teamMemberUserId !== 'string') {
            return sendErrorResponse(req, res, {
                code: 400,
                message:
                    'Team member to be deleted from the project is not in string type.',
            });
        }

        try {
            // Call the TeamService
            const teamMembers: $TSFixMe = await TeamService.removeTeamMember(
                projectId,
                userId,
                teamMemberUserId
            );
            return sendItemResponse(req, res, teamMembers);
        } catch (error) {
            return sendErrorResponse(req, res, error as Exception);
        }
    }
);

/*
 * Route
 * Description: Updating role of team member by Project Admin.
 * Params:
 * Param 1: req.body-> {teamMemberId, role }; req.headers-> {token}; req.params-> {projectId}
 * Returns: 200: "Role changed successfully"; 400: Error; 500: Server Error.
 */
router.put(
    '/:projectId/:teamMemberId/changerole',
    getUser,
    isAuthorized,
    isUserAdmin,
    async (req: ExpressRequest, res: ExpressResponse) => {
        const data: $TSFixMe = req.body;
        const projectId: $TSFixMe = req.params['projectId'];
        data.teamMemberId = req.params['teamMemberId'];
        if (!data.teamMemberId) {
            return sendErrorResponse(req, res, {
                code: 400,
                message:
                    'Team member to be updated from the project must be present.',
            });
        }

        if (typeof data.teamMemberId !== 'string') {
            return sendErrorResponse(req, res, {
                code: 400,
                message:
                    'Team member to be updated from the project is not in string type.',
            });
        }

        if (!data.role) {
            return sendErrorResponse(
                req,
                res,
                new BadDataException('Role must be present.')
            );
        }

        if (typeof data.role !== 'string') {
            return sendErrorResponse(
                req,
                res,
                new BadDataException('Role is not in string type.')
            );
        }

        const userId: $TSFixMe = req.user ? req.user.id : null;
        const teamMemberId: $TSFixMe = data.teamMemberId;

        try {
            if (data.role === 'Owner') {
                /*
                 * Call the TeamService
                 * This code is reverted because the promises need to run sequentially. Debugging it shows that it was running simultaneously
                 */
                await TeamService.updateTeamMemberRole(
                    projectId,
                    userId,
                    teamMemberId,
                    data.role
                );
                const teamMembers: $TSFixMe =
                    await TeamService.updateTeamMemberRole(
                        projectId,
                        userId,
                        userId,
                        'Administrator'
                    );

                NotificationService.create(
                    projectId,

                    `A team members role was updated by ${req.user.name}`,

                    req.user.id,
                    'information'
                );

                return sendItemResponse(req, res, teamMembers);
            }
            // Call the TeamService
            const updatedTeamMembers: $TSFixMe =
                await TeamService.updateTeamMemberRole(
                    projectId,
                    userId,
                    teamMemberId,
                    data.role
                );

            NotificationService.create(
                projectId,

                `A team members role was updated by ${req.user.name}`,

                req.user.id,
                'information'
            );

            return sendItemResponse(req, res, updatedTeamMembers);
        } catch (error) {
            return sendErrorResponse(req, res, error as Exception);
        }
    }
);

export default router;
