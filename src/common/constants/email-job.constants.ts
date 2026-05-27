/**
 * Enum of all job names on the email BullMQ queue.
 *
 * Using an enum (rather than bare string literals) ensures that producers and
 * processors stay in sync and typos are caught at compile time.
 */
export enum EmailJobName {
  WELCOME = 'welcome',
  VERIFY_EMAIL = 'verify-email',
  ACCOUNT_EXISTS_NOTICE = 'account-exists-notice',
  PASSWORD_RESET = 'password-reset',
}
