import { GraphQLResolveInfo } from "graphql";
import { GraphQLError } from "graphql";
import CustomType from "../custom-type/custom-type";
import Excuter from "../middleware/middleware-executer";
import Middlewares, { GQLErrors } from "../middleware/middleware";
import bcrypt from 'bcrypt';
import axios from 'axios';
import { Prisma, PrismaClient } from "@prisma/client";
import jwt, { Secret, JwtPayload } from 'jsonwebtoken';
import { createStripeCustomer } from "../helper/API/stripe";
import Mail from "../helper/API/mail";
import express from "express";
import crypto from "crypto";
export const encriptPassword = (password: string): Promise<string> => {
    return new Promise<string>(async (resolve, reject) => {
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);
        hash ? resolve(hash) : reject(Error('could not encrypt password'));
    });
};

const login = async (user: any, prisma: PrismaClient, res: express.Response) => {
    const { id, permissions } = user;
    ;
    const access_token = jwt.sign({ id, permissions, salt: crypto.randomBytes(8).toString('hex') }, process.env.ACCESS_TOKEN_SECRET as Secret);

    const refresh_token = jwt.sign({ id, permissions, salt: crypto.randomBytes(8).toString('hex') }, process.env.REFRESH_TOKEN_SECRET as Secret);
    ////console.log("before")
    const personal_access_token = await prisma.personalAccessToken.create({
        data: { access_token, refresh_token, user: { connect: { id } } }
    });

    ////console.log(user)
    if (personal_access_token) {
        return {
            access_token,
            refresh_token,
            response: {
                success: true,
                message: 'User signed successfully',
                me: {
                    id: user.id,
                    name: user.name,
                    picture: user.picture,
                    email: user.email,
                    permissions: user.permissions,
                    is_varified: user.email_verified,
                    pricing_plan: user.pricing.name,
                    pricing_id: user.pricing.id,
                    has_instagram: user.instagrams.length > 0,
                    has_tiktok: user.tikToks.length > 0,
                }
            }
        };
    }
    else
        return {
            success: false,
            message: 'User does not signed successfully',
            me: null
        }
}

const sendVariationEmail = async (email: string, id: string) => {
    console.log(id);
    // create reusable transporter object using the default SMTP transport
    try {
        //send email varification link
        const token = jwt.sign({ email }, process.env.SESSION_SECRET as Secret,
            {
                expiresIn: '60 minutes'
            });
        const html = `<div style="background-color: #f5f5f5; padding: 20px;">
                        <div style="background-color: #ffffff; padding: 20px; border-radius: 10px;">
                           <h1 style="text-align: center; color: #d62976;">Verify your email</h1>
                           <p style="text-align: center;">Click <a href="${process.env.CLIENT_URL}/signup?token=${token}&id=${id}">here</a> to verify your email</p>
                           <p style="text-align: center;">Or copy and paste this link in your browser ${process.env.CLIENT_URL}/signup?token=${token}&id=${id}</p>
                           <p style="text-align: center;">This link will expire in 10 minutes</p>
                           <p style="text-align: center;">If you did not request this, please ignore this email</p>
                           <p style="text-align: center;">Regards</p>
                           <p style="text-align: center;">Team Socialite</p>
                        </div>
                      </div>`;
        await Mail.Send(Mail.MailType.VERIFY_EMAIL, email, html);
        return true;
    } catch (error: any) {
        return false;
    }
}

