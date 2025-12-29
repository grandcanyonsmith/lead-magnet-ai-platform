jest.mock('../../services/openaiService', () => ({
  getOpenAIClient: jest.fn(),
}));

jest.mock('../../services/shellExecutorService', () => ({
  runShellExecutorJob: jest.fn(),
}));

describe('shellToolLoopService', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('executes shell_call via executor and returns final output_text', async () => {
    const { getOpenAIClient } = await import('../../services/openaiService');
    const { runShellExecutorJob } = await import('../../services/shellExecutorService');
    const { runShellToolLoop } = await import('../../services/shellToolLoopService');

    const responsesCreate = jest
      .fn()
      .mockResolvedValueOnce({
        id: 'resp_1',
        output: [
          {
            type: 'shell_call',
            call_id: 'call_1',
            action: {
              commands: ['echo hello'],
              timeout_ms: 1000,
              max_output_length: 4096,
            },
            status: 'in_progress',
          },
        ],
      })
      .mockResolvedValueOnce({
        id: 'resp_2',
        output: [],
        output_text: 'done',
      });

    (getOpenAIClient as any).mockResolvedValue({
      responses: { create: responsesCreate },
    });

    (runShellExecutorJob as any).mockResolvedValue({
      version: '2025-12-29',
      job_id: 'job_1',
      max_output_length: 4096,
      output: [
        {
          stdout: 'hello\n',
          stderr: '',
          outcome: { type: 'exit', exit_code: 0 },
        },
      ],
    });

    const result = await runShellToolLoop({
      input: 'say hello using the shell tool',
      model: 'gpt-5.1',
      maxSteps: 5,
    });

    expect(result.outputText).toBe('done');
    expect(responsesCreate).toHaveBeenCalledTimes(2);

    // Follow-up call should include shell_call_output with the max_output_length and output array.
    const followUpArgs = (responsesCreate as any).mock.calls[1][0];
    expect(followUpArgs.previous_response_id).toBe('resp_1');
    expect(Array.isArray(followUpArgs.input)).toBe(true);
    expect(followUpArgs.input[0]).toMatchObject({
      type: 'shell_call_output',
      call_id: 'call_1',
      max_output_length: 4096,
      output: [
        {
          stdout: 'hello\n',
          stderr: '',
          outcome: { type: 'exit', exit_code: 0 },
        },
      ],
    });
  });

  it('throws when shell tool is disabled', async () => {
    const original = process.env.SHELL_TOOL_ENABLED;
    process.env.SHELL_TOOL_ENABLED = 'false';

    // Reload env singleton with updated env var
    jest.resetModules();
    const { runShellToolLoop } = await import('../../services/shellToolLoopService');

    await expect(runShellToolLoop({ input: 'x' })).rejects.toMatchObject({
      name: 'ApiError',
      statusCode: 404,
      message: 'Shell tool is disabled',
    });

    process.env.SHELL_TOOL_ENABLED = original;
  });
});


