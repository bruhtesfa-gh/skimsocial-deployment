import express from 'express';
import Stripe from 'stripe';
import fs from "fs";
import axios from 'axios';
import { createTransport } from 'nodemailer';
import { createStripeCustomer } from '../helper/API/stripe';
import prisma from '../prisma/prisma-client';
const stripe = new Stripe(process.env.STRIPE_TEST_KEY || '', {
    apiVersion: '2022-11-15',
});
const stripeWebhook = express.Router();


stripeWebhook.get('/prices', async (req, res) => {
    const freeplan = await prisma.pricing.findFirst({
        where: {
            lookup_key: 'free-plan'
        }
    });

    if (freeplan) {
        // res.send((await prisma.instagram.updateMany({
        //     where: {
        //         connected: true
        //     },
        //     data: {
        //         connected: false
        //     }
        // })))
        res.send((await prisma.user.delete({
            where: {
                email: "brukx7812@gmail.com",
            }
        })));
        // res.send((await prisma.user.findMany({
        //     where: {
        //         provider: 'GOOGLE'
        //     },
        //     include: {
        //         pricing: true,
        //         instagrams: {
        //             include: {
        //                 posts: {
        //                     include: {
        //                         igContents: true
        //                     }
        //                 },
        //                 reels: {
        //                     include: {
        //                         igContent: true
        //                     }
        //                 },
        //             }
        //         },
        //         tikToks: {
        //             include: {
        //                 videos: true
        //             }
        //         },
        //     }
        // })));
    } else {
        let allprices = await stripe.prices.list({
            limit: 100,
            expand: ['data.product'],
        });
        if (allprices) {
            //save pricing to database
            //create free plan
            const freeplan = await prisma.pricing.create({
                data: {
                    stripe_id: 'free-plan',
                    lookup_key: 'free-plan',
                    active: true,
                    currency: 'usd',
                    interval: 'month',
                    metadata: {
                        social_count: '20',
                        features: ["20 Socials", "1GB Storage", "1GB Bandwidth"]
                    },
                    dictiption: 'Free plan',
                    name: 'Free',
                    number_of_socials: '20',
                    price: 0,
                    prod_id: 'prod_J1Z2Z2Z2Z2Z2Z2Z2',
                    url: 'https://res.cloudinary.com/dx3a3n3n4/image/upload/v1634173899/skimsocial/plan-free.png',
                }
            });
            for (let i = 0; i < allprices.data.length; i++) {
                const price = allprices.data[i];
                const product = price.product as Stripe.Product
                //create new pricing
                const pricing = await prisma.pricing.create({
                    data: {
                        stripe_id: price.id,
                        lookup_key: price.lookup_key || '',
                        active: price.active,
                        currency: price.currency,
                        interval: price.recurring?.interval || '',
                        metadata: {
                            social_count: price.metadata.social_count || '',
                            features: JSON.parse(price.metadata.features) || ''
                        },
                        dictiption: product.description || '',
                        name: product.name || '',
                        number_of_socials: price.metadata.social_count,
                        price: price.unit_amount || 0,
                        prod_id: product.id,
                        url: product.images ? product.images[0] : '',
                    }
                });
            }

        }
        res.send((await prisma.pricing.findMany({
            include: {
                users: true
            }
        })));
        //res.send('no free plan');
    }
    //res.send(allprices);
});

/**
 * Webhook handler for asynchronous events.
 * @see https://stripe.com/docs/api#event_types
 * @param req
 * @param res
 * @returns {*} 
 * @see https://stripe.com/docs/webhooks/signatures
 */
