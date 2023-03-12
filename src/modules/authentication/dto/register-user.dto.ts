import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  Validate,
} from 'class-validator';
import { EmailAlreadyExist } from '../../../custom_validation/email-already-exists.rule';

export class RegisterUserDto {
  @Transform(({ value }) => value?.trim())
  @IsNotEmpty()
  @IsEmail()
  @Validate(EmailAlreadyExist)
  email: string;

  @Transform(({ value }) => value?.trim())
  @IsNotEmpty()
  @IsString()
  @MinLength(2)
  name: string;

  @Transform(({ value }) => value?.trim())
  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  password: string;
}
