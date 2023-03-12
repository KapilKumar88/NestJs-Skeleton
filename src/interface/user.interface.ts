export interface User {
  email?: string;
  name?: string;
  password?: string;
  last_login?: Date | string | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  deletedAt?: Date | string | null;
}
