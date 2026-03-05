import chalk from 'chalk';
import { readHistory } from '../core/history-manager.js';

export function showHistory(options: { limit?: number } = {}): void {
  const history = readHistory();

  if (history.length === 0) {
    console.log(chalk.gray('\n  No session history yet.\n'));
    return;
  }

  const limit = options.limit ?? 10;
  const recent = history.slice(-limit);

  console.log(chalk.bold(`\n  Session History (${recent.length}/${history.length})\n`));

  for (const session of recent) {
    const date = session.completedAt ? new Date(session.completedAt).toLocaleDateString() : '?';
    const oopsLabel =
      session.oopsCount === 0 ? chalk.green('0 oops') : chalk.yellow(`${session.oopsCount} oops`);
    const testLabel = `${session.testResults.passed}/${session.testResults.total} tests`;

    console.log(`  ${chalk.cyan(session.featureName)}`);
    console.log(`    ${chalk.gray(date)}  ${oopsLabel}  ${testLabel}`);
  }

  // Summary stats
  const totalOops = history.reduce((sum, s) => sum + s.oopsCount, 0);
  const totalSessions = history.length;
  const avgOops = totalSessions > 0 ? (totalOops / totalSessions).toFixed(1) : '0';

  console.log(chalk.bold('\n  Summary'));
  console.log(`  Total sessions:  ${chalk.cyan(String(totalSessions))}`);
  console.log(`  Total oops:      ${chalk.yellow(String(totalOops))}`);
  console.log(`  Avg oops/session: ${chalk.cyan(avgOops)}`);
  console.log();
}
