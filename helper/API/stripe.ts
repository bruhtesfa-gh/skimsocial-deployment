
import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_TEST_KEY || '', {
    apiVersion: '2022-11-15',
});

export const createStripeCustomer = async (email: string, name: string): Promise<Stripe.Customer> => {
    const stripes = new Stripe(process.env.STRIPE_TEST_KEY || '', {
        apiVersion: '2022-11-15',
    });
    const customer = await stripes.customers.create({
        name: name,
        email: email,
    });
    return customer;
}