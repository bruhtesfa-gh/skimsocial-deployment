//#region Import
import { GraphQLResolveInfo } from "graphql/type";
import CustomType from "../custom-type/custom-type";
import { GraphQLError } from "graphql";
import Ajv from 'ajv';
//#endregion

//#region NessesaryObjects
const resplverPermition: any = {
    'user-products': ['block-user'],
    'users': ['block-user'],
    'userbyid': ['block-user']
}

const resolverInputRules: any = {
    createUser: {
        type: "object",
        properties: {
            name: { type: 'string', },
            email: { type: 'string', "pattern": "^\\S+@\\S+\\.\\S+$" },
            carrier: { type: 'string' },
            role: { type: 'string' },
            password: { type: 'string' },
            is_system_user: { type: 'boolean' },
            is_on_bus: { type: 'boolean' },
            bus_id: { type: 'string' },
            company_id: { type: 'string' },
        },
        additionalProperties: false,
        required: ["name", "carrier", "role", 'email', 'password', 'is_on_bus'],
    },
    editUser: {
        type: "object",
        properties: {
            name: { type: 'string' },
            email: { type: 'string', "pattern": "^\\S+@\\S+\\.\\S+$" },
            bus_id: { type: 'string' },
        },
        additionalProperties: false,
    },
    blockUser: {
        type: "object",
        properties: {
            blocked: { type: 'boolean' },
        },
        additionalProperties: false,
        required: ["blocked"],
    },
    editUserPermission: {
        type: "object",
        properties: {
            permissions: {
                type: 'array',
                items: {
                    type: 'string'
                }
            },
        },
        additionalProperties: false,
        required: ["permissions"],
    },
    createRole: {
        type: "object",
        properties: {
            name: { type: 'string' },
            permissions: {
                type: 'array',
                items: {
                    type: 'string'
                }
            }
        },
        additionalProperties: false,
        required: ["name", "permissions"]
    },
    editRole: {
        type: "object",
        properties: {
            permissions: {
                type: 'array',
                items: {
                    type: 'string'
                }
            }
        },
        additionalProperties: false,
        required: ["permissions"]
    },
    createRoute: {
        type: 'array',
        items: {
            type: 'object',
            properties: {
                from: { type: 'string' },
                to: { type: 'string' }
            },
        },
    },
    createBus: {
        type: "object",
        properties: {
            seat_type: { type: 'string' },
            total_seats: { type: 'number' },
            side_num: { type: 'number' },
            vin: { type: 'string' },
        },
        additionalProperties: false,
        required: ['seat_type', 'total_seats', 'side_num', 'vin']
    },
    createTrip: {
        type: "array",
        items: {
            type: "object",
            properties: {
                route_id: { type: 'string' },
                date: { type: 'string', "pattern": "^[0-9]{4}-([0][0-9]|[1][0-2])-([0-2][0-9]|[3][0-1])$" },
                price: { type: 'number' },
                starting_time: { type: 'string', "pattern": "^([0][0-9]|[1][0-2]):[0-5][0-9] (AM|PM)$" },
                end_time: { type: 'string', "pattern": "^([0][0-9]|[1][0-2]):[0-5][0-9] (AM|PM)$" },
                bus_id: { type: 'string' }
            },
            additionalProperties: false,
            required: ["route_id", "date", "price", "starting_time", "end_time", "bus_id"]
        }
    },
    reserveTrip: {
        type: 'object',
        properties: {
            seats: { type: 'array', items: { type: 'number' } },
            passenger_info: {
                type: 'object',
                properties: {
                    things: { type: 'number' },
                    passengers: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                name: { type: 'string' },
                                phone: { type: 'string', "pattern": "^(\\+251|\\(251\\)|0)(9|7)[0-9]{8}$" }
                            },
                            additionalProperties: false,
                            required: ['name', 'phone']
                        }
                    },
                },
                additionalProperties: false,
                required: ['things', 'passengers']
            },
            adult: { type: 'number' },
            child: { type: 'number' },
        },
        additionalProperties: false,
        required: ['seats', 'passenger_info', 'adult', 'child']
    },
    login: {
        type: "object",
        properties: {
            username: { type: 'string', "pattern": "^\\S+@\\S+\\.\\S+$" },
            password: { type: 'string' },
        },
        additionalProperties: false,
        required: ["username", "password"]
    },
    signUpWithGoogle: {
        type: "object",
        properties: {
            access_token: { type: 'string' },
        },
        additionalProperties: false,
        required: ["access_token"]
    },
    signUpWithEmail: {
        type: "object",
        properties: {
            name: { type: 'string' },
            lastname: { type: 'string' },
            email: { type: 'string', "pattern": "^\\S+@\\S+\\.\\S+$" },
            password: { type: 'string' },
        },
        additionalProperties: false,
        required: ["name", "lastname", "email", "password"]
    },
    refreshToken: {
        type: "object",
        properties: {
            refresh_token: { type: 'string' },
        },
        additionalProperties: false,
        required: ["refresh_token"]
    },
    connectToInstagram: {
        type: "object",
        properties: {
            username: { type: 'string' },
            password: { type: 'string' },
        },
        additionalProperties: false,
        required: ["username", "password"]
    },
    connectToInstagramWithCookies: {
        type: "object",
        properties: {
            cookies: {
                type: 'array',
                items: {
                    type: 'string',
                }
            },
            userID: { type: 'string' },
            username: { type: 'string' },
            width: { type: 'number' },
            height: { type: 'number' },
        },
        additionalProperties: false,
        required: ["cookies", "userID", "width", "height", "username"]
    },
    userInstagrams: {
        type: "object",
        properties: {
            userID: { type: 'string' },
        },
        additionalProperties: false,
        required: ["userID"]
    },
    userTikToks: {
        type: "object",
        properties: {
            userID: { type: 'string' },
        },
        additionalProperties: false,
        required: ["userID"]
    },
    getInstagramAccount: {
        type: "object",
        properties: {
            instagram_id: { type: 'string' },
        },
        additionalProperties: false,
        required: ["instagram_id"]
    },
    getTikTokAccount: {
        type: "object",
        properties: {
            tik_tok_id: { type: 'string' },
        },
        additionalProperties: false,
        required: ["tik_tok_id"]
    },
    toggleStorySaving: {
        type: "object",
        properties: {
            instagram_id: { type: 'string' },
            enabled: { type: 'boolean' },
        },
        additionalProperties: false,
        required: ["instagram_id", "enabled"]
    },
    togglePostSaving: {
        type: "object",
        properties: {
            instagram_id: { type: 'string' },
            enabled: { type: 'boolean' },
        },
        additionalProperties: false,
        required: ["instagram_id", "enabled"]
    },
    toggleReelSaving: {
        type: "object",
        properties: {
            instagram_id: { type: 'string' },
            enabled: { type: 'boolean' },
        },
        additionalProperties: false,
        required: ["instagram_id", "enabled"]
    },
    activateInActivateInstagramAccount: {
        type: "object",
        properties: {
            instagram_id: { type: 'string' },
            enabled: { type: 'boolean' },
        },
        additionalProperties: false,
        required: ["instagram_id", "enabled"]
    },
    saveStories: {
        type: "object",
        properties: {
            instagram_id: { type: 'string' },
        },
        additionalProperties: false,
        required: ["instagram_id"]
    },
    savePostsAndReels: {
        type: "object",
        properties: {
            instagram_id: { type: 'string' },
        },
        additionalProperties: false,
        required: ["instagram_id"]
    },
    connectToTikTokWithCookies: {
        type: "object",
        properties: {
            cookies: {
                type: 'array',
                items: {
                    type: 'string',
                }
            },
            userID: { type: 'string' },
            url_param: { type: 'string' },
            device_id: { type: 'string' },
        },
        additionalProperties: false,
        required: ["cookies", "userID", 'url_param', 'device_id']
    },
    disconnectFromInstagram: {
        type: "object",
        properties: {
            id: { type: 'string' },
        },
        additionalProperties: false,
        required: ["id"]
    },
    connectToTiktok: {
        type: "object",
        properties: {
            phone: { type: 'string', "pattern": "(^(\\+251|\\(251\\)|0)(9|7)[0-9]{8}$)|(^(\\+251|\\(251\\)|0)(9|7)[0-9]{8}$)" },
        },
        additionalProperties: false,
        required: ["phone"]
    },
    disconnectFromTiktok: {
        type: "object",
        properties: {
            id: { type: 'string' },
        },
        additionalProperties: false,
        required: ["id"]
    },
    saveTikTokVideoWithUrl: {
        type: "object",
        properties: {
            // url is like this: https://www.tiktok.com/@username/video/1234567891234567891
            url: { type: 'string', "pattern": "^https://www.tiktok.com/@\\S+/video/\\d+$" },
            tiktok_id: { type: 'string' },
        },
        additionalProperties: false,
        required: ["url", "tiktok_id"]
    },
    saveInstagramContentWithUrl: {
        type: "object",
        properties: {
            // url is like this: https://www.instagram.com/p/1234567891234567891
            url: { type: 'string', "pattern": "^https://www\\.instagram\\.com/(stories/[^/]+/\\d+/?|p/[^/]+/)$" },
            instagram_id: { type: 'string' },
        },
        additionalProperties: false,
        required: ["url", "instagram_id"]
    },
    getCollection: {
        type: "object",
        properties: {
            id: { type: 'string' },
        },
        additionalProperties: false,
        required: ["id"]
    },
    createCollection: {
        type: "object",
        properties: {
            name: { type: 'string' },
        },
        additionalProperties: false,
        required: ["name"]
    },
    renameCollection: {
        type: "object",
        properties: {
            id: { type: 'string' },
            name: { type: 'string' },
        },
        additionalProperties: false,
        required: ["id", "name"]
    },
    deleteCollection: {
        type: "object",
        properties: {
            id: { type: 'string' },
        },
        additionalProperties: false,
        required: ["id"]
    },
    addPostToCollection: {
        type: "object",
        properties: {
            collectionId: { type: 'string' },
            postId: { type: 'string' },
        },
        additionalProperties: false,
        required: ["collectionId", "postId"]
    },
    removePostFromCollection: {
        type: "object",
        properties: {
            collectionId: { type: 'string' },
            postId: { type: 'string' },
        },
        additionalProperties: false,
        required: ["collectionId", "postId"]
    },
    addReelToCollection: {
        type: "object",
        properties: {
            collectionId: { type: 'string' },
            reelId: { type: 'string' },
        },
        additionalProperties: false,
        required: ["collectionId", "reelId"]
    },
    removeReelFromCollection: {
        type: "object",
        properties: {
            collectionId: { type: 'string' },
            reelId: { type: 'string' },
        },
        additionalProperties: false,
        required: ["collectionId", "reelId"]
    },
    addStoryToCollection: {
        type: "object",
        properties: {
            collectionId: { type: 'string' },
            storyId: { type: 'string' },
        },
        additionalProperties: false,
        required: ["collectionId", "storyId"]
    },
    removeStoryFromCollection: {
        type: "object",
        properties: {
            collectionId: { type: 'string' },
            storyId: { type: 'string' },
        },
        additionalProperties: false,
        required: ["collectionId", "storyId"]
    },
    addVideoToCollection: {
        type: "object",
        properties: {
            collectionId: { type: 'string' },
            videoId: { type: 'string' },
        },
        additionalProperties: false,
        required: ["collectionId", "videoId"]
    },
    removeVideoFromCollection: {
        type: "object",
        properties: {
            collectionId: { type: 'string' },
            videoId: { type: 'string' },
        },
        additionalProperties: false,
        required: ["collectionId", "videoId"]
    },
    filterContents: {
        type: "object",
        properties: {
            usernames: { type: 'array', items: { type: 'string' } },
            unique_ids: { type: 'array', items: { type: 'string' } },
            type: { type: 'array', items: { type: 'string' } },
            start_time: { type: 'number' },
            end_time: { type: 'number' },
            hashtags: { type: 'array', items: { type: 'string' } },
            content_type: { type: 'number', enum: [0, 1, 2] },
            usage_right: { type: 'array', items: { type: 'string', enum: ['PENDING', 'APPROVED', 'REJECTED', 'DEFAULT'] } },
            followers: { type: 'number' },
            verified: { type: 'number', enum: [0, 1, 2] },
            collection_include: { type: 'array', items: { type: 'string' } },
            collection_exclude: { type: 'array', items: { type: 'string' } },
            likes: { type: 'number' },
            comments: { type: 'number' },
            shares: { type: 'number' },
            views: { type: 'number' },
            limit: { type: 'number' },
            offset: { type: 'number' },
        },
        additionalProperties: false,
        required: ["usernames", "unique_ids", "type", "start_time", "end_time", "hashtags", "content_type", "usage_right", "followers", "verified", "collection_include", "collection_exclude"]
    },
    deleteContents: {
        type: "object",
        properties: {
            posts: { type: 'array', items: { type: 'string' } },
            stories: { type: 'array', items: { type: 'string' } },
            reels: { type: 'array', items: { type: 'string' } },
            videos: { type: 'array', items: { type: 'string' } },
        },
        additionalProperties: false,
        required: ["posts", "stories", "reels", "videos"]
    },
    createCheckoutSession: {
        type: "object",
        properties: {
            lookup_key: { type: 'string' },
        },
        additionalProperties: false,
        required: ["lookup_key"]
    },
    createPortalSession: {
        type: "object",
        properties: {
            session_id: { type: 'string' },
        },
        additionalProperties: false,
        required: ["session_id"]
    },
    sendVarifyEmail: {
        type: "object",
        properties: {
            id: { type: 'string' },
        },
        additionalProperties: false,
        required: ["id"]
    },
    varifyEmail: {
        type: "object",
        properties: {
            token: { type: 'string' },
        },
        additionalProperties: false,
        required: ["token"]
    },
    logInWithEmail: {
        type: "object",
        properties: {
            email: { type: 'string', "pattern": "^\\S+@\\S+\\.\\S+$" },
            password: { type: 'string' },
        },
        additionalProperties: false,
        required: ["email", "password"]
    },
    resetPassword: {
        type: "object",
        properties: {
            token: { type: 'string' },
            password: { type: 'string' },
        },
        additionalProperties: false,
        required: ["token", "password"]
    },
    changePassword: {
        type: "object",
        properties: {
            old_password: { type: 'string' },
            new_password: { type: 'string' },
        },
        additionalProperties: false,
        required: ["old_password", "new_password"]
    },

}
//#endregion

