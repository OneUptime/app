export default class Service {
    async create(data: $TSFixMe): void {
        const emailTemplateModel = new EmailTemplateModel();

        emailTemplateModel.projectId = data.projectId || null;

        emailTemplateModel.subject = data.subject || null;

        emailTemplateModel.body = data.body || null;

        emailTemplateModel.emailType = data.emailType || null;

        emailTemplateModel.allowedVariables =
            emailTemplateVariables[[data.emailType]];
        const emailTemplate = await emailTemplateModel.save();
        return emailTemplate;
    }

    async updateOneBy(query: Query, data: $TSFixMe): void {
        if (!query) {
            query = {};
        }

        if (!query['deleted']) query['deleted'] = false;

        if (data.emailType && !data.allowedVariables) {
            data.allowedVariables = emailTemplateVariables[[data.emailType]];
        }
        const updatedEmailTemplate = await EmailTemplateModel.findOneAndUpdate(
            query,
            {
                $set: data,
            },
            {
                new: true,
            }
        );
        return updatedEmailTemplate;
    }

    async updateBy(query: Query, data: $TSFixMe): void {
        if (!query) {
            query = {};
        }

        if (!query['deleted']) query['deleted'] = false;
        let updatedData = await EmailTemplateModel.updateMany(query, {
            $set: data,
        });
        const select = 'projectId subject body emailType allowedVariables';
        updatedData = await this.findBy({
            query,
            select,
            populate: [{ path: 'projectId', select: 'nmae' }],
        });
        return updatedData;
    }

    async deleteBy(query: Query, userId: ObjectID): void {
        const emailTemplate = await EmailTemplateModel.findOneAndUpdate(
            query,
            {
                $set: {
                    deleted: true,
                    deletedById: userId,
                    deletedAt: Date.now(),
                },
            },
            {
                new: true,
            }
        );
        return emailTemplate;
    }

    async findBy({ query, limit, skip, populate, select, sort }: FindBy): void {
        query['deleted'] = false;
        const emailTemplates = EmailTemplateModel.find(query)
            .lean()
            .sort(sort)
            .limit(limit.toNumber())
            .skip(skip.toNumber());
        emailTemplates.select(select);
        emailTemplates.populate(populate);
        const result = await emailTemplates;

        return result;
    }

    async findOneBy({ query, select, populate, sort }: FindOneBy): void {
        if (!query) {
            query = {};
        }

        query['deleted'] = false;
        const emailTemplate = EmailTemplateModel.findOne(query)
            .sort(sort)
            .lean()
            .sort(sort);

        emailTemplate.select(select);
        emailTemplate.populate(populate);
        const result = await emailTemplate;
        return result;
    }

    async countBy(query: Query): void {
        if (!query) {
            query = {};
        }

        query['deleted'] = false;
        const count = await EmailTemplateModel.countDocuments(query);
        return count;
    }

    async getTemplates(projectId: ObjectID): void {
        const select = 'projectId subject body emailType allowedVariables';
        const templates = await Promise.all(
            defaultTemplate.map(async template => {
                const emailTemplate = await this.findOneBy({
                    query: {
                        projectId: projectId,
                        emailType: template.emailType,
                    },
                    select,
                    populate: [{ path: 'projectId', select: 'nmae' }],
                });
                return emailTemplate != null && emailTemplate != undefined
                    ? emailTemplate
                    : template;
            })
        );
        return templates;
    }

    async resetTemplate(projectId: ObjectID, templateId: $TSFixMe): void {
        const select = 'projectId subject body emailType allowedVariables';
        const oldTemplate = await this.findOneBy({
            query: { _id: templateId },
            select,
            populate: [{ path: 'projectId', select: 'nmae' }],
        });
        const newTemplate = defaultTemplate.filter(
            template => template.emailType === oldTemplate.emailType
        )[0];
        const resetTemplate = await this.updateOneBy(
            {
                _id: oldTemplate._id,
            },
            {
                emailType: newTemplate.emailType,
                subject: newTemplate.subject,
                body: newTemplate.body,
                allowedVariables: newTemplate.allowedVariables,
            }
        );
        return resetTemplate;
    }
}

import EmailTemplateModel from '../Models/emailTemplate';
import ObjectID from 'Common/Types/ObjectID';
import emailTemplateVariables from '../config/emailTemplateVariables';
import defaultTemplate from '../config/emailTemplate';

import FindOneBy from '../Types/DB/FindOneBy';
import FindBy from '../Types/DB/FindBy';
import Query from '../Types/DB/Query';
