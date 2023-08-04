import gql from 'graphql-tag';

const typeDefs = `#graphql
  # Comments in GraphQL strings (such as this one) start with the hash (#) symbol.
  
  
  # This "User" type defines the queryable fields for every user in our data source.
  type User {
   id: ID!
    email: String!
    password: String!
    name: String!
    lastname: String!
    picture: String!
    permissions: [String]!     
  }

  type Cookie {
    data: String!
  }

  type MiniInstagram {
    id: ID!
    pk: String!
    username: String!
    connected: Boolean!
    full_name: String!
    profile_pic_url: String!
  }

  type MiniTikTok{
    id: ID!
    uniqueId: String!
    nickname: String!
    connected: Boolean!
    profilePic: String!
  }
  type FilterInstagram {
    id: ID!
    full_name: String!
    username: String!
    profile_pic_url: String!
    followers: Int!
    following: Int!
    posts_count: Int!
    reels_count: Int!
    stories_count: Int!
    posts: [FilterPost!]!
    reels: [FilterReel!]!
    stories: [FilterStory!]!
  }
  type Instagram {
    id: ID!
    full_name: String!
    username: String!
    profile_pic_url: String!
    followers: Int!
    following: Int!
    posts_count: Int!
    reels_count: Int!
    stories_count: Int!
    connected: Boolean!
    story_enabled: Boolean!
    post_enabled: Boolean!
    reel_enabled: Boolean!
    posts: [Post!]!
    reels: [Reel!]!
    stories: [Story!]!
    members: [Owner!]!
  } 
  type FilterTikTok{
    id: ID!
    uniqueId: String!
    nickname: String!
    bio: String!
    profilePic: String!
    followerCount: Int!
    followingCount: Int!
    heartCount: Int!
    videoCount: Int!
    videos: [FilterVideo!]!
  }
  type TikTok {
    id: ID!
    t_id: String!
    uniqueId: String!
    connected: Boolean!
    followerCount: Int!
    followingCount: Int!
    heartCount: Int!
    videoCount: Int!
    profilePic: String!
    nickname: String!
    bio: String!
    videos: [Video!]!
  }
  type FilterVideo {
    id: ID!
    t_id: String!
    width: Int!
    height: Int!
    duration: Float!
    caption: String!
    timestamp: Int!
    usage_right: String!
    display_url: String!
    url: String!
    owner: VideoOwner
  }
  type Video {
    id: ID!
    t_id: String!
    link: String!
    width: Int!
    height: Int!
    duration: Float!
    caption: String!
    timestamp: Int!
    usage_right: String!
    display_url: String!
    url: String!
    owner: VideoOwner!
  }

  type VideoOwner {
    id: ID!
    uniqueId:String!             
    followerCount:Int!
    followingCount:Int!
    heartCount:Int!
    videoCount:Int!
    profileUrl:String!
    nickname:String!             
    bio:String!
  }
  type MiniCollection {
    id: ID!
    name: String!
  }
  type Collection {
    id: ID!
    name: String!
    posts: [Post!]!
    reels: [Reel!]!
    stories: [Story!]!
    videos: [Video!]!
  }
  
  # The "LogIn" type is special: it gives the user the access token and refresh token
  # and the user's information
  type Me {
    id: String!
    email: String!
    name: String!
    picture: String!
    permissions: [String!]!
    is_varified: Boolean!
    pricing_id: String!
    pricing_plan: String!
    has_instagram: Boolean!
    has_tiktok: Boolean!
    instagrams: [MiniInstagram!]! 
    tiktoks: [MiniTikTok!]!
    collections: [MiniCollection!]!
  }
  
  type Response{
    success: Boolean!
    message: String!
    data: JSON
  }
  
  type LoginResponse{
    success: Boolean!
    message: String!
    me: Me
  }

  type Refresh{
    access_token: String!
    refresh_token: String!
  }

  type InstaConnectResponse {
    success: Boolean!
    message: String!
  }
  type Test{
    id: String!
    name: String!
  }
  type CheckoutResponse{
    success: Boolean!
    message: String!
    url: String
  }
  type FilterOwner {
    id: ID!
    username: String!
    full_name: String!
    profile_pic_url: String!
    followers: Int!
    verified: Boolean!
  }
  type Owner {
    id: ID!
    username: String!
    full_name: String!
    profile_pic_url: String!
    followers: Int!
    verified: Boolean!
  }
  type Content {
    id: ID!
    url: String!
    width: Int!
    height: Int!
    has_audio: Boolean!
    duration: Float
    display_url: String!
    taken_at: Float!
    is_video: Boolean!
  }
  type FilterPost { 
    id: ID!
    caption: String
    mentions: [String!]!
    owner_username: String!
    owner_full_name: String!
    owner_profile_pic_url: String!
    owner_followers: Int!
    owner_verified: Boolean!
    usage_right: String!
    ig_contents: [Content!]!
  }
  type Post {
    id: ID!
    caption: String
    mentions: [String!]!
    link: String!
    owner_username: String!
    owner_full_name: String!
    owner_profile_pic_url: String!
    owner_followers: Int!
    owner_verified: Boolean!
    usage_right: String!
    ig_contents: [Content!]!
  }
  type FilterReel {
    id: ID!
    caption: String
    mentions: [String!]!
    usage_right: String!
    owner_username: String!
    owner_full_name: String!
    owner_profile_pic_url: String!
    owner_followers: Int!
    owner_verified: Boolean!
    ig_content: Content
  }
  type Reel {
    id: ID!
    caption: String
    mentions: [String!]!
    link: String!
    usage_right: String!
    owner_username: String!
    owner_full_name: String!
    owner_profile_pic_url: String!
    owner_followers: Int!
    owner_verified: Boolean!
    ig_content: Content!
  }
  type FilterStory {
    id: ID!
    mentions: [String!]!
    usage_right: String!
    owner_username: String!
    owner_full_name: String!
    owner_profile_pic_url: String!
    owner_followers: Int!
    owner_verified: Boolean!
    ig_contents: [Content!]!
  }
  type Story {
    id: ID!
    mentions: [String!]!
    usage_right: String!
    owner_username: String!
    owner_full_name: String!
    owner_profile_pic_url: String!
    owner_followers: Int!
    owner_verified: Boolean!
    ig_contents: [Content!]!
  }
  type userInstagramsResponse{
    success: Boolean!
    message: String!
    instagrams: [MiniInstagram!]!
  }
  type userTikToksResponse{
    success: Boolean!
    message: String!
    tiktoks: [MiniTikTok!]!
  }
  type connectToInstagramResponse{
    success: Boolean!
    message: String!
    instagram: MiniInstagram
  }
  type connectToTikTokResponse{
    success: Boolean!
    message: String!
    tiktok: MiniTikTok
  }
  type saveTikTokVideoWithUrlResponse{
    success: Boolean!
    message: String!
    url: String!
    thumbnail: String!
  }
  type DownloadContent{
    url: String!
    display_url: String!
    is_video: Boolean!
  }

  type saveInstagramContentWithUrlResponse{
    success: Boolean!
    message: String!
    contents: [DownloadContent!]!
  }
  type FilterContentResponse{
    success: Boolean!
    message: String!
    id: ID!
    instagrams: [FilterInstagram!]!
    tiktoks: [FilterTikTok!]!
  }
  type Hollo{
    name: String!
    message: String!
  }
  type HelloResponse{
    success: Boolean!
    message: String!
    data: Hollo!
  }
  # The "Query" type is special: it lists all of the available queries that
  # clients can execute along with the return type for each. In this
  # case the "users" query returns an array of zero or more Users (defined above).
  type Query {
    hello(json_input: String!): HelloResponse!
    me: Me!,
    userInstagrams(json_input: String!): userInstagramsResponse!
    userTikToks(json_input: String!): userTikToksResponse!
    getInstagramAccount(json_input: String!): Instagram
    getTikTokAccount(json_input: String!): TikTok
    saveTikTokVideoWithUrl(json_input: String!):saveTikTokVideoWithUrlResponse!
    saveInstagramContentWithUrl(json_input: String!):saveInstagramContentWithUrlResponse!
    getCollection(json_input: String!): Collection
    filterContents(json_input: String!): FilterContentResponse!
    testquery:Test!
    refreshInsta: Boolean! 
  }

  type Mutation {
    # A mutation to add a new user to the list of users 
    # This mutation takes an argument is access_token from google api
    # and returns the user's information
    # and the access token and refresh token
    # and the user's information
    # update user if exists before 
    signWithGoogle(json_input: String!):LoginResponse!
    signUpWithEmail(json_input: String!):Response!
    logInWithEmail(json_input: String!):LoginResponse
    logout:Response!
    refreshToken(json_input: String!):Refresh
    forgotPassword(json_input: String!):Boolean!
    resetPassword(json_input: String!):Boolean!
    changePassword(json_input: String!):Boolean!
    sendVarifyEmail(json_input: String!):Boolean!
    varifyEmail(json_input: String!):LoginResponse
    connectToInstagram(json_input: String!):InstaConnectResponse!
    connectToInstagramWithCookies(json_input: String!):connectToInstagramResponse!
    connectToTikTokWithCookies(json_input: String!):connectToTikTokResponse!
    connectToTiktok(json_input: String!):Boolean!
    disconnectFromTiktok(json_input: String!):Boolean!
    createCheckoutSession(json_input: String!):CheckoutResponse!
    createPortalSession(json_input: String!):CheckoutResponse!
    saveStories(json_input: String!):Response!
    savePostsAndReels(json_input: String!):Response!
    createCollection(json_input: String!):Response!
    renameCollection(json_input: String!):Response!
    deleteCollection(json_input: String!):Response!
    addPostToCollection(json_input: String!):Response!
    removePostFromCollection(json_input: String!):Response!
    addReelToCollection(json_input: String!):Response!
    removeReelFromCollection(json_input: String!):Response!
    addStoryToCollection(json_input: String!):Response!
    removeStoryFromCollection(json_input: String!):Response!
    addVideoToCollection(json_input: String!):Response!
    removeVideoFromCollection(json_input: String!):Response!
    deleteContents(json_input: String!):Response!
  }
  scalar JSON
`

export default typeDefs;