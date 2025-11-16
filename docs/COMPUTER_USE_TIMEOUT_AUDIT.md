# Computer Use Preview & Timeout Audit Report

## Executive Summary

This audit examines:
1. **Computer Use Preview Usage**: How many workflows actually use `computer_use_preview` tool
2. **Current Timeout Configurations**: Lambda and CUA loop timeout settings
3. **Timeout Monitoring**: Existing CloudWatch alarms and monitoring
4. **Recommendations**: Implementation paths based on findings

---

## 1. Computer Use Preview Usage Audit

### Codebase Support
✅ **Fully Supported**
- Frontend UI includes `computer_use_preview` as selectable tool
- Backend has complete CUA (Computer Use API) loop implementation
- Test files exist for computer use functionality
- Tool validator recognizes `computer_use_preview`
- Browser service integrated for screenshot capture

### Key Files
- `backend/worker/services/cua_loop_service.py` - Main CUA loop implementation
- `backend/worker/services/browser_service.py` - Browser automation
- `backend/worker/ai_service.py` - Detects and routes to CUA loop
- `frontend/src/app/dashboard/workflows/components/WorkflowStepEditor.tsx` - UI support
- Multiple test files in `scripts/testing/`

### Actual Usage in Production
**Status**: ⚠️ **Requires Database Query**

A script has been created to audit actual usage:
- **Script**: `scripts/utils/check-computer-use-usage.py`
- **Usage**: `python3 scripts/utils/check-computer-use-usage.py`
- **Output**: JSON report with workflow breakdown

**To Run Audit**:
```bash
cd /Users/canyonsmith/lead-magnent-ai
python3 scripts/utils/check-computer-use-usage.py
```

The script will:
- Scan all workflows in DynamoDB
- Identify workflows using `computer_use_preview`
- Show breakdown by tenant
- Display configuration details (display_width, display_height, environment)
- Generate JSON report: `computer-use-usage-report.json`

---

## 2. Current Timeout Configurations

### Lambda Function Timeouts

| Function | Timeout | Location |
|----------|---------|----------|
| **Job Processor Lambda** | **15 minutes** (900 seconds) | `infrastructure/lib/config/constants.ts` |
| API Lambda | 15 minutes (900 seconds) | `infrastructure/lib/config/constants.ts` |

**Configuration**:
```typescript
JOB_PROCESSOR: {
  MEMORY_SIZE: 3008,
  TIMEOUT_MINUTES: 15,  // 900 seconds
  LOG_RETENTION_DAYS: 7,
}
```

### CUA Loop Timeouts

| Component | Timeout | Location |
|-----------|---------|----------|
| **CUA Loop Max Duration** | **5 minutes** (300 seconds) | `backend/worker/services/cua_loop_service.py:37` |
| CUA Loop Max Iterations | 50 iterations | `backend/worker/services/cua_loop_service.py:36` |
| Browser Navigation | 30 seconds | `backend/worker/services/browser_service.py:74` |
| Element Click | 5 seconds | `backend/worker/services/browser_service.py:189` |

**CUA Loop Configuration**:
```python
def run_cua_loop(
    ...
    max_iterations: int = 50,
    max_duration_seconds: int = 300,  # 5 minutes
    ...
)
```

**Timeout Check Logic**:
```python
# Check timeout
elapsed = time.time() - start_time
if elapsed > max_duration_seconds:
    logger.warning(f"[CUALoopService] CUA loop timeout after {elapsed:.1f} seconds")
    break
```

### Other Timeouts

| Component | Timeout | Location |
|-----------|---------|----------|
| HTTP Requests (artifacts) | 30 seconds | `backend/worker/artifact_service.py:201` |
| Webhook Calls | 30 seconds | `backend/worker/services/webhook_step_service.py:102` |
| Delivery Service | 30 seconds | `backend/worker/delivery_service.py:88,94,276` |

---

## 3. Timeout Monitoring