stripeWebhook.post('/webhook', express.json({ type: 'application/json' }), async (req, res) => {
    const signature = req.headers['stripe-signature'] as string;
    try {
        //event = stripe.webhooks.constructEvent(req.body, signature, 'whsec_d490d0fed64be56d27ce127cd04169de2eccd3bd77edb95d7ca45a84ca344e36');
        const event = req.body;
        // Handle the event
        switch (event.type) {
            case 'customer.subscription.deleted': {
                const subscription: Stripe.Subscription = event.data.object;
                try {
                    const user = await prisma.user.update({
                        where: {
                            stripe_customer_id: subscription.customer as string
                        },
                        data: {
                            subscribed: false,
                            subscription_expired: true,
                            number_of_socials: "20",
                            pricing: {
                                connect: {
                                    lookup_key: 'free-plan'
                                }
                            }
                        }
                    });
                    if (user) {
                        //send email
                        const subject = 'Your subscription has been cancelled';
                        const html = `<p>Hi ${user.name},</p>
                                      <p>Your subscription has been cancelled. We are sorry to see you go.</p>
                                      <p>Now you can only add 20 social media accounts.</p>
                                      <p>Best regards,</p>
                                      <p>Team</p>`;
                        const transporter = createTransport({
                            host: process.env.SMTP_HOST,
                            port: parseInt(process.env.SMTP_PORT as string),
                            secure: false,
                            auth: {
                                user: process.env.SMTP_USER,
                                pass: process.env.SMTP_PASSWORD
                            }
                        });
                        transporter.sendMail({
                            from: process.env.SMTP_FROM,
                            to: user.email,
                            subject: subject,
                            html: html
                        }, (err, info) => {
                            if (err) {
                                //console.log(err);
                            } else {
                                //console.log(info);
                            }
                        }
                        );
                    } else {
                        //console.log('user not found or could not update user');
                    }
                } catch (error: any) {
                    //console.log(error.message);
                    const user = await prisma.user.update({
                        where: {
                            stripe_customer_id: subscription.customer as string
                        },
                        data: {
                            subscribed: false,
                            subscription_expired: true,
                            number_of_socials: "20",
                            pricing: {
                                connect: {
                                    lookup_key: 'free-plan'
                                }
                            }
                        }
                    });
                }
                break;
            }
            case 'customer.subscription.trial_will_end': {
                const subscription = event.data.object;
                status = subscription.status;
                //console.log(`🔔  Webhook received! ${event.type}`);
                break;
            }
            case 'invoice.payment_succeeded': {
                // If the payment suceeds, we update the subscription status to active
                const invoice: Stripe.Invoice = event.data.object;
                if (invoice.billing_reason === 'subscription_create') {
                    const price = invoice.lines.data[0].price;
                    try {
                        if (price) {
                            //#region 1. update user payment
                            const user = await prisma.user.update({
                                where: {
                                    stripe_customer_id: invoice.customer as string
                                },
                                data: {
                                    subscribed: true,
                                    subscription_expired: false,
                                    number_of_socials: price.metadata.social_count,
                                    pricing: {
                                        connect: {
                                            stripe_id: price.id
                                        }
                                    }
                                }
                            });
                            //#endregion

                            if (user) {
                                //#region 2. send email
                                const subject = 'Thanks for subscribing';
                                const html = `<p>Hi ${user.name},</p>
                                <p>Thanks for subscribing. We are glad to have you on board.</p>
                                <p>Best Regards,</p>
                                <p>Team</p>`;
                                const transporter = createTransport({
                                    host: process.env.SMTP_HOST,
                                    port: parseInt(process.env.SMTP_PORT as string),
                                    secure: false,
                                    auth: {
                                        user: process.env.SMTP_USER,
                                        pass: process.env.SMTP_PASSWORD
                                    }
                                });
                                transporter.sendMail({
                                    from: process.env.SMTP_FROM,
                                    to: user.email,
                                    subject: subject,
                                    html: html
                                }, (err, info) => {
                                    if (err) {
                                        //console.log(err);
                                    } else {
                                        //console.log(info);
                                    }
                                }
                                );
                                //#endregion
                            } else {
                                //console.log('user not found or could not update user');
                            }
                        } else {
                            //console.log('price not found');
                        }
                    } catch (error: any) {

                    }
                } else if (invoice.billing_reason === 'subscription_update') {
                    //#region 1. declare variables 
                    const previous: Stripe.Price | null = invoice.lines.data[0].price;
                    const current: Stripe.Price | null = invoice.lines.data[1].price;

                    let subject = '';
                    let html = '';
                    //#endregion
                    try {
                        if (current) {
                            //#region 2. update user payment
                            const user = await prisma.user.update({
                                where: {
                                    stripe_customer_id: invoice.customer as string
                                },
                                data: {
                                    subscribed: true,
                                    subscription_expired: false,
                                    number_of_socials: current.metadata.social_count,
                                    pricing: {
                                        connect: {
                                            stripe_id: current.id
                                        }
                                    }
                                }
                            });
                            //#endregion
                            if (user) {
                                const previous_unit_amount = previous?.unit_amount;
                                const current_unit_amount = current.unit_amount;
                                if (previous_unit_amount && current_unit_amount) {
                                    //#region 3. assign email variables
                                    if (previous_unit_amount < current_unit_amount) {
                                        subject = 'Thanks for upgrading your subscription';
                                        html = `<p>Hi ${user.name},</p>
                                                <p>Thanks for upgrading your subscription. We are glad to have you on board.</p>
                                                <p>Now you can add upto ${+current.metadata.social_count} social media accounts.</p>
                                                <p>Best regards,</p>
                                                <p>Team</p>`;
                                    } else {
                                        subject = 'Your subscription has been downgraded';
                                        html = `<p>Hi ${user.name},</p>
                                                <p>Your subscription has been downgraded. We are sorry to see you go.</p>
                                                <p>Now you can only add ${+current.metadata.social_count} social media accounts.</p>
                                                <p>Best regards,</p>
                                                <p>Team</p>`;
                                    }
                                    //#endregion

                                    //#region 4. send email
                                    try {
                                        let transporter = createTransport({
                                            host: process.env.EMAIL_HOST,
                                            port: 587,
                                            secure: false, // true for 465, false for other ports
                                            auth: {
                                                user: process.env.EMAIL, // generated ethereal user
                                                pass: process.env.EMAIL_PASSWORD, // generated ethereal password
                                            },
                                        });
                                        const mailOptions = {
                                            from: process.env.EMAIL,
                                            to: user.email,
                                            subject: subject,
                                            html: html,
                                        };
                                        transporter.sendMail(mailOptions, (err, info) => {
                                            if (err) {
                                                //console.log(err);
                                            } else {
                                                //console.log(info);
                                            }
                                        });
                                    } catch (error: any) {

                                    }
                                    //#endregion
                                }
                            } else {
                                //console.log('user not found');
                            }
                        } else {
                            //console.log('price not found');
                        }
                    } catch (error: any) {
                        //console.log('user not found');
                    }
                }
                break;
            }
            case 'invoice.payment_failed': {
                const invoice: Stripe.Invoice = event.data.object;

                try {
                    //update user subcription_expired to true by customer id
                    if (invoice.attempt_count === 3) {
                        const user = await prisma.user.update({
                            where: {
                                stripe_customer_id: invoice.customer as string
                            },
                            data: {
                                number_of_socials: "20",
                                subscribed: false,
                                subscription_expired: true,
                                pricing: {
                                    connect: {
                                        lookup_key: 'free-plan'
                                    }
                                }
                            }
                        });
                        if (user) {
                            //send email
                            const subject = 'Your subscription has been cancelled';
                            const html = `<p>Hi ${user.name},</p>
                                          <p>Your subscription has been cancelled. We are sorry to see you go.</p>
                                          <p>Now you can only add 20 social media accounts.</p>
                                          <p>Best regards,</p>
                                          <p>Team</p>`;
                            const transporter = createTransport({
                                host: process.env.SMTP_HOST,
                                port: parseInt(process.env.SMTP_PORT as string),
                                secure: false,
                                auth: {
                                    user: process.env.SMTP_USER,
                                    pass: process.env.SMTP_PASSWORD
                                }
                            });
                            transporter.sendMail({
                                from: process.env.SMTP_FROM,
                                to: user.email,
                                subject: subject,
                                html: html
                            }, (err, info) => {
                                if (err) {
                                    //console.log(err);
                                } else {
                                    //console.log(info);
                                }
                            }
                            );
                        }
                    } else {
                        const user = await prisma.user.update({
                            where: {
                                stripe_customer_id: invoice.customer as string
                            },
                            data: {
                                subscription_expired: true
                            }
                        });

                        if (user) {
                            //send email
                            const subject = 'Your subscription payment failed';
                            const html = `<p>Hi ${user.name},</p>
                                          <p>Your subscription payment failed. Please update your payment method.</p>
                                          <p>Best regards,</p>
                                          <p>Team</p>`;
                            const transporter = createTransport({
                                host: process.env.SMTP_HOST,
                                port: parseInt(process.env.SMTP_PORT as string),
                                secure: false,
                                auth: {
                                    user: process.env.SMTP_USER,
                                    pass: process.env.SMTP_PASSWORD
                                }
                            });
                            transporter.sendMail({
                                from: process.env.SMTP_FROM,
                                to: user.email,
                                subject: subject,
                                html: html
                            }, (err, info) => {
                                if (err) {
                                    //console.log(err);
                                } else {
                                    //console.log(info);
                                }
                            }
                            );
                        }
                    }
                } catch (error: any) {

                }
                break;
            }
            default:
                //console.log(`🔔  Webhook received! ${event.type}`);
                break;
        }
        res.sendStatus(200);
    } catch (err: any) {
        //console.log(`⚠️  Webhook signature verification failed.`, err.message);
        return res.sendStatus(400);
    }
});

export default stripeWebhook;