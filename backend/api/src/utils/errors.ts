export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const handleError = (error: unknown): { statusCode: number; body: any } => {
  if (error instanceof ApiError) {
    return {
      statusCode: error.statusCode,
      body: {
        error: error.message,
        code: error.code,
      },
    };
  }

  if (error instanceof Error) {
    return {
      statusCode: 500,
      body: {
        error: 'Internal server error',
        message: error.message,
      },
    };
  }

  return {
    statusCode: 500,
    body: {
      error: 'Unknown error occurred',
    },
  };
};

