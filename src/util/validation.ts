import validator from 'validator';
import { ResponseItem } from './response';
import { isUserUnique } from '../db/users';
import Logger from './logger';

const validationErrors: Array<ResponseItem> = [];

const clearErrors = () => {
  validationErrors.length = 0;
};

const isValidUsername = async (username: string): Promise<boolean> => {
  try {
    // Is username unique
    const isUnique: boolean = await isUserUnique(username);
    if (!isUnique) {
      validationErrors.push({ name: 'username_exists', message: 'Username already exists' });
      return false;
    }

    // Is username length between 3-255
    if (!(validator.isLength(username, { min: 3, max: 255 }))) {
      validationErrors.push({ name: 'username_length_invalid', message: 'Username length should be between 3-255 characters' });
      return false;
    }
  } catch (err) {
    Logger.error(err);
    return false;
  }

  return true;
};
const isValidPassword = (password: string, password2: string): boolean => {
  try {
    if (!(password === password2)) {
      validationErrors.push({ name: 'passwords_dont_match', message: 'Passwords don\'t match' });
      return false;
    }

    // Is password length between 8-255 characters
    if (!(validator.isLength(password, { min: 8, max: 255 }))) {
      validationErrors.push({ name: 'password_length_invalid', message: 'Password length should be between 8-255 characters' });
      return false;
    }

    // Checks if password meets the requirements
    if (!(validator.isStrongPassword(password, {
      minSymbols: 0,
      minUppercase: 0,
      minNumbers: 0,
    }))) {
      validationErrors.push({ name: 'password_invalid', message: 'Password doesn\'t meet the requirements' });
      return false;
    }
  } catch (err) {
    Logger.error(err);
    return false;
  }

  return true;
};

/**
 *
 * @param username {string} Username
 * @param password {string} User password
 * @returns {boolean} true if username and passwords are valid
 */
const validateCredientials = async (
  username: string,
  password: string,
  password2: string,
): Promise<boolean> => {
  if (!(await isValidUsername(username))) return false;
  if (!isValidPassword(password, password2)) return false;
  return true;
};

export {
  isValidUsername,
  isValidPassword,
  validateCredientials,
  validationErrors,
  clearErrors,
};
