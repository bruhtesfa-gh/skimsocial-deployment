import { PrismaClient, User } from "@prisma/client";
import express from "express";
export enum MediaType {
    IMAGE = "IMAGE",
    VIDEO = "VIDEO",
    CAROUSEL_ALBUM = "CAROUSEL_ALBUM",
}

declare namespace CustomType {
    interface Context {
        prisma: PrismaClient;
        auth: Authorization;
        req: express.Request;
        res: express.Response;
    }



    interface Authorization {
        isAuthenticated: boolean;
        hasToken: boolean;
        permissions: string[];
        id: string;
        access_token: string;
        forbidden: boolean;
    }

    interface CsrfTokenResponse {
        success: boolean;
        error: boolean;
        token: string;
        message: string;
    }

    interface InstagramLoginResponse {
        success: boolean;
        error: boolean;
        message: string;
        data: {
            cookies: [string];
            cookie: string;
            pk: string;
        };
    }

    // interface FileToBeUploaded {
    //     key: string;
    //     path: string;
    //     size: number;
    //     uploaded: boolean;
    //     file_not_found: boolean;
    // }

    interface FileToBeUploaded1 {
        [key: string]: {
            path: string;
            size: number;
            uploaded: boolean;
            file_not_found: boolean;
        };
    }

    interface MediaDetailInfo {
        caption: string;
        mentions: [string];
        type: MediaType;
        data: ImageContent | VideoContent | Content[];
    }

    interface ImageContent {
        media_id: string;
        url: string;
        width: number;
        height: number;
        display_url: string;
        taken_at: number;
    }

    interface VideoContent {
        media_id: string;
        url: string;
        width: number;
        height: number;
        has_audio: boolean;
        duration: number;
        display_url: string;
        taken_at: number;
    }

    interface Content {
        content: ImageContent | VideoContent;
    }

    interface TaggedPostsAndReels {
        total_saved_reels: number;
        total_saved_posts: number;
        reels_id: string[];
        posts_id: string[];
    }

    interface TaggedStories {
        total_saved_stories: number
        stories_id: string[]
    }

}
export default CustomType;