### Existing CloudWatch Alarms

✅ **Step Functions Timeout Alarm**
- **Location**: `infrastructure/lib/monitoring/alarms.ts:177`
- **Metric**: `stateMachine.metricTimedOut()`
- **Threshold**: 1 timeout per 5-minute period
- **Status**: Configured and active

✅ **Lambda Error Alarm**
- **Location**: `infrastructure/lib/monitoring/alarms.ts:35`
- **Metric**: `lambdaFunction.metricErrors()`
- **Threshold**: 5 errors per 5-minute period
- **Note**: Catches timeout errors but not specifically

❌ **Lambda Timeout-Specific Alarm**
- **Status**: **NOT IMPLEMENTED**
- **Gap**: No dedicated alarm for Lambda timeouts
- **Impact**: Timeout errors are only caught by general error alarm

### Lambda Timeout Detection

Lambda timeouts appear as:
- **Error Type**: `Task timed out after X.XX seconds`
- **Error Metric**: Counted in `metricErrors()`
- **Log Pattern**: `REPORT RequestId: ... Duration: 900000.XX ms ... Memory Size: 3008 MB ... Max Memory Used: XXX MB`

**Current Detection**:
- ✅ ErrorHandlerService classifies "timeout" in error messages
- ✅ General Lambda error alarm will trigger
- ❌ No specific timeout metric or alarm

---

## 4. Timeout Risk Analysis

### Risk Scenarios

#### Scenario 1: CUA Loop Exceeds 5 Minutes
- **Current Limit**: 300 seconds (5 minutes)
- **Lambda Limit**: 900 seconds (15 minutes)
- **Risk**: Medium
- **Impact**: CUA loop stops, but Lambda continues (wasted time)
- **Mitigation**: Current timeout check works, but may not be optimal

#### Scenario 2: Multiple CUA Steps in Workflow
- **Current**: Each step gets 15-minute Lambda timeout
- **Risk**: Low (if CUA loop timeout is respected)
- **Impact**: If CUA loop doesn't timeout properly, entire Lambda could timeout
- **Mitigation**: Need to verify CUA loop timeout is always respected

#### Scenario 3: Lambda Timeout (15 minutes)
- **Current Limit**: 900 seconds
- **Risk**: Low (for single steps)
- **Risk**: Medium (for complex workflows with multiple steps)
- **Impact**: Job fails, user sees error
- **Mitigation**: Step Functions orchestrates, but each Lambda invocation has 15-minute limit

#### Scenario 4: Step Functions Timeout
- **Current**: Not explicitly set (uses default)
- **Risk**: Unknown
- **Impact**: Entire job execution fails
- **Mitigation**: Alarm exists, but need to check actual timeout value

---

## 5. Recommendations

### Immediate Actions

1. **Run Computer Use Audit**
   ```bash
   python3 scripts/utils/check-computer-use-usage.py
   ```
   - Determine actual usage in production
   - Identify workflows that may be at risk

2. **Check CloudWatch Logs for Timeouts**
   ```bash
   # Check Lambda timeout errors
   aws logs filter-log-events \
     --log-group-name /aws/lambda/leadmagnet-job-processor \
     --filter-pattern "Task timed out" \
     --start-time $(date -u -d '7 days ago' +%s)000
   
   # Check CUA loop timeouts
   aws logs filter-log-events \
     --log-group-name /aws/lambda/leadmagnet-job-processor \
     --filter-pattern "CUA loop timeout" \
     --start-time $(date -u -d '7 days ago' +%s)000
   ```

3. **Review Step Functions Timeout Configuration**
   - Check if Step Functions state machine has explicit timeout
   - Verify timeout alarm is properly configured
   - Review recent timeout events in CloudWatch

### Implementation Paths (Based on Audit Results)

#### Path A: Low/No Computer Use Usage
**If**: < 5% of workflows use computer_use_preview
**Then**:
- ✅ Keep current timeout configuration
- ✅ Add Lambda timeout-specific alarm for monitoring
- ✅ Document timeout behavior
- ⚠️ Consider deprecating if usage is near zero

