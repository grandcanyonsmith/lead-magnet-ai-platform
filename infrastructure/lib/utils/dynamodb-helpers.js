"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTable = createTable;
exports.createTableWithGSI = createTableWithGSI;
const cdk = __importStar(require("aws-cdk-lib"));
const dynamodb = __importStar(require("aws-cdk-lib/aws-dynamodb"));
/**
 * Creates a DynamoDB table with standard configuration
 */
function createTable(scope, id, config) {
    const table = new dynamodb.Table(scope, id, {
        tableName: config.tableName,
        partitionKey: config.partitionKey,
        sortKey: config.sortKey,
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
        pointInTimeRecovery: true,
        deletionProtection: true,
        removalPolicy: cdk.RemovalPolicy.RETAIN,
        encryption: dynamodb.TableEncryption.AWS_MANAGED,
        timeToLiveAttribute: config.timeToLiveAttribute,
    });
    return table;
}
/**
 * Creates a DynamoDB table with Global Secondary Indexes
 */
function createTableWithGSI(scope, id, config, gsis) {
    const table = createTable(scope, id, config);
    gsis.forEach((gsi) => {
        table.addGlobalSecondaryIndex({
            indexName: gsi.indexName,
            partitionKey: gsi.partitionKey,
            sortKey: gsi.sortKey,
            projectionType: gsi.projectionType || dynamodb.ProjectionType.ALL,
        });
    });
    return table;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZHluYW1vZGItaGVscGVycy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImR5bmFtb2RiLWhlbHBlcnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFRQSxrQ0FrQkM7QUFLRCxnREFrQkM7QUFqREQsaURBQW1DO0FBQ25DLG1FQUFxRDtBQUlyRDs7R0FFRztBQUNILFNBQWdCLFdBQVcsQ0FDekIsS0FBZ0IsRUFDaEIsRUFBVSxFQUNWLE1BQW1CO0lBRW5CLE1BQU0sS0FBSyxHQUFHLElBQUksUUFBUSxDQUFDLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFO1FBQzFDLFNBQVMsRUFBRSxNQUFNLENBQUMsU0FBUztRQUMzQixZQUFZLEVBQUUsTUFBTSxDQUFDLFlBQVk7UUFDakMsT0FBTyxFQUFFLE1BQU0sQ0FBQyxPQUFPO1FBQ3ZCLFdBQVcsRUFBRSxRQUFRLENBQUMsV0FBVyxDQUFDLGVBQWU7UUFDakQsbUJBQW1CLEVBQUUsSUFBSTtRQUN6QixrQkFBa0IsRUFBRSxJQUFJO1FBQ3hCLGFBQWEsRUFBRSxHQUFHLENBQUMsYUFBYSxDQUFDLE1BQU07UUFDdkMsVUFBVSxFQUFFLFFBQVEsQ0FBQyxlQUFlLENBQUMsV0FBVztRQUNoRCxtQkFBbUIsRUFBRSxNQUFNLENBQUMsbUJBQW1CO0tBQ2hELENBQUMsQ0FBQztJQUVILE9BQU8sS0FBSyxDQUFDO0FBQ2YsQ0FBQztBQUVEOztHQUVHO0FBQ0gsU0FBZ0Isa0JBQWtCLENBQ2hDLEtBQWdCLEVBQ2hCLEVBQVUsRUFDVixNQUFtQixFQUNuQixJQUFpQjtJQUVqQixNQUFNLEtBQUssR0FBRyxXQUFXLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxNQUFNLENBQUMsQ0FBQztJQUU3QyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsR0FBRyxFQUFFLEVBQUU7UUFDbkIsS0FBSyxDQUFDLHVCQUF1QixDQUFDO1lBQzVCLFNBQVMsRUFBRSxHQUFHLENBQUMsU0FBUztZQUN4QixZQUFZLEVBQUUsR0FBRyxDQUFDLFlBQVk7WUFDOUIsT0FBTyxFQUFFLEdBQUcsQ0FBQyxPQUFPO1lBQ3BCLGNBQWMsRUFBRSxHQUFHLENBQUMsY0FBYyxJQUFJLFFBQVEsQ0FBQyxjQUFjLENBQUMsR0FBRztTQUNsRSxDQUFDLENBQUM7SUFDTCxDQUFDLENBQUMsQ0FBQztJQUVILE9BQU8sS0FBSyxDQUFDO0FBQ2YsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBkeW5hbW9kYiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZHluYW1vZGInO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5pbXBvcnQgeyBUYWJsZUNvbmZpZywgR3NpQ29uZmlnIH0gZnJvbSAnLi4vdHlwZXMnO1xuXG4vKipcbiAqIENyZWF0ZXMgYSBEeW5hbW9EQiB0YWJsZSB3aXRoIHN0YW5kYXJkIGNvbmZpZ3VyYXRpb25cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVRhYmxlKFxuICBzY29wZTogQ29uc3RydWN0LFxuICBpZDogc3RyaW5nLFxuICBjb25maWc6IFRhYmxlQ29uZmlnXG4pOiBkeW5hbW9kYi5UYWJsZSB7XG4gIGNvbnN0IHRhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHNjb3BlLCBpZCwge1xuICAgIHRhYmxlTmFtZTogY29uZmlnLnRhYmxlTmFtZSxcbiAgICBwYXJ0aXRpb25LZXk6IGNvbmZpZy5wYXJ0aXRpb25LZXksXG4gICAgc29ydEtleTogY29uZmlnLnNvcnRLZXksXG4gICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcbiAgICBwb2ludEluVGltZVJlY292ZXJ5OiB0cnVlLFxuICAgIGRlbGV0aW9uUHJvdGVjdGlvbjogdHJ1ZSxcbiAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU4sXG4gICAgZW5jcnlwdGlvbjogZHluYW1vZGIuVGFibGVFbmNyeXB0aW9uLkFXU19NQU5BR0VELFxuICAgIHRpbWVUb0xpdmVBdHRyaWJ1dGU6IGNvbmZpZy50aW1lVG9MaXZlQXR0cmlidXRlLFxuICB9KTtcblxuICByZXR1cm4gdGFibGU7XG59XG5cbi8qKlxuICogQ3JlYXRlcyBhIER5bmFtb0RCIHRhYmxlIHdpdGggR2xvYmFsIFNlY29uZGFyeSBJbmRleGVzXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVUYWJsZVdpdGhHU0koXG4gIHNjb3BlOiBDb25zdHJ1Y3QsXG4gIGlkOiBzdHJpbmcsXG4gIGNvbmZpZzogVGFibGVDb25maWcsXG4gIGdzaXM6IEdzaUNvbmZpZ1tdXG4pOiBkeW5hbW9kYi5UYWJsZSB7XG4gIGNvbnN0IHRhYmxlID0gY3JlYXRlVGFibGUoc2NvcGUsIGlkLCBjb25maWcpO1xuXG4gIGdzaXMuZm9yRWFjaCgoZ3NpKSA9PiB7XG4gICAgdGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xuICAgICAgaW5kZXhOYW1lOiBnc2kuaW5kZXhOYW1lLFxuICAgICAgcGFydGl0aW9uS2V5OiBnc2kucGFydGl0aW9uS2V5LFxuICAgICAgc29ydEtleTogZ3NpLnNvcnRLZXksXG4gICAgICBwcm9qZWN0aW9uVHlwZTogZ3NpLnByb2plY3Rpb25UeXBlIHx8IGR5bmFtb2RiLlByb2plY3Rpb25UeXBlLkFMTCxcbiAgICB9KTtcbiAgfSk7XG5cbiAgcmV0dXJuIHRhYmxlO1xufVxuXG4iXX0=