export default {
    getPlans() {
        //If in testing.
        if (
            !process.env.STRIPE_PRIVATE_KEY ||
            (process.env.STRIPE_PRIVATE_KEY &&
                process.env.STRIPE_PRIVATE_KEY.startsWith('sk_test'))
        ) {
            return [
                {
                    category: 'Startup',
                    planId: 'plan_GoWIYiX2L8hwzx',
                    type: 'month',
                    amount: 25,
                    details: '$25 / Month / User',
                    monitorLimit: 5,
                    userLimit: 1,
                    extraUserFee: 25,
                    extraUserPlanId: 'plan_GoWoYO1AUR0DTQ',
                },
                {
                    category: 'Startup',
                    planId: 'plan_GoWIqpBpStiqQp',
                    type: 'annual',
                    amount: 264,
                    details: '$22/mo per user paid annually. ',
                    monitorLimit: 5,
                    userLimit: 1,
                    extraUserFee: 264,
                    extraUserPlanId: 'plan_GoWp2WJhBnD6VZ',
                },
                {
                    category: 'Growth',
                    planId: 'plan_GoWKgxRnPPBJWy',
                    type: 'month',
                    amount: 59,
                    details: '$59 / Month / User',
                    monitorLimit: 10,
                    userLimit: 1,
                    extraUserFee: 59,
                    extraUserPlanId: 'plan_GoWq0Kr6Nd4gUd',
                },
                {
                    category: 'Growth',
                    planId: 'plan_GoWKiTdQ6NiQFw',
                    type: 'annual',
                    amount: 588,
                    details: '$49/mo per user paid annually. ',
                    monitorLimit: 10,
                    userLimit: 1,
                    extraUserFee: 588,
                    extraUserPlanId: 'plan_GoWqMIaXq4ZGYU',
                },
                {
                    category: 'Scale',
                    planId: 'plan_H9Iox3l2YqLTDR',
                    type: 'month',
                    amount: 99,
                    details: '$120 / Month / User',
                    monitorLimit: 9999,
                    userLimit: 1,
                    extraUserFee: 99,
                    extraUserPlanId: 'plan_H9Imj6AgWToUwp',
                },
                {
                    category: 'Scale',
                    planId: 'plan_H9IlBKhsFz4hV2',
                    type: 'annual',
                    amount: 1188,
                    details: '$99/mo per user paid annually. ',
                    monitorLimit: 10,
                    userLimit: 1,
                    extraUserFee: 588,
                    extraUserPlanId: 'plan_H9Imd3AdGh4hFQ',
                },
            ];
        }
        return [
            {
                category: 'Startup',
                planId: 'plan_GoVgVbvNdbWwlm',
                type: 'month',
                amount: 25,
                details: '$25 / Month / User',
                monitorLimit: 5,
                userLimit: 1,
                extraUserFee: 25,
                extraUserPlanId: 'plan_GoWu7xQNlMMBBQ',
            },
            {
                category: 'Startup',
                planId: 'plan_GoVgJu5PKMLRJU',
                type: 'annual',
                amount: 264,
                details: '$22/mo per user paid annually. ',
                monitorLimit: 5,
                userLimit: 1,
                extraUserFee: 264,
                extraUserPlanId: 'plan_GoWupIEAW3zWEL',
            },
            {
                category: 'Growth',
                planId: 'plan_GoVi9EIa6MU0fG',
                type: 'month',
                amount: 59,
                details: '$59 / Month / User',
                monitorLimit: 10,
                userLimit: 1,
                extraUserFee: 59,
                extraUserPlanId: 'plan_GoWvz29xo67Hei',
            },
            {
                category: 'Growth',
                planId: 'plan_GoViZshjqzZ0vv',
                type: 'annual',
                amount: 588,
                details: '$49/mo per user paid annually. ',
                monitorLimit: 10,
                userLimit: 1,
                extraUserFee: 588,
                extraUserPlanId: 'plan_GoWv1li5eqRzAn',
            },
            {
                category: 'Scale',
                planId: 'plan_H9Ii6Qj3HLdtty',
                type: 'month',
                amount: 99,
                details: '$120 / Month / User',
                monitorLimit: 9999,
                userLimit: 1,
                extraUserFee: 99,
                extraUserPlanId: 'plan_H9InEBqd44BZF4',
            },
            {
                category: 'Scale',
                planId: 'plan_H9IjvX2Flsvlcg',
                type: 'annual',
                amount: 1188,
                details: '$99/mo per user paid annually. ',
                monitorLimit: 10,
                userLimit: 1,
                extraUserFee: 588,
                extraUserPlanId: 'plan_H9InyYK1lLzsY9',
            },
        ];
    },

    getReserveNumberProductId() {
        //If in testing.
        if (
            !process.env.STRIPE_PRIVATE_KEY ||
            (process.env.STRIPE_PRIVATE_KEY &&
                process.env.STRIPE_PRIVATE_KEY.startsWith('sk_test'))
        ) {
            return 'prod_IrghVi0HPtZB95'; //Test
        }
        return 'prod_IsoDG7l9a8t3s4'; //Production
    },

    getPlanById(id: $TSFixMe) {
        const plans: $TSFixMe = this.getPlans();
        if (id) {
            return (
                plans.find((plan: $TSFixMe) => {
                    return plan.planId === id;
                }) || null
            );
        }
        return null;
    },

    getPlanByExtraUserId(id: $TSFixMe) {
        const plans: $TSFixMe = this.getPlans();
        if (id) {
            return (
                plans.find((plan: $TSFixMe) => {
                    return plan.extraUserPlanId === id;
                }) || null
            );
        }
        return null;
    },
};
