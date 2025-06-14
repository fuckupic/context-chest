import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

const validation: FastifyPluginAsync = async (fastify) => {
  fastify.setValidatorCompiler(({ schema }) => {
    return (data) => {
      try {
        const result = schema.parse(data);
        return { value: result };
      } catch (error) {
        if (error instanceof z.ZodError) {
          const issues = error.issues.map((issue) => ({
            code: 'VALIDATION_ERROR',
            field: issue.path.join('.'),
            message: issue.message,
          }));
          return { error: issues };
        }
        throw error;
      }
    };
  });

  fastify.setSerializerCompiler(({ schema }) => {
    return (data) => {
      try {
        const result = schema.parse(data);
        return JSON.stringify(result);
      } catch (error) {
        if (error instanceof z.ZodError) {
          const issues = error.issues.map((issue) => ({
            code: 'VALIDATION_ERROR',
            field: issue.path.join('.'),
            message: issue.message,
          }));
          throw fastify.httpErrors.badRequest(JSON.stringify(issues));
        }
        throw error;
      }
    };
  });
};

export default fp(validation);

// Common schemas
export const emailSchema = z.string().email();
export const passwordSchema = z.string().min(8);
export const clientIdSchema = z.string().min(1);
export const clientSecretSchema = z.string().min(1);
export const scopeSchema = z.array(z.enum(['vault.read', 'vault.write']));
export const blobHashSchema = z.string().length(64); 