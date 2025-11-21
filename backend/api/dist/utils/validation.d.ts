import { z } from 'zod';
export declare const workflowStepSchema: z.ZodEffects<z.ZodObject<{
    step_name: z.ZodString;
    step_description: z.ZodOptional<z.ZodString>;
    step_type: z.ZodDefault<z.ZodOptional<z.ZodEnum<["ai_generation", "webhook"]>>>;
    model: z.ZodOptional<z.ZodString>;
    instructions: z.ZodOptional<z.ZodString>;
    step_order: z.ZodOptional<z.ZodNumber>;
    depends_on: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
    tools: z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
        type: z.ZodString;
        display_width: z.ZodOptional<z.ZodNumber>;
        display_height: z.ZodOptional<z.ZodNumber>;
        environment: z.ZodOptional<z.ZodEnum<["browser", "mac", "windows", "ubuntu"]>>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        type: z.ZodString;
        display_width: z.ZodOptional<z.ZodNumber>;
        display_height: z.ZodOptional<z.ZodNumber>;
        environment: z.ZodOptional<z.ZodEnum<["browser", "mac", "windows", "ubuntu"]>>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        type: z.ZodString;
        display_width: z.ZodOptional<z.ZodNumber>;
        display_height: z.ZodOptional<z.ZodNumber>;
        environment: z.ZodOptional<z.ZodEnum<["browser", "mac", "windows", "ubuntu"]>>;
    }, z.ZodTypeAny, "passthrough">>]>, "many">>;
    tool_choice: z.ZodDefault<z.ZodOptional<z.ZodEnum<["auto", "required", "none"]>>>;
    webhook_url: z.ZodOptional<z.ZodString>;
    webhook_headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    webhook_data_selection: z.ZodOptional<z.ZodObject<{
        include_submission: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        exclude_step_indices: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
        include_job_info: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    }, "strip", z.ZodTypeAny, {
        include_submission: boolean;
        include_job_info: boolean;
        exclude_step_indices?: number[] | undefined;
    }, {
        include_submission?: boolean | undefined;
        exclude_step_indices?: number[] | undefined;
        include_job_info?: boolean | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    step_name: string;
    step_type: "ai_generation" | "webhook";
    tool_choice: "required" | "auto" | "none";
    step_description?: string | undefined;
    model?: string | undefined;
    instructions?: string | undefined;
    step_order?: number | undefined;
    depends_on?: number[] | undefined;
    tools?: (string | z.objectOutputType<{
        type: z.ZodString;
        display_width: z.ZodOptional<z.ZodNumber>;
        display_height: z.ZodOptional<z.ZodNumber>;
        environment: z.ZodOptional<z.ZodEnum<["browser", "mac", "windows", "ubuntu"]>>;
    }, z.ZodTypeAny, "passthrough">)[] | undefined;
    webhook_url?: string | undefined;
    webhook_headers?: Record<string, string> | undefined;
    webhook_data_selection?: {
        include_submission: boolean;
        include_job_info: boolean;
        exclude_step_indices?: number[] | undefined;
    } | undefined;
}, {
    step_name: string;
    step_description?: string | undefined;
    step_type?: "ai_generation" | "webhook" | undefined;
    model?: string | undefined;
    instructions?: string | undefined;
    step_order?: number | undefined;
    depends_on?: number[] | undefined;
    tools?: (string | z.objectInputType<{
        type: z.ZodString;
        display_width: z.ZodOptional<z.ZodNumber>;
        display_height: z.ZodOptional<z.ZodNumber>;
        environment: z.ZodOptional<z.ZodEnum<["browser", "mac", "windows", "ubuntu"]>>;
    }, z.ZodTypeAny, "passthrough">)[] | undefined;
    tool_choice?: "required" | "auto" | "none" | undefined;
    webhook_url?: string | undefined;
    webhook_headers?: Record<string, string> | undefined;
    webhook_data_selection?: {
        include_submission?: boolean | undefined;
        exclude_step_indices?: number[] | undefined;
        include_job_info?: boolean | undefined;
    } | undefined;
}>, {
    step_name: string;
    step_type: "ai_generation" | "webhook";
    tool_choice: "required" | "auto" | "none";
    step_description?: string | undefined;
    model?: string | undefined;
    instructions?: string | undefined;
    step_order?: number | undefined;
    depends_on?: number[] | undefined;
    tools?: (string | z.objectOutputType<{
        type: z.ZodString;
        display_width: z.ZodOptional<z.ZodNumber>;
        display_height: z.ZodOptional<z.ZodNumber>;
        environment: z.ZodOptional<z.ZodEnum<["browser", "mac", "windows", "ubuntu"]>>;
    }, z.ZodTypeAny, "passthrough">)[] | undefined;
    webhook_url?: string | undefined;
    webhook_headers?: Record<string, string> | undefined;
    webhook_data_selection?: {
        include_submission: boolean;
        include_job_info: boolean;
        exclude_step_indices?: number[] | undefined;
    } | undefined;
}, {
    step_name: string;
    step_description?: string | undefined;
    step_type?: "ai_generation" | "webhook" | undefined;
    model?: string | undefined;
    instructions?: string | undefined;
    step_order?: number | undefined;
    depends_on?: number[] | undefined;
    tools?: (string | z.objectInputType<{
        type: z.ZodString;
        display_width: z.ZodOptional<z.ZodNumber>;
        display_height: z.ZodOptional<z.ZodNumber>;
        environment: z.ZodOptional<z.ZodEnum<["browser", "mac", "windows", "ubuntu"]>>;
    }, z.ZodTypeAny, "passthrough">)[] | undefined;
    tool_choice?: "required" | "auto" | "none" | undefined;
    webhook_url?: string | undefined;
    webhook_headers?: Record<string, string> | undefined;
    webhook_data_selection?: {
        include_submission?: boolean | undefined;
        exclude_step_indices?: number[] | undefined;
        include_job_info?: boolean | undefined;
    } | undefined;
}>;
export declare const createWorkflowSchema: z.ZodEffects<z.ZodObject<{
    workflow_name: z.ZodString;
    workflow_description: z.ZodOptional<z.ZodString>;
    steps: z.ZodOptional<z.ZodArray<z.ZodEffects<z.ZodObject<{
        step_name: z.ZodString;
        step_description: z.ZodOptional<z.ZodString>;
        step_type: z.ZodDefault<z.ZodOptional<z.ZodEnum<["ai_generation", "webhook"]>>>;
        model: z.ZodOptional<z.ZodString>;
        instructions: z.ZodOptional<z.ZodString>;
        step_order: z.ZodOptional<z.ZodNumber>;
        depends_on: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
        tools: z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
            type: z.ZodString;
            display_width: z.ZodOptional<z.ZodNumber>;
            display_height: z.ZodOptional<z.ZodNumber>;
            environment: z.ZodOptional<z.ZodEnum<["browser", "mac", "windows", "ubuntu"]>>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            type: z.ZodString;
            display_width: z.ZodOptional<z.ZodNumber>;
            display_height: z.ZodOptional<z.ZodNumber>;
            environment: z.ZodOptional<z.ZodEnum<["browser", "mac", "windows", "ubuntu"]>>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            type: z.ZodString;
            display_width: z.ZodOptional<z.ZodNumber>;
            display_height: z.ZodOptional<z.ZodNumber>;
            environment: z.ZodOptional<z.ZodEnum<["browser", "mac", "windows", "ubuntu"]>>;
        }, z.ZodTypeAny, "passthrough">>]>, "many">>;
        tool_choice: z.ZodDefault<z.ZodOptional<z.ZodEnum<["auto", "required", "none"]>>>;
        webhook_url: z.ZodOptional<z.ZodString>;
        webhook_headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        webhook_data_selection: z.ZodOptional<z.ZodObject<{
            include_submission: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            exclude_step_indices: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
            include_job_info: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        }, "strip", z.ZodTypeAny, {
            include_submission: boolean;
            include_job_info: boolean;
            exclude_step_indices?: number[] | undefined;
        }, {
            include_submission?: boolean | undefined;
            exclude_step_indices?: number[] | undefined;
            include_job_info?: boolean | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        step_name: string;
        step_type: "ai_generation" | "webhook";
        tool_choice: "required" | "auto" | "none";
        step_description?: string | undefined;
        model?: string | undefined;
        instructions?: string | undefined;
        step_order?: number | undefined;
        depends_on?: number[] | undefined;
        tools?: (string | z.objectOutputType<{
            type: z.ZodString;
            display_width: z.ZodOptional<z.ZodNumber>;
            display_height: z.ZodOptional<z.ZodNumber>;
            environment: z.ZodOptional<z.ZodEnum<["browser", "mac", "windows", "ubuntu"]>>;
        }, z.ZodTypeAny, "passthrough">)[] | undefined;
        webhook_url?: string | undefined;
        webhook_headers?: Record<string, string> | undefined;
        webhook_data_selection?: {
            include_submission: boolean;
            include_job_info: boolean;
            exclude_step_indices?: number[] | undefined;
        } | undefined;
    }, {
        step_name: string;
        step_description?: string | undefined;
        step_type?: "ai_generation" | "webhook" | undefined;
        model?: string | undefined;
        instructions?: string | undefined;
        step_order?: number | undefined;
        depends_on?: number[] | undefined;
        tools?: (string | z.objectInputType<{
            type: z.ZodString;
            display_width: z.ZodOptional<z.ZodNumber>;
            display_height: z.ZodOptional<z.ZodNumber>;
            environment: z.ZodOptional<z.ZodEnum<["browser", "mac", "windows", "ubuntu"]>>;
        }, z.ZodTypeAny, "passthrough">)[] | undefined;
        tool_choice?: "required" | "auto" | "none" | undefined;
        webhook_url?: string | undefined;
        webhook_headers?: Record<string, string> | undefined;
        webhook_data_selection?: {
            include_submission?: boolean | undefined;
            exclude_step_indices?: number[] | undefined;
            include_job_info?: boolean | undefined;
        } | undefined;
    }>, {
        step_name: string;
        step_type: "ai_generation" | "webhook";
        tool_choice: "required" | "auto" | "none";
        step_description?: string | undefined;
        model?: string | undefined;
        instructions?: string | undefined;
        step_order?: number | undefined;
        depends_on?: number[] | undefined;
        tools?: (string | z.objectOutputType<{
            type: z.ZodString;
            display_width: z.ZodOptional<z.ZodNumber>;
            display_height: z.ZodOptional<z.ZodNumber>;
            environment: z.ZodOptional<z.ZodEnum<["browser", "mac", "windows", "ubuntu"]>>;
        }, z.ZodTypeAny, "passthrough">)[] | undefined;
        webhook_url?: string | undefined;
        webhook_headers?: Record<string, string> | undefined;
        webhook_data_selection?: {
            include_submission: boolean;
            include_job_info: boolean;
            exclude_step_indices?: number[] | undefined;
        } | undefined;
    }, {
        step_name: string;
        step_description?: string | undefined;
        step_type?: "ai_generation" | "webhook" | undefined;
        model?: string | undefined;
        instructions?: string | undefined;
        step_order?: number | undefined;
        depends_on?: number[] | undefined;
        tools?: (string | z.objectInputType<{
            type: z.ZodString;
            display_width: z.ZodOptional<z.ZodNumber>;
            display_height: z.ZodOptional<z.ZodNumber>;
            environment: z.ZodOptional<z.ZodEnum<["browser", "mac", "windows", "ubuntu"]>>;
        }, z.ZodTypeAny, "passthrough">)[] | undefined;
        tool_choice?: "required" | "auto" | "none" | undefined;
        webhook_url?: string | undefined;
        webhook_headers?: Record<string, string> | undefined;
        webhook_data_selection?: {
            include_submission?: boolean | undefined;
            exclude_step_indices?: number[] | undefined;
            include_job_info?: boolean | undefined;
        } | undefined;
    }>, "many">>;
    template_id: z.ZodOptional<z.ZodString>;
    template_version: z.ZodDefault<z.ZodNumber>;
    folder_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    delivery_method: z.ZodDefault<z.ZodEnum<["webhook", "sms", "none"]>>;
    delivery_webhook_url: z.ZodOptional<z.ZodString>;
    delivery_webhook_headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    delivery_sms_enabled: z.ZodDefault<z.ZodBoolean>;
    delivery_sms_message: z.ZodOptional<z.ZodString>;
    delivery_sms_ai_generated: z.ZodDefault<z.ZodBoolean>;
    delivery_sms_ai_instructions: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    workflow_name: string;
    template_version: number;
    delivery_method: "webhook" | "none" | "sms";
    delivery_sms_enabled: boolean;
    delivery_sms_ai_generated: boolean;
    workflow_description?: string | undefined;
    steps?: {
        step_name: string;
        step_type: "ai_generation" | "webhook";
        tool_choice: "required" | "auto" | "none";
        step_description?: string | undefined;
        model?: string | undefined;
        instructions?: string | undefined;
        step_order?: number | undefined;
        depends_on?: number[] | undefined;
        tools?: (string | z.objectOutputType<{
            type: z.ZodString;
            display_width: z.ZodOptional<z.ZodNumber>;
            display_height: z.ZodOptional<z.ZodNumber>;
            environment: z.ZodOptional<z.ZodEnum<["browser", "mac", "windows", "ubuntu"]>>;
        }, z.ZodTypeAny, "passthrough">)[] | undefined;
        webhook_url?: string | undefined;
        webhook_headers?: Record<string, string> | undefined;
        webhook_data_selection?: {
            include_submission: boolean;
            include_job_info: boolean;
            exclude_step_indices?: number[] | undefined;
        } | undefined;
    }[] | undefined;
    template_id?: string | undefined;
    folder_id?: string | null | undefined;
    delivery_webhook_url?: string | undefined;
    delivery_webhook_headers?: Record<string, string> | undefined;
    delivery_sms_message?: string | undefined;
    delivery_sms_ai_instructions?: string | undefined;
}, {
    workflow_name: string;
    workflow_description?: string | undefined;
    steps?: {
        step_name: string;
        step_description?: string | undefined;
        step_type?: "ai_generation" | "webhook" | undefined;
        model?: string | undefined;
        instructions?: string | undefined;
        step_order?: number | undefined;
        depends_on?: number[] | undefined;
        tools?: (string | z.objectInputType<{
            type: z.ZodString;
            display_width: z.ZodOptional<z.ZodNumber>;
            display_height: z.ZodOptional<z.ZodNumber>;
            environment: z.ZodOptional<z.ZodEnum<["browser", "mac", "windows", "ubuntu"]>>;
        }, z.ZodTypeAny, "passthrough">)[] | undefined;
        tool_choice?: "required" | "auto" | "none" | undefined;
        webhook_url?: string | undefined;
        webhook_headers?: Record<string, string> | undefined;
        webhook_data_selection?: {
            include_submission?: boolean | undefined;
            exclude_step_indices?: number[] | undefined;
            include_job_info?: boolean | undefined;
        } | undefined;
    }[] | undefined;
    template_id?: string | undefined;
    template_version?: number | undefined;
    folder_id?: string | null | undefined;
    delivery_method?: "webhook" | "none" | "sms" | undefined;
    delivery_webhook_url?: string | undefined;
    delivery_webhook_headers?: Record<string, string> | undefined;
    delivery_sms_enabled?: boolean | undefined;
    delivery_sms_message?: string | undefined;
    delivery_sms_ai_generated?: boolean | undefined;
    delivery_sms_ai_instructions?: string | undefined;
}>, {
    workflow_name: string;
    template_version: number;
    delivery_method: "webhook" | "none" | "sms";
    delivery_sms_enabled: boolean;
    delivery_sms_ai_generated: boolean;
    workflow_description?: string | undefined;
    steps?: {
        step_name: string;
        step_type: "ai_generation" | "webhook";
        tool_choice: "required" | "auto" | "none";
        step_description?: string | undefined;
        model?: string | undefined;
        instructions?: string | undefined;
        step_order?: number | undefined;
        depends_on?: number[] | undefined;
        tools?: (string | z.objectOutputType<{
            type: z.ZodString;
            display_width: z.ZodOptional<z.ZodNumber>;
            display_height: z.ZodOptional<z.ZodNumber>;
            environment: z.ZodOptional<z.ZodEnum<["browser", "mac", "windows", "ubuntu"]>>;
        }, z.ZodTypeAny, "passthrough">)[] | undefined;
        webhook_url?: string | undefined;
        webhook_headers?: Record<string, string> | undefined;
        webhook_data_selection?: {
            include_submission: boolean;
            include_job_info: boolean;
            exclude_step_indices?: number[] | undefined;
        } | undefined;
    }[] | undefined;
    template_id?: string | undefined;
    folder_id?: string | null | undefined;
    delivery_webhook_url?: string | undefined;
    delivery_webhook_headers?: Record<string, string> | undefined;
    delivery_sms_message?: string | undefined;
    delivery_sms_ai_instructions?: string | undefined;
}, {
    workflow_name: string;
    workflow_description?: string | undefined;
    steps?: {
        step_name: string;
        step_description?: string | undefined;
        step_type?: "ai_generation" | "webhook" | undefined;
        model?: string | undefined;
        instructions?: string | undefined;
        step_order?: number | undefined;
        depends_on?: number[] | undefined;
        tools?: (string | z.objectInputType<{
            type: z.ZodString;
            display_width: z.ZodOptional<z.ZodNumber>;
            display_height: z.ZodOptional<z.ZodNumber>;
            environment: z.ZodOptional<z.ZodEnum<["browser", "mac", "windows", "ubuntu"]>>;
        }, z.ZodTypeAny, "passthrough">)[] | undefined;
        tool_choice?: "required" | "auto" | "none" | undefined;
        webhook_url?: string | undefined;
        webhook_headers?: Record<string, string> | undefined;
        webhook_data_selection?: {
            include_submission?: boolean | undefined;
            exclude_step_indices?: number[] | undefined;
            include_job_info?: boolean | undefined;
        } | undefined;
    }[] | undefined;
    template_id?: string | undefined;
    template_version?: number | undefined;
    folder_id?: string | null | undefined;
    delivery_method?: "webhook" | "none" | "sms" | undefined;
    delivery_webhook_url?: string | undefined;
    delivery_webhook_headers?: Record<string, string> | undefined;
    delivery_sms_enabled?: boolean | undefined;
    delivery_sms_message?: string | undefined;
    delivery_sms_ai_generated?: boolean | undefined;
    delivery_sms_ai_instructions?: string | undefined;
}>;
export declare const updateWorkflowSchema: z.ZodEffects<z.ZodObject<{
    workflow_name: z.ZodOptional<z.ZodString>;
    workflow_description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    steps: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodEffects<z.ZodObject<{
        step_name: z.ZodString;
        step_description: z.ZodOptional<z.ZodString>;
        step_type: z.ZodDefault<z.ZodOptional<z.ZodEnum<["ai_generation", "webhook"]>>>;
        model: z.ZodOptional<z.ZodString>;
        instructions: z.ZodOptional<z.ZodString>;
        step_order: z.ZodOptional<z.ZodNumber>;
        depends_on: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
        tools: z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
            type: z.ZodString;
            display_width: z.ZodOptional<z.ZodNumber>;
            display_height: z.ZodOptional<z.ZodNumber>;
            environment: z.ZodOptional<z.ZodEnum<["browser", "mac", "windows", "ubuntu"]>>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            type: z.ZodString;
            display_width: z.ZodOptional<z.ZodNumber>;
            display_height: z.ZodOptional<z.ZodNumber>;
            environment: z.ZodOptional<z.ZodEnum<["browser", "mac", "windows", "ubuntu"]>>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            type: z.ZodString;
            display_width: z.ZodOptional<z.ZodNumber>;
            display_height: z.ZodOptional<z.ZodNumber>;
            environment: z.ZodOptional<z.ZodEnum<["browser", "mac", "windows", "ubuntu"]>>;
        }, z.ZodTypeAny, "passthrough">>]>, "many">>;
        tool_choice: z.ZodDefault<z.ZodOptional<z.ZodEnum<["auto", "required", "none"]>>>;
        webhook_url: z.ZodOptional<z.ZodString>;
        webhook_headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        webhook_data_selection: z.ZodOptional<z.ZodObject<{
            include_submission: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            exclude_step_indices: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
            include_job_info: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        }, "strip", z.ZodTypeAny, {
            include_submission: boolean;
            include_job_info: boolean;
            exclude_step_indices?: number[] | undefined;
        }, {
            include_submission?: boolean | undefined;
            exclude_step_indices?: number[] | undefined;
            include_job_info?: boolean | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        step_name: string;
        step_type: "ai_generation" | "webhook";
        tool_choice: "required" | "auto" | "none";
        step_description?: string | undefined;
        model?: string | undefined;
        instructions?: string | undefined;
        step_order?: number | undefined;
        depends_on?: number[] | undefined;
        tools?: (string | z.objectOutputType<{
            type: z.ZodString;
            display_width: z.ZodOptional<z.ZodNumber>;
            display_height: z.ZodOptional<z.ZodNumber>;
            environment: z.ZodOptional<z.ZodEnum<["browser", "mac", "windows", "ubuntu"]>>;
        }, z.ZodTypeAny, "passthrough">)[] | undefined;
        webhook_url?: string | undefined;
        webhook_headers?: Record<string, string> | undefined;
        webhook_data_selection?: {
            include_submission: boolean;
            include_job_info: boolean;
            exclude_step_indices?: number[] | undefined;
        } | undefined;
    }, {
        step_name: string;
        step_description?: string | undefined;
        step_type?: "ai_generation" | "webhook" | undefined;
        model?: string | undefined;
        instructions?: string | undefined;
        step_order?: number | undefined;
        depends_on?: number[] | undefined;
        tools?: (string | z.objectInputType<{
            type: z.ZodString;
            display_width: z.ZodOptional<z.ZodNumber>;
            display_height: z.ZodOptional<z.ZodNumber>;
            environment: z.ZodOptional<z.ZodEnum<["browser", "mac", "windows", "ubuntu"]>>;
        }, z.ZodTypeAny, "passthrough">)[] | undefined;
        tool_choice?: "required" | "auto" | "none" | undefined;
        webhook_url?: string | undefined;
        webhook_headers?: Record<string, string> | undefined;
        webhook_data_selection?: {
            include_submission?: boolean | undefined;
            exclude_step_indices?: number[] | undefined;
            include_job_info?: boolean | undefined;
        } | undefined;
    }>, {
        step_name: string;
        step_type: "ai_generation" | "webhook";
        tool_choice: "required" | "auto" | "none";
        step_description?: string | undefined;
        model?: string | undefined;
        instructions?: string | undefined;
        step_order?: number | undefined;
        depends_on?: number[] | undefined;
        tools?: (string | z.objectOutputType<{
            type: z.ZodString;
            display_width: z.ZodOptional<z.ZodNumber>;
            display_height: z.ZodOptional<z.ZodNumber>;
            environment: z.ZodOptional<z.ZodEnum<["browser", "mac", "windows", "ubuntu"]>>;
        }, z.ZodTypeAny, "passthrough">)[] | undefined;
        webhook_url?: string | undefined;
        webhook_headers?: Record<string, string> | undefined;
        webhook_data_selection?: {
            include_submission: boolean;
            include_job_info: boolean;
            exclude_step_indices?: number[] | undefined;
        } | undefined;
    }, {
        step_name: string;
        step_description?: string | undefined;
        step_type?: "ai_generation" | "webhook" | undefined;
        model?: string | undefined;
        instructions?: string | undefined;
        step_order?: number | undefined;
        depends_on?: number[] | undefined;
        tools?: (string | z.objectInputType<{
            type: z.ZodString;
            display_width: z.ZodOptional<z.ZodNumber>;
            display_height: z.ZodOptional<z.ZodNumber>;
            environment: z.ZodOptional<z.ZodEnum<["browser", "mac", "windows", "ubuntu"]>>;
        }, z.ZodTypeAny, "passthrough">)[] | undefined;
        tool_choice?: "required" | "auto" | "none" | undefined;
        webhook_url?: string | undefined;
        webhook_headers?: Record<string, string> | undefined;
        webhook_data_selection?: {
            include_submission?: boolean | undefined;
            exclude_step_indices?: number[] | undefined;
            include_job_info?: boolean | undefined;
        } | undefined;
    }>, "many">>>;
    template_id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    template_version: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    folder_id: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    delivery_method: z.ZodOptional<z.ZodDefault<z.ZodEnum<["webhook", "sms", "none"]>>>;
    delivery_webhook_url: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    delivery_webhook_headers: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>>;
    delivery_sms_enabled: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    delivery_sms_message: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    delivery_sms_ai_generated: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    delivery_sms_ai_instructions: z.ZodOptional<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    workflow_name?: string | undefined;
    workflow_description?: string | undefined;
    steps?: {
        step_name: string;
        step_type: "ai_generation" | "webhook";
        tool_choice: "required" | "auto" | "none";
        step_description?: string | undefined;
        model?: string | undefined;
        instructions?: string | undefined;
        step_order?: number | undefined;
        depends_on?: number[] | undefined;
        tools?: (string | z.objectOutputType<{
            type: z.ZodString;
            display_width: z.ZodOptional<z.ZodNumber>;
            display_height: z.ZodOptional<z.ZodNumber>;
            environment: z.ZodOptional<z.ZodEnum<["browser", "mac", "windows", "ubuntu"]>>;
        }, z.ZodTypeAny, "passthrough">)[] | undefined;
        webhook_url?: string | undefined;
        webhook_headers?: Record<string, string> | undefined;
        webhook_data_selection?: {
            include_submission: boolean;
            include_job_info: boolean;
            exclude_step_indices?: number[] | undefined;
        } | undefined;
    }[] | undefined;
    template_id?: string | undefined;
    template_version?: number | undefined;
    folder_id?: string | null | undefined;
    delivery_method?: "webhook" | "none" | "sms" | undefined;
    delivery_webhook_url?: string | undefined;
    delivery_webhook_headers?: Record<string, string> | undefined;
    delivery_sms_enabled?: boolean | undefined;
    delivery_sms_message?: string | undefined;
    delivery_sms_ai_generated?: boolean | undefined;
    delivery_sms_ai_instructions?: string | undefined;
}, {
    workflow_name?: string | undefined;
    workflow_description?: string | undefined;
    steps?: {
        step_name: string;
        step_description?: string | undefined;
        step_type?: "ai_generation" | "webhook" | undefined;
        model?: string | undefined;
        instructions?: string | undefined;
        step_order?: number | undefined;
        depends_on?: number[] | undefined;
        tools?: (string | z.objectInputType<{
            type: z.ZodString;
            display_width: z.ZodOptional<z.ZodNumber>;
            display_height: z.ZodOptional<z.ZodNumber>;
            environment: z.ZodOptional<z.ZodEnum<["browser", "mac", "windows", "ubuntu"]>>;
        }, z.ZodTypeAny, "passthrough">)[] | undefined;
        tool_choice?: "required" | "auto" | "none" | undefined;
        webhook_url?: string | undefined;
        webhook_headers?: Record<string, string> | undefined;
        webhook_data_selection?: {
            include_submission?: boolean | undefined;
            exclude_step_indices?: number[] | undefined;
            include_job_info?: boolean | undefined;
        } | undefined;
    }[] | undefined;
    template_id?: string | undefined;
    template_version?: number | undefined;
    folder_id?: string | null | undefined;
    delivery_method?: "webhook" | "none" | "sms" | undefined;
    delivery_webhook_url?: string | undefined;
    delivery_webhook_headers?: Record<string, string> | undefined;
    delivery_sms_enabled?: boolean | undefined;
    delivery_sms_message?: string | undefined;
    delivery_sms_ai_generated?: boolean | undefined;
    delivery_sms_ai_instructions?: string | undefined;
}>, {
    workflow_name?: string | undefined;
    workflow_description?: string | undefined;
    steps?: {
        step_name: string;
        step_type: "ai_generation" | "webhook";
        tool_choice: "required" | "auto" | "none";
        step_description?: string | undefined;
        model?: string | undefined;
        instructions?: string | undefined;
        step_order?: number | undefined;
        depends_on?: number[] | undefined;
        tools?: (string | z.objectOutputType<{
            type: z.ZodString;
            display_width: z.ZodOptional<z.ZodNumber>;
            display_height: z.ZodOptional<z.ZodNumber>;
            environment: z.ZodOptional<z.ZodEnum<["browser", "mac", "windows", "ubuntu"]>>;
        }, z.ZodTypeAny, "passthrough">)[] | undefined;
        webhook_url?: string | undefined;
        webhook_headers?: Record<string, string> | undefined;
        webhook_data_selection?: {
            include_submission: boolean;
            include_job_info: boolean;
            exclude_step_indices?: number[] | undefined;
        } | undefined;
    }[] | undefined;
    template_id?: string | undefined;
    template_version?: number | undefined;
    folder_id?: string | null | undefined;
    delivery_method?: "webhook" | "none" | "sms" | undefined;
    delivery_webhook_url?: string | undefined;
    delivery_webhook_headers?: Record<string, string> | undefined;
    delivery_sms_enabled?: boolean | undefined;
    delivery_sms_message?: string | undefined;
    delivery_sms_ai_generated?: boolean | undefined;
    delivery_sms_ai_instructions?: string | undefined;
}, {
    workflow_name?: string | undefined;
    workflow_description?: string | undefined;
    steps?: {
        step_name: string;
        step_description?: string | undefined;
        step_type?: "ai_generation" | "webhook" | undefined;
        model?: string | undefined;
        instructions?: string | undefined;
        step_order?: number | undefined;
        depends_on?: number[] | undefined;
        tools?: (string | z.objectInputType<{
            type: z.ZodString;
            display_width: z.ZodOptional<z.ZodNumber>;
            display_height: z.ZodOptional<z.ZodNumber>;
            environment: z.ZodOptional<z.ZodEnum<["browser", "mac", "windows", "ubuntu"]>>;
        }, z.ZodTypeAny, "passthrough">)[] | undefined;
        tool_choice?: "required" | "auto" | "none" | undefined;
        webhook_url?: string | undefined;
        webhook_headers?: Record<string, string> | undefined;
        webhook_data_selection?: {
            include_submission?: boolean | undefined;
            exclude_step_indices?: number[] | undefined;
            include_job_info?: boolean | undefined;
        } | undefined;
    }[] | undefined;
    template_id?: string | undefined;
    template_version?: number | undefined;
    folder_id?: string | null | undefined;
    delivery_method?: "webhook" | "none" | "sms" | undefined;
    delivery_webhook_url?: string | undefined;
    delivery_webhook_headers?: Record<string, string> | undefined;
    delivery_sms_enabled?: boolean | undefined;
    delivery_sms_message?: string | undefined;
    delivery_sms_ai_generated?: boolean | undefined;
    delivery_sms_ai_instructions?: string | undefined;
}>;
export declare const createFormSchema: z.ZodObject<{
    workflow_id: z.ZodString;
    form_name: z.ZodString;
    public_slug: z.ZodString;
    form_fields_schema: z.ZodObject<{
        fields: z.ZodArray<z.ZodObject<{
            field_id: z.ZodString;
            field_type: z.ZodEnum<["text", "textarea", "email", "tel", "number", "select", "checkbox", "radio"]>;
            label: z.ZodString;
            placeholder: z.ZodOptional<z.ZodString>;
            required: z.ZodBoolean;
            validation_regex: z.ZodOptional<z.ZodString>;
            max_length: z.ZodOptional<z.ZodNumber>;
            options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            required: boolean;
            field_id: string;
            field_type: "number" | "email" | "text" | "textarea" | "tel" | "select" | "checkbox" | "radio";
            label: string;
            options?: string[] | undefined;
            placeholder?: string | undefined;
            validation_regex?: string | undefined;
            max_length?: number | undefined;
        }, {
            required: boolean;
            field_id: string;
            field_type: "number" | "email" | "text" | "textarea" | "tel" | "select" | "checkbox" | "radio";
            label: string;
            options?: string[] | undefined;
            placeholder?: string | undefined;
            validation_regex?: string | undefined;
            max_length?: number | undefined;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        fields: {
            required: boolean;
            field_id: string;
            field_type: "number" | "email" | "text" | "textarea" | "tel" | "select" | "checkbox" | "radio";
            label: string;
            options?: string[] | undefined;
            placeholder?: string | undefined;
            validation_regex?: string | undefined;
            max_length?: number | undefined;
        }[];
    }, {
        fields: {
            required: boolean;
            field_id: string;
            field_type: "number" | "email" | "text" | "textarea" | "tel" | "select" | "checkbox" | "radio";
            label: string;
            options?: string[] | undefined;
            placeholder?: string | undefined;
            validation_regex?: string | undefined;
            max_length?: number | undefined;
        }[];
    }>;
    rate_limit_enabled: z.ZodDefault<z.ZodBoolean>;
    rate_limit_per_hour: z.ZodDefault<z.ZodNumber>;
    captcha_enabled: z.ZodDefault<z.ZodBoolean>;
    custom_css: z.ZodOptional<z.ZodString>;
    thank_you_message: z.ZodOptional<z.ZodString>;
    redirect_url: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    workflow_id: string;
    form_name: string;
    public_slug: string;
    form_fields_schema: {
        fields: {
            required: boolean;
            field_id: string;
            field_type: "number" | "email" | "text" | "textarea" | "tel" | "select" | "checkbox" | "radio";
            label: string;
            options?: string[] | undefined;
            placeholder?: string | undefined;
            validation_regex?: string | undefined;
            max_length?: number | undefined;
        }[];
    };
    rate_limit_enabled: boolean;
    rate_limit_per_hour: number;
    captcha_enabled: boolean;
    custom_css?: string | undefined;
    thank_you_message?: string | undefined;
    redirect_url?: string | undefined;
}, {
    workflow_id: string;
    form_name: string;
    public_slug: string;
    form_fields_schema: {
        fields: {
            required: boolean;
            field_id: string;
            field_type: "number" | "email" | "text" | "textarea" | "tel" | "select" | "checkbox" | "radio";
            label: string;
            options?: string[] | undefined;
            placeholder?: string | undefined;
            validation_regex?: string | undefined;
            max_length?: number | undefined;
        }[];
    };
    rate_limit_enabled?: boolean | undefined;
    rate_limit_per_hour?: number | undefined;
    captcha_enabled?: boolean | undefined;
    custom_css?: string | undefined;
    thank_you_message?: string | undefined;
    redirect_url?: string | undefined;
}>;
export declare const updateFormSchema: z.ZodObject<{
    workflow_id: z.ZodOptional<z.ZodString>;
    form_name: z.ZodOptional<z.ZodString>;
    public_slug: z.ZodOptional<z.ZodString>;
    form_fields_schema: z.ZodOptional<z.ZodObject<{
        fields: z.ZodArray<z.ZodObject<{
            field_id: z.ZodString;
            field_type: z.ZodEnum<["text", "textarea", "email", "tel", "number", "select", "checkbox", "radio"]>;
            label: z.ZodString;
            placeholder: z.ZodOptional<z.ZodString>;
            required: z.ZodBoolean;
            validation_regex: z.ZodOptional<z.ZodString>;
            max_length: z.ZodOptional<z.ZodNumber>;
            options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            required: boolean;
            field_id: string;
            field_type: "number" | "email" | "text" | "textarea" | "tel" | "select" | "checkbox" | "radio";
            label: string;
            options?: string[] | undefined;
            placeholder?: string | undefined;
            validation_regex?: string | undefined;
            max_length?: number | undefined;
        }, {
            required: boolean;
            field_id: string;
            field_type: "number" | "email" | "text" | "textarea" | "tel" | "select" | "checkbox" | "radio";
            label: string;
            options?: string[] | undefined;
            placeholder?: string | undefined;
            validation_regex?: string | undefined;
            max_length?: number | undefined;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        fields: {
            required: boolean;
            field_id: string;
            field_type: "number" | "email" | "text" | "textarea" | "tel" | "select" | "checkbox" | "radio";
            label: string;
            options?: string[] | undefined;
            placeholder?: string | undefined;
            validation_regex?: string | undefined;
            max_length?: number | undefined;
        }[];
    }, {
        fields: {
            required: boolean;
            field_id: string;
            field_type: "number" | "email" | "text" | "textarea" | "tel" | "select" | "checkbox" | "radio";
            label: string;
            options?: string[] | undefined;
            placeholder?: string | undefined;
            validation_regex?: string | undefined;
            max_length?: number | undefined;
        }[];
    }>>;
    rate_limit_enabled: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    rate_limit_per_hour: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    captcha_enabled: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    custom_css: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    thank_you_message: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    redirect_url: z.ZodOptional<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    workflow_id?: string | undefined;
    form_name?: string | undefined;
    public_slug?: string | undefined;
    form_fields_schema?: {
        fields: {
            required: boolean;
            field_id: string;
            field_type: "number" | "email" | "text" | "textarea" | "tel" | "select" | "checkbox" | "radio";
            label: string;
            options?: string[] | undefined;
            placeholder?: string | undefined;
            validation_regex?: string | undefined;
            max_length?: number | undefined;
        }[];
    } | undefined;
    rate_limit_enabled?: boolean | undefined;
    rate_limit_per_hour?: number | undefined;
    captcha_enabled?: boolean | undefined;
    custom_css?: string | undefined;
    thank_you_message?: string | undefined;
    redirect_url?: string | undefined;
}, {
    workflow_id?: string | undefined;
    form_name?: string | undefined;
    public_slug?: string | undefined;
    form_fields_schema?: {
        fields: {
            required: boolean;
            field_id: string;
            field_type: "number" | "email" | "text" | "textarea" | "tel" | "select" | "checkbox" | "radio";
            label: string;
            options?: string[] | undefined;
            placeholder?: string | undefined;
            validation_regex?: string | undefined;
            max_length?: number | undefined;
        }[];
    } | undefined;
    rate_limit_enabled?: boolean | undefined;
    rate_limit_per_hour?: number | undefined;
    captcha_enabled?: boolean | undefined;
    custom_css?: string | undefined;
    thank_you_message?: string | undefined;
    redirect_url?: string | undefined;
}>;
export declare const createTemplateSchema: z.ZodObject<{
    template_name: z.ZodString;
    template_description: z.ZodOptional<z.ZodString>;
    html_content: z.ZodString;
    placeholder_tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    is_published: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    template_name: string;
    html_content: string;
    is_published: boolean;
    template_description?: string | undefined;
    placeholder_tags?: string[] | undefined;
}, {
    template_name: string;
    html_content: string;
    template_description?: string | undefined;
    placeholder_tags?: string[] | undefined;
    is_published?: boolean | undefined;
}>;
export declare const updateTemplateSchema: z.ZodObject<{
    template_name: z.ZodOptional<z.ZodString>;
    template_description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    html_content: z.ZodOptional<z.ZodString>;
    placeholder_tags: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
    is_published: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    template_name?: string | undefined;
    template_description?: string | undefined;
    html_content?: string | undefined;
    placeholder_tags?: string[] | undefined;
    is_published?: boolean | undefined;
}, {
    template_name?: string | undefined;
    template_description?: string | undefined;
    html_content?: string | undefined;
    placeholder_tags?: string[] | undefined;
    is_published?: boolean | undefined;
}>;
export declare const createFolderSchema: z.ZodObject<{
    folder_name: z.ZodString;
}, "strip", z.ZodTypeAny, {
    folder_name: string;
}, {
    folder_name: string;
}>;
export declare const updateFolderSchema: z.ZodObject<{
    folder_name: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    folder_name?: string | undefined;
}, {
    folder_name?: string | undefined;
}>;
export declare const updateSettingsSchema: z.ZodObject<{
    organization_name: z.ZodOptional<z.ZodString>;
    contact_email: z.ZodOptional<z.ZodString>;
    website_url: z.ZodOptional<z.ZodString>;
    logo_url: z.ZodOptional<z.ZodString>;
    avatar_url: z.ZodOptional<z.ZodString>;
    branding_colors: z.ZodOptional<z.ZodObject<{
        primary: z.ZodString;
        secondary: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        primary: string;
        secondary: string;
    }, {
        primary: string;
        secondary: string;
    }>>;
    default_ai_model: z.ZodOptional<z.ZodString>;
    webhooks: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    ghl_webhook_url: z.ZodOptional<z.ZodString>;
    lead_phone_field: z.ZodOptional<z.ZodString>;
    brand_description: z.ZodOptional<z.ZodString>;
    brand_voice: z.ZodOptional<z.ZodString>;
    target_audience: z.ZodOptional<z.ZodString>;
    company_values: z.ZodOptional<z.ZodString>;
    industry: z.ZodOptional<z.ZodString>;
    company_size: z.ZodOptional<z.ZodString>;
    brand_messaging_guidelines: z.ZodOptional<z.ZodString>;
    icp_document_url: z.ZodOptional<z.ZodString>;
    onboarding_survey_completed: z.ZodOptional<z.ZodBoolean>;
    onboarding_survey_responses: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    onboarding_checklist: z.ZodOptional<z.ZodObject<{
        complete_profile: z.ZodOptional<z.ZodBoolean>;
        create_first_lead_magnet: z.ZodOptional<z.ZodBoolean>;
        view_generated_lead_magnets: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        complete_profile?: boolean | undefined;
        create_first_lead_magnet?: boolean | undefined;
        view_generated_lead_magnets?: boolean | undefined;
    }, {
        complete_profile?: boolean | undefined;
        create_first_lead_magnet?: boolean | undefined;
        view_generated_lead_magnets?: boolean | undefined;
    }>>;
    onboarding_completed_at: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    organization_name?: string | undefined;
    contact_email?: string | undefined;
    website_url?: string | undefined;
    logo_url?: string | undefined;
    avatar_url?: string | undefined;
    branding_colors?: {
        primary: string;
        secondary: string;
    } | undefined;
    default_ai_model?: string | undefined;
    webhooks?: string[] | undefined;
    ghl_webhook_url?: string | undefined;
    lead_phone_field?: string | undefined;
    brand_description?: string | undefined;
    brand_voice?: string | undefined;
    target_audience?: string | undefined;
    company_values?: string | undefined;
    industry?: string | undefined;
    company_size?: string | undefined;
    brand_messaging_guidelines?: string | undefined;
    icp_document_url?: string | undefined;
    onboarding_survey_completed?: boolean | undefined;
    onboarding_survey_responses?: Record<string, any> | undefined;
    onboarding_checklist?: {
        complete_profile?: boolean | undefined;
        create_first_lead_magnet?: boolean | undefined;
        view_generated_lead_magnets?: boolean | undefined;
    } | undefined;
    onboarding_completed_at?: string | undefined;
}, {
    organization_name?: string | undefined;
    contact_email?: string | undefined;
    website_url?: string | undefined;
    logo_url?: string | undefined;
    avatar_url?: string | undefined;
    branding_colors?: {
        primary: string;
        secondary: string;
    } | undefined;
    default_ai_model?: string | undefined;
    webhooks?: string[] | undefined;
    ghl_webhook_url?: string | undefined;
    lead_phone_field?: string | undefined;
    brand_description?: string | undefined;
    brand_voice?: string | undefined;
    target_audience?: string | undefined;
    company_values?: string | undefined;
    industry?: string | undefined;
    company_size?: string | undefined;
    brand_messaging_guidelines?: string | undefined;
    icp_document_url?: string | undefined;
    onboarding_survey_completed?: boolean | undefined;
    onboarding_survey_responses?: Record<string, any> | undefined;
    onboarding_checklist?: {
        complete_profile?: boolean | undefined;
        create_first_lead_magnet?: boolean | undefined;
        view_generated_lead_magnets?: boolean | undefined;
    } | undefined;
    onboarding_completed_at?: string | undefined;
}>;
export declare const submitFormSchema: z.ZodObject<{
    submission_data: z.ZodEffects<z.ZodRecord<z.ZodString, z.ZodAny>, Record<string, any>, Record<string, any>>;
}, "strip", z.ZodTypeAny, {
    submission_data: Record<string, any>;
}, {
    submission_data: Record<string, any>;
}>;
export declare const webhookRequestSchema: z.ZodEffects<z.ZodObject<{
    workflow_id: z.ZodOptional<z.ZodString>;
    workflow_name: z.ZodOptional<z.ZodString>;
    form_data: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    submission_data: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, "strip", z.ZodTypeAny, {
    workflow_name?: string | undefined;
    workflow_id?: string | undefined;
    submission_data?: Record<string, any> | undefined;
    form_data?: Record<string, any> | undefined;
}, {
    workflow_name?: string | undefined;
    workflow_id?: string | undefined;
    submission_data?: Record<string, any> | undefined;
    form_data?: Record<string, any> | undefined;
}>, {
    workflow_name?: string | undefined;
    workflow_id?: string | undefined;
    submission_data?: Record<string, any> | undefined;
    form_data?: Record<string, any> | undefined;
}, {
    workflow_name?: string | undefined;
    workflow_id?: string | undefined;
    submission_data?: Record<string, any> | undefined;
    form_data?: Record<string, any> | undefined;
}>;
/**
 * Validate data against a Zod schema.
 *
 * Parses and validates data using a Zod schema, throwing a ValidationError
 * if validation fails. This provides consistent error handling across the application.
 *
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @returns Validated and typed data
 * @throws {ValidationError} If validation fails
 *
 * @example
 * ```typescript
 * try {
 *   const workflow = validate(createWorkflowSchema, requestBody);
 *   // workflow is now typed and validated
 * } catch (error) {
 *   if (error instanceof ValidationError) {
 *     // Handle validation error
 *   }
 * }
 * ```
 */
export declare const validate: <T>(schema: z.ZodSchema<T>, data: unknown) => T;
/**
 * Safe validation that returns errors instead of throwing
 */
export declare const safeValidate: <T>(schema: z.ZodSchema<T>, data: unknown) => {
    success: true;
    data: T;
} | {
    success: false;
    errors: z.ZodError["errors"];
};
//# sourceMappingURL=validation.d.ts.map