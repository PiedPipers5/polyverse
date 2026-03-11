import openApiSpec from '../../../../docs/openapi.json';

export function GET() {
	return Response.json(openApiSpec);
}