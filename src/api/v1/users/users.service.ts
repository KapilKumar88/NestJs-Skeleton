import { Injectable, NotFoundException } from '@nestjs/common';
import { UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  /**
   * Returns the authenticated user's profile (no sensitive fields).
   */
  async findById(id: number) {
    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  /**
   * Used by the EmailAlreadyExist class-validator rule.
   * Returns the count of users with the given email (0 = available).
   */
  async checkEmailExists(email: string): Promise<number> {
    return this.usersRepository.countByEmail(email);
  }
}