//#region GraphQL Errors
export const GQLErrors = {
    BAD_USER_INPUT: new GraphQLError('Bad User Input', {
        extensions: {
            code: '400',
            exception: {
                code: 'Bad User Input'
            }
        },
    }),
    INVALID_EMAIL: new GraphQLError('Invalid Email', {
        extensions: {
            code: '400',
            exception: {
                code: 'Invalid Email'
            }
        },
    }),
    EMAIL_NOT_VERIFIED: new GraphQLError('Email not verified', {
        extensions: {
            code: '400',
            exception: {
                code: 'Email not verified'
            }
        },
    }),
    EMAIL_ALREADY_VERIFIED: new GraphQLError('Email already verified', {
        extensions: {
            code: '400',
            exception: {
                code: 'Email already verified'
            }
        },
    }),
    INSTAGRAM_ACCOUNT_NOT_FOUND: new GraphQLError('Instagram account not found', {
        extensions: {
            code: '200',
            exception: {
                code: 'Instagram account not found'
            }
        },
    }),
    TIKTOK_ACCOUNT_NOT_FOUND: new GraphQLError('Tiktok account not found', {
        extensions: {
            code: '200',
            exception: {
                code: 'Tiktok account not found'
            }
        },
    }),
    USER_ALREADY_EXISTS: new GraphQLError('User already exists', {
        extensions: {
            code: '400',
            exception: {
                code: 'User already exists'
            }
        },
    }),
    TOKEN_EXPIRED: new GraphQLError('Token expired', {
        extensions: {
            code: '401',
            exception: {
                code: 'Token expired'
            }
        },
    }),
    FORBIDDEN: new GraphQLError('access token expierd', {
        extensions: {
            status: 403,
            code: 'FORBIDDEN',
            data: 'refresh access token'
        },
    }),
    INVALID_TOKEN: new GraphQLError('Invalid token', {
        extensions: {
            status: 401,
            code: '401',
            data: 'Invalid token'
        },
    }),
    SERVER_ERROR: new GraphQLError('Internal Server Error', {
        extensions: {
            code: '500',
            exception: {
                code: 'Internal Server Error'
            }
        },
    }),
    UNAUTHENTICATED: new GraphQLError('Un authenticated request', {
        extensions: {
            status: 401,
            code: '401',
            data: 'login to access this resource'
        },
    }),
    UNAUTHORIZED: new GraphQLError('Un autorized request', {
        extensions: {
            status: 403,
            code: '403',
            data: 'you are not authorized to access this resource'
        },
    }),
    FILE_NOT_FOUND: new GraphQLError('File not found', {
        extensions: {
            status: 404,
            code: '404',
            data: 'File not found'
        },
    }),
}
//#endregion

