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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZHluYW1vZGItaGVscGVycy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImR5bmFtb2RiLWhlbHBlcnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFRQSxrQ0FpQkM7QUFLRCxnREFrQkM7QUFoREQsaURBQW1DO0FBQ25DLG1FQUFxRDtBQUlyRDs7R0FFRztBQUNILFNBQWdCLFdBQVcsQ0FDekIsS0FBZ0IsRUFDaEIsRUFBVSxFQUNWLE1BQW1CO0lBRW5CLE1BQU0sS0FBSyxHQUFHLElBQUksUUFBUSxDQUFDLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFO1FBQzFDLFNBQVMsRUFBRSxNQUFNLENBQUMsU0FBUztRQUMzQixZQUFZLEVBQUUsTUFBTSxDQUFDLFlBQVk7UUFDakMsT0FBTyxFQUFFLE1BQU0sQ0FBQyxPQUFPO1FBQ3ZCLFdBQVcsRUFBRSxRQUFRLENBQUMsV0FBVyxDQUFDLGVBQWU7UUFDakQsbUJBQW1CLEVBQUUsSUFBSTtRQUN6QixhQUFhLEVBQUUsR0FBRyxDQUFDLGFBQWEsQ0FBQyxNQUFNO1FBQ3ZDLFVBQVUsRUFBRSxRQUFRLENBQUMsZUFBZSxDQUFDLFdBQVc7UUFDaEQsbUJBQW1CLEVBQUUsTUFBTSxDQUFDLG1CQUFtQjtLQUNoRCxDQUFDLENBQUM7SUFFSCxPQUFPLEtBQUssQ0FBQztBQUNmLENBQUM7QUFFRDs7R0FFRztBQUNILFNBQWdCLGtCQUFrQixDQUNoQyxLQUFnQixFQUNoQixFQUFVLEVBQ1YsTUFBbUIsRUFDbkIsSUFBaUI7SUFFakIsTUFBTSxLQUFLLEdBQUcsV0FBVyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsTUFBTSxDQUFDLENBQUM7SUFFN0MsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLEdBQUcsRUFBRSxFQUFFO1FBQ25CLEtBQUssQ0FBQyx1QkFBdUIsQ0FBQztZQUM1QixTQUFTLEVBQUUsR0FBRyxDQUFDLFNBQVM7WUFDeEIsWUFBWSxFQUFFLEdBQUcsQ0FBQyxZQUFZO1lBQzlCLE9BQU8sRUFBRSxHQUFHLENBQUMsT0FBTztZQUNwQixjQUFjLEVBQUUsR0FBRyxDQUFDLGNBQWMsSUFBSSxRQUFRLENBQUMsY0FBYyxDQUFDLEdBQUc7U0FDbEUsQ0FBQyxDQUFDO0lBQ0wsQ0FBQyxDQUFDLENBQUM7SUFFSCxPQUFPLEtBQUssQ0FBQztBQUNmLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgZHluYW1vZGIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWR5bmFtb2RiJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuaW1wb3J0IHsgVGFibGVDb25maWcsIEdzaUNvbmZpZyB9IGZyb20gJy4uL3R5cGVzJztcblxuLyoqXG4gKiBDcmVhdGVzIGEgRHluYW1vREIgdGFibGUgd2l0aCBzdGFuZGFyZCBjb25maWd1cmF0aW9uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVUYWJsZShcbiAgc2NvcGU6IENvbnN0cnVjdCxcbiAgaWQ6IHN0cmluZyxcbiAgY29uZmlnOiBUYWJsZUNvbmZpZ1xuKTogZHluYW1vZGIuVGFibGUge1xuICBjb25zdCB0YWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZShzY29wZSwgaWQsIHtcbiAgICB0YWJsZU5hbWU6IGNvbmZpZy50YWJsZU5hbWUsXG4gICAgcGFydGl0aW9uS2V5OiBjb25maWcucGFydGl0aW9uS2V5LFxuICAgIHNvcnRLZXk6IGNvbmZpZy5zb3J0S2V5LFxuICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXG4gICAgcG9pbnRJblRpbWVSZWNvdmVyeTogdHJ1ZSxcbiAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU4sXG4gICAgZW5jcnlwdGlvbjogZHluYW1vZGIuVGFibGVFbmNyeXB0aW9uLkFXU19NQU5BR0VELFxuICAgIHRpbWVUb0xpdmVBdHRyaWJ1dGU6IGNvbmZpZy50aW1lVG9MaXZlQXR0cmlidXRlLFxuICB9KTtcblxuICByZXR1cm4gdGFibGU7XG59XG5cbi8qKlxuICogQ3JlYXRlcyBhIER5bmFtb0RCIHRhYmxlIHdpdGggR2xvYmFsIFNlY29uZGFyeSBJbmRleGVzXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVUYWJsZVdpdGhHU0koXG4gIHNjb3BlOiBDb25zdHJ1Y3QsXG4gIGlkOiBzdHJpbmcsXG4gIGNvbmZpZzogVGFibGVDb25maWcsXG4gIGdzaXM6IEdzaUNvbmZpZ1tdXG4pOiBkeW5hbW9kYi5UYWJsZSB7XG4gIGNvbnN0IHRhYmxlID0gY3JlYXRlVGFibGUoc2NvcGUsIGlkLCBjb25maWcpO1xuXG4gIGdzaXMuZm9yRWFjaCgoZ3NpKSA9PiB7XG4gICAgdGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xuICAgICAgaW5kZXhOYW1lOiBnc2kuaW5kZXhOYW1lLFxuICAgICAgcGFydGl0aW9uS2V5OiBnc2kucGFydGl0aW9uS2V5LFxuICAgICAgc29ydEtleTogZ3NpLnNvcnRLZXksXG4gICAgICBwcm9qZWN0aW9uVHlwZTogZ3NpLnByb2plY3Rpb25UeXBlIHx8IGR5bmFtb2RiLlByb2plY3Rpb25UeXBlLkFMTCxcbiAgICB9KTtcbiAgfSk7XG5cbiAgcmV0dXJuIHRhYmxlO1xufVxuXG4iXX0=