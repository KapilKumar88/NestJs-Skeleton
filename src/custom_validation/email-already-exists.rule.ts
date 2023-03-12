import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { UserService } from '../modules/user/user.service';

@ValidatorConstraint({ name: 'emailAlreadyExist', async: true })
export class EmailAlreadyExist implements ValidatorConstraintInterface {
  constructor(private readonly userService: UserService) {}

  async validate(email: string, _args: ValidationArguments) {
    try {
      const result = await this.userService.checkEmailExists(email);
      return result === 0 ? true : false;
    } catch (error) {
      return false;
    }
  }

  defaultMessage(_args: ValidationArguments) {
    return 'Email already taken try with other.';
  }
}
