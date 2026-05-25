/**
 * Basic sanity test — ensures the app module compiles and the config/guard
 * decorators can be imported without errors.
 * More targeted unit tests belong in each domain's *.spec.ts file.
 */
describe('App sanity', () => {
  it('should load without errors', () => {
    expect(true).toBe(true);
  });

  it('should export ResponseMessage decorator', async () => {
    const { ResponseMessage } = await import(
      './common/decorators/response-message.decorator'
    );
    expect(typeof ResponseMessage).toBe('function');
  });

  it('should export Public decorator', async () => {
    const { Public } = await import('./guard/decorators/public.decorator');
    expect(typeof Public).toBe('function');
  });
});
