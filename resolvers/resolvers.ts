import CustomType from "../custom-type/custom-type";
import { GraphQLResolveInfo } from 'graphql';
import authResolver from "./auth-resolver";
import connectResolver from "./connect-resolver";
import axios from "axios";
import util from "util";
import fs from "fs";
import { exec as execnormal } from 'child_process';
import https from 'https';
import { HttpsProxyAgent } from 'https-proxy-agent';
import fetch from 'node-fetch';
import jwt, { JwtPayload } from 'jsonwebtoken';
import download from 'download';
import cheerio from 'cheerio';
import InstagramAPI from "../helper/API/instagram";
import { downloadFiles } from "../helper/FileManagment/downloader";
import Middlewares, { GQLErrors } from "../middleware/middleware";
import Mail from "../helper/API/mail";
import stripeResolver from "./stripe-resolver";
import instagramResolver from "./instagram-resolver";
import Excuter from "../middleware/middleware-executer";
import path from 'path';
import TikTokAPI from "../helper/API/tiktok";
import { request, response } from "express";
import tiktokResolver from "./tiktok-resolver";
import collectionResolver from "./collection-resolver";
import GraphQLJSON from 'graphql-type-json';
import filterResolver from "./filter-resolver";
import contentResolver from "./content-resolver";


const exec = util.promisify(execnormal);
const proxyaddress = 'pr.oxylabs.io:7777';
const proxyauth = 'customer-bruk_x:Snpgl2iDY69GGhhhh821387213';

async function getCsrfToken() {
    try {
        //send get response to https://www.instagram.com/account/login/
        //and set nessary headers
        const response = await axios({
            method: 'get',
            url: 'https://www.instagram.com/accounts/login/',
            headers: {
                'authority': 'www.instagram.com',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36',
                'accept': '*/*',
                'accept-language': 'en-US,en;q=0.9',
            }
        });
        const html = response.data as string;
        let csrftoken: string = '';
        csrftoken = html.substring(html.indexOf("csrf_token"), html.indexOf('viewer')).match(/[a-zA-Z0-9]+/gi)![2] as string;
        if (!csrftoken) {
            //console.log('csrftoken not found in first try')
            csrftoken = html.substring(html.lastIndexOf("csrf_token"), html.lastIndexOf('viewer')).match(/[a-zA-Z0-9]+/gi)![2] as string;
        }
        //if csrf is found return success and token
        if (csrftoken) {
            return {
                success: true,
                token: csrftoken
            };
        }
        //if csrf is not found return error
        return {
            success: false,
            error: 'csrf token not found'
        };
    } catch (error: any) {
        console.error(error);
    }
}

