import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ApiErrorCode } from '@wayfinder/domain';
import { ApiExceptionFilter } from './api-exception.filter';

describe('ApiExceptionFilter', () => {
  const filter = new ApiExceptionFilter();

  it('gives a bare Nest exception the code for its status', () => {
    expect(
      filter.toErrorResponse(new NotFoundException('No such project')),
    ).toEqual([
      404,
      { code: ApiErrorCode.NotFound, message: 'No such project' },
    ]);
  });

  it('keeps a code the thrower chose, with its details', () => {
    const thrown = new ConflictException({
      code: ApiErrorCode.SlugTaken,
      message: 'Slug "x" is taken',
      details: { slug: 'x' },
    });
    expect(filter.toErrorResponse(thrown)).toEqual([
      409,
      {
        code: ApiErrorCode.SlugTaken,
        message: 'Slug "x" is taken',
        details: { slug: 'x' },
      },
    ]);
  });

  it('lists each ValidationPipe failure under details', () => {
    const thrown = new BadRequestException([
      'title must be a string',
      'slug should not be empty',
    ]);
    expect(filter.toErrorResponse(thrown)).toEqual([
      400,
      {
        code: ApiErrorCode.ValidationFailed,
        message: 'Validation failed',
        details: {
          errors: ['title must be a string', 'slug should not be empty'],
        },
      },
    ]);
  });

  it('logs a 5xx the code threw on purpose', () => {
    const logged = silenceErrorLog();
    filter.toErrorResponse(
      new HttpException('Upstream down', HttpStatus.BAD_GATEWAY),
    );
    expect(logged).toHaveBeenCalledTimes(1);
  });

  it('does not log a client error', () => {
    const logged = silenceErrorLog();
    filter.toErrorResponse(new NotFoundException());
    expect(logged).not.toHaveBeenCalled();
  });

  it('falls back by status class when nothing more specific applies', () => {
    silenceErrorLog();
    expect(
      filter.toErrorResponse(new HttpException('Gone', HttpStatus.GONE))[1]
        .code,
    ).toBe(ApiErrorCode.BadRequest);
    expect(
      filter.toErrorResponse(
        new HttpException('Down', HttpStatus.BAD_GATEWAY),
      )[1].code,
    ).toBe(ApiErrorCode.Internal);
  });

  it('hides an unexpected error from the client and logs it', () => {
    const logged = silenceErrorLog();
    expect(
      filter.toErrorResponse(new Error('relation "secrets" does not exist')),
    ).toEqual([
      500,
      { code: ApiErrorCode.Internal, message: 'Internal server error' },
    ]);
    expect(logged).toHaveBeenCalledWith(
      expect.stringContaining('relation "secrets"'),
    );
  });
});

function silenceErrorLog(): ReturnType<typeof vi.spyOn> {
  return vi
    .spyOn(Logger.prototype, 'error')
    .mockImplementation(() => undefined);
}
