import { HttpException, HttpStatus } from '@nestjs/common';

const reject = (status: HttpStatus, code: string, message: string) => new HttpException({ code, message }, status);

export const unsupportedImage = () =>
  reject(HttpStatus.UNSUPPORTED_MEDIA_TYPE, 'UNSUPPORTED_IMAGE', 'La foto no es un JPEG, PNG o WebP válido.');

export const imageTooLarge = () =>
  reject(HttpStatus.UNPROCESSABLE_ENTITY, 'IMAGE_TOO_LARGE', 'La foto supera los 40 megapíxeles.');

export const invalidModel = (reason: string) =>
  reject(HttpStatus.UNPROCESSABLE_ENTITY, 'INVALID_MODEL', `El modelo 3D no se puede usar: ${reason}.`);

export const fileTooLarge = () =>
  reject(HttpStatus.PAYLOAD_TOO_LARGE, 'FILE_TOO_LARGE', 'El archivo supera el tamaño permitido.');