export default {
    signWithGoogle: async (parent: any, args: any, { prisma, auth, req, res }: CustomType.Context, info: GraphQLResolveInfo) => {
        ////console.log('signWithGoogle')
        let _Error = await Excuter([Middlewares.DeletedFilterParseJson, Middlewares.ValidateJsonInput], parent, args, { prisma, auth, req, res }, info, 'signUpWithGoogle');
        if (_Error)
            return _Error;
        try {
            const response = await axios.get("https://www.googleapis.com/oauth2/v3/userinfo", {
                headers: {
                    "Authorization": `Bearer ${args.json_input.access_token}`
                }
            });
            ////console.log(response.data)
            if (response.status !== 200) return GQLErrors.UNAUTHORIZED;
            const {
                sub,
                name,
                given_name,
                family_name,
                picture,
                email,
                email_verified,
                locale,
            }: {
                sub: string,
                name: string,
                given_name: string,
                family_name: string,
                picture: string,
                email: string,
                email_verified: boolean,
                locale: string,
            } = response.data;

            /** If the user doesn't exist, Prisma Client will return null */
            const user = await prisma.user.findUnique({
                where: { email },
            });
            ////console.log(user)
            if (user) {
                //update user
                const updatedUser = await prisma.user.update({
                    where: { email },
                    data: {
                        sub,
                        name: given_name,
                        lastname: family_name,
                        picture,
                    },
                    include: {
                        pricing: {
                            select: {
                                id: true,
                                name: true,
                            }
                        },
                        instagrams: {
                            where: {
                                active: true
                            },
                            select: {
                                id: true,
                                username: true,
                                connected: true,
                            }
                        },
                        tikToks: {
                            select: {
                                id: true,
                            }
                        }
                    }
                });

                const logInResponse = await login(updatedUser, prisma, res);
                //console.log("logInResponse")
                res.cookie('access_token', logInResponse.access_token, { httpOnly: false, maxAge: 1000 * 60 * 60 * 24 * 7, path: '/', secure: true, sameSite: 'none' });
                res.cookie('skimsocial_id', updatedUser.id, { httpOnly: false, maxAge: 1000 * 60 * 60 * 24 * 7, path: '/', secure: true, sameSite: "none" })
                res.cookie('refresh_token', logInResponse.refresh_token, { httpOnly: false, maxAge: 1000 * 60 * 60 * 24 * 7, path: '/', secure: true, sameSite: 'none' });
                return logInResponse.response;
            } else {
                try {
                    const freeplan = await prisma.pricing.findUnique({
                        where: { lookup_key: 'free-plan' }
                    });
                    if (freeplan == null)
                        return GQLErrors.SERVER_ERROR;
                    const customer = await createStripeCustomer(email, name);

                    const newUser = await prisma.user.create({
                        data: {
                            sub,
                            name: given_name,
                            lastname: family_name,
                            picture,
                            email,
                            stripe_customer_id: customer?.id,
                            number_of_socials: freeplan?.number_of_socials,
                            provider: 'GOOGLE',
                            pricing: {
                                connect: {
                                    id: freeplan.id
                                }
                            },

                        },
                        include: {
                            pricing: {
                                select: {
                                    id: true,
                                    name: true,
                                }
                            },
                            instagrams: {
                                where: {
                                    active: false
                                },
                                select: {
                                    id: true,
                                    username: true,
                                    connected: true,
                                }
                            },
                            tikToks: {
                                select: {
                                    id: true,
                                }
                            }
                        }
                    });

                    if (newUser) {
                        const logInResponse = await login(newUser, prisma, res);
                        res.cookie('access_token', logInResponse.access_token, { httpOnly: false, maxAge: 1000 * 60 * 60 * 24 * 7, path: '/', secure: true, sameSite: 'none' });
                        res.cookie('skimsocial_id', newUser.id, { httpOnly: false, maxAge: 1000 * 60 * 60 * 24 * 7, path: '/', secure: true, sameSite: 'none' })
                        res.cookie('refresh_token', logInResponse.refresh_token, { httpOnly: false, maxAge: 1000 * 60 * 60 * 24 * 7, path: '/', secure: true, sameSite: 'none' });
                        return logInResponse.response;
                    }
                    else
                        return GQLErrors.SERVER_ERROR;
                } catch (error: any) {
                    //console.log(error.message);
                    return GQLErrors.SERVER_ERROR;
                }
            }
        } catch (err) {
            return GQLErrors.UNAUTHORIZED
        }
    },
    signUpWithEmail: async (parent: any, args: any, { prisma, auth, req, res }: CustomType.Context, info: GraphQLResolveInfo) => {
        //console.log('signUpWithEmail')
        let _Error = await Excuter([Middlewares.DeletedFilterParseJson, Middlewares.ValidateJsonInput], parent, args, { prisma, auth, req, res }, info, 'signUpWithEmail')
        //console.log(_Error)
        if (_Error)
            return _Error;
        const {
            email,
            password,
            name,
            lastname,
        }: {
            email: string,
            password: string,
            name: string,
            lastname: string,
        } = args.json_input
        const user = await prisma.user.findUnique({
            where: { email },
        });
        if (user) {
            await sendVariationEmail(email, user.id)
            return GQLErrors.USER_ALREADY_EXISTS;
        } else {
            let hash_password = await encriptPassword(password);
            try {
                const freeplan = await prisma.pricing.findUnique({
                    where: { lookup_key: 'free-plan' }
                });
                if (freeplan == null) return GQLErrors.SERVER_ERROR;
                const customer = await createStripeCustomer(email, name);
                const newUser = await prisma.user.create({
                    data: {
                        email,
                        password: hash_password,
                        name,
                        lastname,
                        stripe_customer_id: customer?.id,
                        picture: `https://ui-avatars.com/api/?uppercase=true&name=${name}&length=1&bold=true&rounded=true&font-size=0.5&background=d62976&color=ffffff`,
                        provider: 'LOCAL',
                        number_of_socials: freeplan.number_of_socials,
                        pricing: {
                            connect: {
                                id: freeplan?.id
                            }
                        }
                    },
                });
                if (newUser) {
                    //send email varification link
                    if ((await sendVariationEmail(email, newUser.id)))
                        return {
                            success: true,
                            message: 'varification email sent successfully',
                            data: {
                                id: newUser.id,
                                name: newUser.name,
                                picture: newUser.picture,
                                email: newUser.email,
                                permissions: newUser.permissions,
                                is_varified: false,
                            }
                        }
                    return GQLErrors.INVALID_EMAIL;
                    //  const logInResponse = await login(newUser, prisma);
                }
                else
                    return null;
            } catch (err) {
                return null;
            }

        }
    },
    logInWithEmail: async (parent: any, args: any, { prisma, auth, req, res }: CustomType.Context, info: GraphQLResolveInfo) => {
        ////console.log('logInWithEmail')
        let _Error = await Excuter([Middlewares.DeletedFilterParseJson, Middlewares.ValidateJsonInput], parent, args, { prisma, auth, req, res }, info, 'logInWithEmail')
        //console.log(_Error)
        if (_Error)
            return _Error;
        try {
            const {
                email,
                password,
            }: {
                email: string,
                password: string,
            } = args.json_input
            //console.log(email, password)
            const user = await prisma.user.findUnique({
                where: { email },
                include: {
                    pricing: {
                        select: {
                            id: true,
                            name: true,
                        }
                    },
                    instagrams: {
                        where: {
                            active: false
                        },
                        select: {
                            id: true,
                            username: true,
                            connected: true,
                        }
                    },
                    tikToks: {
                        select: {
                            id: true,
                        }
                    }
                }
            });

            if (user && user.provider === 'LOCAL') {
                if (!user.email_verified) return {
                    success: false,
                    message: 'Varify your email first!!',
                    me: null
                };
                const validPassword = await bcrypt.compare(password, user.password as string);
                if (!validPassword) return {
                    success: false,
                    message: 'Invalid password',
                    me: null
                };
                //console.log('before')
                const logInResponse = await login(user, prisma, res);
                res.cookie('access_token', logInResponse.access_token, { httpOnly: false, maxAge: 1000 * 60 * 60 * 24 * 7, path: '/', secure: true, sameSite: 'none' });
                res.cookie('skimsocial_id', user.id, { httpOnly: false, maxAge: 1000 * 60 * 60 * 24 * 7, path: '/', secure: true, sameSite: 'none' })
                res.cookie('refresh_token', logInResponse.refresh_token, { httpOnly: false, maxAge: 1000 * 60 * 60 * 24 * 7, path: '/', secure: true, sameSite: 'none' });
                return logInResponse.response;
            } else {
                return {
                    success: false,
                    message: 'Invalid email or password',
                    me: null
                };
            }
        } catch (error: any) {
            return GQLErrors.SERVER_ERROR;
        }

    },
    refreshToken: async (parent: any, args: any, { prisma, auth, req, res }: CustomType.Context, info: GraphQLResolveInfo) => {
        let _Error = await Excuter([Middlewares.DeletedFilterParseJson, Middlewares.ValidateJsonInput], parent, args, { prisma, auth, req, res }, info, 'refreshToken')
        if (_Error)
            return _Error;
        const { refresh_token, }: { refresh_token: string, } = args.json_input
        const personal_access_token = await prisma.personalAccessToken.findUnique({
            where: { refresh_token },
        });
        if (personal_access_token) {
            const decoded = jwt.verify(personal_access_token.refresh_token, process.env.REFRESH_TOKEN_SECRET as Secret) as JwtPayload;
            const user = await prisma.user.findUnique({
                where: { id: decoded.id },
            });
            if (!user) return GQLErrors.UNAUTHORIZED;
            const { id, permissions } = user;
            const access_token = jwt.sign({ id, permissions }, process.env.ACCESS_TOKEN_SECRET as Secret, {
                expiresIn: '1h'
            });
            //const refresh_token = jwt.sign({ id, permissions }, process.env.REFRESH_TOKEN_SECRET as Secret);
            const updated_personal_access_token = await prisma.personalAccessToken.update({
                where: { id: personal_access_token.id },
                data: { access_token }
            });

            if (updated_personal_access_token)
                return { access_token, refresh_token: updated_personal_access_token.refresh_token };
            else
                return null;
        } else {
            return GQLErrors.UNAUTHORIZED;
        }
    },
    logout: async (parent: any, args: any, { prisma, auth, req, res }: CustomType.Context, info: GraphQLResolveInfo) => {
        let _Error = await Excuter([Middlewares.DeletedFilterParseJson, Middlewares.Authenticate], parent, args, { prisma, auth, req, res }, info, 'logout')
        if (_Error)
            return _Error;
        const {
            refresh_token,
        }: {
            refresh_token: string,
        } = req.cookies;
        try {
            const personal_access_token = await prisma.personalAccessToken.findUnique({
                where: { refresh_token },
            });
            if (personal_access_token) {
                const deleted_personal_access_token = await prisma.personalAccessToken.delete({
                    where: { id: personal_access_token.id },
                });
            }
        } catch (error: any) {

        }
        res.cookie('access_token', '', { httpOnly: false, maxAge: 0, path: '/', secure: true, sameSite: 'none' });
        res.cookie('skimsocial_id', '', { httpOnly: false, maxAge: 0, path: '/', secure: true, sameSite: 'none' })
        res.cookie('refresh_token', '', { httpOnly: false, maxAge: 0, path: '/', secure: true, sameSite: 'none' });
        return {
            success: true,
            message: 'User logged out successfully',
        };
    },
    forgotPassword: async (parent: any, args: any, { prisma, auth, req, res }: CustomType.Context, info: GraphQLResolveInfo) => {
        let _Error = await Excuter([Middlewares.DeletedFilterParseJson, Middlewares.ValidateJsonInput], parent, args, { prisma, auth, req, res }, info, 'forgotPassword')
        if (_Error)
            return _Error;
        const {
            email,
        }: {
            email: string,
        } = args.json_input
        const user = await prisma.user.findUnique({
            where: { email },
        });

        if (user && user.provider === 'LOCAL') {
            if (!user.email_verified) {
                return GQLErrors.EMAIL_NOT_VERIFIED;
            }
            const token = jwt.sign({ id: user.id }, process.env.SESSION_SECRET as Secret, {
                expiresIn: '10 minutes'
            });
            const reset_password_token = await prisma.resetPasswordToken.create({
                data: {
                    userId: user.id,
                    token,
                },
            });
            if (reset_password_token) {
                // create reusable transporter object using the default SMTP transport
                try {
                    //send email varification link
                    const html = `<div style="background-color: #f5f5f5; padding: 20px;">
                                    <div style="background-color: #ffffff; padding: 20px; border-radius: 10px;">
                                        <h1 style="text-align: center; color: #d62976;">Reset your password</h1>
                                        <p style="text-align: center;">Click <a href="${process.env.CLIENT_URL}/reset-password/${token}">here</a> to reset your password</p>
                                        <p style="text-align: center;">Or copy and paste this link in your browser ${process.env.CLIENT_URL}/reset-password/${token}</p>
                                        <p style="text-align: center;">This link will expire in 10 minutes</p>
                                        <p style="text-align: center;">If you did not request this, please ignore this email</p>
                                        <p style="text-align: center;">Regards</p>
                                        <p style="text-align: center;">Team Socialite</p>
                                    </div>
                                </div>`;
                    await Mail.Send(Mail.MailType.RESET_PASSWORD, email, html);
                    return true;
                } catch (error: any) {
                    return false;
                }
            } else {
                return false;
            }
        } else {
            return false;
        }
    },
    resetPassword: async (parent: any, args: any, { prisma, auth, req, res }: CustomType.Context, info: GraphQLResolveInfo) => {
        let _Error = await Excuter([Middlewares.DeletedFilterParseJson, Middlewares.ValidateJsonInput], parent, args, { prisma, auth, req, res }, info, 'resetPassword')
        if (_Error)
            return _Error;
        const {
            token,
            password,
        }: {
            token: string,
            password: string,
        } = args.json_input
        const reset_password_token = await prisma.resetPasswordToken.findUnique({
            where: { token },
        });
        if (reset_password_token) {
            try {
                const decoded = jwt.verify(reset_password_token.token, process.env.SESSION_SECRET as Secret) as JwtPayload;
                const user = await prisma.user.findUnique({
                    where: { id: decoded.id },
                });
                if (!user) return GQLErrors.UNAUTHORIZED;
                const hash_password = await encriptPassword(password);
                const updated_user = await prisma.user.update({
                    where: { id: user.id },
                    data: { password: hash_password },
                });
                if (updated_user) {
                    const deleted_reset_password_token = await prisma.resetPasswordToken.delete({
                        where: { id: reset_password_token.id },
                    });
                    if (deleted_reset_password_token)
                        return true;
                    else
                        return false;
                } else {
                    return false;
                }
            } catch (error: any) {
                return GQLErrors.TOKEN_EXPIRED;
            }
        } else {
            return false;
        }
    },
    changePassword: async (parent: any, args: any, { prisma, auth, req, res }: CustomType.Context, info: GraphQLResolveInfo) => {
        let _Error = await Excuter([Middlewares.Authenticate, Middlewares.DeletedFilterParseJson, Middlewares.ValidateJsonInput], parent, args, { prisma, auth, req, res }, info, 'changePassword')
        if (_Error)
            return _Error;
        const {
            old_password,
            new_password,
        }: {
            old_password: string,
            new_password: string,
        } = args.json_input
        const user = await prisma.user.findUnique({
            where: { id: auth.id },
        });
        if (user) {
            const validPassword = await bcrypt.compare(old_password, user.password as string);
            if (!validPassword) return GQLErrors.UNAUTHORIZED;
            const hash_password = await encriptPassword(new_password);
            const updated_user = await prisma.user.update({
                where: { id: user.id },
                data: { password: hash_password },
            });
            if (updated_user)
                return true;
            else
                return false;
        } else {
            return false;
        }
    },
    sendVarifyEmail: async (parent: any, args: any, { prisma, auth, req, res }: CustomType.Context, info: GraphQLResolveInfo) => {
        let _Error = await Excuter([Middlewares.DeletedFilterParseJson, Middlewares.ValidateJsonInput], parent, args, { prisma, auth, req, res }, info, 'sendVarifyEmail')
        if (_Error)
            return _Error;
        try {
            let user = await prisma.user.findUnique({
                where: { id: args.json_input.id },
            });
            if (user) {
                if ((await sendVariationEmail(user?.email, args.json_input.id)))
                    return true;
                else return false;
            } else
                return GQLErrors.BAD_USER_INPUT;
        } catch (error) {

        }
        return GQLErrors.INVALID_EMAIL;
    },
    varifyEmail: async (parent: any, args: any, { prisma, auth, req, res }: CustomType.Context, info: GraphQLResolveInfo) => {
        let _Error = await Excuter([Middlewares.DeletedFilterParseJson, Middlewares.ValidateJsonInput], parent, args, { prisma, auth, req, res }, info, 'varifyEmail')
        if (_Error)
            return _Error;
        const {
            token,
        }: {
            token: string,
        } = args.json_input;
        try {
            let decoded: JwtPayload;
            try {
                decoded = jwt.verify(token, process.env.SESSION_SECRET as Secret) as JwtPayload;
            } catch (error: any) {
                //console.log(error.message)
                return GQLErrors.TOKEN_EXPIRED;
            }
            ////console.log(decoded)
            const user = await prisma.user.findUnique({
                where: { email: decoded.email },
            });
            if (!user) return GQLErrors.UNAUTHORIZED;
            ////console.log(user)
            if (user.email_verified) return GQLErrors.EMAIL_ALREADY_VERIFIED;
            const updated_user = await prisma.user.update({
                where: { id: user.id },
                data: { email_verified: true },
                include: {
                    pricing: {
                        select: {
                            id: true,
                            name: true,
                        }
                    },
                    instagrams: {
                        where: {
                            active: false,
                        },
                        select: {
                            id: true,
                            username: true,
                            connected: true,
                        }
                    },
                    tikToks: {
                        select: {
                            id: true,
                        }
                    }
                }
            });
            ////console.log(updated_user)
            if (updated_user) {
                ////console.log('updated_user')
                const logInResponse = await login(updated_user, prisma, res);
                ////console.log(logInResponse)
                res.cookie('access_token', logInResponse.access_token, { httpOnly: false, maxAge: 1000 * 60 * 60 * 24 * 7, path: '/', secure: true, sameSite: 'none' });
                res.cookie('skimsocial_id', user.id, { httpOnly: false, maxAge: 1000 * 60 * 60 * 24 * 7, path: '/', secure: true, sameSite: "none" })
                res.cookie('refresh_token', logInResponse.refresh_token, { httpOnly: false, maxAge: 1000 * 60 * 60 * 24 * 7, path: '/', secure: true, sameSite: 'none' });
                return logInResponse.response;
            }
            else
                return null;
        }
        catch (error: any) {
            //console.log(error.message)
            return GQLErrors.SERVER_ERROR;
        }
    },
}