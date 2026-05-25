import { SetMetadata } from '@nestjs/common';

export const RESPONSE_MESSAGE_KEY = 'response_message';

/**
 * Sets a custom success message that TransformInterceptor picks up.
 * Usage: @ResponseMessage('User created successfully')
 */
export const ResponseMessage = (message: string) =>
  SetMetadata(RESPONSE_MESSAGE_KEY, message);
