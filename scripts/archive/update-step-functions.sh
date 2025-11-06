#!/bin/bash
# Script to update Step Functions to invoke ECS worker task
# Run this after WorkerStack is deployed

set -e

AWS_REGION=${AWS_REGION:-us-east-1}
STATE_MACHINE_ARN="arn:aws:states:us-east-1:471112574622:stateMachine:leadmagnet-job-processor"
TASK_DEFINITION="leadmagnet-worker:1"
CLUSTER="leadmagnet-cluster"
VPC_ID="vpc-08d64cbdaee46da3d"

echo "Getting private subnet..."
SUBNET=$(aws ec2 describe-subnets --region $AWS_REGION \
  --filters "Name=vpc-id,Values=$VPC_ID" "Name=map-public-ip-on-launch,Values=false" \
  --query "Subnets[0].SubnetId" --output text)

if [ -z "$SUBNET" ] || [ "$SUBNET" == "None" ]; then
  echo "Error: Could not find private subnet"
  exit 1
fi

echo "Using subnet: $SUBNET"
echo "Updating Step Functions state machine..."

# Create the definition file
cat > /tmp/sf-definition.json <<EOF
{
  "Comment": "Process lead magnet jobs",
  "StartAt": "UpdateJobStatus",
  "States": {
    "UpdateJobStatus": {
      "Type": "Task",
      "Resource": "arn:aws:states:::dynamodb:updateItem",
      "Parameters": {
        "TableName": "leadmagnet-jobs",
        "Key": {
          "job_id": {
            "S.\$": "\$.job_id"
          }
        },
        "UpdateExpression": "SET #status = :status, updated_at = :updated_at",
        "ExpressionAttributeNames": {
          "#status": "status"
        },
        "ExpressionAttributeValues": {
          ":status": {
            "S": "processing"
          },
          ":updated_at": {
            "S.\$": "\$\$.State.EnteredTime"
          }
        }
      },
      "ResultPath": "\$.updateResult",
      "Next": "ProcessJob"
    },
    "ProcessJob": {
      "Type": "Task",
      "Resource": "arn:aws:states:::ecs:runTask.sync",
      "Parameters": {
        "Cluster": "$CLUSTER",
        "TaskDefinition": "$TASK_DEFINITION",
        "LaunchType": "FARGATE",
        "NetworkConfiguration": {
          "AwsvpcConfiguration": {
            "Subnets": ["$SUBNET"],
            "AssignPublicIp": "DISABLED"
          }
        },
        "Overrides": {
          "ContainerOverrides": [
            {
              "Name": "WorkerContainer",
              "Environment": [
                {
                  "Name": "JOB_ID",
                  "Value.\$": "\$.job_id"
                }
              ]
            }
          ]
        }
      },
      "ResultPath": "\$.processResult",
      "Next": "HandleSuccess",
      "Catch": [
        {
          "ErrorEquals": ["States.ALL"],
          "ResultPath": "\$.error",
          "Next": "HandleFailure"
        }
      ]
    },
    "HandleSuccess": {
      "Type": "Task",
      "Resource": "arn:aws:states:::dynamodb:updateItem",
      "Parameters": {
        "TableName": "leadmagnet-jobs",
        "Key": {
          "job_id": {
            "S.\$": "\$.job_id"
          }
        },
        "UpdateExpression": "SET #status = :status, completed_at = :completed_at, updated_at = :updated_at",
        "ExpressionAttributeNames": {
          "#status": "status"
        },
        "ExpressionAttributeValues": {
          ":status": {
            "S": "completed"
          },
          ":completed_at": {
            "S.\$": "\$\$.State.EnteredTime"
          },
          ":updated_at": {
            "S.\$": "\$\$.State.EnteredTime"
          }
        }
      },
      "End": true
    },
    "HandleFailure": {
      "Type": "Task",
      "Resource": "arn:aws:states:::dynamodb:updateItem",
      "Parameters": {
        "TableName": "leadmagnet-jobs",
        "Key": {
          "job_id": {
            "S.\$": "\$.job_id"
          }
        },
        "UpdateExpression": "SET #status = :status, error_message = :error, updated_at = :updated_at",
        "ExpressionAttributeNames": {
          "#status": "status"
        },
        "ExpressionAttributeValues": {
          ":status": {
            "S": "failed"
          },
          ":error": {
            "S": "Error occurred"
          },
          ":updated_at": {
            "S.\$": "\$\$.State.EnteredTime"
          }
        }
      },
      "End": true
    }
  }
}
EOF

aws stepfunctions update-state-machine \
  --region $AWS_REGION \
  --state-machine-arn "$STATE_MACHINE_ARN" \
  --definition file:///tmp/sf-definition.json

echo "✅ Step Functions state machine updated successfully!"
echo "The state machine will now invoke the ECS worker task to process jobs."