//#region Middlewares
const Authenticate = async (parent: any, args: any, context: CustomType.Context, info: GraphQLResolveInfo, resolvername = '') => {
    if (context.auth.forbidden) {
        return GQLErrors.FORBIDDEN;
    }
    if (!context.auth.isAuthenticated) {
        if (context.auth.hasToken) {
            return GQLErrors.UNAUTHENTICATED;
        }
        return GQLErrors.UNAUTHORIZED;
    }
    return null;
}

const HasPermission = async (parent: any, args: any, context: CustomType.Context, info: GraphQLResolveInfo, resolvername = '') => {

    if (!context.auth.permissions.includes(resolvername)) {
        return GQLErrors.UNAUTHORIZED;
    }
    return null;
}

const ValidateJsonInput = async (parent: any, args: any, context: CustomType.Context, info: GraphQLResolveInfo, resolvername = '') => {
    const ajv = new Ajv({ allErrors: true });
    const validate = ajv.compile(resolverInputRules[resolvername]);
    const valid = validate(args.json_input);
    if (!valid) {
        let errorMessage = ``;
        validate.errors?.forEach((error) => {
            errorMessage += error.message + '\n';
        });
        return new GraphQLError(errorMessage, {
            extensions: {
                code: '400',
                exception: {
                    code: 'Invalid Inpute Data'
                }
            },
        });
    }

    return null;
}

const DeletedFilterParseJson = async (parent: any, args: any, context: CustomType.Context, info: GraphQLResolveInfo, resolvername = '') => {
    let Error = null;
    let json_input = null;
    let filter = {};

    try {
        if (args.json_input) {
            json_input = JSON.parse(args.json_input)
        }
        if (args.filter) {
            filter = JSON.parse(args.filter)
        }
    } catch (error: any) {
        Error = GQLErrors.BAD_USER_INPUT;
    }
    ////console.log(json_input);
    if (Error)
        return Error;
    if (json_input)
        args.json_input = json_input;

    args.filter = filter;

    if (Object.keys(args.filter).findIndex(f => f == 'is_deleted') === -1) {
        args.filter.is_deleted = false;
    }
    return null;
}
//#endregion

//#region Middlewares Object for Export

const Middlewares = {
    Authenticate,
    HasPermission,
    ValidateJsonInput,
    DeletedFilterParseJson,
}
//#endregion
export default Middlewares;