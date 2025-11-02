# Lead Magnet Generation Flow

## Complete Process Flow Diagram

```mermaid
flowchart TD
    Start([User Submits Form]) --> API[API Gateway<br/>POST /v1/forms/:slug/submit]
    
    API --> CreateSubmission[Create Submission Record<br/>DynamoDB: submissions]
    CreateSubmission --> CreateJob[Create Job Record<br/>DynamoDB: jobs<br/>Status: pending]
    CreateJob --> TriggerStepFunctions[Start Step Functions Execution<br/>State Machine: leadmagnet-job-processor]
    
    TriggerStepFunctions --> Step1[Step Functions: Update Job Status<br/>Status: processing]
    
    Step1 --> Step2[Step Functions: Invoke Lambda<br/>Function: leadmagnet-job-processor]
    
    Step2 --> LambdaStart[Lambda Handler Starts<br/>Extract job_id from event]
    
    LambdaStart --> GetJob[Get Job Details<br/>from DynamoDB]
    GetJob --> GetWorkflow[Get Workflow Config<br/>from DynamoDB]
    GetWorkflow --> GetSubmission[Get Submission Data<br/>from DynamoDB]
    
    GetSubmission --> Step1Worker[Worker Step 1:<br/>Generate AI Report]
    Step1Worker --> OpenAI[Call OpenAI API<br/>Generate markdown report]
    OpenAI --> StoreReport[Store report.md<br/>S3 + DynamoDB artifact]
    
    StoreReport --> Step2Worker[Worker Step 2:<br/>Get Template]
    Step2Worker --> GetTemplate[Load Template from DynamoDB<br/>Check if published]
    
    GetTemplate --> Step3Worker[Worker Step 3:<br/>Convert Markdown to HTML]
    Step3Worker --> MarkdownConvert[Use markdown library<br/>Convert report.md → HTML]
    
    MarkdownConvert --> Step4Worker[Worker Step 4:<br/>Render Template]
    Step4Worker --> RenderTemplate[Replace {{REPORT_CONTENT}}<br/>with HTML report]
    RenderTemplate --> InitialHTML[Initial HTML Created]
    
    InitialHTML --> CheckRewrite{AI Rewrite<br/>Enabled?}
    
    CheckRewrite -->|Yes| StoreInitial[Store initial.html<br/>S3 + DynamoDB artifact]
    StoreInitial --> AIRewrite[Call OpenAI API<br/>Rewrite HTML]
    AIRewrite --> FinalHTML[Final HTML]
    
    CheckRewrite -->|No| FinalHTML
    
    FinalHTML --> Step6Worker[Worker Step 6:<br/>Store Final HTML]
    Step6Worker --> StoreFinal[Store final.html<br/>S3 + DynamoDB artifact<br/>Set public=True]
    
    StoreFinal --> Step7Worker[Worker Step 7:<br/>Update Job]
    Step7Worker --> UpdateJob[Update Job Record<br/>Status: completed<br/>output_url: final.html URL<br/>artifacts: [report, final]]
    
    UpdateJob --> CheckWebhook{Webhook<br/>Configured?}
    
    CheckWebhook -->|Yes| Step8Worker[Worker Step 8:<br/>Send Webhook]
    Step8Worker --> Webhook[POST to webhook_url<br/>with job_id, output_url]
    
    CheckWebhook -->|No| StepFunctionsSuccess
    Webhook --> StepFunctionsSuccess[Step Functions: Update Job Status<br/>Status: completed]
    
    StepFunctionsSuccess --> End([Job Complete<br/>User can view artifact])
    
    %% Error paths
    Step1Worker -.->|Error| ErrorHandler[Update Job Status: failed<br/>Store error_message]
    Step2Worker -.->|Error| ErrorHandler
    Step3Worker -.->|Error| ErrorHandler
    Step4Worker -.->|Error| ErrorHandler
    AIRewrite -.->|Error| LogWarning[Log warning<br/>Use original HTML]
    LogWarning --> FinalHTML
    Step6Worker -.->|Error| ErrorHandler
    ErrorHandler --> StepFunctionsFailure[Step Functions: Update Job Status<br/>Status: failed]
    StepFunctionsFailure --> ErrorEnd([Job Failed])
    
    style Start fill:#e1f5ff
    style End fill:#d4edda
    style ErrorEnd fill:#f8d7da
    style Step1Worker fill:#fff3cd
    style Step2Worker fill:#fff3cd
    style Step3Worker fill:#fff3cd
    style Step4Worker fill:#fff3cd
    style Step6Worker fill:#fff3cd
    style OpenAI fill:#cfe2ff
    style AIRewrite fill:#cfe2ff
```