#### Path B: Moderate Computer Use Usage
**If**: 5-20% of workflows use computer_use_preview
**Then**:
- ✅ Add Lambda timeout-specific alarm
- ✅ Optimize CUA loop timeout (consider increasing to 10 minutes)
- ✅ Add timeout metrics and dashboards
- ✅ Implement timeout retry logic for CUA steps

#### Path C: High Computer Use Usage
**If**: > 20% of workflows use computer_use_preview
**Then**:
- ✅ Increase Lambda timeout to 30 minutes (if needed)
- ✅ Optimize CUA loop (increase max_duration_seconds to 10-15 minutes)
- ✅ Implement async CUA processing (move to separate Lambda)
- ✅ Add comprehensive timeout monitoring and alerting
- ✅ Consider Step Functions Express for long-running CUA workflows

### Recommended Monitoring Enhancements

1. **Add Lambda Timeout Metric Alarm**
   ```typescript
   // In infrastructure/lib/monitoring/alarms.ts
   export function createLambdaTimeoutAlarm(
     scope: Construct,
     lambdaFunction: lambda.IFunction,
     options: AlarmOptions
   ): cloudwatch.Alarm {
     const metric = lambdaFunction.metricDuration({
       statistic: 'Maximum',
       period: cdk.Duration.minutes(5),
     });
     
     const alarm = new cloudwatch.Alarm(scope, `${options.alarmName}Alarm`, {
       alarmName: options.alarmName,
       alarmDescription: options.alarmDescription,
       metric,
       threshold: lambdaFunction.timeout?.toMilliseconds() * 0.9, // 90% of timeout
       evaluationPeriods: 1,
       comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
     });
     
     return alarm;
   }
   ```

2. **Add CUA Loop Timeout Logging**
   - Log when CUA loop approaches timeout (80% threshold)
   - Track average CUA loop duration
   - Alert on frequent CUA timeouts

3. **Add Timeout Dashboard**
   - Lambda duration trends
   - CUA loop duration distribution
   - Timeout error rates
   - Step Functions execution times

---

## 6. Next Steps

### Phase 1: Data Collection (Current)
- [x] Create computer use audit script
- [ ] Run audit script on production database
- [ ] Query CloudWatch logs for timeout errors
- [ ] Review Step Functions timeout configuration

### Phase 2: Analysis
- [ ] Analyze audit results
- [ ] Identify timeout patterns
- [ ] Calculate timeout risk score
- [ ] Determine implementation path (A, B, or C)

### Phase 3: Implementation
- [ ] Add Lambda timeout alarm
- [ ] Optimize timeout configurations (if needed)
- [ ] Implement monitoring enhancements
- [ ] Update documentation

### Phase 4: Validation
- [ ] Test timeout scenarios
- [ ] Verify alarm triggers
- [ ] Monitor for 1 week
- [ ] Adjust based on findings

---

## Appendix: Key Files Reference

### Timeout Configuration
- `infrastructure/lib/config/constants.ts` - Lambda timeout defaults
- `infrastructure/lib/compute-stack.ts` - Job processor Lambda configuration
- `backend/worker/services/cua_loop_service.py` - CUA loop timeout

### Timeout Monitoring
- `infrastructure/lib/monitoring/alarms.ts` - CloudWatch alarms
- `backend/worker/services/error_handler_service.py` - Error classification

### Computer Use Implementation
- `backend/worker/services/cua_loop_service.py` - Main CUA loop
- `backend/worker/services/browser_service.py` - Browser automation
- `backend/worker/ai_service.py` - CUA routing logic

### Audit Scripts
- `scripts/utils/check-computer-use-usage.py` - Computer use audit (NEW)
- `scripts/utils/check-legacy-workflow-usage.py` - Legacy workflow audit (reference)


