/**
 * Custom error for CLI commands.
 * Thrown instead of calling process.exit() directly.
 * Caught by the CLI entry point to exit with proper codes.
 */
export class CliError extends Error {
  constructor(
    message: string,
    public readonly exitCode: number = 1,
  ) {
    super(message);
    this.name = 'CliError';
  }
}