const resolvers = {
    Me: {
        instagrams: instagramResolver.getUserInstagramAccounts,
        tiktoks: tiktokResolver.getUserTikTokAccounts,
        collections: collectionResolver.getUserMiniCollections,
    },
    Post: {
        ig_contents: instagramResolver.getPostIgContents,
    },
    Reel: {
        ig_content: instagramResolver.getReelIgContent,
    },
    Story: {
        ig_contents: instagramResolver.getStoryIgContents,
    },
    Instagram: {
        posts: instagramResolver.getInstagramAccountPosts,
        reels: instagramResolver.getInstagramAccountReels,
        stories: instagramResolver.getInstagramAccountStories,
        members: instagramResolver.getUserInstaMembers,
    },
    TikTok: {
        videos: tiktokResolver.getTikTokAccountVideos,
    },
    Video: {
        owner: tiktokResolver.getVideoOwner,
    },
    HelloResponse: {
        data: (parent: any, args: any, context: CustomType.Context, info: GraphQLResolveInfo) => {
            //console.log(parent, args);
            return {
                name: "John",
                message: "Hello John"
            };
        }
    },
    FilterPost: {
        ig_contents: filterResolver.filterPostIgContents,
    },
    FilterReel: {
        ig_content: filterResolver.filterReelIgContent,
    },
    FilterStory: {
        ig_contents: filterResolver.filterStoryIgContents,
    },
    FilterInstagram: {
        posts: filterResolver.filterInstagramPosts,
        reels: filterResolver.filterInstagramReels,
        stories: filterResolver.filterInstagramStories,
    },
    FilterVideo: {
        owner: filterResolver.filterVideoOwner,
    },
    FilterTikTok: {
        videos: filterResolver.filterTikTokVideos,
    },
    FilterContentResponse: {
        instagrams: filterResolver.filterInstagrams,
        tiktoks: filterResolver.filterTikToks,
    },
    Query: {
        hello: async (parent: any, args: any, context: CustomType.Context, info: GraphQLResolveInfo) => {
            //console.log(parent, args);
            return {
                success: true,
                message: "Hello World",
                args: args,
            };
        },
        filterContents: filterResolver.filterContents,
        me: async (parent: any, args: any, { prisma, auth, req, res }: CustomType.Context, info: GraphQLResolveInfo) => {
            let _Error = await Excuter([Middlewares.Authenticate], parent, args, { prisma, auth, req, res }, info, 'me');
            if (_Error)
                return _Error;
            try {
                const user = await prisma.user.findUnique({
                    where: {
                        id: auth.id as string
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
                            }
                        },
                        tikToks: {
                            select: {
                                id: true,
                            }
                        },
                    }
                });
                if (user) {
                    return {
                        id: user.id,
                        name: user.name,
                        picture: user.picture,
                        email: user.email,
                        permissions: user.permissions,
                        is_varified: user.email_verified,
                        pricing_plan: user.pricing.name,
                        pricing_id: user.pricing.id,
                        has_instagram: user.instagrams.length > 0 ? true : false,
                        has_tiktok: user.tikToks.length > 0 ? true : false
                    }
                } else {
                    return GQLErrors.UNAUTHENTICATED;
                }
            } catch (error: any) {
                //console.log(error.message);
                return GQLErrors.SERVER_ERROR;
            }
        },
        userInstagrams: async (parent: any, args: any, { prisma, auth, req, res }: CustomType.Context, info: GraphQLResolveInfo) => {
            let _Error = await Excuter([Middlewares.DeletedFilterParseJson, Middlewares.ValidateJsonInput], parent, args, { prisma, auth, req, res }, info, 'userInstagrams');
            if (_Error)
                return _Error;
            try {
                const id = args.json_input.userID;
                const user = await prisma.user.findUnique({
                    where: {
                        id: id
                    },
                    include: {
                        instagrams: {
                            where: {
                                active: true
                            },
                            select: {
                                id: true,
                                pk: true,
                                username: true,
                                full_name: true,
                                connected: true,
                                profile_pic_url: true,
                            }
                        }
                    }
                });
                ////console.log(user);
                if (user) {
                    return {
                        success: true,
                        message: 'Instagram accounts fetched successfully',
                        instagrams: user.instagrams
                    };
                } else {
                    return {
                        success: false,
                        message: 'User not found, please login to your Skimsocial account and try again',
                        instagrams: []
                    };
                }
            } catch (error: any) {
                //console.log(error.message);
                return {
                    success: false,
                    message: 'Server error',
                    instagrams: []
                };
            }
        },
        userTikToks: async (parent: any, args: any, { prisma, auth, req, res }: CustomType.Context, info: GraphQLResolveInfo) => {
            let _Error = await Excuter([Middlewares.DeletedFilterParseJson, Middlewares.ValidateJsonInput], parent, args, { prisma, auth, req, res }, info, 'userTikToks');
            if (_Error)
                return _Error;
            try {
                const id = args.json_input.userID;
                const user = await prisma.user.findUnique({
                    where: {
                        id: id
                    },
                    include: {
                        tikToks: {
                            select: {
                                id: true,
                                t_id: true,
                                uniqueId: true,
                                nickname: true,
                                connected: true,
                                profilePic: true,
                            }
                        }
                    }
                });
                if (user) {
                    return {
                        success: true,
                        message: 'TikTok accounts fetched successfully',
                        tiktoks: user.tikToks
                    }
                } else {
                    return {
                        success: false,
                        message: 'User not found',
                        tiktoks: []
                    };
                }
            } catch (error: any) {
                //console.log(error.message);
                return {
                    success: false,
                    message: 'Server error',
                    tiktoks: []
                }
            }
        },
        getInstagramAccount: instagramResolver.getInstagramAccount,
        getTikTokAccount: tiktokResolver.getTikTokAccount,
        saveTikTokVideoWithUrl: tiktokResolver.saveTikTokVideoWithUrl,
        saveInstagramContentWithUrl: instagramResolver.saveInstagramContentWithUrl,
        getCollection: collectionResolver.getCollection,
        testquery: async (parent: any, args: any, { prisma, auth, req, res }: CustomType.Context, info: GraphQLResolveInfo) => {
            async function filterBestIPs() {
                try {
                    let data = [
                        {
                            "RetailerName": "Best Bet_ Getahun Bahirdar",
                            "SlipReference": "36027795430126",
                            "SlipId": 360277954,
                            "BetReference": "1-634320074",
                            "CurrencySymbol": "Br",
                            "Game": "Keno-141131",
                            "Stake": 1800,
                            "LosingStake": 0,
                            "WinningStake": 1800,
                            "Payout": 6840,
                            "ProfitOrLoss": -5040,
                            "TaxableAmount": 5040,
                            "TaxOnWinningBet": 0,
                            "TaxOnLosingBet": 0,
                            "VAT": 0,
                            "GGRTax": 0,
                            "ConvertedCurrencyCode": "ETB",
                            "ConvertedCurrencySymbol": "Br",
                            "TimeZone": "(UTC-12:00) International Date Line West",
                            "TimeZoneName": "Etc/GMT+12"
                        },
                        {
                            "RetailerName": "Best Bet_ Getahun Bahirdar",
                            "SlipReference": "35975134114438",
                            "SlipId": 359751341,
                            "BetReference": "1-633262783",
                            "CurrencySymbol": "Br",
                            "Game": "Keno-141053",
                            "Stake": 400,
                            "LosingStake": 0,
                            "WinningStake": 400,
                            "Payout": 1520,
                            "ProfitOrLoss": -1120,
                            "TaxableAmount": 1120,
                            "TaxOnWinningBet": 0,
                            "TaxOnLosingBet": 0,
                            "VAT": 0,
                            "GGRTax": 0,
                            "ConvertedCurrencyCode": "ETB",
                            "ConvertedCurrencySymbol": "Br",
                            "TimeZone": "(UTC-12:00) International Date Line West",
                            "TimeZoneName": "Etc/GMT+12"
                        },
                        {
                            "RetailerName": "Best Bet_ Getahun Bahirdar",
                            "SlipReference": "35972647413231",
                            "SlipId": 359726474,
                            "BetReference": "1-633213059",
                            "CurrencySymbol": "Br",
                            "Game": "Keno-141050",
                            "Stake": 200,
                            "LosingStake": 0,
                            "WinningStake": 200,
                            "Payout": 600,
                            "ProfitOrLoss": -400,
                            "TaxableAmount": 400,
                            "TaxOnWinningBet": 0,
                            "TaxOnLosingBet": 0,
                            "VAT": 0,
                            "GGRTax": 0,
                            "ConvertedCurrencyCode": "ETB",
                            "ConvertedCurrencySymbol": "Br",
                            "TimeZone": "(UTC-12:00) International Date Line West",
                            "TimeZoneName": "Etc/GMT+12"
                        },
                        {
                            "RetailerName": "Best Bet_ Getahun Bahirdar",
                            "SlipReference": "35975032044621",
                            "SlipId": 359750320,
                            "BetReference": "1-633260757",
                            "CurrencySymbol": "Br",
                            "Game": "Keno-141053",
                            "Stake": 200,
                            "LosingStake": 0,
                            "WinningStake": 200,
                            "Payout": 600,
                            "ProfitOrLoss": -400,
                            "TaxableAmount": 400,
                            "TaxOnWinningBet": 0,
                            "TaxOnLosingBet": 0,
                            "VAT": 0,
                            "GGRTax": 0,
                            "ConvertedCurrencyCode": "ETB",
                            "ConvertedCurrencySymbol": "Br",
                            "TimeZone": "(UTC-12:00) International Date Line West",
                            "TimeZoneName": "Etc/GMT+12"
                        },
                        {
                            "RetailerName": "Best Bet_ Getahun Bahirdar",
                            "SlipReference": "36006705718094",
                            "SlipId": 360067057,
                            "BetReference": "1-633892677",
                            "CurrencySymbol": "Br",
                            "Game": "Keno-141102",
                            "Stake": 50,
                            "LosingStake": 0,
                            "WinningStake": 50,
                            "Payout": 400,
                            "ProfitOrLoss": -350,
                            "TaxableAmount": 350,
                            "TaxOnWinningBet": 0,
                            "TaxOnLosingBet": 0,
                            "VAT": 0,
                            "GGRTax": 0,
                            "ConvertedCurrencyCode": "ETB",
                            "ConvertedCurrencySymbol": "Br",
                            "TimeZone": "(UTC-12:00) International Date Line West",
                            "TimeZoneName": "Etc/GMT+12"
                        },
                        {
                            "RetailerName": "Best Bet_ Getahun Bahirdar",
                            "SlipReference": "36029796095540",
                            "SlipId": 360297960,
                            "BetReference": "1-634359953",
                            "CurrencySymbol": "Br",
                            "Game": "Keno-141134",
                            "Stake": 50,
                            "LosingStake": 0,
                            "WinningStake": 50,
                            "Payout": 400,
                            "ProfitOrLoss": -350,
                            "TaxableAmount": 350,
                            "TaxOnWinningBet": 0,
                            "TaxOnLosingBet": 0,
                            "VAT": 0,
                            "GGRTax": 0,
                            "ConvertedCurrencyCode": "ETB",
                            "ConvertedCurrencySymbol": "Br",
                            "TimeZone": "(UTC-12:00) International Date Line West",
                            "TimeZoneName": "Etc/GMT+12"
                        },
                        {
                            "RetailerName": "Best Bet_ Getahun Bahirdar",
                            "SlipReference": "36032110732905",
                            "SlipId": 360321107,
                            "BetReference": "1-634407083",
                            "CurrencySymbol": "Br",
                            "Game": "Keno-141138",
                            "Stake": 10,
                            "LosingStake": 0,
                            "WinningStake": 10,
                            "Payout": 350,
                            "ProfitOrLoss": -340,
                            "TaxableAmount": 340,
                            "TaxOnWinningBet": 0,
                            "TaxOnLosingBet": 0,
                            "VAT": 0,
                            "GGRTax": 0,
                            "ConvertedCurrencyCode": "ETB",
                            "ConvertedCurrencySymbol": "Br",
                            "TimeZone": "(UTC-12:00) International Date Line West",
                            "TimeZoneName": "Etc/GMT+12"
                        },
                        {
                            "RetailerName": "Best Bet_ Getahun Bahirdar",
                            "SlipReference": "36000402513988",
                            "SlipId": 360004025,
                            "BetReference": "1-633765079",
                            "CurrencySymbol": "Br",
                            "Game": "Keno-141092",
                            "Stake": 30,
                            "LosingStake": 0,
                            "WinningStake": 30,
                            "Payout": 300,
                            "ProfitOrLoss": -270,
                            "TaxableAmount": 270,
                            "TaxOnWinningBet": 0,
                            "TaxOnLosingBet": 0,
                            "VAT": 0,
                            "GGRTax": 0,
                            "ConvertedCurrencyCode": "ETB",
                            "ConvertedCurrencySymbol": "Br",
                            "TimeZone": "(UTC-12:00) International Date Line West",
                            "TimeZoneName": "Etc/GMT+12"
                        },
                        {
                            "RetailerName": "Best Bet_ Getahun Bahirdar",
                            "SlipReference": "36010582851391",
                            "SlipId": 360105828,
                            "BetReference": "1-633972847",
                            "CurrencySymbol": "Br",
                            "Game": "Keno-141108",
                            "Stake": 30,
                            "LosingStake": 0,
                            "WinningStake": 30,
                            "Payout": 240,
                            "ProfitOrLoss": -210,
                            "TaxableAmount": 210,
                            "TaxOnWinningBet": 0,
                            "TaxOnLosingBet": 0,
                            "VAT": 0,
                            "GGRTax": 0,
                            "ConvertedCurrencyCode": "ETB",
                            "ConvertedCurrencySymbol": "Br",
                            "TimeZone": "(UTC-12:00) International Date Line West",
                            "TimeZoneName": "Etc/GMT+12"
                        },
                        {
                            "RetailerName": "Best Bet_ Getahun Bahirdar",
                            "SlipReference": "36015815692525",
                            "SlipId": 360158156,
                            "BetReference": "1-634078028",
                            "CurrencySymbol": "Br",
                            "Game": "Keno-141115",
                            "Stake": 30,
                            "LosingStake": 0,
                            "WinningStake": 30,
                            "Payout": 240,
                            "ProfitOrLoss": -210,
                            "TaxableAmount": 210,
                            "TaxOnWinningBet": 0,
                            "TaxOnLosingBet": 0,
                            "VAT": 0,
                            "GGRTax": 0,
                            "ConvertedCurrencyCode": "ETB",
                            "ConvertedCurrencySymbol": "Br",
                            "TimeZone": "(UTC-12:00) International Date Line West",
                            "TimeZoneName": "Etc/GMT+12"
                        },
                        {
                            "RetailerName": "Best Bet_ Getahun Bahirdar",
                            "SlipReference": "36004609668792",
                            "SlipId": 360046096,
                            "BetReference": "1-633849191",
                            "CurrencySymbol": "Br",
                            "Game": "Keno-141099",
                            "Stake": 200,
                            "LosingStake": 0,
                            "WinningStake": 200,
                            "Payout": 200,
                            "ProfitOrLoss": 0,
                            "TaxableAmount": 0,
                            "TaxOnWinningBet": 0,
                            "TaxOnLosingBet": 0,
                            "VAT": 0,
                            "GGRTax": 0,
                            "ConvertedCurrencyCode": "ETB",
                            "ConvertedCurrencySymbol": "Br",
                            "TimeZone": "(UTC-12:00) International Date Line West",
                            "TimeZoneName": "Etc/GMT+12"
                        },
                        {
                            "RetailerName": "Best Bet_ Getahun Bahirdar",
                            "SlipReference": "36006413863608",
                            "SlipId": 360064138,
                            "BetReference": "1-633886604",
                            "CurrencySymbol": "Br",
                            "Game": "Keno-141102",
                            "Stake": 50,
                            "LosingStake": 0,
                            "WinningStake": 50,
                            "Payout": 150,
                            "ProfitOrLoss": -100,
                            "TaxableAmount": 100,
                            "TaxOnWinningBet": 0,
                            "TaxOnLosingBet": 0,
                            "VAT": 0,
                            "GGRTax": 0,
                            "ConvertedCurrencyCode": "ETB",
                            "ConvertedCurrencySymbol": "Br",
                            "TimeZone": "(UTC-12:00) International Date Line West",
                            "TimeZoneName": "Etc/GMT+12"
                        },
                        {
                            "RetailerName": "Best Bet_ Getahun Bahirdar",
                            "SlipReference": "36015901615012",
                            "SlipId": 360159016,
                            "BetReference": "1-634079786",
                            "CurrencySymbol": "Br",
                            "Game": "Keno-141115",
                            "Stake": 50,
                            "LosingStake": 0,
                            "WinningStake": 50,
                            "Payout": 150,
                            "ProfitOrLoss": -100,
                            "TaxableAmount": 100,
                            "TaxOnWinningBet": 0,
                            "TaxOnLosingBet": 0,
                            "VAT": 0,
                            "GGRTax": 0,
                            "ConvertedCurrencyCode": "ETB",
                            "ConvertedCurrencySymbol": "Br",
                            "TimeZone": "(UTC-12:00) International Date Line West",
                            "TimeZoneName": "Etc/GMT+12"
                        },
                        {
                            "RetailerName": "Best Bet_ Getahun Bahirdar",
                            "SlipReference": "36025112827626",
                            "SlipId": 360251128,
                            "BetReference": "1-634266637",
                            "CurrencySymbol": "Br",
                            "Game": "Keno-141128",
                            "Stake": 50,
                            "LosingStake": 0,
                            "WinningStake": 50,
                            "Payout": 150,
                            "ProfitOrLoss": -100,
                            "TaxableAmount": 100,
                            "TaxOnWinningBet": 0,
                            "TaxOnLosingBet": 0,
                            "VAT": 0,
                            "GGRTax": 0,
                            "ConvertedCurrencyCode": "ETB",
                            "ConvertedCurrencySymbol": "Br",
                            "TimeZone": "(UTC-12:00) International Date Line West",
                            "TimeZoneName": "Etc/GMT+12"
                        },
                        {
                            "RetailerName": "Best Bet_ Getahun Bahirdar",
                            "SlipReference": "35998487528311",
                            "SlipId": 359984875,
                            "BetReference": "1-633726997",
                            "CurrencySymbol": "Br",
                            "Game": "Keno-141089",
                            "Stake": 30,
                            "LosingStake": 0,
                            "WinningStake": 30,
                            "Payout": 90,
                            "ProfitOrLoss": -60,
                            "TaxableAmount": 60,
                            "TaxOnWinningBet": 0,
                            "TaxOnLosingBet": 0,
                            "VAT": 0,
                            "GGRTax": 0,
                            "ConvertedCurrencyCode": "ETB",
                            "ConvertedCurrencySymbol": "Br",
                            "TimeZone": "(UTC-12:00) International Date Line West",
                            "TimeZoneName": "Etc/GMT+12"
                        },
                        {
                            "RetailerName": "Best Bet_ Getahun Bahirdar",
                            "SlipReference": "35994222395930",
                            "SlipId": 359942223,
                            "BetReference": "1-633641567",
                            "CurrencySymbol": "Br",
                            "Game": "Keno-141082",
                            "Stake": 10,
                            "LosingStake": 0,
                            "WinningStake": 10,
                            "Payout": 80,
                            "ProfitOrLoss": -70,
                            "TaxableAmount": 70,
                            "TaxOnWinningBet": 0,
                            "TaxOnLosingBet": 0,
                            "VAT": 0,
                            "GGRTax": 0,
                            "ConvertedCurrencyCode": "ETB",
                            "ConvertedCurrencySymbol": "Br",
                            "TimeZone": "(UTC-12:00) International Date Line West",
                            "TimeZoneName": "Etc/GMT+12"
                        },
                        {
                            "RetailerName": "Best Bet_ Getahun Bahirdar",
                            "SlipReference": "36015505595228",
                            "SlipId": 360155055,
                            "BetReference": "1-634071884",
                            "CurrencySymbol": "Br",
                            "Game": "Keno-141115",
                            "Stake": 10,
                            "LosingStake": 0,
                            "WinningStake": 10,
                            "Payout": 80,
                            "ProfitOrLoss": -70,
                            "TaxableAmount": 70,
                            "TaxOnWinningBet": 0,
                            "TaxOnLosingBet": 0,
                            "VAT": 0,
                            "GGRTax": 0,
                            "ConvertedCurrencyCode": "ETB",
                            "ConvertedCurrencySymbol": "Br",
                            "TimeZone": "(UTC-12:00) International Date Line West",
                            "TimeZoneName": "Etc/GMT+12"
                        },
                        {
                            "RetailerName": "Best Bet_ Getahun Bahirdar",
                            "SlipReference": "35998487528311",
                            "SlipId": 359984875,
                            "BetReference": "1-633727004",
                            "CurrencySymbol": "Br",
                            "Game": "Keno-141089",
                            "Stake": 50,
                            "LosingStake": 0,
                            "WinningStake": 50,
                            "Payout": 50,
                            "ProfitOrLoss": 0,
                            "TaxableAmount": 0,
                            "TaxOnWinningBet": 0,
                            "TaxOnLosingBet": 0,
                            "VAT": 0,
                            "GGRTax": 0,
                            "ConvertedCurrencyCode": "ETB",
                            "ConvertedCurrencySymbol": "Br",
                            "TimeZone": "(UTC-12:00) International Date Line West",
                            "TimeZoneName": "Etc/GMT+12"
                        },
                        {
                            "RetailerName": "Best Bet_ Getahun Bahirdar",
                            "SlipReference": "36002672413968",
                            "SlipId": 360026724,
                            "BetReference": "1-633810156",
                            "CurrencySymbol": "Br",
                            "Game": "Keno-141095",
                            "Stake": 50,
                            "LosingStake": 0,
                            "WinningStake": 50,
                            "Payout": 50,
                            "ProfitOrLoss": 0,
                            "TaxableAmount": 0,
                            "TaxOnWinningBet": 0,
                            "TaxOnLosingBet": 0,
                            "VAT": 0,
                            "GGRTax": 0,
                            "ConvertedCurrencyCode": "ETB",
                            "ConvertedCurrencySymbol": "Br",
                            "TimeZone": "(UTC-12:00) International Date Line West",
                            "TimeZoneName": "Etc/GMT+12"
                        },
                        {
                            "RetailerName": "Best Bet_ Getahun Bahirdar",
                            "SlipReference": "36002672413968",
                            "SlipId": 360026724,
                            "BetReference": "1-633810157",
                            "CurrencySymbol": "Br",
                            "Game": "Keno-141095",
                            "Stake": 50,
                            "LosingStake": 0,
                            "WinningStake": 50,
                            "Payout": 50,
                            "ProfitOrLoss": 0,
                            "TaxableAmount": 0,
                            "TaxOnWinningBet": 0,
                            "TaxOnLosingBet": 0,
                            "VAT": 0,
                            "GGRTax": 0,
                            "ConvertedCurrencyCode": "ETB",
                            "ConvertedCurrencySymbol": "Br",
                            "TimeZone": "(UTC-12:00) International Date Line West",
                            "TimeZoneName": "Etc/GMT+12"
                        },
                        {
                            "RetailerName": "Best Bet_ Getahun Bahirdar",
                            "SlipReference": "36002957647440",
                            "SlipId": 360029576,
                            "BetReference": "1-633816199",
                            "CurrencySymbol": "Br",
                            "Game": "Keno-141095",
                            "Stake": 50,
                            "LosingStake": 0,
                            "WinningStake": 50,
                            "Payout": 50,
                            "ProfitOrLoss": 0,
                            "TaxableAmount": 0,
                            "TaxOnWinningBet": 0,
                            "TaxOnLosingBet": 0,
                            "VAT": 0,
                            "GGRTax": 0,
                            "ConvertedCurrencyCode": "ETB",
                            "ConvertedCurrencySymbol": "Br",
                            "TimeZone": "(UTC-12:00) International Date Line West",
                            "TimeZoneName": "Etc/GMT+12"
                        },
                        {
                            "RetailerName": "Best Bet_ Getahun Bahirdar",
                            "SlipReference": "36013128184323",
                            "SlipId": 360131281,
                            "BetReference": "1-634023851",
                            "CurrencySymbol": "Br",
                            "Game": "Keno-141112",
                            "Stake": 50,
                            "LosingStake": 0,
                            "WinningStake": 50,
                            "Payout": 50,
                            "ProfitOrLoss": 0,
                            "TaxableAmount": 0,
                            "TaxOnWinningBet": 0,
                            "TaxOnLosingBet": 0,
                            "VAT": 0,
                            "GGRTax": 0,
                            "ConvertedCurrencyCode": "ETB",
                            "ConvertedCurrencySymbol": "Br",
                            "TimeZone": "(UTC-12:00) International Date Line West",
                            "TimeZoneName": "Etc/GMT+12"
                        },
                        {
                            "RetailerName": "Best Bet_ Getahun Bahirdar",
                            "SlipReference": "36013841068815",
                            "SlipId": 360138410,
                            "BetReference": "1-634039067",
                            "CurrencySymbol": "Br",
                            "Game": "Keno-141112",
                            "Stake": 50,
                            "LosingStake": 0,
                            "WinningStake": 50,
                            "Payout": 50,
                            "ProfitOrLoss": 0,
                            "TaxableAmount": 0,
                            "TaxOnWinningBet": 0,
                            "TaxOnLosingBet": 0,
                            "VAT": 0,
                            "GGRTax": 0,
                            "ConvertedCurrencyCode": "ETB",
                            "ConvertedCurrencySymbol": "Br",
                            "TimeZone": "(UTC-12:00) International Date Line West",
                            "TimeZoneName": "Etc/GMT+12"
                        },
                        {
                            "RetailerName": "Best Bet_ Getahun Bahirdar",
                            "SlipReference": "36016505329655",
                            "SlipId": 360165053,
                            "BetReference": "1-634091884",
                            "CurrencySymbol": "Br",
                            "Game": "Keno-141115",
                            "Stake": 50,
                            "LosingStake": 0,
                            "WinningStake": 50,
                            "Payout": 50,
                            "ProfitOrLoss": 0,
                            "TaxableAmount": 0,
                            "TaxOnWinningBet": 0,
                            "TaxOnLosingBet": 0,
                            "VAT": 0,
                            "GGRTax": 0,
                            "ConvertedCurrencyCode": "ETB",
                            "ConvertedCurrencySymbol": "Br",
                            "TimeZone": "(UTC-12:00) International Date Line West",
                            "TimeZoneName": "Etc/GMT+12"
                        },
                        {
                            "RetailerName": "Best Bet_ Getahun Bahirdar",
                            "SlipReference": "36033612099722",
                            "SlipId": 360336120,
                            "BetReference": "1-634436460",
                            "CurrencySymbol": "Br",
                            "Game": "Keno-141141",
                            "Stake": 50,
                            "LosingStake": 0,
                            "WinningStake": 50,
                            "Payout": 50,
                            "ProfitOrLoss": 0,
                            "TaxableAmount": 0,
                            "TaxOnWinningBet": 0,
                            "TaxOnLosingBet": 0,
                            "VAT": 0,
                            "GGRTax": 0,
                            "ConvertedCurrencyCode": "ETB",
                            "ConvertedCurrencySymbol": "Br",
                            "TimeZone": "(UTC-12:00) International Date Line West",
                            "TimeZoneName": "Etc/GMT+12"
                        },
                        {
                            "RetailerName": "Best Bet_ Getahun Bahirdar",
                            "SlipReference": "35998487528311",
                            "SlipId": 359984875,
                            "BetReference": "1-633727002",
                            "CurrencySymbol": "Br",
                            "Game": "Keno-141089",
                            "Stake": 30,
                            "LosingStake": 0,
                            "WinningStake": 30,
                            "Payout": 30,
                            "ProfitOrLoss": 0,
                            "TaxableAmount": 0,
                            "TaxOnWinningBet": 0,
                            "TaxOnLosingBet": 0,
                            "VAT": 0,
                            "GGRTax": 0,
                            "ConvertedCurrencyCode": "ETB",
                            "ConvertedCurrencySymbol": "Br",
                            "TimeZone": "(UTC-12:00) International Date Line West",
                            "TimeZoneName": "Etc/GMT+12"
                        },
                        {
                            "RetailerName": "Best Bet_ Getahun Bahirdar",
                            "SlipReference": "35998487528311",
                            "SlipId": 359984875,
                            "BetReference": "1-633727003",
                            "CurrencySymbol": "Br",
                            "Game": "Keno-141089",
                            "Stake": 30,
                            "LosingStake": 0,
                            "WinningStake": 30,
                            "Payout": 30,
                            "ProfitOrLoss": 0,
                            "TaxableAmount": 0,
                            "TaxOnWinningBet": 0,
                            "TaxOnLosingBet": 0,
                            "VAT": 0,
                            "GGRTax": 0,
                            "ConvertedCurrencyCode": "ETB",
                            "ConvertedCurrencySymbol": "Br",
                            "TimeZone": "(UTC-12:00) International Date Line West",
                            "TimeZoneName": "Etc/GMT+12"
                        },
                        {
                            "RetailerName": "Best Bet_ Getahun Bahirdar",
                            "SlipReference": "36002331787309",
                            "SlipId": 360023317,
                            "BetReference": "1-633803313",
                            "CurrencySymbol": "Br",
                            "Game": "Keno-141095",
                            "Stake": 10,
                            "LosingStake": 0,
                            "WinningStake": 10,
                            "Payout": 30,
                            "ProfitOrLoss": -20,
                            "TaxableAmount": 20,
                            "TaxOnWinningBet": 0,
                            "TaxOnLosingBet": 0,
                            "VAT": 0,
                            "GGRTax": 0,
                            "ConvertedCurrencyCode": "ETB",
                            "ConvertedCurrencySymbol": "Br",
                            "TimeZone": "(UTC-12:00) International Date Line West",
                            "TimeZoneName": "Etc/GMT+12"
                        },
                        {
                            "RetailerName": "Best Bet_ Getahun Bahirdar",
                            "SlipReference": "36002672413968",
                            "SlipId": 360026724,
                            "BetReference": "1-633810153",
                            "CurrencySymbol": "Br",
                            "Game": "Keno-141095",
                            "Stake": 30,
                            "LosingStake": 0,
                            "WinningStake": 30,
                            "Payout": 30,
                            "ProfitOrLoss": 0,
                            "TaxableAmount": 0,
                            "TaxOnWinningBet": 0,
                            "TaxOnLosingBet": 0,
                            "VAT": 0,
                            "GGRTax": 0,
                            "ConvertedCurrencyCode": "ETB",
                            "ConvertedCurrencySymbol": "Br",
                            "TimeZone": "(UTC-12:00) International Date Line West",
                            "TimeZoneName": "Etc/GMT+12"
                        },
                        {
                            "RetailerName": "Best Bet_ Getahun Bahirdar",
                            "SlipReference": "36002672413968",
                            "SlipId": 360026724,
                            "BetReference": "1-633810154",
                            "CurrencySymbol": "Br",
                            "Game": "Keno-141095",
                            "Stake": 30,
                            "LosingStake": 0,
                            "WinningStake": 30,
                            "Payout": 30,
                            "ProfitOrLoss": 0,
                            "TaxableAmount": 0,
                            "TaxOnWinningBet": 0,
                            "TaxOnLosingBet": 0,
                            "VAT": 0,
                            "GGRTax": 0,
                            "ConvertedCurrencyCode": "ETB",
                            "ConvertedCurrencySymbol": "Br",
                            "TimeZone": "(UTC-12:00) International Date Line West",
                            "TimeZoneName": "Etc/GMT+12"
                        },
                        {
                            "RetailerName": "Best Bet_ Getahun Bahirdar",
                            "SlipReference": "36002672413968",
                            "SlipId": 360026724,
                            "BetReference": "1-633810155",
                            "CurrencySymbol": "Br",
                            "Game": "Keno-141095",
                            "Stake": 30,
                            "LosingStake": 0,
                            "WinningStake": 30,
                            "Payout": 30,
                            "ProfitOrLoss": 0,
                            "TaxableAmount": 0,
                            "TaxOnWinningBet": 0,
                            "TaxOnLosingBet": 0,
                            "VAT": 0,
                            "GGRTax": 0,
                            "ConvertedCurrencyCode": "ETB",
                            "ConvertedCurrencySymbol": "Br",
                            "TimeZone": "(UTC-12:00) International Date Line West",
                            "TimeZoneName": "Etc/GMT+12"
                        },
                        {
                            "RetailerName": "Best Bet_ Getahun Bahirdar",
                            "SlipReference": "36004862163809",
                            "SlipId": 360048621,
                            "BetReference": "1-633854833",
                            "CurrencySymbol": "Br",
                            "Game": "Keno-141099",
                            "Stake": 10,
                            "LosingStake": 0,
                            "WinningStake": 10,
                            "Payout": 30,
                            "ProfitOrLoss": -20,
                            "TaxableAmount": 20,
                            "TaxOnWinningBet": 0,
                            "TaxOnLosingBet": 0,
                            "VAT": 0,
                            "GGRTax": 0,
                            "ConvertedCurrencyCode": "ETB",
                            "ConvertedCurrencySymbol": "Br",
                            "TimeZone": "(UTC-12:00) International Date Line West",
                            "TimeZoneName": "Etc/GMT+12"
                        },
                        {
                            "RetailerName": "Best Bet_ Getahun Bahirdar",
                            "SlipReference": "36018642490332",
                            "SlipId": 360186424,
                            "BetReference": "1-634135581",
                            "CurrencySymbol": "Br",
                            "Game": "Keno-141118",
                            "Stake": 30,
                            "LosingStake": 0,
                            "WinningStake": 30,
                            "Payout": 30,
                            "ProfitOrLoss": 0,
                            "TaxableAmount": 0,
                            "TaxOnWinningBet": 0,
                            "TaxOnLosingBet": 0,
                            "VAT": 0,
                            "GGRTax": 0,
                            "ConvertedCurrencyCode": "ETB",
                            "ConvertedCurrencySymbol": "Br",
                            "TimeZone": "(UTC-12:00) International Date Line West",
                            "TimeZoneName": "Etc/GMT+12"
                        },
                        {
                            "RetailerName": "Best Bet_ Getahun Bahirdar",
                            "SlipReference": "36019761354895",
                            "SlipId": 360197613,
                            "BetReference": "1-634158146",
                            "CurrencySymbol": "Br",
                            "Game": "Keno-141121",
                            "Stake": 30,
                            "LosingStake": 0,
                            "WinningStake": 30,
                            "Payout": 30,
                            "ProfitOrLoss": 0,
                            "TaxableAmount": 0,
                            "TaxOnWinningBet": 0,
                            "TaxOnLosingBet": 0,
                            "VAT": 0,
                            "GGRTax": 0,
                            "ConvertedCurrencyCode": "ETB",
                            "ConvertedCurrencySymbol": "Br",
                            "TimeZone": "(UTC-12:00) International Date Line West",
                            "TimeZoneName": "Etc/GMT+12"
                        },
                        {
                            "RetailerName": "Best Bet_ Getahun Bahirdar",
                            "SlipReference": "36022869659077",
                            "SlipId": 360228696,
                            "BetReference": "1-634221255",
                            "CurrencySymbol": "Br",
                            "Game": "Keno-141125",
                            "Stake": 30,
                            "LosingStake": 0,
                            "WinningStake": 30,
                            "Payout": 30,
                            "ProfitOrLoss": 0,
                            "TaxableAmount": 0,
                            "TaxOnWinningBet": 0,
                            "TaxOnLosingBet": 0,
                            "VAT": 0,
                            "GGRTax": 0,
                            "ConvertedCurrencyCode": "ETB",
                            "ConvertedCurrencySymbol": "Br",
                            "TimeZone": "(UTC-12:00) International Date Line West",
                            "TimeZoneName": "Etc/GMT+12"
                        },
                        {
                            "RetailerName": "Best Bet_ Getahun Bahirdar",
                            "SlipReference": "36032110732905",
                            "SlipId": 360321107,
                            "BetReference": "1-634407096",
                            "CurrencySymbol": "Br",
                            "Game": "Keno-141138",
                            "Stake": 10,
                            "LosingStake": 0,
                            "WinningStake": 10,
                            "Payout": 30,
                            "ProfitOrLoss": -20,
                            "TaxableAmount": 20,
                            "TaxOnWinningBet": 0,
                            "TaxOnLosingBet": 0,
                            "VAT": 0,
                            "GGRTax": 0,
                            "ConvertedCurrencyCode": "ETB",
                            "ConvertedCurrencySymbol": "Br",
                            "TimeZone": "(UTC-12:00) International Date Line West",
                            "TimeZoneName": "Etc/GMT+12"
                        },
                        {
                            "RetailerName": "Best Bet_ Getahun Bahirdar",
                            "SlipReference": "35982764662588",
                            "SlipId": 359827646,
                            "BetReference": "1-633412783",
                            "CurrencySymbol": "Br",
                            "Game": "Keno-141066",
                            "Stake": 10,
                            "LosingStake": 0,
                            "WinningStake": 10,
                            "Payout": 10,
                            "ProfitOrLoss": 0,
                            "TaxableAmount": 0,
                            "TaxOnWinningBet": 0,
                            "TaxOnLosingBet": 0,
                            "VAT": 0,
                            "GGRTax": 0,
                            "ConvertedCurrencyCode": "ETB",
                            "ConvertedCurrencySymbol": "Br",
                            "TimeZone": "(UTC-12:00) International Date Line West",
                            "TimeZoneName": "Etc/GMT+12"
                        },
                        {
                            "RetailerName": "Best Bet_ Getahun Bahirdar",
                            "SlipReference": "35983017987245",
                            "SlipId": 359830179,
                            "BetReference": "1-633418194",
                            "CurrencySymbol": "Br",
                            "Game": "Keno-141066",
                            "Stake": 10,
                            "LosingStake": 0,
                            "WinningStake": 10,
                            "Payout": 10,
                            "ProfitOrLoss": 0,
                            "TaxableAmount": 0,
                            "TaxOnWinningBet": 0,
                            "TaxOnLosingBet": 0,
                            "VAT": 0,
                            "GGRTax": 0,
                            "ConvertedCurrencyCode": "ETB",
                            "ConvertedCurrencySymbol": "Br",
                            "TimeZone": "(UTC-12:00) International Date Line West",
                            "TimeZoneName": "Etc/GMT+12"
                        },
                        {
                            "RetailerName": "Best Bet_ Getahun Bahirdar",
                            "SlipReference": "35987759649137",
                            "SlipId": 359877596,
                            "BetReference": "1-633512629",
                            "CurrencySymbol": "Br",
                            "Game": "Keno-141073",
                            "Stake": 10,
                            "LosingStake": 0,
                            "WinningStake": 10,
                            "Payout": 10,
                            "ProfitOrLoss": 0,
                            "TaxableAmount": 0,
                            "TaxOnWinningBet": 0,
                            "TaxOnLosingBet": 0,
                            "VAT": 0,
                            "GGRTax": 0,
                            "ConvertedCurrencyCode": "ETB",
                            "ConvertedCurrencySymbol": "Br",
                            "TimeZone": "(UTC-12:00) International Date Line West",
                            "TimeZoneName": "Etc/GMT+12"
                        },
                        {
                            "RetailerName": "Best Bet_ Getahun Bahirdar",
                            "SlipReference": "35996000366535",
                            "SlipId": 359960003,
                            "BetReference": "1-633677055",
                            "CurrencySymbol": "Br",
                            "Game": "Keno-141086",
                            "Stake": 10,
                            "LosingStake": 0,
                            "WinningStake": 10,
                            "Payout": 10,
                            "ProfitOrLoss": 0,
                            "TaxableAmount": 0,
                            "TaxOnWinningBet": 0,
                            "TaxOnLosingBet": 0,
                            "VAT": 0,
                            "GGRTax": 0,
                            "ConvertedCurrencyCode": "ETB",
                            "ConvertedCurrencySymbol": "Br",
                            "TimeZone": "(UTC-12:00) International Date Line West",
                            "TimeZoneName": "Etc/GMT+12"
                        },
                        {
                            "RetailerName": "Best Bet_ Getahun Bahirdar",
                            "SlipReference": "35998183767278",
                            "SlipId": 359981837,
                            "BetReference": "1-633721079",
                            "CurrencySymbol": "Br",
                            "Game": "Keno-141089",
                            "Stake": 10,
                            "LosingStake": 0,
                            "WinningStake": 10,
                            "Payout": 10,
                            "ProfitOrLoss": 0,
                            "TaxableAmount": 0,
                            "TaxOnWinningBet": 0,
                            "TaxOnLosingBet": 0,
                            "VAT": 0,
                            "GGRTax": 0,
                            "ConvertedCurrencyCode": "ETB",
                            "ConvertedCurrencySymbol": "Br",
                            "TimeZone": "(UTC-12:00) International Date Line West",
                            "TimeZoneName": "Etc/GMT+12"
                        },
                        {
                            "RetailerName": "Best Bet_ Getahun Bahirdar",
                            "SlipReference": "35998183767278",
                            "SlipId": 359981837,
                            "BetReference": "1-633721081",
                            "CurrencySymbol": "Br",
                            "Game": "Keno-141089",
                            "Stake": 10,
                            "LosingStake": 0,
                            "WinningStake": 10,
                            "Payout": 10,
                            "ProfitOrLoss": 0,
                            "TaxableAmount": 0,
                            "TaxOnWinningBet": 0,
                            "TaxOnLosingBet": 0,
                            "VAT": 0,
                            "GGRTax": 0,
                            "ConvertedCurrencyCode": "ETB",
                            "ConvertedCurrencySymbol": "Br",
                            "TimeZone": "(UTC-12:00) International Date Line West",
                            "TimeZoneName": "Etc/GMT+12"
                        },
                        {
                            "RetailerName": "Best Bet_ Getahun Bahirdar",
                            "SlipReference": "36000771529729",
                            "SlipId": 360007715,
                            "BetReference": "1-633772683",
                            "CurrencySymbol": "Br",
                            "Game": "Keno-141092",
                            "Stake": 10,
                            "LosingStake": 0,
                            "WinningStake": 10,
                            "Payout": 10,
                            "ProfitOrLoss": 0,
                            "TaxableAmount": 0,
                            "TaxOnWinningBet": 0,
                            "TaxOnLosingBet": 0,
                            "VAT": 0,
                            "GGRTax": 0,
                            "ConvertedCurrencyCode": "ETB",
                            "ConvertedCurrencySymbol": "Br",
                            "TimeZone": "(UTC-12:00) International Date Line West",
                            "TimeZoneName": "Etc/GMT+12"
                        },
                        {
                            "RetailerName": "Best Bet_ Getahun Bahirdar",
                            "SlipReference": "36001437487539",
                            "SlipId": 360014374,
                            "BetReference": "1-633785861",
                            "CurrencySymbol": "Br",
                            "Game": "Keno-141095",
                            "Stake": 10,
                            "LosingStake": 0,
                            "WinningStake": 10,
                            "Payout": 10,
                            "ProfitOrLoss": 0,
                            "TaxableAmount": 0,
                            "TaxOnWinningBet": 0,
                            "TaxOnLosingBet": 0,
                            "VAT": 0,
                            "GGRTax": 0,
                            "ConvertedCurrencyCode": "ETB",
                            "ConvertedCurrencySymbol": "Br",
                            "TimeZone": "(UTC-12:00) International Date Line West",
                            "TimeZoneName": "Etc/GMT+12"
                        },
                        {
                            "RetailerName": "Best Bet_ Getahun Bahirdar",
                            "SlipReference": "36006429899819",
                            "SlipId": 360064298,
                            "BetReference": "1-633886889",
                            "CurrencySymbol": "Br",
                            "Game": "Keno-141102",
                            "Stake": 10,
                            "LosingStake": 0,
                            "WinningStake": 10,
                            "Payout": 10,
                            "ProfitOrLoss": 0,
                            "TaxableAmount": 0,
                            "TaxOnWinningBet": 0,
                            "TaxOnLosingBet": 0,
                            "VAT": 0,
                            "GGRTax": 0,
                            "ConvertedCurrencyCode": "ETB",
                            "ConvertedCurrencySymbol": "Br",
                            "TimeZone": "(UTC-12:00) International Date Line West",
                            "TimeZoneName": "Etc/GMT+12"
                        },
                        {
                            "RetailerName": "Best Bet_ Getahun Bahirdar",
                            "SlipReference": "36014048342163",
                            "SlipId": 360140483,
                            "BetReference": "1-634043543",
                            "CurrencySymbol": "Br",
                            "Game": "Keno-141112",
                            "Stake": 10,
                            "LosingStake": 0,
                            "WinningStake": 10,
                            "Payout": 10,
                            "ProfitOrLoss": 0,
                            "TaxableAmount": 0,
                            "TaxOnWinningBet": 0,
                            "TaxOnLosingBet": 0,
                            "VAT": 0,
                            "GGRTax": 0,
                            "ConvertedCurrencyCode": "ETB",
                            "ConvertedCurrencySymbol": "Br",
                            "TimeZone": "(UTC-12:00) International Date Line West",
                            "TimeZoneName": "Etc/GMT+12"
                        },
                        {
                            "RetailerName": "Best Bet_ Getahun Bahirdar",
                            "SlipReference": "36015505595228",
                            "SlipId": 360155055,
                            "BetReference": "1-634071891",
                            "CurrencySymbol": "Br",
                            "Game": "Keno-141115",
                            "Stake": 10,
                            "LosingStake": 0,
                            "WinningStake": 10,
                            "Payout": 10,
                            "ProfitOrLoss": 0,
                            "TaxableAmount": 0,
                            "TaxOnWinningBet": 0,
                            "TaxOnLosingBet": 0,
                            "VAT": 0,
                            "GGRTax": 0,
                            "ConvertedCurrencyCode": "ETB",
                            "ConvertedCurrencySymbol": "Br",
                            "TimeZone": "(UTC-12:00) International Date Line West",
                            "TimeZoneName": "Etc/GMT+12"
                        },
                        {
                            "RetailerName": "Best Bet_ Getahun Bahirdar",
                            "SlipReference": "36016128348896",
                            "SlipId": 360161283,
                            "BetReference": "1-634084333",
                            "CurrencySymbol": "Br",
                            "Game": "Keno-141115",
                            "Stake": 10,
                            "LosingStake": 0,
                            "WinningStake": 10,
                            "Payout": 10,
                            "ProfitOrLoss": 0,
                            "TaxableAmount": 0,
                            "TaxOnWinningBet": 0,
                            "TaxOnLosingBet": 0,
                            "VAT": 0,
                            "GGRTax": 0,
                            "ConvertedCurrencyCode": "ETB",
                            "ConvertedCurrencySymbol": "Br",
                            "TimeZone": "(UTC-12:00) International Date Line West",
                            "TimeZoneName": "Etc/GMT+12"
                        },
                        {
                            "RetailerName": "Best Bet_ Getahun Bahirdar",
                            "SlipReference": "36022264056501",
                            "SlipId": 360222640,
                            "BetReference": "1-634208103",
                            "CurrencySymbol": "Br",
                            "Game": "Keno-141125",
                            "Stake": 10,
                            "LosingStake": 0,
                            "WinningStake": 10,
                            "Payout": 10,
                            "ProfitOrLoss": 0,
                            "TaxableAmount": 0,
                            "TaxOnWinningBet": 0,
                            "TaxOnLosingBet": 0,
                            "VAT": 0,
                            "GGRTax": 0,
                            "ConvertedCurrencyCode": "ETB",
                            "ConvertedCurrencySymbol": "Br",
                            "TimeZone": "(UTC-12:00) International Date Line West",
                            "TimeZoneName": "Etc/GMT+12"
                        },
                        {
                            "RetailerName": "Best Bet_ Getahun Bahirdar",
                            "SlipReference": "36024590048825",
                            "SlipId": 360245900,
                            "BetReference": "1-634256065",
                            "CurrencySymbol": "Br",
                            "Game": "Keno-141128",
                            "Stake": 10,
                            "LosingStake": 0,
                            "WinningStake": 10,
                            "Payout": 10,
                            "ProfitOrLoss": 0,
                            "TaxableAmount": 0,
                            "TaxOnWinningBet": 0,
                            "TaxOnLosingBet": 0,
                            "VAT": 0,
                            "GGRTax": 0,
                            "ConvertedCurrencyCode": "ETB",
                            "ConvertedCurrencySymbol": "Br",
                            "TimeZone": "(UTC-12:00) International Date Line West",
                            "TimeZoneName": "Etc/GMT+12"
                        }
                    ];
                    for (let i = 0; i < data.length; i++) {
                        if (data[i].Payout > 50)
                            continue;
                        if (data[i].Payout <= 0)
                            break;
                        const curlgetch = `curl "https://retail2.playbetman.com/Bet/RedeemBetDetail" \
                        -H "authority: retail2.playbetman.com" \
                        -H "accept: text/html, */*; q=0.01" \
                        -H "accept-language: en-US,en;q=0.9" \
                        -H "content-type: application/json; charset=UTF-8" \
                        -H "cookie: BetManRetail_Culture=en-GB; BetManRetail_Style=Style2; ASP.NET_SessionId=qbnhmcmkaib25b2baq0bh43e; .ASPXAUTH=88F1D240CDDF84CF38D3E2B067394DD04C5DC81D9BA9043A4FA38F421796FCD50C53C072E2BED258C9F346102CB418EE9DFB7E04895C39A58F2E81E1F7793C22C91221805708C616E6BFE023600669BCE83590F1A30A8DC1B2B3274D; __cf_bm=mLiN5vNHQjFgTLdb8c8VIfRSDZ1sUSiouaIkXPDbaag-1688306346-0-ASg7R877JzeqG8hqnVqXI/Y9Kqp8C8dfqFY+XfOhzqGGagy/h3eKjd2Pt6+HMrWZWN5tKDK9SZlctUgFHbctwYx0N4mIPTOHs0qaj41rMp2m" \
                        -H "origin: https://retail2.playbetman.com" \
                        -H "referer: https://retail2.playbetman.com/" \
                        -H "sec-ch-ua: "Not.A/Brand";v="8", "Chromium";v="114", "Google Chrome";v="114"" \
                        -H "sec-ch-ua-mobile: ?0" \
                        -H "sec-ch-ua-platform: "Windows"" \
                        -H "sec-fetch-dest: empty" \
                        -H "sec-fetch-mode: cors" \
                        -H "sec-fetch-site: same-origin" \
                        -H "user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36" \
                        -H "x-requested-with: XMLHttpRequest" \
                        --data-raw "{"SlipReference":"${data[i].SlipReference}","Offset":180,"SlipInputMethod":2}"`
                        try {
                            ////console.log(data[i]['Payout'])
                            const { stdout, stderr }: { stdout: any, stderr: any } = await exec(curlgetch);
                            //console.log("stdout");
                            //if (stdout.includes("Win"))
                            //console.log("yes", data[i]['SlipReference']);
                        } catch (error: any) {
                            //console.log("error.stdout")
                            //if (error.stdout.includes("Win"))
                            //console.log("yes", data[i]['SlipReference']);
                        };

                    }
                    //console.log("end");

                    return {
                        id: "1",
                        name: "bruk_x"
                    };
                } catch (error: any) {
                    //console.log("")
                }
            }
            const profileInfo = await TikTokAPI.getTikTokProfile("michaelkumsa4");
            console.log("profileInfo", profileInfo);
            return {
                id: "1",
                name: "bruk_x"
            }
            // if (instagram)
            //     console.log(await instagramResolver.storySaver("northwest_mcm_wholesale", "3151273701169432808", instagram));
            try {
                let userId = '18428658';
                // const res = await InstagramAPI.getProfileInfoById(userId, 'csrftoken=Hsk173NaaI4xuXNVAFP026rnvqdbwyR0; rur="LDC\\05458353110944\\0541712170829:01f79071eac851feb98379f0658b989324e332237b0caa3199838da2446d64a097167e0f"; mid=ZCxzygALAAESgUr0YTt2MffdHrJf; ds_user_id=58353110944; ig_did=27D23FC3-451E-4420-8E98-602D6F7F4D77; sessionid=58353110944%3AXktfapADTL6dPp%3A13%3AAYejCGidQkcaU3gNMzlV1eM5NsKw6ObqJFalQVDTww');
                // //console.log(res);
                //return true;
                // const upload_to_s3 = await downloadFiles([{
                //     key: 'profile',
                //     path: 'https://scontent.cdninstagram.com/v/t51.2885-19/333307207_226481366609565_6002692981455248869_n.jpg?stp=dst-jpg_s150x150&_nc_ht=scontent.cdninstagram.com&_nc_cat=109&_nc_ohc=d7Zmpk5X-4UAX-1SgmS&edm=APs17CUBAAAA&ccb=7-5&oh=00_AfCV9qw7Grb_BYDRNH_JW1ptW1c1xkwgpFJNoy23d-5okg&oe=643A85BC&_nc_sid=978cb9',
                //     size: 0,
                //     uploaded: false,
                //     file_not_found: false,
                // }]);
                // //console.log(upload_to_s3);
                // return true;
                const instagram = await prisma.instagram.findFirst({
                    where: {
                        username: 'bruk_x'
                    }
                });
                // let cookies: any = {};
                // const ig_cookies = JSON.parse(instagram?.cookies as string);
                // ig_cookies.forEach((cookie: any) => {
                //     cookies[cookie.name] = cookie.value;
                // });
                // //console.log(cookies);


                let media_id = '3072638141562945552'
                // const media_info = `https://www.instagram.com/api/v1/media/${media_id}/info/`;
                // const query = `https://www.instagram.com/graphql/query/`;
                const tag = 'https://www.instagram.com/api/v1/feed/tag/?tag_name=bruk_x&count=12';
                // const timeline = `https://www.instagram.com/api/v1/feed/timeline/`
                const url = `https://www.instagram.com/api/v1/feed/user/${userId}/story/`;
                // let feed = `https://www.instagram.com/api/v1/feed/user/${instagram?.username}/username/?count=12`;
                let reels = `https://www.instagram.com/api/v1/feed/reels_tray/`;
                let re = 'https://www.instagram.com/api/v1/feed/reels_media/?reel_ids=18428658'
                //https://www.instagram.com/api/v1/feed/reels_tray
                //https://www.instagram.com/api/v1/feed/user/bruk_x/username/?count=12
                // make a request to Instagram's GraphQL API to retrieve the user's posts (requires a valid session cookie)

                const story = `https://www.instagram.com/graphql/query/?query_hash=de8017ee0a7c9c45ec4260733d81ea31&variables=%7B%22reel_ids%22%3A%5B%22${userId}`
                const headers = {
                    'accept': '*/*',
                    // 'accept-encoding': 'gzip, deflate, br',
                    // 'accept-language': 'en-US,en;q=0.9',
                    'cookie': '',
                    // 'referer': 'https://www.instagram.com/stories/jerusalem_mulugeta/',
                    // 'sec-ch-prefers-color-scheme': 'dark',
                    // 'sec-ch-ua': '"Google Chrome";v="111", "Not(A:Brand";v="8", "Chromium";v="111"',
                    // 'sec-ch-ua-mobile': '?0',
                    // 'sec-ch-ua-platform': "Windows",
                    // 'sec-fetch-dest': 'empty',
                    // 'sec-fetch-mode': 'cors',
                    // 'sec-fetch-site': 'same-origin',
                    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36',
                    // 'viewport-width': 1746,
                    // 'x-asbd-id': 198387,
                    //'x-csrftoken': cookies.csrftoken,
                    'x-ig-app-id': '936619743392459',
                    //'x-ig-www-claim': 'hmac.AR2JOZyKIrOspwcSdlvIMF_YwbbaBpNmTcDcxH9pVESUJ8Ak',
                    'x-requested-with': 'XMLHttpRequest',
                };

                // const params = {
                //     query_hash: 'be13233562af2d229b008d2976b998b5',
                //     variables: JSON.stringify({
                //         id: instagram?.i_id,
                //         first: 12,
                //         after: null
                //     })
                // };
                const params = {
                    query_hash: 'de8017ee0a7c9c45ec4260733d81ea31',
                    variables: JSON.stringify({
                        id: 58353110944,
                    })
                };

                //const url = 'https://www.instagram.com/graphql/query/'

                const response = await axios({
                    method: 'get',
                    url: reels,
                    headers: headers,
                });

                //send curl request to get the reels
                //curl 'https://www.instagram.com/api/v1/feed/reels_tray/' -H 'authority: www.instagram.com' -H 'pragma: no-cache' -H 'cache-control: no-cache' -H 'accept: */*' -H 'x-ig-app-id: 936619743392459' -H 'x-requested-with: XMLHttpRequest' -H 'x-ig-www-claim: hmac.AR2JOZyKIrOspwcSdlvIMF_YwbbaBpNmTcDcxH9pVESUJ8Ak' -H 'user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/


                fs.writeFile("reels_long.json", JSON.stringify(response.data), 'utf8', function (err) {
                    if (err) {
                        //console.log("An error occured while writing JSON Object to File.");
                        return //console.log(err);
                    }

                    //console.log("JSON file has been saved.");
                });
            } catch (error: any) {
                //console.log("error")
                //console.log(error);
            }

            return {
                id: 1,
                name: "bruk",
            };
        },
        refreshInsta: async (parent: any, args: any, context: CustomType.Context, info: GraphQLResolveInfo) => {
            try {
                // [
                //     'csrftoken=ehwjdfmH4AT519QxZZJ9WneDROwhIoEh; Domain=.instagram.com; expires=Tue, 02-Apr-2024 19:31:03 GMT; Max-Age=31449600; Path=/; Secure',
                //     'rur="LDC\\05458459683304\\0541712172663:01f7ac84765ce6190992fccc1ecf929d256d6fcf3da8a33cfdcd73a00e855404ca4a8daa"; Domain=.instagram.com; HttpOnly; Path=/; SameSite=Lax; Secure',
                //     'mid=ZCx69QALAAG1HcKvJ9Oo6g_t6neZ; Domain=.instagram.com; expires=Thu, 03-Apr-2025 19:31:03 GMT; Max-Age=63072000; Path=/; Secure',
                //     'ds_user_id=58459683304; Domain=.instagram.com; expires=Mon, 03-Jul-2023 19:31:03 GMT; Max-Age=7776000; Path=/; Secure',
                //     'ig_did=F9C679BF-E1D3-470E-8D01-4302E49C226B; Domain=.instagram.com; expires=Thu, 03-Apr-2025 19:31:03 GMT; HttpOnly; Max-Age=63072000; Path=/; Secure',     
                //     'sessionid=58459683304%3Am87DZQ6V3tIon5%3A24%3AAYc0Vn-WYcx4OqdLTMmy02yYcFzxZXQDALD3GHms3Q; Domain=.instagram.com; expires=Wed, 03-Apr-2024 19:31:03 GMT; HttpOnly; Max-Age=31536000; Path=/; Secure'
                //   ]
                // const cookiesf = [
                //     'csrftoken=Hsk173NaaI4xuXNVAFP026rnvqdbwyR0; Domain=.instagram.com; expires=Tue, 02-Apr-2024 19:00:29 GMT; Max-Age=31449600; Path=/; Secure',
                //     'rur="LDC\\05458353110944\\0541712170829:01f79071eac851feb98379f0658b989324e332237b0caa3199838da2446d64a097167e0f"; Domain=.instagram.com; HttpOnly; Path=/; SameSite=Lax; Secure',
                //     'mid=ZCxzygALAAESgUr0YTt2MffdHrJf; Domain=.instagram.com; expires=Thu, 03-Apr-2025 19:00:29 GMT; Max-Age=63072000; Path=/; Secure',
                //     'ds_user_id=58353110944; Domain=.instagram.com; expires=Mon, 03-Jul-2023 19:00:29 GMT; Max-Age=7776000; Path=/; Secure',
                //     'ig_did=27D23FC3-451E-4420-8E98-602D6F7F4D77; Domain=.instagram.com; expires=Thu, 03-Apr-2025 19:00:29 GMT; HttpOnly; Max-Age=63072000; Path=/; Secure',
                //     'sessionid=58353110944%3AXktfapADTL6dPp%3A13%3AAYejCGidQkcaU3gNMzlV1eM5NsKw6ObqJFalQVDTww; Domain=.instagram.com; expires=Wed, 03-Apr-2024 19:00:29 GMT; HttpOnly; Max-Age=31536000; Path=/; Secure'
                // ].map(cookie => cookie.split(';')[0]).join('; ');
                // //console.log(cookiesf); 
                // const instagram = await context.prisma.instagram.findFirst({
                //     where: {
                //         username: 'bruk_x'
                //     }
                // });
                // if (instagram == null) throw new Error("No instagram account found");
                // let cookies: any = {};
                // const ig_cookies = JSON.parse(instagram?.cookies as string);
                // ig_cookies.forEach((cookie: any) => {
                //     cookies[cookie.name] = cookie.value;
                // });

                // const headers = {
                //     'accept': '*/*',
                //     // 'accept-encoding': 'gzip, deflate, br',
                //     // 'accept-language': 'en-US,en;q=0.9',
                //     'cookie': Object.keys(cookies).map(key => `${key}=${cookies[key]}`).join('; '),
                //     // 'referer': 'https://www.instagram.com/stories/jerusalem_mulugeta/',
                //     // 'sec-ch-prefers-color-scheme': 'dark',
                //     // 'sec-ch-ua': '"Google Chrome";v="111", "Not(A:Brand";v="8", "Chromium";v="111"',
                //     // 'sec-ch-ua-mobile': '?0',
                //     // 'sec-ch-ua-platform': "Windows",
                //     // 'sec-fetch-dest': 'empty',
                //     // 'sec-fetch-mode': 'cors',
                //     // 'sec-fetch-site': 'same-origin',
                //     'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36',
                //     // 'viewport-width': 1746,
                //     // 'x-asbd-id': 198387,
                //     //'x-csrftoken': cookies.csrftoken,
                //     'x-ig-app-id': '936619743392459',
                //     //'x-ig-www-claim': 'hmac.AR2JOZyKIrOspwcSdlvIMF_YwbbaBpNmTcDcxH9pVESUJ8Ak',
                //     'x-requested-with': 'XMLHttpRequest',
                // };

                // let { username, password }: { username: string, password: string } = instagram;
                try {
                    // let decoded = jwt.verify(password, process.env.INSTA_PASSWORD_SECRET || '') as JwtPayload;
                    // password = decoded.password;
                    // //console.log(`Decoded password for '${password}'`);
                    // const refreshCookies = async (username: string, password: string) => {
                    //     try {
                    //         const response = await axios.post('https://www.instagram.com/accounts/login/ajax/', {
                    //             username: username,
                    //             password: password
                    //         }, {
                    //             withCredentials: true
                    //         });
                    //         //console.log(response.data, response.headers);
                    //         // Check if the response contains cookies
                    //         // if (response.headers['set-cookie']) {
                    //         const cookies = [
                    //             'csrftoken=Hsk173NaaI4xuXNVAFP026rnvqdbwyR0; Domain=.instagram.com; expires=Tue, 02-Apr-2024 19:00:29 GMT; Max-Age=31449600; Path=/; Secure',
                    //             'rur="LDC\\05458353110944\\0541712170829:01f79071eac851feb98379f0658b989324e332237b0caa3199838da2446d64a097167e0f"; Domain=.instagram.com; HttpOnly; Path=/; SameSite=Lax; Secure',
                    //             'mid=ZCxzygALAAESgUr0YTt2MffdHrJf; Domain=.instagram.com; expires=Thu, 03-Apr-2025 19:00:29 GMT; Max-Age=63072000; Path=/; Secure',
                    //             'ds_user_id=58353110944; Domain=.instagram.com; expires=Mon, 03-Jul-2023 19:00:29 GMT; Max-Age=7776000; Path=/; Secure',
                    //             'ig_did=27D23FC3-451E-4420-8E98-602D6F7F4D77; Domain=.instagram.com; expires=Thu, 03-Apr-2025 19:00:29 GMT; HttpOnly; Max-Age=63072000; Path=/; Secure',
                    //             'sessionid=58353110944%3AXktfapADTL6dPp%3A13%3AAYejCGidQkcaU3gNMzlV1eM5NsKw6ObqJFalQVDTww; Domain=.instagram.com; expires=Wed, 03-Apr-2024 19:00:29 GMT; HttpOnly; Max-Age=31536000; Path=/; Secure'
                    //         ].map(cookie => cookie.split(';')[0]).join('; ');
                    //         //     return cookies;
                    //         // } else {
                    //         //     throw new Error('Unable to refresh cookies');
                    //         // }
                    //     } catch (error : any) {
                    //         console.error(error);
                    //         throw error;
                    //     }
                    // }
                    //console.log('Refreshing cookies...');

                    const csrfResponse = await getCsrfToken();
                    //console.log(csrfResponse);
                    if (csrfResponse?.success === false) {
                        throw new Error('Unable to get csrf token');
                    }
                    const csrfToken = csrfResponse?.token;

                    const time = Math.floor(Date.now() / 1000)

                    const response = await axios({
                        method: 'post',
                        url: 'https://www.instagram.com/accounts/login/ajax/',
                        headers: {
                            "Content-Type": "application/x-www-form-urlencoded",
                            "x-csrftoken": csrfToken,
                            "x-requested-with": "XMLHttpRequest",
                            "referer": "https://www.instagram.com/accounts/login/",
                            "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36",
                        },
                        data: {
                            username: "archive9109",
                            enc_password: `#PWD_INSTAGRAM_BROWSER:0:${time}:Youtubestar@123#`,
                            queryParams: {},
                            optIntoOneTap: "false",
                        }
                    })

                    //console.log("data\n", response.data, "headers\n", response.headers, "config\n", response.config);
                } catch (error: any) {
                    console.error(error);
                    throw new Error("Invalid password");
                }
            } catch (error: any) {
                //console.log(error);
            }
            return true;
        },
    },
    Mutation: {
        ...authResolver,
        connectToInstagram: connectResolver.connectToInstagram,
        connectToInstagramWithCookies: connectResolver.connectToInstagramWithCookies,
        connectToTikTokWithCookies: connectResolver.connectToTikTokWithCookies,
        connectToTiktok: connectResolver.connectToTiktok,
        disconnectFromTiktok: connectResolver.disconnectFromTiktok,
        createCheckoutSession: stripeResolver.createCheckoutSession,
        createPortalSession: stripeResolver.createPortalSession,
        createCollection: collectionResolver.createCollection,
        renameCollection: collectionResolver.renameCollection,
        deleteCollection: collectionResolver.deleteCollection,
        addStoryToCollection: collectionResolver.addStoryToCollection,
        removeStoryFromCollection: collectionResolver.removeStoryFromCollection,
        addReelToCollection: collectionResolver.addReelToCollection,
        removeReelFromCollection: collectionResolver.removeReelFromCollection,
        addPostToCollection: collectionResolver.addPostToCollection,
        removePostFromCollection: collectionResolver.removePostFromCollection,
        addVideoToCollection: collectionResolver.addVideoToCollection,
        removeVideoFromCollection: collectionResolver.removeVideoFromCollection,
        deleteContents: contentResolver.deleteContents,
        saveStories: async (parent: any, args: any, { prisma, auth, req, res }: CustomType.Context, info: GraphQLResolveInfo) => {
            let _Error = await Excuter([Middlewares.DeletedFilterParseJson, Middlewares.ValidateJsonInput, Middlewares.Authenticate], parent, args, { prisma, auth, req, res }, info, 'saveStories')
            if (_Error)
                return _Error;
            try {
                const { instagram_id } = args.json_input;
                const instagram = await prisma.instagram.findUnique({
                    where: {
                        id: instagram_id
                    },
                    include: {
                        user: true
                    }
                });
                if (instagram == null)
                    return {
                        success: false,
                        message: "No instagram account found"
                    };
                //check if user is the owner of the instagram account
                if (instagram.userId != auth.id)
                    return GQLErrors.UNAUTHORIZED;
                //check if instagram account is connected    
                if (!instagram.connected)
                    return {
                        success: false,
                        message: `Instagram account with username ${instagram.username} not Connected please reconnect it`
                    }
                InstagramAPI.getTaggedStories(instagram, instagram.user).then((result) => {
                    //send notification email for the user that saving done
                    //send email
                    const html = `
                        <div style="background-color: #f5f5f5; padding: 20px;">
                            <div style="background-color: #ffffff; padding: 20px; border-radius: 10px;">
                                <h1 style="text-align: center; color: #d62976;">Wild Social</h1>
                                <h2 style="text-align: center; color: #d62976;">Saving done</h2>
                                <p style="text-align: center;">Your stories are saved successfully</p>
                                <p style="text-align: center;">We saved ${result.total_saved_stories} stories</p>
                            </div>
                            </div>Best regards,<br>Wild Social Team</div>
                        </div>
                        `;
                    Mail.Send(Mail.MailType.NEW_MESSAGE, instagram.user.email, html, 'Saving done').then((result) => {
                        //console.log(result);
                    }).catch((err) => {
                        //console.log(err);
                    });
                }).catch((err) => {
                    //console.log(err);
                });
                return {
                    success: true,
                    message: "Saving started \nYou will receive an email when saving is done"
                };
            } catch (error: any) {
                //console.log(error);
                return false;
            }
        },
        savePostsAndReels: async (parent: any, args: any, { prisma, auth, req, res }: CustomType.Context, info: GraphQLResolveInfo) => {
            let _Error = await Excuter([Middlewares.DeletedFilterParseJson, Middlewares.Authenticate], parent, args, { prisma, auth, req, res }, info, 'savePostsAndReels');
            if (_Error)
                return _Error;
            try {
                const { instagram_id } = args.json_input;
                const instagram = await prisma.instagram.findUnique({
                    where: {
                        id: instagram_id
                    },
                    include: {
                        user: true
                    }
                });
                if (instagram == null)
                    return {
                        success: false,
                        message: "No instagram account found"
                    };
                //check if user is the owner of the instagram account
                if (instagram.userId != auth.id)
                    return GQLErrors.UNAUTHORIZED;
                if (!instagram.connected)
                    return {
                        success: false,
                        message: `Instagram account with username ${instagram.username} not Connected please reconnect it`
                    }
                // const up = await prisma.instagram.update({
                //     where: {
                //         id: instagram.id
                //     },
                //     data: {
                //         cookie: 'mid=Y_h6JAALAAGQuEkuRQcEq1Yi-opa; ig_did=90E3D59D-3AEE-458F-88FB-1D02B007B29C; datr=eHr4YwrqZYIBzH-WtO2eZt7x; fbm_124024574287414=base_domain=.instagram.com; dpr=1.100000023841858; shbid="883\\05458459683304\\0541715696634:01f7652995f01545825606a23802908dbd6b34b017a621758bcc845dd45ca83cb60d5596"; shbts="1684160634\\05458459683304\\0541715696634:01f76eca496b90d578df664d9b64f2a2201d52129c20eef865acf5902baddf87f0fbdafe"; ds_user_id=58353110944; csrftoken=zmTTm8NXPJTHLziQNYxYOktBN4sFhAvV; sessionid=58353110944%3Ar5CcJlMp9CVnun%3A26%3AAYc3zH64FN4222pggCcJsYIinKPFINJvhpuYI48RXQ; fbsr_124024574287414=PZ38Y_VRqsSBDWDZIe1bofrpb5whQ1n_O1eCzNvmXes.eyJ1c2VyX2lkIjoiMTAwMDc3NTgyMDc3OTg3IiwiY29kZSI6IkFRRFcxeGFtY3QwUHdUUWRCWmF2eEtVWWRscTByV1FnX29scFFwNVBsSURYVUdscFJzeEhsWWNCLURmSWk3VTJTVVRXN3I3TXNpZFBtdFJ2Q0VDcHBfdm9jTW84MVd6dTlONjZGbG1PcnJQaG1sdjRFcmNLWkNSaTdPeGpocWFwN3ZaYm42aGZ3N1pIT0phVkVKVW5yWWRXeEQwb1BjUDlmdGx5XzliM1FvYVBtVUpKVXRyUFE0TXVPbUx1d1d6LXhjUXJVY3F0V3JMZl9RbFBqTmNfdEhGTy1oemh3NVBRcThRejN1ZTRDSkoxd1V1UmxFc3ZJTlpJd0ZLNG5tc1RFMUFQUWRPU0Q3bjVTSGlYZFBkZkQzcHgtWUFMZDU2SjJRaVFDVmE5VS1ZNGM5U195eTE5R3kwT0JpdjVOdUplS0RlMnVPbXByLXl6bU94UldKVHl4Z0lDIiwib2F1dGhfdG9rZW4iOiJFQUFCd3pMaXhuallCQUREeEZ4R0lFTGNCd3RIYkJrR3RrRFQxMVBKd1NjM0hNdzllODhBdDRzbmE4T1BueTQ5N255cEV1cG1TSFpBdTZwaXZuU2RaQ3NVN3ZWN1FQZFpCNzVuU3I1SHo5VFFXclBOMVhiYjRaQzFaQzNSVE9Sc242bElva1J0SlpCSkEydmFhc1V1WkFRVVhIa3ZMalJaQWZJMFdaQlNwdGFENjM4WkNKT2FKQjJNNlpCciIsImFsZ29yaXRobSI6IkhNQUMtU0hBMjU2IiwiaXNzdWVkX2F0IjoxNjg0MTg0Mzc0fQ; fbsr_124024574287414=PZ38Y_VRqsSBDWDZIe1bofrpb5whQ1n_O1eCzNvmXes.eyJ1c2VyX2lkIjoiMTAwMDc3NTgyMDc3OTg3IiwiY29kZSI6IkFRRFcxeGFtY3QwUHdUUWRCWmF2eEtVWWRscTByV1FnX29scFFwNVBsSURYVUdscFJzeEhsWWNCLURmSWk3VTJTVVRXN3I3TXNpZFBtdFJ2Q0VDcHBfdm9jTW84MVd6dTlONjZGbG1PcnJQaG1sdjRFcmNLWkNSaTdPeGpocWFwN3ZaYm42aGZ3N1pIT0phVkVKVW5yWWRXeEQwb1BjUDlmdGx5XzliM1FvYVBtVUpKVXRyUFE0TXVPbUx1d1d6LXhjUXJVY3F0V3JMZl9RbFBqTmNfdEhGTy1oemh3NVBRcThRejN1ZTRDSkoxd1V1UmxFc3ZJTlpJd0ZLNG5tc1RFMUFQUWRPU0Q3bjVTSGlYZFBkZkQzcHgtWUFMZDU2SjJRaVFDVmE5VS1ZNGM5U195eTE5R3kwT0JpdjVOdUplS0RlMnVPbXByLXl6bU94UldKVHl4Z0lDIiwib2F1dGhfdG9rZW4iOiJFQUFCd3pMaXhuallCQUREeEZ4R0lFTGNCd3RIYkJrR3RrRFQxMVBKd1NjM0hNdzllODhBdDRzbmE4T1BueTQ5N255cEV1cG1TSFpBdTZwaXZuU2RaQ3NVN3ZWN1FQZFpCNzVuU3I1SHo5VFFXclBOMVhiYjRaQzFaQzNSVE9Sc242bElva1J0SlpCSkEydmFhc1V1WkFRVVhIa3ZMalJaQWZJMFdaQlNwdGFENjM4WkNKT2FKQjJNNlpCciIsImFsZ29yaXRobSI6IkhNQUMtU0hBMjU2IiwiaXNzdWVkX2F0IjoxNjg0MTg0Mzc0fQ; rur="CLN\\05458353110944\\0541715720397:01f78379665af8f3ed665bc9dc1a6dc9648ebc2dfd022d12e2e2a9a1ee1a11c48a8ca2bf"'
                //     }
                // });
                // //console.log(up);
                // return {
                //     success: true,
                //     message: "Saving started \nYou will receive an email when saving is done"
                // };
                InstagramAPI.getTaggedPostsAndReels(instagram, instagram.user).then((result) => {
                    //send notification email for the user that saving done
                    //send email
                    const html = `
                        <div style="background-color: #f5f5f5; padding: 20px;">
                            <div style="background-color: #ffffff; padding: 20px; border-radius: 10px;">
                                <h1 style="text-align: center; color: #d62976;">Wild Social</h1>
                                <h2 style="text-align: center; color: #d62976;">Saving done</h2>
                                <p style="text-align: center;">Your posts and reels are saved successfully</p>
                                <p style="text-align: center;">We saved ${result.total_saved_posts} posts and ${result.total_saved_reels} reels</p>
                            </div>
                            </div>Best regards,<br>Wild Social Team</div>
                        </div>
                        `;
                    Mail.Send(Mail.MailType.NEW_MESSAGE, instagram.user.email, html, 'Saving done').then((result) => {
                        //console.log(result);
                    }).catch((err) => {
                        //console.log(err);
                    });
                }).catch((err) => {
                    //console.log(err);
                });
                return {
                    success: true,
                    message: "Saving started \nYou will receive an email when saving is done"
                };
            } catch (error: any) {
                //console.log(error);
                return false;
            }
        }
    },
    JSON: GraphQLJSON,
};

export default resolvers;