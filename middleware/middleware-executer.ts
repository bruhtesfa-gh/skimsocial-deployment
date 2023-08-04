import CustomType from "../custom-type/custom-type";
import { GraphQLResolveInfo } from 'graphql/type'
import { GraphQLError } from "graphql";
const Excuter = async (middlewares: any[], root: any, args: any, context: CustomType.Context, info: GraphQLResolveInfo, resolvername = ''): Promise<GraphQLError | null> => {
    let error = null;
    for (let index = 0; index < middlewares.length; index++) {
        error = await middlewares[index](root, args, context, info, resolvername);
        if (error !== null)
            break;
    }
    return error;
}

export default Excuter;