## ASCII Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    FORM SUBMISSION FLOW                         │
└─────────────────────────────────────────────────────────────────┘

User submits form
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│ API Gateway: POST /v1/forms/:slug/submit                      │
└─────────────────────────────────────────────────────────────────┘
    │
    ├─► Create Submission Record (DynamoDB: submissions)
    ├─► Create Job Record (DynamoDB: jobs, status: pending)
    └─► Trigger Step Functions Execution
            │
            ▼
┌─────────────────────────────────────────────────────────────────┐
│         Step Functions State Machine                            │
│         leadmagnet-job-processor                                │
└─────────────────────────────────────────────────────────────────┘
    │
    ├─► Step 1: Update Job Status → "processing"
    │
    ├─► Step 2: Invoke Lambda Function
    │       │
    │       ▼
    │   ┌─────────────────────────────────────────────────────────┐
    │   │ Lambda: leadmagnet-job-processor                        │
    │   └─────────────────────────────────────────────────────────┘
    │           │
    │           ├─► Get Job, Workflow, Submission from DynamoDB
    │           │
    │           ├─► WORKER STEP 1: Generate AI Report
    │           │       │
    │           │       ├─► Call OpenAI API (GPT-4o)
    │           │       ├─► Generate markdown report
    │           │       └─► Store report.md (S3 + DynamoDB artifact)
    │           │
    │           ├─► WORKER STEP 2: Get Template
    │           │       │
    │           │       ├─► Load template from DynamoDB
    │           │       └─► Verify template is published
    │           │
    │           ├─► WORKER STEP 3: Convert Markdown to HTML
    │           │       │
    │           │       ├─► Use markdown library
    │           │       └─► Convert report.md → HTML
    │           │
    │           ├─► WORKER STEP 4: Render Template
    │           │       │
    │           │       ├─► Replace {{REPORT_CONTENT}} with HTML report
    │           │       ├─► Replace {{DATE}} with current date
    │           │       └─► Inject submission_data fields
    │           │
    │           ├─► WORKER STEP 5: AI Rewrite (if enabled)
    │           │       │
    │           │       ├─► IF rewrite_enabled:
    │           │       │   ├─► Store initial.html artifact
    │           │       │   ├─► Call OpenAI API to rewrite HTML
    │           │       │   └─► Get enhanced HTML
    │           │       │
    │           │       └─► ELSE: Use initial HTML as final
    │           │
    │           ├─► WORKER STEP 6: Store Final HTML
    │           │       │
    │           │       ├─► Store final.html (S3 + DynamoDB artifact)
    │           │       ├─► Set public=True (CloudFront or presigned URL)
    │           │       └─► Get public_url
    │           │
    │           ├─► WORKER STEP 7: Update Job
    │           │       │
    │           │       ├─► Status: completed
    │           │       ├─► output_url: final.html URL
    │           │       └─► artifacts: [report_artifact_id, final_artifact_id]
    │           │              (+ initial_artifact_id if rewrite enabled)
    │           │
    │           └─► WORKER STEP 8: Send Webhook (if configured)
    │                   │
    │                   └─► POST to webhook_url with job details
    │
    └─► Step 3: Update Job Status → "completed"
            │
            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ARTIFACTS CREATED                           │
└─────────────────────────────────────────────────────────────────┘
    │
    ├─► report.md (markdown)
    ├─► initial.html (only if rewrite_enabled)
    └─► final.html (public URL)
            │
            ▼
    User can view/download artifact
```

## Key Components

### Artifacts Created:
1. **report.md** - Raw markdown report from AI
2. **initial.html** - Template-rendered HTML (only if `rewrite_enabled=true`)
3. **final.html** - Final HTML document (public URL)

### Storage:
- **S3**: All artifacts stored in `leadmagnet-artifacts-{account}/tenant_id/jobs/job_id/`
- **DynamoDB**: Artifact metadata in `leadmagnet-artifacts` table
- **URLs**: CloudFront URLs (if configured) or presigned URLs (7-day expiry)

### Error Handling:
- Any step failure → Job status set to "failed"
- Error message stored in job record
- Step Functions catch Lambda errors
- AI rewrite failures fall back to original HTML

