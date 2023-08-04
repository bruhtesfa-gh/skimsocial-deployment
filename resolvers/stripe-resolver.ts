import { GraphQLResolveInfo } from "graphql";
import CustomType from "../custom-type/custom-type";
import Excuter from "../middleware/middleware-executer";
import Middlewares from "../middleware/middleware";
import Stripe from 'stripe';
import { createStripeCustomer } from "../helper/API/stripe";

export default {
    createCheckoutSession: async (parent: any, args: any, { prisma, auth, req, res }: CustomType.Context, info: GraphQLResolveInfo) => {
        let _Error = await Excuter([Middlewares.DeletedFilterParseJson, Middlewares.ValidateJsonInput, Middlewares.Authenticate], parent, args, { prisma, auth, req, res }, info, 'createCheckoutSession');
        if (_Error)
            return _Error;
        const stripe = new Stripe(process.env.STRIPE_TEST_KEY || '', {
            apiVersion: '2022-11-15',
        });
        try {
            //#region 1. get Auth user
            let AuthUser = null;
            try {
                AuthUser = await prisma.user.findUnique({
                    where: {
                        id: auth.id as string
                    }
                });
                //just to remove type error
                if (AuthUser === null) {
                    return {
                        success: false,
                        message: 'User not found'
                    }
                }
            } catch (error: any) {
                return {
                    success: false,
                    message: 'User not found'
                }
            }
            //#endregion

            //#region 2. get price from lookup_key which is passed from client
            let prices = null;
            try {
                prices = await stripe.prices.list({
                    lookup_keys: [args.json_input.lookup_key],
                    limit: 1,
                    expand: ['data.product'],
                });

                if (prices.data.length === 0) {
                    return {
                        success: false,
                        message: 'Price not found'
                    }
                }
            } catch (error: any) {
                return {
                    success: false,
                    message: error.message
                }
            }
            //#endregion

            //#region 3. create stripe customer if not exists and update user's stripe_customer_id
            if (!AuthUser.stripe_customer_id) {
                let customer: Stripe.Customer | null = null;
                try {
                    customer = await createStripeCustomer(AuthUser.email, AuthUser.name);
                    if (customer === null) {
                        return {
                            success: false,
                            message: 'Error creating customer'
                        }
                    }
                    AuthUser = await prisma.user.update({
                        where: {
                            id: AuthUser.id
                        },
                        data: {
                            stripe_customer_id: customer.id
                        }
                    });
                } catch (error: any) {
                    return {
                        success: false,
                        message: 'Error creating customer'
                    }
                }
            }
            //#endregion

            //#region 4. create checkout session
            const session = await stripe.checkout.sessions.create({
                billing_address_collection: 'auto',
                line_items: [
                    {
                        price: prices.data[0].id,
                        // For metered billing, do not pass quantity
                        quantity: 1,
                    },
                ],
                mode: 'subscription',
                success_url: `${process.env.CLIENT_URL}/?success=true&session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${process.env.CLIENT_URL}?canceled=true&session_id={CHECKOUT_SESSION_ID}`,
                customer: AuthUser.stripe_customer_id,
            });
            //#endregion

            //#region 5. update user's checkout_session_id
            try {
                AuthUser = await prisma.user.update({
                    where: {
                        id: AuthUser.id
                    },
                    data: {
                        checkout_session_id: session.id
                    }
                });
            } catch (error: any) {

            }
            //#endregion

            //#region 6. return session url
            return {
                success: true,
                message: 'Checkout session created',
                url: session.url
            }
            //#endregion
        } catch (error: any) {
            return {
                success: false,
                message: 'Error creating checkout session'
            }
        }
    },
    createPortalSession: async (parent: any, args: any, { prisma, auth, req, res }: CustomType.Context, info: GraphQLResolveInfo) => {
        let _Error = await Excuter([Middlewares.DeletedFilterParseJson, Middlewares.ValidateJsonInput, Middlewares.Authenticate], parent, args, { prisma, auth, req, res }, info, 'createPortalSession');
        if (_Error)
            return _Error;
        const stripe = new Stripe(process.env.STRIPE_TEST_KEY || '', {
            apiVersion: '2022-11-15',
        });
        const { session_id } = args.json_input;
        //console.log(session_id);
        try {
            const checkoutSession = await stripe.checkout.sessions.retrieve(session_id);
            const returnUrl = process.env.CLIENT_URL;

            const portalSession = await stripe.billingPortal.sessions.create({
                customer: checkoutSession.customer as string,
                return_url: returnUrl,
            });

            return {
                success: true,
                message: 'Portal session created',
                url: portalSession.url
            }
        } catch (error: any) {
            return {
                success: false,
                message: error.message
            }
        }
    }
}