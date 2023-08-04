import { ApolloServer } from '@apollo/server';
import express from "express";
import typeDefs from './schema/schema';
import resolvers from './resolvers/resolvers';
import dotenv from 'dotenv';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { expressMiddleware } from '@apollo/server/express4';
import { startStandaloneServer } from '@apollo/server/standalone';
import { ApolloServerErrorCode } from '@apollo/server/errors';
import { GraphQLFormattedError, GraphQLError } from 'graphql/error';
import CustomType from './custom-type/custom-type';
import jwt, { JwtPayload } from 'jsonwebtoken';
import http from 'http';
import cors from 'cors';
import { json } from 'body-parser';
import { GQLErrors } from './middleware/middleware';
import prisma from './prisma/prisma-client';
import stripeWebhook from './webhook/stripe';
import schedule from 'node-schedule';
import saveInstagramMedia from './cronjob/instagramscraper';
//@ts-ignore
import cookieParser from 'cookie-parser';

dotenv.config();

const app = express();

app.get('/', (req, res) => {
    //html with css and bootstrap
    const html = `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.3/css/all.min.css">
        <link rel="preconnect" href="https://fonts.gstatic.com">
        <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap" rel="stylesheet">
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/twitter-bootstrap/5.0.1/css/bootstrap.min.css">
        <title>Wild Social</title>
    <head>
    <body>
        <div id="root">
            <div class="container">
                <div class="row">
                    <div class="col-12">
                        <div class="d-flex justify-content-center align-items-center" style="height: 100vh;">
                            <div class="text-center">
                                <h1 class="display-1">Wild Social</h1>
                                <h2 class="display-6">GraphQL API</h2>
                                <h3 class="display-6">Version 1.0.0</h3>
                                <h3 class="display-6">Developed by <a href="http://fejleszto-tech.com/" target="_blank">Fejleszto Technology</a></h3>
                                <img src="http://fejleszto-tech.com/assets/images/favicon.png" alt="Wild Social" style="width: 200px; height: 200px;">
                                <h3 class="display-6">Contact: <a href="mailto:info@fejleszto-tech.com"><i class="fas fa-envelope"></i></a></h3>
                                <p class="display-6 text-muted">Wild Social</p>
                            </div>
                            <div class="text-center">
                                
                            </div>
                        </div>
                    </div>
                </div>
            </div>                    
        </div>
    </body>
    </html>
        `;
    res.send(html);
});
const httpServer = http.createServer(app);
const server = new ApolloServer<CustomType.Context>({
    typeDefs,
    resolvers,
    formatError: (formattedError: GraphQLFormattedError, error) => {
        const { message, extensions } = formattedError;
        if (!formattedError.path?.includes('me'))
            console.log(formattedError);
        return { message, status: extensions?.status, code: extensions?.code, data: extensions?.data };
    },
    plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
});

server.start().then((result) => {
    //access for body-parser
    app.use(express.json());
    app.use(cookieParser());
    app.use(cors({
        origin: ['http://localhost:3000', 'https://skimsocial.vercel.app', 'https://studio.apollographql.com'],
        credentials: true,
    }))
    //access for rest api
    app.use('/payment', stripeWebhook);
    //access for graphql
    //app.set('trust proxy', 1);
    app.use(
        '/graphql',
        cors<cors.CorsRequest>({ origin: ['http://localhost:3000', 'https://wildsocial-demo.vercel.app', 'https://skimsocial.vercel.app', 'https://studio.apollographql.com'], credentials: true }),
        json(),
        expressMiddleware(server, {
            context: async ({ req, res }) => {
                //res.cookie.acces
                const context: CustomType.Context = {
                    prisma,
                    auth: {
                        isAuthenticated: false,
                        hasToken: false,
                        permissions: [],
                        id: '',
                        access_token: '',
                        forbidden: false,
                    },
                    req,
                    res,
                };
                //console.log(req.cookies.access_token);
                //let _token = req.headers.authorization?.split(' ')[1];
                //console.log(req.cookies);
                let _token = req.cookies.access_token || req.headers.authorization?.split(' ')[1];
                //res.cookie('accessc', "access_token", { httpOnly: true, maxAge: 1000 * 60 * 60 * 24 * 7, path: '/', secure: process.env.NODE_ENV === 'production' ? false : true, sameSite: 'none' })
                if (_token) {
                    context.auth.access_token = _token;
                    let decoded: JwtPayload | null = null;
                    try {
                        decoded = jwt.verify(_token, process.env.ACCESS_TOKEN_SECRET || '') as JwtPayload;
                        context.auth.isAuthenticated = true;
                        context.auth.permissions = decoded.permissions;
                        context.auth.id = decoded.id;
                    } catch (error: any) {
                        if (error?.name === 'TokenExpiredError') {
                            context.auth.forbidden = true;
                        }
                        // //throw GQLErrors.INVALID_TOKEN;
                    }
                    context.auth.hasToken = true;
                }
                return context;
            },
        }),
    );
}).catch((err) => {

});
schedule.scheduleJob('32 15 * * *', async () => {
    console.log('running a task every day at 00:00');
    //await saveInstagramMedia(1, 10);
});
const starter = async () => {
    await new Promise<void>((resolve) => httpServer.listen({ port: process.env.PORT }, resolve));
    console.log(`🚀 Server ready at http://localhost:${process.env.PORT}/graphql`);
}

starter().then(() => { });

